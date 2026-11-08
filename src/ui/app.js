// The application shell, laid out as DEDALO's: a dark command bar (the sections toggle, the
// title, Save, the File menu), a sections panel that slides in or stays pinned, a crumbs row,
// the page, a status row. One session in memory — the database and, once a specification is
// open, the job; every action goes through `update`, which re-renders the current page.
import { APP_NAME, APP_VERSION } from '../version.js';
import { createSession, openSpecification, loadJob, addNotes, loadExtension, meta } from '../model/session.js';
import { readEmbedded, saveFile, jobEnvelope, readJobEnvelope } from '../io/file.js';
import { downloadJson, fileName } from '../io/exports.js';
import { importTable, importDb, exportDb } from '../model/db.js';
import { progress, buildQuote } from '../model/project.js';
import { h, clear, append, button, pickFile, confirmDialog } from './dom.js';
import { money } from './sections/common.js';
import { SECTIONS, GROUPS, PLACES } from './sections/index.js';
import { checkForUpdates, updateOverdue, updateReminderButton, reminderText } from './update.js';

const PIN_KEY = 'vlc.nav.pinned';
const readPinned = () => { try { return localStorage.getItem(PIN_KEY) === '1'; } catch { return false; } };
const writePinned = (v) => { try { localStorage.setItem(PIN_KEY, v ? '1' : '0'); } catch { /* private mode: the pin just does not persist */ } };

