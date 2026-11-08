// The database: one editable table per kind of thing the builder owns, imported and exported
// table by table or as a whole, saved inside this file. A table with a natural category —
// instruments, parts and contacts, items, checklist items — shows as a collapsible tree of
// that category, so a long list can be narrowed and skimmed rather than scrolled; a filter
// picks one branch, a sort field with a direction toggle orders the rows within.
import { h, table, button, input, select, field, pickFile, confirmDialog } from '../dom.js';
import { page, tabs, more, moneyHeader } from './common.js';
import { TABLES, TABLE_IDS, newRow, exportTable, importTable, exportDb, importDb, starterDb, emptyDb, groupValuesOf, sortedRows, parseAccessories, formatAccessories } from '../../model/db.js';
import { touch } from '../../model/session.js';
import { downloadJson } from '../../io/exports.js';
import { EXAMPLE_CATALOGUE, EXAMPLE_PARTS, EXAMPLE_RATE_CARD, EXAMPLE_ITEMS } from '../../kb/examples.js';
import { thumb, chooseImage, IMAGE_DIR, GUIDE, forgetFolder, folderChosen } from '../images.js';

/** Per-table UI state (search, category filter, sort, which groups are collapsed) — not part of the job, kept in the session's UI state only. */
function dbState(ctx, table) {
  const all = ctx.ui.filters.db || (ctx.ui.filters.db = {});
  return all[table] || (all[table] = { search: '', category: '', sortKey: '', sortDir: 'asc', collapsed: {} });
}

