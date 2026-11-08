// The project: the requirements the specification imposes, one slot each, and what the user
// assigns to them from the database — with the quantity, the cost, and for an instrument what
// goes with it (its routing over the points, its accessories). Slots start empty; the help is
// a ranking of what fits, never a choice made for the user.
import { h, table, badge, button, input, select, notice, fmt } from '../dom.js';
import { page, needSpec, more, money, moneyHeader, makerModel, qty as fq, figure } from './common.js';
import { GROUPS, assignment, assign, unassign, defaultQty, progress, projectSummary, costOf, addRouting, removeRouting, setRoutingQty, setAccessory, accessoriesOf } from '../../model/project.js';
import { suggestInstruments, suggestParts, suggestRouting, itemsOfKind, find, priceOf, newRow, groupValuesOf, sortByField, parseAccessories, formatAccessories } from '../../model/db.js';
import { touch } from '../../model/session.js';
import { formatSeconds } from '../../model/derived.js';
import { thumb } from '../images.js';

/** What can be filtered and sorted in a picker, by requirement kind: the table it ranks over, its category field, and the fields offered for sorting (numeric ones listed in `numeric`). */
const PICKER_CONFIG = {
  instrument: { table: 'instruments', categoryKey: 'category', categoryLabel: 'Category', categoryPlural: 'categories', sort: [['name', 'Name'], ['price', 'Price'], ['accuracy', 'Accuracy'], ['channels', 'Channels']], numeric: new Set(['price', 'accuracy', 'channels']) },
  part: { table: 'parts', categoryKey: 'kind', categoryLabel: 'Kind', categoryPlural: 'kinds', sort: [['name', 'Name'], ['price', 'Price'], ['current', 'Current']], numeric: new Set(['price', 'current']) },
  item: { table: 'items', categoryKey: 'kind', categoryLabel: 'Kind', categoryPlural: 'kinds', sort: [['name', 'Name'], ['price', 'Price']], numeric: new Set(['price']) },
};

export const project = {
  id: 'project', title: 'Project',
  count: (ctx) => { const s = ctx.session; if (!s.job) return ''; const p = progress(s.job, s.reqs); return `${p.done}/${p.total}`; },
  render(ctx) {
    const empty = needSpec(ctx);
    if (empty) return empty;
    const s = ctx.session;
    const id = ctx.meta().identity;
    const sum = projectSummary({ db: s.db, job: s.job, reqs: s.reqs, derived: s.derivedBase, meta: ctx.meta() });
    return h('div',
      page(`${id.documentCode || ''} ${id.title}`.trim(), [id.company, id.product].filter(Boolean).join(' · ')),
      s.job.spec.problems.length ? notice('warn', h('b', 'Import notes: '), s.job.spec.problems.join(' ')) : null,
      summary(ctx, sum),
      GROUPS.map((g) => groupBlock(ctx, g, sum.groups.find((x) => x.id === g.id))),
    );
  },
};

// ---- the recap: the specification, where the project stands, what it costs so far -------------------

