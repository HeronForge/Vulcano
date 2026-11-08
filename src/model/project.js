// The project: the requirements the specification imposes — one empty slot each — and what
// the user assigned to them from the database. Nothing is filled in by itself: a slot stays
// empty until the user picks an instrument, a part, an item or an effort for it. The quote is
// the sum of the assignments, the manual lines and the suggestions the user accepted.
import { newId, now } from './ids.js';
import { hazardousStimuli } from '../kb/rules.js';
import { classesForResource, contactTypeOf } from '../kb/reference.js';
import { COST_PATTERNS } from '../kb/costs.js';
import { actionVerbs } from './entities.js';
import { isSetup } from './schema.js';
import { labelOf, unitFamily, unitScale } from './spec.js';
import { find, priceOf, parseAccessories } from './db.js';

export const GROUPS = [
  { id: 'instruments', label: 'Instruments', hint: 'One slot per resource of the specification: pick the instrument that realises it, and how many.' },
  { id: 'contacts', label: 'Contacts and fixture', hint: 'One slot per contact type the points use, and one per physical action the steps imply.' },
  { id: 'software', label: 'Software', hint: 'What has to be written: the steps, the drivers, the variants — as hours at a rate.' },
  { id: 'bench', label: 'Bench', hint: 'What every bench carries: frame, power, fixture, interface board, safety.' },
];

/** The client and the terms of one quote — per job, unlike your own company, which is part of the database. */
export const emptyQuoteDetails = () => ({ number: '', date: '', validity: '', paymentTerms: '', deliveryTerms: '', notes: '', client: { name: '', address: '', vat: '', contact: '', email: '', phone: '' } });
export const normaliseQuoteDetails = (input) => { const base = emptyQuoteDetails(); const d = { ...base, ...(input && typeof input === 'object' ? input : {}) }; d.client = { ...base.client, ...(d.client && typeof d.client === 'object' ? d.client : {}) }; return d; };

export function emptyJob() {
  return { version: 1, name: '', spec: null, assignments: {}, choices: {}, lines: [], questions: [], checklist: {}, quote: { markup: 0, contingency: 5, discount: 0, details: emptyQuoteDetails() }, settings: { turTarget: 4, guardFactor: 1, spareShare: 10, language: 'English' }, created: now() };
}

/**
 * The requirements of one specification, from its derived tables. Each has an id that is stable
 * across re-reads (the element's own id or the contact type), a group, what it demands, and the
 * kind of thing that satisfies it: an `instrument`, a `part`, an `item` or an `effort`.
 */