export const database = {
  id: 'database', title: 'Database', tabs: TABLE_IDS.map((t) => [t, TABLES[t].label]),
  render(ctx) {
    const s = ctx.session;
    const db = s.db;
    const { active, bar } = tabs(ctx, 'database', TABLE_IDS.map((t) => [t, `${TABLES[t].label} (${(db[t] || []).length})`]));
    const t = TABLES[active];
    const ui = dbState(ctx, active);
    const set = (fn) => ctx.update(() => fn(ui));
    const search = ui.search.toLowerCase();
    const changed = () => { s.dirty = true; if (s.job) touch(s); };
    const edit = (row, key, value) => { row[key] = value; changed(); };
    const pickImage = (row) => chooseImage({ notify: ctx.notify }).then((name) => { if (name) ctx.update(() => { row.image = name; changed(); }); });
    const cell = (row, [key, , type, options]) => type === 'number'
      ? input(row[key] ?? '', (v) => edit(row, key, v === '' ? null : Number(v)), { type: 'number', step: 'any', class: 'inline', style: { width: '90px' } })
      : type === 'select' ? select(options.map((o) => [o, o]), row[key] || options[0], (v) => edit(row, key, v), { class: 'inline' })
        : type === 'image' ? h('span', { class: 'image-cell' }, thumb(row.image, { size: 36, caption: row.name }), h('span', { class: 'col' }, input(row.image ?? '', (v) => ctx.update(() => edit(row, key, v.trim())), { class: 'inline', placeholder: 'file in IMG/', style: { width: '120px' }, title: GUIDE }), button('Pick…', () => pickImage(row), { class: 'small', title: 'Choose a picture; it is copied into the IMG folder beside this file where the browser allows it' })))
          : type === 'accessories' ? accessoriesCell(ctx, row, key, edit)
            : input(row[key] ?? '', (v) => edit(row, key, v), { class: 'inline', style: { width: key === 'name' || key === 'title' || key === 'characteristics' || key === 'notes' || key === 'why' ? '260px' : '140px' } });
    const importThis = () => pickFile('.json', (text, name) => { try { const r = importTable(db, active, JSON.parse(text)); changed(); ctx.notify('ok', `${name}: ${r.added} added, ${r.replaced} replaced${r.skipped ? `, ${r.skipped} skipped` : ''}.`); } catch (e) { ctx.notify('err', e.message); } ctx.update(); });
    const example = { instruments: EXAMPLE_CATALOGUE, parts: EXAMPLE_PARTS, rates: EXAMPLE_RATE_CARD, items: EXAMPLE_ITEMS }[active];

    let rows = db[active].filter((r) => !search || Object.values(r).join(' ').toLowerCase().includes(search));
    const categories = t.groupKey ? groupValuesOf(db, active) : [];
    if (t.groupKey && ui.category) rows = rows.filter((r) => (String(r[t.groupKey] || '').trim() || '(uncategorised)') === ui.category);
    rows = sortedRows(rows, t.columns, ui.sortKey, ui.sortDir);
    const sortOptions = t.columns.filter(([, , type]) => type !== 'image' && type !== 'accessories').map(([key, label]) => [key, label]);
    const columns = [...t.columns.map((c) => [(row) => cell(row, c), c[0] === 'price' ? moneyHeader(c[1], db.currency) : c[1]]),
      [(row) => button('×', () => ctx.update(() => { if (!confirmDialog(`Delete «${row.name || row.title || row.label || row.id}»?`)) return; db[active] = db[active].filter((r) => r !== row); changed(); }), { class: 'small', title: 'Delete' }), '']];

    return h('div',
      page('Database', 'What you own and pick from. Edit in place; every change is saved with the file. Import and export each table as JSON to share it between copies.',
        h('label', 'Name ', input(db.name, (v) => { db.name = v; changed(); }, { class: 'inline' })), h('label', 'Currency ', input(db.currency, (v) => { db.currency = v; changed(); }, { class: 'inline', style: { width: '60px' } })),
        button('Export the whole database', () => downloadJson(exportDb(db, ctx.meta()), `${(db.name || 'database').replace(/[^A-Za-z0-9._-]+/g, '-')}.json`)),
        button('Import a whole database…', () => pickFile('.json', (text) => { try { if (!confirmDialog('Replace the whole database with the file? The current tables are lost unless saved elsewhere.')) return; s.db = importDb(JSON.parse(text)); changed(); ctx.notify('ok', 'Database replaced.'); } catch (e) { ctx.notify('err', e.message); } ctx.update(); }))),
      companyFold(db, changed),
      bar,
      h('p', { class: 'muted' }, t.hint),
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        button('Add a row', () => ctx.update(() => { rows.unshift(newRow(active)); changed(); }), { class: 'primary' }),
        input(ui.search, (v) => set((u) => { u.search = v; }), { placeholder: 'search', class: 'inline', style: { width: '200px' } }),
        categories.length > 1 ? select([['', `All ${t.groupPlural} (${db[active].length})`], ...categories.map(([v, n]) => [v, `${v} (${n})`])], ui.category, (v) => set((u) => { u.category = v; }), { class: 'inline', title: `Filter by ${t.groupLabel.toLowerCase()}` }) : null,
        h('label', 'Sort by ', select([['', 'as entered'], ...sortOptions], ui.sortKey, (v) => set((u) => { u.sortKey = v; }), { class: 'inline' })),
        ui.sortKey ? button(ui.sortDir === 'desc' ? '↓ Z–A' : '↑ A–Z', () => set((u) => { u.sortDir = u.sortDir === 'desc' ? 'asc' : 'desc'; }), { class: 'small', title: 'Reverse the sort direction' }) : null,
        button(`Import ${t.label.toLowerCase()}…`, importThis, { title: `${t.format}/1` }), button('Export', () => downloadJson(exportTable(db, active, ctx.meta()), `${active}.json`), { title: `${t.format}/1` }),
        example ? button('Example file', () => downloadJson(example, `${active}-example.json`)) : null),
      renderRows(ctx, ui, t, active, categories, rows, columns, set),
      t.columns.some(([, , type]) => type === 'image') ? more(`Pictures (the ${IMAGE_DIR} folder)`,
        h('p', { class: 'muted' }, `A picture is not embedded in the file: it is a file in a folder named ${IMAGE_DIR} beside this HTML file, and the row holds its name — the pictures show as thumbnails wherever the row appears, and enlarge on click. Keep the folder next to the file when you move or send it.`),
        h('p', { class: 'muted' }, typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function' ? `«Pick…» asks once for the ${IMAGE_DIR} folder (create it beside this file first, if it is not there), then copies the chosen picture into it and fills in the name.` : `This browser cannot write into a folder for you: «Pick…» only fills in the name. ${GUIDE}`),
        folderChosen() ? button(`Forget the ${IMAGE_DIR} folder chosen`, () => ctx.update(() => forgetFolder()), { class: 'small' }) : null) : null,
      more('Starter content and reset',
        h('p', { class: 'muted' }, 'The tool ships with a starter set drawn from its knowledge base — generic instrument classes with indicative prices, the usual contacts, rates and standard items — meant to be replaced by what you actually buy and charge.'),
        h('div', { class: 'row' }, button('Reload the starter set into empty tables', () => ctx.update(() => { const st = starterDb(); for (const k of TABLE_IDS) if (!db[k].length) db[k] = st[k]; changed(); })), button('Empty every table', () => ctx.update(() => { if (!confirmDialog('Empty every table of the database?')) return; const e = emptyDb(); for (const k of TABLE_IDS) db[k] = e[k]; changed(); })))),
    );
  },
};