function summary(ctx, sum) {
  const s = ctx.session;
  const cur = s.db.currency;
  const id = ctx.meta().identity;
  const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
  const maxSub = Math.max(1, ...sum.groups.map((g) => g.subtotal), sum.services.subtotal);
  return h('div', { class: 'summary' },
    h('div', { class: 'card' }, h('h3', 'The specification'),
      h('div', { class: 'figures' },
        figure(id.revision || '—', 'revision'), figure(String(sum.spec.stages), 'stages'), figure(String(sum.spec.steps), 'steps'), figure(String(sum.spec.criteria), 'criteria'),
        figure(String(sum.spec.points), 'points'), figure(String(sum.spec.resources), 'resources'), figure(formatSeconds(sum.spec.cycleSeconds), 'cycle time'),
        sum.spec.interfaces ? figure(String(sum.spec.interfaces), 'interfaces') : null, sum.spec.variants ? figure(String(sum.spec.variants), 'variants') : null)),
    h('div', { class: 'card' }, h('h3', 'Where the project stands'),
      h('div', { class: 'progress big' }, h('div', { class: 'bar' }, h('i', { style: { width: `${pct(sum.progress.done, sum.progress.total)}%` } })), h('b', `${sum.progress.done} of ${sum.progress.total}`), h('span', 'assigned')),
      h('div', { class: 'rows' }, sum.groups.map((g) => h('div', { class: 'r' }, h('span', g.label), h('div', { class: 'bar' }, h('i', { style: { width: `${pct(g.done, g.total)}%` } })), h('span', { class: 'num' }, `${g.done}/${g.total}`)))),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, sum.questions.open ? [`${sum.questions.open} open question${sum.questions.open > 1 ? 's' : ''} · `, h('a', { href: '#questions', onclick: (e) => { e.preventDefault(); ctx.go('questions'); } }, 'Questions →')] : ['No open question · ', h('a', { href: '#questions', onclick: (e) => { e.preventDefault(); ctx.go('questions'); } }, 'see what is proposed →')])),
    h('div', { class: 'card' }, h('h3', 'Money so far'),
      h('div', { class: 'rows money' }, [...sum.groups.map((g) => ({ label: g.label, value: g.subtotal, unpriced: g.unpriced })), { label: 'Other lines', value: sum.services.subtotal, unpriced: 0 }].map((r) => h('div', { class: 'r' }, h('span', r.label, r.unpriced ? h('span', { class: 'muted' }, ` · ${r.unpriced} unpriced`) : null), h('div', { class: 'bar' }, h('i', { style: { width: `${pct(r.value, maxSub)}%` } })), h('span', { class: 'num' }, money(r.value))))),
      h('div', { class: 'totals compact' },
        h('div', h('span', 'Subtotal'), h('b', money(sum.quote.subtotal, cur))),
        sum.quote.markup || sum.quote.contingency || sum.quote.discount ? h('div', h('span', { class: 'muted' }, `markup ${sum.quote.parameters.markup} %, contingency ${sum.quote.parameters.contingency} %, discount ${sum.quote.parameters.discount} %`), h('span', { class: 'muted' }, money(sum.quote.markup + sum.quote.contingency - sum.quote.discount, cur))) : null,
        h('div', { class: 'total' }, h('span', 'Quote', h('span', { class: 'muted' }, ` · ${fq(sum.quote.hours)} h`)), h('b', money(sum.quote.total, cur)))),
      h('p', { class: 'muted small' }, h('a', { href: '#quote', onclick: (e) => { e.preventDefault(); ctx.go('quote'); } }, 'Quote →'), sum.progress.done < sum.progress.total ? ` · ${sum.progress.total - sum.progress.done} slots still count nothing` : '')),
  );
}

// ---- one group: a table of slots with a cost column and a subtotal ------------------------------------

function groupBlock(ctx, g, gs) {
  const s = ctx.session;
  const reqs = s.reqs.filter((r) => r.group === g.id);
  if (!reqs.length) return null;
  const cur = s.db.currency;
  const onlyUnassigned = !!(ctx.ui.filters.unassignedOnly || {})[g.id];
  const shown = onlyUnassigned ? reqs.filter((r) => !assignment(s.job, r.id)) : reqs;
  const rows = [];
  for (const req of shown) rows.push(...slotRows(ctx, req));
  return h('section', { class: 'group' },
    h('h2', h('span', g.label), h('span', { class: 'muted' }, `${gs.done}/${gs.total}`), h('span', { class: 'hint' }, g.hint),
      gs.total > gs.done ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: onlyUnassigned, onchange: (e) => ctx.update((st) => { st.ui.filters.unassignedOnly = st.ui.filters.unassignedOnly || {}; st.ui.filters.unassignedOnly[g.id] = e.target.checked; }) }), ' only what is not assigned') : null,
      h('span', { class: 'subtotal' }, `${money(gs.subtotal, cur)}${gs.unpriced ? ` · ${gs.unpriced} unpriced` : ''}`)),
    shown.length ? h('div', { class: 'table-wrap slots' }, h('table', { class: 'slots' },
      h('thead', h('tr', h('th', 'Code'), h('th', 'Requirement'), h('th', 'Assigned'), h('th', { class: 'num' }, 'Qty'), h('th', { class: 'num' }, moneyHeader('Cost', cur)), h('th'))),
      h('tbody', rows),
      h('tfoot', h('tr', h('td', { colspan: 4 }, `${g.label} — ${gs.done} of ${gs.total} assigned`), h('td', { class: 'num' }, money(gs.subtotal, cur)), h('td')))))
      : notice('ok', `Every slot of ${g.label.toLowerCase()} is assigned.`),
  );
}