export function start(root) {
  const embedded = readEmbedded();
  const state = { session: createSession({ db: embedded.db, job: embedded.job }), ui: { section: 'project', sub: {}, filters: {}, selected: {}, details: {} }, toast: null };
  const nav = { open: false, pinned: readPinned() };
  const ctx = {
    get session() { return state.session; }, get ui() { return state.ui; },
    update: (fn) => { try { if (fn) fn(state); } catch (e) { toast('err', String(e.message || e)); console.error(e); } render(); },
    go: (section, sub) => { state.ui.section = section; if (sub) state.ui.sub[section] = sub; setNav(false); render(); },
    notify: (kind, text) => toast(kind, text),
    meta: () => meta(state.session),
  };
  let toastTimer = null;
  function toast(kind, text) { state.toast = { kind, text }; clearTimeout(toastTimer); toastTimer = setTimeout(() => { state.toast = null; renderStatus(); }, 8000); renderStatus(); }

  const bar = h('header', { class: 'toolbar' });
  const sidebar = h('nav', { class: 'sidebar', id: 'vlc-nav', 'aria-label': 'Sections' });
  const scrim = h('div', { class: 'nav-scrim', onclick: () => setNav(false) });
  const crumbs = h('div', { class: 'crumbs' });
  const main = h('main', { class: 'main' });
  const status = h('footer', { class: 'statusbar' });
  append(clear(root), [h('div', { class: 'app' }, bar, crumbs, h('div', { class: 'workspace' }, sidebar, scrim, main), status)]);

  // ---- file actions ------------------------------------------------------------------------------
  const guarded = (fn) => async (...args) => { try { await fn(...args); } catch (e) { toast('err', String(e.message || e)); console.error(e); } render(); };
  const confirmLeave = () => !state.session.job || !state.session.dirty || confirmDialog('The current project has unsaved changes. Continue anyway?');
  // The file dialog answers later than the click: the page is drawn again when the text arrives, not when the dialog opens.
  const openSpec = () => pickFile('.html,.json', guarded((text, name) => { if (!confirmLeave()) return; openText(text, name); }));
  const importJob = () => pickFile('.json', guarded((text, name) => { if (!confirmLeave()) return; openText(text, name); }));
  const importDatabase = () => pickFile('.json', guarded((text, name) => { const data = JSON.parse(text); if (!String(data.format || '').startsWith('vulcano-db')) throw new Error(`${name} is not a whole-database file (vulcano-db/1); a single table is imported on the Database page.`); if (!confirmDialog('Replace the whole database with this file? The current tables are lost unless saved elsewhere.')) return; state.session.db = importDb(data); state.session.dirty = true; toast('ok', 'Database replaced.'); }));
  const openText = (text, name) => {
    let format = '';
    if (!/^\s*<!doctype html|^\s*<html/i.test(text.slice(0, 300))) { try { format = String(JSON.parse(text).format || ''); } catch { /* the reader will say */ } }
    if (format.startsWith('vulcano-job')) { const { job, notes } = readJobEnvelope(text); loadJob(state.session, job); state.session.dirty = true; state.ui.section = 'project'; toast(notes.length ? 'warn' : 'ok', `Project ${name} imported.${notes.length ? ' ' + notes.join(' ') : ''}`); return; }
    if (format.startsWith('vulcano-db')) { if (!confirmDialog('Replace the whole database with this file?')) return; state.session.db = importDb(JSON.parse(text)); state.session.dirty = true; toast('ok', 'Database replaced.'); return; }
    for (const [prefix, table] of [['vulcano-catalogue', 'instruments'], ['vulcano-parts', 'parts'], ['vulcano-ratecard', 'rates'], ['vulcano-items', 'items']]) {
      if (format.startsWith(prefix)) { const r = importTable(state.session.db, table, JSON.parse(text)); state.session.dirty = true; toast('ok', `${name}: ${r.added} rows added, ${r.replaced} replaced into ${table}.`); return; }
    }
    if (format.startsWith('vulcano-kb')) { const r = loadExtension(state.session, JSON.parse(text), name); state.session.dirty = true; toast('ok', `Extension «${r.name}»: ${r.added} items added, ${r.replaced} replaced.${r.skipped.length ? ' Skipped: ' + r.skipped.join('; ') : ''}`); return; }
    if (format.startsWith('tsw-notes')) { const r = addNotes(state.session, text); toast('ok', `${name}: ${r.added} notes, proposed on the Questions page.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`); return; }
    if (/<script type="application\/json" id="vlc-/.test(text)) { toast('warn', 'That is a VULCANO file: open it by double click, it carries its own database and project.'); return; }
    const spec = openSpecification(state.session, text, name);
    state.ui.section = 'project';
    state.ui.selected = {};
    toast(spec.problems.length ? 'warn' : 'ok', `${name} opened: ${state.session.reqs.length} requirements to assign.${spec.problems.length ? ` ${spec.problems.length} import notes on the Project page.` : ''}`);
  };
  const save = guarded(() => { const s = state.session; saveFile({ db: s.db, job: s.job, identity: s.job ? meta(s).identity : null }); s.dirty = false; toast('ok', s.job ? 'Saved: a new copy of this file with the project and the database inside — it replaces the one on disk.' : 'Saved: a copy of the tool with your database inside.'); });
  const exportJob = guarded(() => { const s = state.session; if (!s.job) throw new Error('No project open.'); const withAssets = Object.keys(s.job.spec.assets || {}).length ? confirmDialog('Include the pictures of the specification? (Cancel keeps the file small.)') : false; downloadJson(jobEnvelope(s.job, { includeAssets: withAssets }), fileName(meta(s).identity, 'job', 'json')); toast('ok', 'Project exported as JSON.'); });
  const exportDatabase = guarded(() => { const s = state.session; downloadJson(exportDb(s.db, meta(s)), `${(s.db.name || 'database').replace(/[^A-Za-z0-9._-]+/g, '-')}.json`); toast('ok', 'Database exported as JSON.'); });
  ctx.actions = { openSpec, importJob, save, exportJob, exportDatabase, importDatabase };

  window.addEventListener('beforeunload', (e) => { if (state.session.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.addEventListener('drop', guarded(async (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) { const text = await f.text(); if (!confirmLeave()) return; openText(text, f.name); } }));
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });

  // ---- the sections panel: slides over the page, or stays pinned beside it --------------------------
  function setNav(open) { nav.open = open; drawNav(); }
  function togglePin() { nav.pinned = !nav.pinned; writePinned(nav.pinned); if (nav.pinned) nav.open = false; drawNav(); }
  function drawNav() {
    const shown = nav.pinned || nav.open;
    clear(sidebar).appendChild(h('div',
      h('div', { class: 'nav-head' }, h('span', { class: 'nav-head-title' }, 'Sections'),
        button('📌', togglePin, { class: `btn-icon nav-pin ${nav.pinned ? 'nav-pin-on' : ''}`, title: nav.pinned ? 'Unpin: the panel withdraws and comes out from the toggle' : 'Pin the panel open beside the page' }),
        button('✕', () => setNav(false), { class: 'btn-icon nav-close', title: 'Close' })),
      GROUPS.map((g) => h('div', { class: 'nav-group' }, h('div', { class: 'nav-title' }, g.title), g.items.map((id) => { const sec = SECTIONS.find((x) => x.id === id); const count = sec.count ? sec.count(ctx) : null; return h('button', { type: 'button', class: `nav-item ${state.ui.section === id ? 'nav-item-sel' : ''}`, onclick: () => ctx.go(id) }, h('span', sec.title), count ? h('span', { class: 'count' }, String(count)) : null); }))),
    ));
    sidebar.classList.toggle('nav-pinned', nav.pinned);
    sidebar.classList.toggle('nav-open', shown);
    scrim.classList.toggle('scrim-on', nav.open && !nav.pinned);
    for (const b of bar.querySelectorAll('.nav-toggle')) { b.classList.toggle('nav-toggle-on', shown); b.setAttribute('aria-expanded', shown ? 'true' : 'false'); }
  }

  // ---- the command bar ---------------------------------------------------------------------------
  function renderTop() {
    const s = state.session;
    const id = s.job ? meta(s).identity : null;
    append(clear(bar), [h('div', { class: 'toolbar-row' },
      h('button', { type: 'button', class: `nav-toggle ${nav.pinned || nav.open ? 'nav-toggle-on' : ''}`, title: 'Show the list of sections', 'aria-controls': 'vlc-nav', 'aria-expanded': String(nav.pinned || nav.open), onclick: () => setNav(!(nav.pinned || nav.open)) }, h('span', { class: 'burger' }, '☰'), h('span', { class: 'nav-toggle-text' }, 'Sections')),
      h('div', { class: 'toolbar-title' }, id
        ? [h('strong', [id.documentCode, id.title].filter(Boolean).join(' — ') || 'Specification'), h('span', { class: 'muted' }, ` Rev. ${id.revision || '—'}`)]
        : [h('strong', APP_NAME), h('span', { class: 'muted' }, ` no project open — File ▸ Open a specification, or drop one here`)]),
      h('div', { class: 'toolbar-actions' },
        // Where the side rail sits in DEDALO: a way back to the project from anywhere else, one click.
        s.job && state.ui.section !== 'project' ? button('📄', () => ctx.go('project'), { class: 'btn-icon', title: 'Back to the project' }) : null,
        // Save as an icon, primary and orange when there is something to save: the bar is read a hundred times a day.
        button('💾', save, { class: `btn-icon btn-act btn-primary ${s.dirty ? 'btn-unsaved' : ''}`, title: s.dirty ? 'Save — there are unsaved changes (Ctrl+S)' : 'Save: download the updated file (Ctrl+S)' }),
        menu('File ▾', [
          ['Open a specification…', openSpec, { title: 'A DEDALO document (.html), its data export or an authoring file: a new, empty project over it' }],
          null,
          ['Export the project (JSON)', exportJob, { disabled: !s.job, title: 'vulcano-job/1: the project as data, to hand over or to import into another copy' }],
          ['Import a project…', importJob, { title: 'A vulcano-job file exported from a copy of this tool' }],
          null,
          ['Export the database (JSON)', exportDatabase, { title: 'vulcano-db/1: every table, to share between copies' }],
          ['Import a database…', importDatabase, { title: 'Replaces every table with the file’s' }],
          null,
          ['Check for updates…', () => checkForUpdates(ctx), { title: 'Asks the project’s page which build is the latest — only when you choose this; nothing is ever checked on its own' }],
        ], { title: 'Open, export, import, check for updates' })),
      s.dirty ? h('div', { class: 'unsaved-banner' }, h('strong', '● Unsaved changes'), h('span', 'the file on disk is still the previous one. Saving downloads the updated file, which replaces it.'), button('Save now', save, { class: 'small' })) : null,
    )]);
  }

  /** A drop-down of actions, as DEDALO's File menu: closed by a choice, a click outside or Escape. */
  function menu(label, items, options = {}) {
    const list = h('div', { class: 'menu-list', role: 'menu' });
    const trigger = h('button', { type: 'button', class: 'menu-trigger', title: options.title, 'aria-haspopup': 'true', 'aria-expanded': 'false' }, label);
    const wrap = h('div', { class: 'menu' }, trigger, list);
    const close = () => { wrap.classList.remove('menu-open'); trigger.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', onOutside, true); document.removeEventListener('keydown', onKey, true); };
    const onOutside = (ev) => { if (!wrap.contains(ev.target)) close(); };
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    const open = () => { wrap.classList.add('menu-open'); trigger.setAttribute('aria-expanded', 'true'); document.addEventListener('pointerdown', onOutside, true); document.addEventListener('keydown', onKey, true); };
    trigger.addEventListener('click', () => (wrap.classList.contains('menu-open') ? close() : open()));
    for (const item of items) {
      if (!item) { list.appendChild(h('div', { class: 'menu-sep' })); continue; }
      const [text, action, opts = {}] = item;
      list.appendChild(h('button', { type: 'button', class: 'menu-item', title: opts.title, disabled: opts.disabled, onclick: () => { close(); action(); } }, text));
    }
    return wrap;
  }

  // ---- crumbs: where the page sits, with the siblings a hover away --------------------------------
  function renderCrumbs() {
    const place = PLACES.get(state.ui.section) || PLACES.get('project');
    const group = GROUPS.find((g) => g.id === place.groupId);
    const sub = state.ui.sub[state.ui.section];
    const secDef = SECTIONS.find((x) => x.id === state.ui.section);
    const subLabel = sub && secDef.tabs ? (secDef.tabs.find((t) => t[0] === sub) || [])[1] : '';
    append(clear(crumbs), [
      h('button', { type: 'button', class: 'crumb crumb-static', title: 'Show the list of sections', onclick: () => setNav(true) }, '☰'),
      h('span', { class: 'crumb-sep' }, '›'),
      h('span', { class: 'crumb-wrap' }, h('span', { class: 'crumb crumb-static' }, group.title), h('div', { class: 'crumb-menu' }, group.items.map((id) => h('button', { type: 'button', class: `crumb-menu-item ${id === state.ui.section ? 'crumb-menu-current' : ''}`, onclick: () => ctx.go(id) }, SECTIONS.find((x) => x.id === id).title)))),
      h('span', { class: 'crumb-sep' }, '›'),
      h('span', { class: 'crumb crumb-here' }, place.label),
      subLabel ? [h('span', { class: 'crumb-sep' }, '›'), h('span', { class: 'crumb-wrap' }, h('span', { class: 'crumb crumb-static' }, subLabel), h('div', { class: 'crumb-menu' }, secDef.tabs.map(([k, l]) => h('button', { type: 'button', class: `crumb-menu-item ${k === sub ? 'crumb-menu-current' : ''}`, onclick: () => ctx.go(state.ui.section, k) }, l))))] : null,
    ]);
  }

  function renderMain() {
    const sec = SECTIONS.find((x) => x.id === state.ui.section) || SECTIONS[0];
    const scroll = main.scrollTop;
    clear(main);
    try { main.appendChild(sec.render(ctx)); } catch (e) { console.error(e); main.appendChild(h('div', { class: 'notice err' }, `This page could not be drawn: ${e.message}`)); }
    main.scrollTop = scroll;
  }

  // ---- the status row: saved or not, where the job stands, what the database holds ------------------
  function renderStatus() {
    const s = state.session;
    const p = s.job ? progress(s.job, s.reqs) : null;
    const q = s.job ? buildQuote({ db: s.db, job: s.job, reqs: s.reqs, meta: meta(s) }) : null;
    const open = s.job ? s.job.questions.filter((x) => x.status === 'open' || x.status === 'asked').length : 0;
    append(clear(status), [h('div', { class: `status-row ${s.dirty ? 'status-dirty' : ''}` },
      h('span', s.dirty ? '● Unsaved changes' : '✓ Saved'),
      p ? h('button', { type: 'button', class: 'status-link', onclick: () => ctx.go('project') }, `${p.done} of ${p.total} assigned`) : null,
      q ? h('button', { type: 'button', class: 'status-link', onclick: () => ctx.go('quote') }, `Quote ${money(q.total, s.db.currency)}${q.unassigned.length ? ' so far' : ''}`) : null,
      s.job ? h('button', { type: 'button', class: 'status-link', onclick: () => ctx.go('questions') }, open ? `${open} open question${open > 1 ? 's' : ''}` : 'No open questions') : null,
      h('button', { type: 'button', class: 'status-link', onclick: () => ctx.go('database') }, `${s.db.name}: ${s.db.instruments.length} instruments, ${s.db.parts.length} parts, ${s.db.items.length} items · ${s.db.currency}`),
      updateOverdue() ? updateReminderButton(ctx) : null,
      h('span', { class: 'muted', style: { marginLeft: 'auto' } }, `${APP_NAME} ${APP_VERSION}`),
      state.toast ? h('span', { class: `toast ${state.toast.kind}` }, state.toast.text) : null,
    )]);
  }
  function render() { renderTop(); drawNav(); renderCrumbs(); renderMain(); renderStatus(); }
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (SECTIONS.some((x) => x.id === id)) { state.ui.section = id; render(); } });
  if (location.hash && SECTIONS.some((x) => x.id === location.hash.slice(1))) state.ui.section = location.hash.slice(1);
  render();
  // The only thing the update pattern does unasked: a word, once, when the last check is a quarter old. It asks nobody anything.
  if (updateOverdue()) toast('info', reminderText());
  // Served from a web server with `?open=<url>`, the page fetches that specification itself — for a demo or a test; never from file:.
  const openParam = new URLSearchParams(location.search).get('open');
  if (openParam && location.protocol !== 'file:') fetch(openParam).then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.text(); }).then((text) => { openText(text, openParam.split('/').pop()); render(); }).catch((e) => toast('err', `Could not open ${openParam}: ${e.message}`));
  return ctx;
}