/**
 * Accessories, one at a time: a chip per accessory with its price editable in place and a way
 * to remove it, and a small form to add another — rack mount kits, communication interfaces,
 * lead sets, whatever is bought alongside the instrument. Stored as the same «name price; …»
 * text the format has always used; this is only how it is edited.
 */
/** Who issues the quote — kept with the database, not the job, because it is yours across every job; the Quote page edits the same fields for convenience while filling in an offer. */
function companyFold(db, changed) {
  const set = (key, v) => { db.company[key] = v; changed(); };
  const FIELDS = [['name', 'Name'], ['address', 'Address'], ['vat', 'VAT / tax code'], ['contact', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website']];
  return more('Your company (used on quotes)',
    h('p', { class: 'muted' }, 'Your own commercial identity — name, address, VAT, contacts — used as the «From» of every quote; the same fields are also on the Quote page, ready when you fill in an offer.'),
    h('div', { class: 'fields' }, FIELDS.map(([key, label]) => field(label, input(db.company[key], (v) => set(key, v), { class: 'inline' })))));
}

function accessoriesCell(ctx, row, key, edit) {
  const list = parseAccessories(row[key]);
  const setList = (next) => ctx.update(() => edit(row, key, formatAccessories(next)));
  const draft = { name: '', price: '' };
  return h('span', { class: 'accessories-cell' },
    list.length ? h('span', { class: 'chips' }, list.map((a, i) => h('span', { class: 'chip' },
      a.name,
      input(a.price ?? '', (v) => setList(list.map((x, j) => (j === i ? { ...x, price: v === '' ? null : Number(v) } : x))), { type: 'number', step: 'any', class: 'inline chip-price', placeholder: '—' }),
      button('×', () => setList(list.filter((_, j) => j !== i)), { class: 'small', title: `Remove ${a.name}` }),
    ))) : h('span', { class: 'muted small' }, 'none yet'),
    h('span', { class: 'row chip-add' },
      input('', (v) => { draft.name = v; }, { class: 'inline', placeholder: 'name', style: { width: '130px' } }),
      input('', (v) => { draft.price = v; }, { type: 'number', step: 'any', class: 'inline', placeholder: 'price', style: { width: '70px' } }),
      button('+ Add', () => { if (!draft.name.trim()) return; setList([...list, { name: draft.name.trim(), price: draft.price === '' ? null : Number(draft.price) }]); }, { class: 'small' })),
  );
}

/** A flat table when there is nothing to group by, or one branch is picked; otherwise a collapsible tree, one section per category. */
function renderRows(ctx, ui, t, active, categories, rows, columns, set) {
  if (!t.groupKey || ui.category || categories.length <= 1) return table(columns, rows, { empty: 'No rows. Add one, import a file, or clear the filter.' });
  const groups = new Map();
  for (const r of rows) { const v = String(r[t.groupKey] || '').trim() || '(uncategorised)'; if (!groups.has(v)) groups.set(v, []); groups.get(v).push(r); }
  const order = categories.map(([v]) => v).filter((v) => groups.has(v));
  if (!order.length) return table(columns, [], { empty: 'Nothing matches — clear the search.' });
  return h('div',
    h('div', { class: 'row', style: { marginBottom: '8px' } },
      button('Expand all', () => set((u) => { u.collapsed = {}; }), { class: 'small' }),
      button('Collapse all', () => set((u) => { for (const v of order) u.collapsed[v] = true; }), { class: 'small' })),
    order.map((v) => {
      const grows = groups.get(v);
      const open = !ui.collapsed[v];
      return h('details', { class: 'more tree', open, ontoggle: (e) => { const isOpen = e.target.open; if (isOpen === open) return; ctx.update(() => { ui.collapsed[v] = !isOpen; }); } },
        h('summary', h('b', v), h('span', { class: 'muted' }, ` ${grows.length}`)),
        table(columns, grows, { wrap: false }));
    }),
  );
}