/** The rows of one slot: the slot itself, then for an assigned instrument its routing and accessories, then the open picker. */
function slotRows(ctx, req) {
  const s = ctx.session;
  const a = assignment(s.job, req.id);
  const open = ctx.ui.selected.req === req.id;
  const toggle = () => ctx.update((st) => { st.ui.selected.req = open ? '' : req.id; st.ui.selected.routing = ''; st.ui.filters.pickSearch = ''; st.ui.filters.pickAll = false; st.ui.filters.pickCategory = ''; st.ui.filters.pickSort = ''; st.ui.filters.pickSortDir = 'asc'; });
  const change = (fn) => ctx.update(() => { fn(); touch(s); });
  const cur = s.db.currency;
  const row = a && !a.none && a.table && a.itemId ? find(s.db, a.table, a.itemId) : null;
  const rate = a && req.kind === 'effort' && a.rateId ? find(s.db, 'rates', a.rateId) : null;
  const mainCost = a && !a.none ? (req.kind === 'effort' ? (rate && priceOf(rate) != null ? priceOf(rate) * (Number(a.hours) || 0) : null) : row && priceOf(row) != null ? priceOf(row) * (Number(a.qty) || 0) : null) : null;
  const detailsOpen = req.kind === 'instrument' && !!ctx.ui.details[`res:${req.id}`];
  const out = [];
  out.push(h('tr', { class: `slot ${a ? 'assigned' : 'unassigned'} ${open ? 'open' : ''}` },
    h('td', { class: 'code' }, req.code),
    h('td', { class: 'req' }, h('b', req.label), h('span', { class: 'sub' }, req.demands.join(' · ')),
      req.kind === 'instrument' ? detailsToggleButton(ctx, req) : null),
    h('td', { class: 'to' }, a ? assignedCell(ctx, req, a, row, rate) : badge('not assigned', 'warning')),
    h('td', { class: 'num' }, a && !a.none ? (req.kind === 'effort'
      ? h('span', { class: 'qty' }, input(a.hours, (v) => change(() => { a.hours = Number(v) || 0; }), { type: 'number', step: 'any', min: 0, class: 'inline' }), ' h')
      : h('span', { class: 'qty' }, input(a.qty, (v) => change(() => { a.qty = Number(v) || 0; }), { type: 'number', step: 1, min: 0, class: 'inline' }), row && row.unit ? ` ${row.unit}` : '')) : ''),
    h('td', { class: 'num' }, a && !a.none ? money(mainCost) : ''),
    h('td', { class: 'act' }, h('span', { class: 'row' }, button(a ? 'Change' : 'Assign…', toggle, { class: a ? 'small' : 'small primary' }), a ? button('×', () => change(() => unassign(s.job, req.id)), { class: 'small', title: 'Clear the assignment' }) : null)),
  ));
  // While the picker is open, its own copy of the fuller picture (toggled by the same button)
  // stands in for this one — showing both at once said everything twice.
  if (detailsOpen && !open) out.push(h('tr', { class: 'details-row' }, h('td'), h('td', { colspan: 5 }, resourceDetails(ctx, req))));
  if (row && req.kind === 'instrument') out.push(...extrasRows(ctx, req, a, row));
  if (open) out.push(h('tr', { class: 'picker-row' }, h('td', { colspan: 6 }, picker(ctx, req, a))));
  return out;
}

// ---- the fuller picture of a resource: everything `demands` only summarises -------------------------

function resourceDetails(ctx, req) {
  const characteristics = req.characteristics.length ? table([
    [(c) => c.name || '—', 'Characteristic'],
    [(c) => [c.value, c.unit].filter(Boolean).join(' ') || '—', 'Value'],
  ], req.characteristics, { wrap: false }) : h('p', { class: 'muted small' }, 'No characteristic stated.');
  const text = h('div',
    req.category ? h('p', { class: 'sub' }, h('b', 'Category: '), req.category) : null,
    req.notes ? h('p', { class: 'sub' }, req.notes) : null,
    h('p', { class: 'sub' },
      `${req.channels} channel${req.channels > 1 ? 's' : ''} needed at once${req.dedaloChannels !== req.channels ? ` — DEDALO counts ${req.dedaloChannels}` : ''}${req.approximate ? ' (approximate: the sequence does not enumerate every parallel group)' : ''}.`),
    req.requiredPercent != null ? h('p', { class: 'sub' }, `Accuracy the criteria demand: ≤ ${fmt(req.requiredPercent, 2)} % of reading${req.tightest ? ` (tightest: ${req.tightest.code} «${req.tightest.quantity}» ${req.tightest.text})` : ''}.`) : null,
    h('p', { class: 'sub' }, [
      req.stimulusUses || req.measurementUses ? `${req.stimulusUses} stimulus use${req.stimulusUses === 1 ? '' : 's'}, ${req.measurementUses} measurement use${req.measurementUses === 1 ? '' : 's'}` : null,
      req.stages.length ? `in stages ${req.stages.join(', ')}` : null,
      req.points.length ? `reaching ${req.points.join(', ')}` : null,
      req.interfaceLabels.length ? `over ${req.interfaceLabels.join(', ')}` : null,
    ].filter(Boolean).join(' · ') || 'Not used by any step directly (held, or reached only through a command).'));
  return h('div', { class: 'resource-details' },
    h('div', { class: 'grid2' }, characteristics, text),
    openInSpecButton(ctx, req),
  );
}