export function requirements(derived, accuracy = null) {
  const label = (id) => labelOf(derived.codes, derived.index, id);
  const out = [];
  // Instruments: one per resource, with the channels DEDALO counts and the ones that get wired.
  for (const row of derived.resources.rows) {
    const r = row.resource;
    if (r.missing) continue;
    const agg = accuracy ? accuracy.byResource.get(r.id) : null;
    const channels = Math.max(1, row.refinedChannels || row.maxChannels);
    out.push({
      id: `res:${r.id}`, group: 'instruments', kind: 'instrument', code: derived.codes.get(r.id), label: r.name, subjectId: r.id, resource: r,
      demands: [...(r.characteristics || []).map((c) => `${c.name} ${c.value} ${c.unit}`.trim()), `${channels} channel${channels > 1 ? 's' : ''} at once${row.maxChannels !== channels ? ` (DEDALO counts ${row.maxChannels})` : ''}`, ...(row.interfaceIds.length ? [`speaks ${row.interfaceIds.map(label).join(', ')}`] : [])],
      channels, dedaloChannels: row.maxChannels, classIds: classesForResource(r).map((c) => c.id), requiredPercent: agg ? agg.requiredPercent : null, tightest: agg ? agg.tightest : null, stages: row.stageIds.map((id) => derived.codes.get(id)),
      // The fuller picture, folded by default: every characteristic (not just the ones that fit
      // on one line), the resource's own notes, where it is used and how much, the points it
      // reaches — everything `demands` only summarises.
      category: r.category || '', notes: r.notes || '', characteristics: r.characteristics || [],
      interfaceLabels: row.interfaceIds.map(label), points: row.points.map((id) => derived.codes.get(id)),
      parameters: row.parameters || [], stimulusUses: row.stimulusUses || 0, measurementUses: row.measurementUses || 0, approximate: !!row.approximate,
    });
  }
  // Contacts: one per contact type group, with the points and the current to carry.
  const groups = new Map();
  for (const p of derived.points) {
    const ct = contactTypeOf(p.point.contactType);
    if (['wireless', 'optical-acoustic', 'manual', 'as-fitted'].includes(ct.id)) continue;
    const key = ct.id === 'unknown' ? 'unknown' : String(p.point.contactType || '').trim().toLowerCase() || ct.id;
    if (!groups.has(key)) groups.set(key, { ct, text: p.point.contactType || '', points: [], current: 0 });
    const g = groups.get(key);
    g.points.push(p);
    const maxI = (p.characteristics.find((c) => /current/i.test(c.name)) || {}).quantity;
    let applied = 0;
    for (const st of p.stimuli) for (const par of st.parameters) for (const v of par.values || []) { const n = v.range ? v.range.max : v.value; if (n != null && unitFamily(par.unit) === 'current') applied = Math.max(applied, Math.abs(n * unitScale(par.unit).factor)); }
    g.current = Math.max(g.current, maxI && maxI.value != null ? maxI.value : 0, applied);
  }
  for (const [key, g] of groups) {
    const partKind = ['kelvin-probe', 'probe-0.9', 'probe-1.3', 'probe-2', 'probe-generic', 'unknown'].includes(g.ct.id) ? 'probe' : ['kelvin-clip', 'clip-4mm'].includes(g.ct.id) ? 'clip' : g.ct.id === 'connector-mated' ? 'connector' : g.ct.id === 'cable' ? 'cable' : 'other';
    // How many contacts: the points the steps are applied on (DEDALO's «Applied on»), one contact
    // each; a point listed but never touched by a step is shown but not counted.
    const applied = g.points.filter((p) => p.uses.length > 0);
    const count = applied.length || g.points.length;
    out.push({ id: `pts:${key}`, group: 'contacts', kind: 'part', partKind, code: `${count} pt`, label: g.text || 'Contact type not stated', subjectIds: g.points.map((p) => p.point.id), points: g.points.map((p) => derived.codes.get(p.point.id)), count, listed: g.points.length, current: g.current, contactType: g.text,
      demands: [`${count} point${count > 1 ? 's' : ''} applied on: ${(applied.length ? applied : g.points).map((p) => derived.codes.get(p.point.id)).join(', ')}`, applied.length && applied.length < g.points.length ? `${g.points.length - applied.length} more listed but never used by a step` : null, g.current ? `up to ${g.current} A` : null, g.ct.id === 'unknown' ? 'the specification does not say how they are contacted' : null].filter(Boolean) });
  }
  // Actions: the physical steps — press, mate, present — with or without a listed actuator.
  const actions = new Map();
  for (const st of derived.stimuli) {
    if (st.table || st.commandId) continue;
    const step = derived.index.get(st.stepId);
    const verbs = actionVerbs(`${st.description} ${step ? step.description : ''}`);
    if (!verbs.length) continue;
    const resources = st.resourceIds.map((id) => derived.index.get(id)).filter(Boolean);
    const electrical = st.parameters.some((p) => /volt|current|freq|duty|resist|power/i.test(`${p.name} ${p.unit}`));
    const actuation = resources.some((r) => /actuat|fixtur|mechan|handl/i.test(r.category || ''));
    if (!actuation && electrical && resources.length) continue;
    if (resources.some((r) => /simulat|communication|power|load|measurement|safety/i.test(r.category || '')) && !actuation) continue;
    const key = `${st.resourceIds.join(',')}|${st.description.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (!actions.has(key)) actions.set(key, { description: st.description, verbs, steps: [], resources, listed: actuation });
    actions.get(key).steps.push(st.stepId);
  }
  for (const a of actions.values()) {
    out.push({ id: `act:${a.steps[0]}`, group: 'contacts', kind: 'part', partKind: 'actuator', code: a.steps.map((id) => derived.codes.get(id)).join(', '), label: `«${a.description}»`, subjectIds: a.steps, demands: [`${a.verbs.join(', ')}${a.resources.length ? ` — the specification lists ${a.resources.map((r) => `${derived.codes.get(r.id)} ${r.name}`).join(', ')}` : ' — no actuator among the resources'}`], listed: a.listed, canBeOperator: true });
  }
  // Software: effort slots.
  const steps = derived.steps.length;
  const stages = derived.doc.stages.filter((s) => !isSetup(s)).length;
  out.push({ id: 'sw:steps', group: 'software', kind: 'effort', code: 'steps', label: `Implement ${steps} steps in ${stages} stages`, demands: [`${derived.criteria.length} criteria`, `${derived.doc.stages.length - stages} setup routines`], suggestedHours: Math.round(steps * 0.5 + 24), suggestionNote: `${steps} steps × 0.5 h + 24 h of framework set-up` });
  const drivers = derived.resources.rows.filter((r) => !r.resource.missing).length;
  out.push({ id: 'sw:drivers', group: 'software', kind: 'effort', code: 'drivers', label: `Drivers for ${drivers} instruments`, demands: derived.resources.rows.filter((r) => !r.resource.missing).map((r) => r.resource.name), suggestedHours: drivers * 12, suggestionNote: `${drivers} drivers × 12 h; less for what the house library has` });
  for (const itf of derived.doc.interfaces || []) {
    const commands = (derived.doc.commands || []).filter((c) => c.interfaceId === itf.id);
    if (!commands.length) continue;
    const byRef = commands.filter((c) => c.referenceId && !c.requestFormat && !c.responseFormat).length;
    out.push({ id: `itf:${itf.id}`, group: 'software', kind: 'effort', code: derived.codes.get(itf.id), label: `DUT protocol driver: ${itf.name}`, subjectId: itf.id, demands: [`${commands.length} commands${byRef ? `, ${byRef} defined only by reference` : ''}`, itf.type], suggestedHours: 12 + commands.length * 0.5, suggestionNote: `12 h + ${commands.length} commands × 0.5 h` });
  }
  if ((derived.doc.variants || []).length > 1) out.push({ id: 'sw:variants', group: 'software', kind: 'effort', code: 'variants', label: `Handle ${derived.doc.variants.length} variants`, demands: derived.doc.variants.map((v) => v.name), suggestedHours: derived.doc.variants.length * 4, suggestionNote: `${derived.doc.variants.length} variants × 4 h` });
  // Bench.
  const hazards = hazardousStimuli({ derived });
  const probes = derived.points.filter((p) => /probe|pad|nail|pogo/i.test(p.point.contactType || '') || !p.point.contactType).length;
  out.push({ id: 'bench:fixture', group: 'bench', kind: 'item', itemKind: 'fixture', code: 'fixture', label: 'Fixture', demands: [`${derived.points.length} points, ${probes} probed`, hazards.length ? 'hazardous voltage present: an interlocked guard is needed' : null].filter(Boolean), suggestionNote: hazards.length || probes > 30 ? 'a pneumatic fixture with an interlocked guard' : 'a manual clamp fixture is usually enough' });
  out.push({ id: 'bench:board', group: 'bench', kind: 'item', itemKind: 'fixture', code: 'board', label: 'Interface board and harness', demands: ['switching, conditioning, protection, the connectors of the harness'] });
  out.push({ id: 'bench:frame', group: 'bench', kind: 'item', itemKind: 'bench', code: 'frame', label: 'Frame, cabinet, power distribution', demands: ['frame, operator station, main switch and protected circuits'] });
  if (hazards.length) out.push({ id: 'bench:safety', group: 'bench', kind: 'item', itemKind: 'safety', code: 'safety', label: 'Safety circuit', demands: [`${hazards.length} stimuli at hazardous levels (${[...new Set(hazards.map((h) => derived.codes.get(h.stepId)))].slice(0, 4).join(', ')}${hazards.length > 4 ? '…' : ''})`, 'interlocked guard, safety relay, emergency stop, discharge'] });
  return out;
}

// ---- assignments -------------------------------------------------------------------------------------

export const assignment = (job, reqId) => (job.assignments || {})[reqId] || null;

/**
 * Assigns a database row (or «nothing», or an effort) to a requirement. An instrument's
 * assignment also carries what goes with it: the `routing` — relays, a multiplexer card,
 * anything from the database that puts the instrument on its points, in whatever quantity —
 * and the `accessories` ticked among those the instrument's row defines.
 */
export function assign(job, req, fields) {
  const prev = job.assignments[req.id] || {};
  const a = { table: '', itemId: '', qty: 1, hours: 0, rateId: '', none: false, note: '', routing: [], accessories: [], at: now(), ...prev, ...fields };
  // Another instrument brings its own accessories; the routing is about the points and stays.
  if (fields.itemId != null && fields.itemId !== prev.itemId && !('accessories' in fields)) a.accessories = [];
  if (a.none) { a.routing = []; a.accessories = []; }
  job.assignments[req.id] = a;
  return a;
}
export function unassign(job, reqId) { delete job.assignments[reqId]; }

/** The default quantity of a row for a slot: one instrument or item; one contact per point applied on; one actuator. */
export const defaultQty = (req) => (req.kind === 'part' && req.partKind !== 'actuator' ? Math.max(1, req.count || 1) : 1);

/** Whether an assigned instrument is routed over its points (something in its routing) — what the sequence and the accuracy path use. */
export const switchingOf = (a) => (a && !a.none && (a.routing || []).length ? 'mux' : 'dedicated');

export function addRouting(job, reqId, { table, itemId, qty = 1, note = '' }) {
  const a = job.assignments[reqId];
  if (!a) return null;
  a.routing = a.routing || [];
  const line = { id: newId('rt'), table, itemId, qty: Number(qty) || 1, note };
  a.routing.push(line);
  return line;
}
export const removeRouting = (job, reqId, id) => { const a = job.assignments[reqId]; if (a) a.routing = (a.routing || []).filter((r) => r.id !== id); };
export const setRoutingQty = (job, reqId, id, qty) => { const a = job.assignments[reqId]; const r = a && (a.routing || []).find((x) => x.id === id); if (r) r.qty = Number(qty) || 0; };

/** Ticks an accessory the instrument's row defines (by name); `qty` 0 or `selected: false` unticks it. */
export function setAccessory(job, reqId, name, { selected = true, qty = 1 } = {}) {
  const a = job.assignments[reqId];
  if (!a) return;
  a.accessories = (a.accessories || []).filter((x) => x.name !== name);
  if (selected && qty > 0) a.accessories.push({ name, qty: Number(qty) || 1 });
}

/** The accessories of the assigned instrument's row, with which are ticked and how many. */
export function accessoriesOf(db, a) {
  if (!a || a.none || a.table !== 'instruments' || !a.itemId) return [];
  const row = find(db, 'instruments', a.itemId);
  if (!row) return [];
  return parseAccessories(row.accessories).map((acc) => { const sel = (a.accessories || []).find((x) => x.name === acc.name); return { ...acc, selected: !!sel, qty: sel ? sel.qty : 1 }; });
}

/** The quote lines of one assignment, priced from the database: the row, its routing, its ticked accessories. */
export function linesOf(db, req, a) {
  if (!a || a.none) return [];
  const lines = [];
  if (req.kind === 'effort') {
    const rate = a.rateId ? find(db, 'rates', a.rateId) : null;
    lines.push({ id: `${req.id}|effort`, reqId: req.id, section: req.group, name: req.label, qty: Number(a.hours) || 0, unit: rate ? rate.unit : 'h', price: rate ? priceOf(rate) : null, note: rate ? rate.label : 'no rate', source: 'assignment' });
    return lines;
  }
  const row = a.table && a.itemId ? find(db, a.table, a.itemId) : null;
  if (row) lines.push({ id: `${req.id}|item`, reqId: req.id, section: req.group, name: row.name, qty: Number(a.qty) || 0, unit: row.unit || 'pc', price: priceOf(row), note: a.note || '', source: 'assignment', image: row.image || '', maker: a.table === 'instruments' ? row.maker || '' : '', model: a.table === 'instruments' ? row.model || '' : '' });
  for (const r of a.routing || []) {
    const rr = find(db, r.table, r.itemId);
    lines.push({ id: `${req.id}|rt:${r.id}`, reqId: req.id, section: req.group, name: rr ? rr.name : 'a routing part no longer in the database', qty: Number(r.qty) || 0, unit: rr && rr.unit ? rr.unit : 'pc', price: rr ? priceOf(rr) : null, note: `routing of ${row ? row.name : req.label}${r.note ? ' · ' + r.note : ''}`, source: 'assignment', part: 'routing', image: rr ? rr.image || '' : '', maker: rr && r.table === 'instruments' ? rr.maker || '' : '', model: rr && r.table === 'instruments' ? rr.model || '' : '' });
  }
  for (const acc of accessoriesOf(db, a).filter((x) => x.selected)) {
    lines.push({ id: `${req.id}|acc:${acc.name}`, reqId: req.id, section: req.group, name: acc.name, qty: acc.qty, unit: 'pc', price: acc.price, note: `accessory of ${row.name}`, source: 'assignment', part: 'accessory' });
  }
  return lines;
}

/** What one assignment costs in the quote (null when nothing of it is priced). */
export function costOf(db, req, a) {
  let total = null;
  for (const l of linesOf(db, req, a)) if (l.price != null) total = (total || 0) + l.qty * l.price;
  return total;
}

// ---- the quote ----------------------------------------------------------------------------------------

export function buildQuote({ db, job, reqs, meta }) {
  const sections = GROUPS.map((g) => ({ id: g.id, label: g.label, lines: [], subtotal: 0, unpriced: 0 }));
  sections.push({ id: 'services', label: 'Services and other lines', lines: [], subtotal: 0, unpriced: 0 });
  const put = (line) => {
    const sec = sections.find((s) => s.id === line.section) || sections[sections.length - 1];
    const total = line.price != null ? line.qty * line.price : null;
    sec.lines.push({ ...line, total });
    if (total != null) sec.subtotal += total; else sec.unpriced++;
  };
  for (const req of reqs) for (const line of linesOf(db, req, assignment(job, req.id))) put(line);
  for (const line of job.lines || []) put({ ...line, price: line.price != null && line.price !== '' ? Number(line.price) : line.rateId ? priceOf(find(db, 'rates', line.rateId)) : null });
  const subtotal = sections.reduce((n, s) => n + s.subtotal, 0);
  const q = job.quote || { markup: 0, contingency: 0, discount: 0 };
  const markup = subtotal * (Number(q.markup) || 0) / 100;
  const contingency = (subtotal + markup) * (Number(q.contingency) || 0) / 100;
  const discount = (subtotal + markup + contingency) * (Number(q.discount) || 0) / 100;
  const total = subtotal + markup + contingency - discount;
  const unassigned = reqs.filter((r) => !assignment(job, r.id));
  return {
    format: 'vulcano-quote/1', application: meta.application, applicationVersion: meta.applicationVersion, exported: now().slice(0, 10), spec: meta.identity, currency: db.currency,
    company: db.company || {}, details: normaliseQuoteDetails(q.details),
    sections, subtotal, markup, contingency, discount, total, parameters: { markup: Number(q.markup) || 0, contingency: Number(q.contingency) || 0, discount: Number(q.discount) || 0 },
    unpriced: sections.reduce((n, s) => n + s.unpriced, 0), unassigned: unassigned.map((r) => ({ id: r.id, label: r.label, group: r.group })),
    openQuestions: (job.questions || []).filter((x) => x.status === 'open' || x.status === 'asked').map((x) => ({ number: x.number, text: x.text, priceImpact: x.priceImpact || '' })),
    hours: sections.reduce((n, s) => n + s.lines.filter((l) => l.unit === 'h').reduce((m, l) => m + l.qty, 0), 0),
  };
}

/** Lines the cost patterns suggest from the assignments — offered, never added by themselves. */
export function suggestedLines({ db, job, reqs, derived }) {
  const live = buildQuote({ db, job, reqs, meta: { application: '', applicationVersion: '', identity: {} } });
  const q = {
    channels: reqs.filter((r) => r.kind === 'instrument').reduce((n, r) => n + r.channels, 0),
    points: derived.points.length, probes: reqs.filter((r) => r.partKind === 'probe').reduce((n, r) => n + r.count, 0),
    actuators: reqs.filter((r) => r.partKind === 'actuator').length, resources: reqs.filter((r) => r.kind === 'instrument').length,
    stages: derived.doc.stages.filter((s) => !isSetup(s)).length, steps: derived.steps.length, criteria: derived.criteria.length,
    interfaces: (derived.doc.interfaces || []).length, commands: (derived.doc.commands || []).length, variants: (derived.doc.variants || []).length,
  };
  const KEY = { perChannel: 'channels', perPoint: 'points', perProbe: 'probes', perActuator: 'actuators', perResource: 'resources', perStage: 'stages', perStep: 'steps', perCriterion: 'criteria', perInterface: 'interfaces', perCommand: 'commands', perVariant: 'variants' };
  const RATE = { 'rate-hardware': 'rat_hardware', 'rate-software': 'rat_software', 'rate-mechanical': 'rat_mechanical', 'rate-test': 'rat_test', 'rate-management': 'rat_management', 'rate-test-day': 'rat_onsite' };
  const buildHours = live.sections.filter((s) => s.id !== 'services').reduce((n, s) => n + s.lines.filter((l) => l.unit === 'h').reduce((m, l) => m + l.qty, 0), 0);
  const out = [];
  for (const cp of COST_PATTERNS) {
    if (cp.driver === 'perDriver' || cp.discipline === 'software' && ['sequence', 'limits', 'driver', 'feature', 'framework'].includes(cp.kind)) continue; // the software slots already ask for these hours
    if (cp.unit !== 'h' && cp.unit !== 'day') continue;
    let qty = cp.driver === 'fixed' ? cp.factor : cp.driver === 'shareOfBuild' ? cp.factor * buildHours : (cp.base || 0) + cp.factor * (q[KEY[cp.driver]] || 0);
    qty = Math.round(qty * 10) / 10;
    if (!qty) continue;
    const rateId = RATE[cp.rateId] || '';
    const rate = rateId ? find(db, 'rates', rateId) : null;
    const already = (job.lines || []).some((l) => l.patternId === cp.id);
    out.push({ patternId: cp.id, section: cp.discipline === 'signalPath' || cp.discipline === 'bench' ? 'bench' : cp.discipline === 'fixture' ? 'contacts' : cp.discipline === 'software' ? 'software' : 'services', name: cp.label, qty, unit: cp.unit, rateId, rateLabel: rate ? rate.label : '', price: rate ? priceOf(rate) : null, how: describe(cp, q, buildHours), already });
  }
  return out;
}
const describe = (cp, q, build) => cp.driver === 'fixed' ? `${cp.factor} ${cp.unit}, a fixed allowance` : cp.driver === 'shareOfBuild' ? `${Math.round(cp.factor * 100)} % of the ${Math.round(build)} h of build in the quote` : `${cp.factor} ${cp.unit} × ${q[({ perChannel: 'channels', perPoint: 'points', perProbe: 'probes', perActuator: 'actuators', perResource: 'resources', perStage: 'stages', perStep: 'steps', perCriterion: 'criteria', perInterface: 'interfaces', perCommand: 'commands', perVariant: 'variants' })[cp.driver]] || 0} ${cp.driver.replace(/^per/, '').toLowerCase()}${cp.base ? ` + ${cp.base} ${cp.unit}` : ''}`;

export function addLine(job, fields) {
  const line = { id: newId('ln'), section: 'services', name: '', qty: 1, unit: 'pc', price: null, rateId: '', note: '', source: 'manual', ...fields };
  job.lines.push(line);
  return line;
}
export const removeLine = (job, id) => { job.lines = job.lines.filter((l) => l.id !== id); };
export const progress = (job, reqs) => ({ done: reqs.filter((r) => assignment(job, r.id)).length, total: reqs.length });

/** The figures the Project page recaps: the specification, the progress per group, the money per group and the quote. */
export function projectSummary({ db, job, reqs, derived, meta }) {
  const q = buildQuote({ db, job, reqs, meta });
  const groups = GROUPS.map((g) => {
    const own = reqs.filter((r) => r.group === g.id);
    const sec = q.sections.find((s) => s.id === g.id);
    return { id: g.id, label: g.label, done: own.filter((r) => assignment(job, r.id)).length, total: own.length, subtotal: sec ? sec.subtotal : 0, unpriced: sec ? sec.unpriced : 0, hours: sec ? sec.lines.filter((l) => l.unit === 'h').reduce((n, l) => n + l.qty, 0) : 0 };
  });
  const services = q.sections.find((s) => s.id === 'services');
  return {
    spec: { stages: derived.doc.stages.filter((s) => !isSetup(s)).length, setups: derived.doc.stages.filter(isSetup).length, steps: derived.steps.length, criteria: derived.criteria.length, points: derived.points.length, resources: derived.resources.rows.filter((r) => !r.resource.missing).length, cycleSeconds: derived.cycle.parallel, interfaces: (derived.doc.interfaces || []).length, variants: (derived.doc.variants || []).length },
    progress: progress(job, reqs), groups, services: { subtotal: services ? services.subtotal : 0, lines: services ? services.lines.length : 0 },
    quote: { subtotal: q.subtotal, total: q.total, hours: q.hours, unpriced: q.unpriced, markup: q.markup, contingency: q.contingency, discount: q.discount, parameters: q.parameters },
    questions: { open: (job.questions || []).filter((x) => x.status === 'open' || x.status === 'asked').length, total: (job.questions || []).length },
  };
}