/** The same toggle the slot row carries, so the fuller picture stays one click away while comparing candidates in the picker too. */
function detailsToggleButton(ctx, req) {
  const key = `res:${req.id}`;
  const isOpen = !!ctx.ui.details[key];
  return button(isOpen ? '▴ less' : '▾ more', () => ctx.update((st) => { st.ui.details[key] = !isOpen; }), { class: 'small ghost', title: isOpen ? 'Fold the fuller picture' : 'A fuller picture of this resource: every characteristic, where it is used, the points it reaches' });
}

/** Jumps to the resource in the specification itself, when the actual document is at hand — a data file alone cannot open as a page. */
function openInSpecButton(ctx, req) {
  const s = ctx.session;
  const source = (s.job.spec || {}).source || {};
  if (source.kind !== 'html') {
    const why = source.format ? `this project was opened from its data (${source.format}), not the specification document itself` : 'the specification document itself is not available';
    return button('↗ Open in the specification', () => {}, { class: 'small', disabled: true, title: `Not available: ${why}.` });
  }
  if (!s.specText) return button('↗ Open in the specification', () => {}, { class: 'small', disabled: true, title: 'Not available in this session: the specification was opened from its .html document, but that file is not loaded right now (a saved project or an imported job does not carry it, to keep this file light).' });
  const openIt = () => { const url = URL.createObjectURL(new Blob([s.specText], { type: 'text/html' })); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  return button('↗ Open in the specification', openIt, { class: 'small', title: `Opens the specification in a new tab, as its own copy — look for ${req.code} under Test resources (it opens at the front page, not scrolled to it: DEDALO's document has no link to a place inside it).` });
}

function assignedCell(ctx, req, a, row, rate) {
  const s = ctx.session;
  if (a.none) return h('span', a.note || 'nothing needed', h('span', { class: 'sub' }, req.kind === 'part' && req.partKind === 'actuator' ? 'done by the operator' : 'no line in the quote'));
  if (req.kind === 'effort') return h('span', h('span', { class: 'row' }, 'at ', select(s.db.rates.map((r) => [r.id, `${r.label} (${money(priceOf(r), s.db.currency)}/${r.unit})`]), a.rateId, (v) => ctx.update(() => { a.rateId = v; touch(s); }), { class: 'inline' })), req.suggestedHours ? h('span', { class: 'sub' }, `suggested ${req.suggestedHours} h — ${req.suggestionNote}`) : null);
  if (!row) return h('span', { class: 'muted' }, 'the assigned row is no longer in the database');
  return h('span', { class: 'with-thumb' }, thumb(row.image, { caption: row.name }), h('span', row.name, h('span', { class: 'sub' }, [makerModel(row), row.kind, priceOf(row) != null ? `${money(priceOf(row), s.db.currency)} each` : 'no price', a.note].filter(Boolean).join(' · '))));
}

// ---- what goes with an instrument: its routing over the points, its accessories --------------------------

function extrasRows(ctx, req, a, row) {
  const s = ctx.session;
  const cur = s.db.currency;
  const change = (fn) => ctx.update(() => { fn(); touch(s); });
  const out = [];
  for (const r of a.routing || []) {
    const rr = find(s.db, r.table, r.itemId);
    out.push(h('tr', { class: 'extra' }, h('td', { class: 'code' }, '↳ routing'), h('td', { class: 'req' }, h('span', { class: 'sub' }, `puts ${row.name} on its ${req.channels} point${req.channels > 1 ? 's' : ''}`)),
      h('td', { class: 'to' }, rr ? h('span', { class: 'with-thumb' }, thumb(rr.image, { caption: rr.name }), h('span', rr.name, h('span', { class: 'sub' }, [r.table === 'instruments' ? makerModel(rr) : (rr.kind || rr.category), rr.channels ? `${rr.channels} channels each` : null, priceOf(rr) != null ? `${money(priceOf(rr), cur)} each` : 'no price'].filter(Boolean).join(' · ')))) : h('span', { class: 'muted' }, 'no longer in the database')),
      h('td', { class: 'num' }, h('span', { class: 'qty' }, input(r.qty, (v) => change(() => setRoutingQty(s.job, req.id, r.id, v)), { type: 'number', step: 1, min: 0, class: 'inline' }))),
      h('td', { class: 'num' }, money(rr && priceOf(rr) != null ? priceOf(rr) * (Number(r.qty) || 0) : null)),
      h('td', { class: 'act' }, button('×', () => change(() => removeRouting(s.job, req.id, r.id)), { class: 'small', title: 'Remove this routing' }))));
  }
  const accs = accessoriesOf(s.db, a);
  for (const acc of accs.filter((x) => x.selected)) {
    out.push(h('tr', { class: 'extra' }, h('td', { class: 'code' }, '↳ accessory'), h('td', { class: 'req' }, h('span', { class: 'sub' }, `of ${row.name}`)),
      h('td', { class: 'to' }, h('span', acc.name, h('span', { class: 'sub' }, acc.price != null ? `${money(acc.price, cur)} each` : 'no price'))),
      h('td', { class: 'num' }, h('span', { class: 'qty' }, input(acc.qty, (v) => change(() => setAccessory(s.job, req.id, acc.name, { selected: true, qty: Number(v) || 0 })), { type: 'number', step: 1, min: 0, class: 'inline' }))),
      h('td', { class: 'num' }, money(acc.price != null ? acc.price * acc.qty : null)),
      h('td', { class: 'act' }, button('×', () => change(() => setAccessory(s.job, req.id, acc.name, { selected: false })), { class: 'small', title: 'Untick this accessory' }))));
  }
  const routingOpen = ctx.ui.selected.routing === req.id;
  const unticked = accs.filter((x) => !x.selected);
  const draft = { name: '', price: '' };
  const addNewAccessory = () => { if (!draft.name.trim()) { ctx.notify('warn', 'A name is needed.'); return; } const list = parseAccessories(row.accessories); if (list.some((x) => x.name === draft.name.trim())) { ctx.notify('warn', `${row.name} already has an accessory named «${draft.name.trim()}».`); return; } list.push({ name: draft.name.trim(), price: draft.price === '' ? null : Number(draft.price) }); row.accessories = formatAccessories(list); change(() => setAccessory(s.job, req.id, draft.name.trim(), { selected: true, qty: 1 })); };
  out.push(h('tr', { class: 'extra tools' }, h('td'), h('td', { colspan: 5 }, h('span', { class: 'row' },
    button(routingOpen ? 'Close' : '+ Routing…', () => ctx.update((st) => { st.ui.selected.routing = routingOpen ? '' : req.id; st.ui.selected.req = ''; st.ui.filters.routeSearch = ''; st.ui.filters.routeAll = false; }), { class: 'small', title: 'Relays, a multiplexer card, anything from the database that puts the instrument on its points' }),
    !(a.routing || []).length && req.channels > 1 ? h('span', { class: 'muted small' }, `${req.channels} points at once: one instrument routed over them, or ${req.channels} instruments`) : null,
    unticked.length ? [h('span', { class: 'muted small' }, 'accessories:'), unticked.map((acc) => button(`+ ${acc.name}${acc.price != null ? ` (${money(acc.price, s.db.currency)})` : ''}`, () => change(() => setAccessory(s.job, req.id, acc.name, { selected: true, qty: 1 })), { class: 'small ghost' }))] : null,
    more(`New accessory for ${row.name}…`, h('span', { class: 'row' },
      input('', (v) => { draft.name = v; }, { placeholder: 'name — a rack mount kit, a communication interface…', class: 'inline', style: { width: '220px' } }),
      input('', (v) => { draft.price = v; }, { type: 'number', step: 'any', placeholder: `price (${s.db.currency})`, class: 'inline', style: { width: '90px' } }),
      button('Add and tick', addNewAccessory, { class: 'small' }))),
  ))));
  if (routingOpen) out.push(h('tr', { class: 'picker-row nested' }, h('td', { colspan: 6 }, routingPicker(ctx, req, a))));
  return out;
}

function routingPicker(ctx, req, a) {
  const s = ctx.session;
  const f = ctx.ui.filters;
  const cur = s.db.currency;
  const ranked = suggestRouting(s.db, { channels: req.channels, search: f.routeSearch || '', all: !!f.routeAll });
  const qtys = new Map();
  const add = (x) => ctx.update(() => { addRouting(s.job, req.id, { table: x.table, itemId: x.row.id, qty: qtys.get(x.row.id) ?? x.suggestedQty }); touch(s); ctx.ui.selected.routing = ''; });
  return h('div', { class: 'picker' },
    h('div', { class: 'row', style: { marginBottom: '8px' } }, h('b', 'Routing for ', req.label), input(f.routeSearch || '', (v) => ctx.update((st) => { st.ui.filters.routeSearch = v; }), { placeholder: 'search the database', class: 'inline', style: { width: '220px' } }),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!f.routeAll, onchange: (e) => ctx.update((st) => { st.ui.filters.routeAll = e.target.checked; }) }), ' show everything, not only what switches')),
    h('p', { class: 'muted small' }, `${req.channels} point${req.channels > 1 ? 's' : ''} to reach. Suggested quantities: one relay per point, one card per the channels it switches — change them as you like.`),
    table([
      [(x) => h('span', { class: 'with-thumb' }, thumb(x.row.image, { caption: x.row.name }), h('span', x.row.name, h('span', { class: 'sub' }, [x.table === 'instruments' ? makerModel(x.row) : x.table === 'parts' ? x.row.kind : x.table, x.row.channels ? `${x.row.channels} channels` : null].filter(Boolean).join(' · ')))), 'Row'],
      [(x) => money(priceOf(x.row)), moneyHeader('Price', cur), { class: 'num' }],
      [(x) => h('span', { class: 'muted' }, x.reasons.join(', ')), 'Why'],
      [(x) => h('span', { class: 'qty' }, input(x.suggestedQty, (v) => qtys.set(x.row.id, Number(v) || 1), { type: 'number', step: 1, min: 1, class: 'inline' })), 'Qty', { class: 'num' }],
      [(x) => button('Add', () => add(x), { class: 'small primary' }), ''],
    ], ranked.slice(0, f.routeAll || f.routeSearch ? 200 : 12), { wrap: false, empty: 'Nothing in the database switches by itself — search, show everything, or add a relay part on the Database page.' }),
  );
}

// ---- the picker: what the database has for this slot -------------------------------------------------------

function picker(ctx, req, a) {
  const s = ctx.session;
  const f = ctx.ui.filters;
  const search = String(f.pickSearch || '').toLowerCase();
  const all = !!f.pickAll;
  const category = f.pickCategory || '';
  const sortKey = f.pickSort || '';
  const sortDir = f.pickSortDir || 'asc';
  const cfg = PICKER_CONFIG[req.kind] || null;
  const categories = cfg ? groupValuesOf(s.db, cfg.table) : [];
  const close = () => ctx.update((st) => { st.ui.selected.req = ''; });
  const commit = (fields) => ctx.update(() => { assign(s.job, req, fields); touch(s); ctx.ui.selected.req = ''; });
  const set = (fn) => ctx.update((st) => fn(st.ui.filters));
  const head = h('div', { class: 'row', style: { marginBottom: '8px' } },
    req.kind !== 'effort' ? input(f.pickSearch || '', (v) => set((flt) => { flt.pickSearch = v; }), { placeholder: 'search the database', class: 'inline', style: { width: '220px' } }) : null,
    req.kind !== 'effort' ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: all, onchange: (e) => set((flt) => { flt.pickAll = e.target.checked; }) }), ' show everything, not only what fits') : null,
    cfg && categories.length > 1 ? select([['', `All ${cfg.categoryPlural}`], ...categories.map(([v, n]) => [v, `${v} (${n})`])], category, (v) => set((flt) => { flt.pickCategory = v; }), { class: 'inline', title: `Filter by ${cfg.categoryLabel.toLowerCase()}` }) : null,
    cfg ? h('label', 'Sort ', select([['', 'best fit'], ...cfg.sort], sortKey, (v) => set((flt) => { flt.pickSort = v; }), { class: 'inline' })) : null,
    cfg && sortKey ? button(sortDir === 'desc' ? '↓ Z–A' : '↑ A–Z', () => set((flt) => { flt.pickSortDir = sortDir === 'desc' ? 'asc' : 'desc'; }), { class: 'small', title: 'Reverse the sort direction' }) : null,
    req.kind === 'instrument' ? detailsToggleButton(ctx, req) : null,
    req.canBeOperator ? button('The operator does it', () => commit({ none: true, note: 'by the operator', table: '', itemId: '' }), { class: 'small' }) : null,
    req.kind === 'item' || req.kind === 'part' ? button('Not needed', () => commit({ none: true, note: 'not needed', table: '', itemId: '' }), { class: 'small' }) : null,
    button('Close', close, { class: 'small' }));
  let body;
  if (req.kind === 'instrument') body = instrumentPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir);
  else if (req.kind === 'part') body = partPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir);
  else if (req.kind === 'effort') body = effortPicker(ctx, req, a, commit);
  else body = itemPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir);
  return h('div', { class: 'picker' }, head, body);
}

function instrumentPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir) {
  const s = ctx.session;
  const cfg = PICKER_CONFIG.instrument;
  const ranked = suggestInstruments(s.db, req.resource, { classIds: req.classIds, requiredPercent: req.requiredPercent, channels: req.channels });
  let shown = ranked.filter((x) => !search || `${x.row.name} ${x.row.maker} ${x.row.model} ${x.row.category}`.toLowerCase().includes(search)).filter((x) => all || search || x.score > 0);
  if (category) shown = shown.filter((x) => (String(x.row.category || '').trim() || '(uncategorised)') === category);
  shown = sortByField(shown, sortKey, sortDir, cfg.numeric.has(sortKey), (x) => x.row).slice(0, all || search || category ? 200 : 8);
  const pick = (row) => commit({ table: 'instruments', itemId: row.id, qty: defaultQty(req), none: false, note: '' });
  const detailsOpen = !!ctx.ui.details[`res:${req.id}`];
  return h('div',
    // The channels/accuracy hint here and the fuller picture below say the same thing in
    // different words: shown collapsed only, so the fuller picture never repeats it once open
    // — its own toggle lives in the toolbar above, right by Close, so what it opens starts
    // right under that same bar instead of hanging off a line of its own.
    detailsOpen ? null : h('p', { class: 'muted small' },
      req.channels > 1 ? `${req.channels} points at once: assign one instrument and give it a routing (relays, a multiplexer card) under the slot, or set the quantity to ${req.channels}. ` : '',
      req.requiredPercent != null ? `Accuracy the criteria demand: ≤ ${fmt(req.requiredPercent, 2)} % of reading${req.tightest ? ` (tightest: ${req.tightest.code} «${req.tightest.quantity}» ${req.tightest.text})` : ''}.` : ''),
    detailsOpen ? resourceDetails(ctx, req) : null,
    table([
      [(x) => h('span', { class: 'with-thumb' }, thumb(x.row.image, { caption: x.row.name }), h('span', x.row.name, h('span', { class: 'sub' }, [makerModel(x.row), x.row.category].filter(Boolean).join(' · ')))), 'Instrument'],
      [(x) => x.row.channels != null ? String(x.row.channels) : '', 'Ch.', { class: 'num' }],
      [(x) => x.row.accuracy != null && x.row.accuracy !== '' ? h('span', `${x.row.accuracy} %`, x.accuracy === true ? badge('ok', 'ok') : x.accuracy === false ? badge('short', 'short') : null) : '', 'Accuracy', { class: 'num' }],
      [(x) => money(priceOf(x.row)), moneyHeader('Price', s.db.currency), { class: 'num' }],
      [(x) => h('span', { class: 'muted' }, x.reasons.join(', ')), 'Why'],
      [(x) => button('Assign', () => pick(x.row), { class: 'small primary' }), ''],
    ], shown, { wrap: false, empty: search || category ? 'Nothing matches.' : 'Nothing in the database fits by itself — search, show everything, or add a new instrument.' }),
    newRowForm(ctx, 'instruments', { category: req.resource.category, channels: 1 }, pick),
  );
}

function partPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir) {
  const s = ctx.session;
  const cfg = PICKER_CONFIG.part;
  const ranked = suggestParts(s.db, { kind: req.partKind === 'other' ? null : req.partKind, contactType: req.contactType || req.label, current: req.current || null });
  let shown = ranked.filter((x) => !search || `${x.row.name} ${x.row.kind}`.toLowerCase().includes(search)).filter((x) => all || search || x.score > 0 || ranked.every((y) => y.score === 0));
  if (category) shown = shown.filter((x) => (String(x.row.kind || '').trim() || '(uncategorised)') === category);
  shown = sortByField(shown, sortKey, sortDir, cfg.numeric.has(sortKey), (x) => x.row).slice(0, all || search || category ? 200 : 8);
  const qty = defaultQty(req);
  const pick = (row) => commit({ table: 'parts', itemId: row.id, qty, none: false, note: '' });
  return h('div',
    req.kind === 'part' && req.partKind !== 'actuator' ? h('p', { class: 'muted small' }, `Quantity proposed: ${qty} — one per point the steps are applied on${req.listed > req.count ? ` (${req.listed} listed)` : ''}; change it in the slot afterwards.`) : null,
    table([
      [(x) => h('span', { class: 'with-thumb' }, thumb(x.row.image, { caption: x.row.name }), h('span', x.row.name, h('span', { class: 'sub' }, [x.row.kind, x.row.current ? `${x.row.current} A` : null, x.row.life ? `${Number(x.row.life).toLocaleString()} cycles` : null].filter(Boolean).join(' · ')))), 'Part'],
      [(x) => money(priceOf(x.row)), moneyHeader('Price', s.db.currency), { class: 'num' }],
      [(x) => h('span', { class: 'muted' }, x.reasons.join(', ')), 'Why'],
      [(x) => button(`Assign ${qty} ×`, () => pick(x.row), { class: 'small primary' }), ''],
    ], shown, { wrap: false, empty: 'Nothing in the database fits — search, show everything, or add a new part.' }),
    newRowForm(ctx, 'parts', { kind: req.partKind === 'other' ? 'probe' : req.partKind, matches: req.contactType || '' }, pick),
  );
}

function effortPicker(ctx, req, a, commit) {
  const s = ctx.session;
  let hours = a ? a.hours : '';
  let rateId = a ? a.rateId : (s.db.rates.find((r) => /software/i.test(r.label)) || s.db.rates[0] || {}).id || '';
  return h('div', { class: 'row' },
    h('label', 'Hours ', input(hours, (v) => { hours = v; }, { type: 'number', step: 'any', min: 0, class: 'inline', style: { width: '80px' } })),
    h('label', 'at ', select(s.db.rates.map((r) => [r.id, `${r.label} (${money(priceOf(r), s.db.currency)}/${r.unit})`]), rateId, (v) => { rateId = v; }, { class: 'inline' })),
    button('Assign', () => commit({ hours: Number(hours) || 0, rateId, none: false, table: '', itemId: '' }), { class: 'small primary' }),
    req.suggestedHours ? h('span', { class: 'muted' }, `Suggested: ${req.suggestedHours} h — ${req.suggestionNote} `, button('use', () => commit({ hours: req.suggestedHours, rateId, none: false, table: '', itemId: '' }), { class: 'small' })) : null,
  );
}

function itemPicker(ctx, req, a, search, all, commit, category, sortKey, sortDir) {
  const s = ctx.session;
  const cfg = PICKER_CONFIG.item;
  const fitting = itemsOfKind(s.db, req.itemKind);
  let rows = (all || search || category ? s.db.items : fitting).filter((i) => !search || `${i.name} ${i.kind}`.toLowerCase().includes(search));
  if (category) rows = rows.filter((i) => (String(i.kind || '').trim() || '(uncategorised)') === category);
  rows = sortByField(rows, sortKey, sortDir, cfg.numeric.has(sortKey));
  const pick = (row) => commit({ table: 'items', itemId: row.id, qty: 1, none: false, note: '' });
  return h('div',
    req.suggestionNote ? h('p', { class: 'muted small' }, `Hint: ${req.suggestionNote}.`) : null,
    table([[(i) => h('span', { class: 'with-thumb' }, thumb(i.image, { caption: i.name }), h('span', i.name, h('span', { class: 'sub' }, `${i.kind} · per ${i.unit || 'pc'}`))), 'Item'], [(i) => money(priceOf(i)), moneyHeader('Price', s.db.currency), { class: 'num' }], [(i) => button('Assign', () => pick(i), { class: 'small primary' }), '']], rows, { wrap: false, empty: 'No item of this kind in the database — show everything, clear the filter, or add one.' }),
    newRowForm(ctx, 'items', { kind: req.itemKind, unit: 'pc' }, pick),
  );
}

/** «New … in the database»: a name and a price are enough; the rest is edited on the Database page. */
function newRowForm(ctx, table, defaults, onCreated) {
  const s = ctx.session;
  const draft = { name: '', price: '' };
  return more(`New ${table === 'instruments' ? 'instrument' : table === 'parts' ? 'part' : 'item'} in the database…`,
    h('div', { class: 'row' },
      input('', (v) => { draft.name = v; }, { placeholder: 'name', class: 'inline', style: { width: '260px' } }),
      input('', (v) => { draft.price = v; }, { type: 'number', step: 'any', placeholder: 'price', class: 'inline', style: { width: '90px' } }),
      button('Add and assign', () => { if (!draft.name) { ctx.notify('warn', 'A name is needed.'); return; } const row = { ...newRow(table), ...defaults, name: draft.name, price: draft.price === '' ? null : Number(draft.price) }; s.db[table].push(row); s.dirty = true; onCreated(row); }, { class: 'small' })));
}
