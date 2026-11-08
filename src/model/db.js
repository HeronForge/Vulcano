// The database: what the builder owns and picks from — instruments, parts, rates, standard
// items and services, their own checklist items — embedded in the HTML file beside the
// project, edited in the tool, imported and exported table by table. It starts with a
// starter set drawn from the knowledge base (indicative prices, clearly marked) and grows
// with every job.
import { newId } from './ids.js';
import { INSTRUMENT_CLASSES, CONTACT_TYPES } from '../kb/reference.js';
import { parseQuantity, unitFamily } from './spec.js';

export const DB_VERSION = 1;

/** The tables, with the columns the editor shows and the JSON import/export formats. */
export const TABLES = {
  instruments: {
    label: 'Instruments', prefix: 'ins', format: 'vulcano-catalogue', listKey: 'instruments',
    columns: [
      ['image', 'Image', 'image'], ['name', 'Name', 'text'], ['maker', 'Maker', 'text'], ['model', 'Model', 'text'], ['category', 'Category', 'text'], ['channels', 'Channels', 'number'],
      ['interfaces', 'Interfaces', 'text'], ['accuracy', 'Accuracy % of reading', 'number'], ['characteristics', 'Characteristics (name value unit; …)', 'text'],
      ['accessories', 'Accessories', 'accessories'], ['price', 'Price', 'number'], ['leadTimeWeeks', 'Lead time (weeks)', 'number'], ['notes', 'Notes', 'text'],
    ],
    hint: 'One row per instrument you would buy or already own. Category and characteristics are what the suggestions match against a resource of the specification; accuracy feeds the advanced accuracy check. Accessories are what can be added when the instrument is assigned — a rack mount kit, a communication interface, a multiplexer card, a lead set — each with its own price; add one below the list.',
    groupKey: 'category', groupLabel: 'Category', groupPlural: 'categories',
  },
  parts: {
    label: 'Parts and contacts', prefix: 'prt', format: 'vulcano-parts', listKey: 'parts',
    columns: [
      ['image', 'Image', 'image'], ['name', 'Name', 'text'], ['kind', 'Kind', 'select', ['probe', 'clip', 'connector', 'cable', 'actuator', 'relay', 'sensor', 'other']], ['matches', 'Matches contact type (text)', 'text'],
      ['current', 'Current (A)', 'number'], ['resistance', 'Adds (Ω)', 'number'], ['life', 'Cycle life', 'number'], ['channels', 'Channels', 'number'], ['price', 'Price', 'number'], ['notes', 'Notes', 'text'],
    ],
    hint: 'Probes, clips, connectors, cables, actuators, relays and switching cards. «Matches» is what the suggestions look for in the contact type of a point («Ø 1.3 mm», «clip», «pneumatic»); «Channels» is what a relay card switches, so the routing of an instrument can be sized.',
    groupKey: 'kind', groupLabel: 'Kind', groupPlural: 'kinds',
  },
  rates: {
    label: 'Rates', prefix: 'rat', format: 'vulcano-ratecard', listKey: 'rates',
    columns: [['label', 'Rate', 'text'], ['unit', 'Unit', 'select', ['h', 'day']], ['price', 'Price', 'number'], ['notes', 'Notes', 'text']],
    hint: 'Hourly and daily rates the effort lines of the quote are priced with.',
  },
  items: {
    label: 'Standard items and services', prefix: 'itm', format: 'vulcano-items', listKey: 'items',
    columns: [['image', 'Image', 'image'], ['name', 'Name', 'text'], ['kind', 'Kind', 'select', ['bench', 'safety', 'fixture', 'software', 'service', 'other']], ['unit', 'Unit', 'text'], ['price', 'Price', 'number'], ['notes', 'Notes', 'text']],
    hint: 'What every bench carries and what is sold as a service: cabinet, safety set, licences, documentation, FAT, training, spares.',
    groupKey: 'kind', groupLabel: 'Kind', groupPlural: 'kinds',
  },
  checklists: {
    label: 'Your checklist items', prefix: 'chk', format: 'vulcano-kb', listKey: 'checklists',
    columns: [['discipline', 'Discipline', 'select', ['bench', 'hardware', 'software', 'fixture', 'services']], ['situation', 'Situation', 'text'], ['title', 'Item', 'text'], ['why', 'Why it matters', 'text'], ['when', 'When (words the specification must contain, or blank = always)', 'text']],
    hint: 'Items added to the built-in checklists. «When» is a list of words: the item applies when the specification mentions one of them; leave it blank for an item that always applies.',
    groupKey: 'discipline', groupLabel: 'Discipline', groupPlural: 'disciplines',
  },
};

export const TABLE_IDS = Object.keys(TABLES);

/** Your own commercial identity — who issues the quote — kept with the database because it is yours, not any one job's. */
export const emptyCompany = () => ({ name: '', address: '', vat: '', contact: '', email: '', phone: '', website: '' });

/** A database with the starter content: the knowledge base's classes and contact types as rows with indicative prices. */
export function starterDb() {
  const db = { version: DB_VERSION, currency: 'EUR', name: 'My database', company: emptyCompany(), instruments: [], parts: [], rates: [], items: [], checklists: [] };
  // A few accessories on the classes that usually carry them, so the extras of an assignment have something to show.
  const starterAccessories = { 'dmm-6.5': 'Test lead set 60; Rack mount kit 110; Multiplexer card, 20 channels 950', 'daq-mux': 'Multiplexer module, 20 channels 750; Rack mount kit 110', 'scope-4ch': 'Passive probe 10:1 90; Current probe 30 A 620', 'ac-source-3ph': 'Output cable set, 16 A 180', 'safety-analyser': 'HV test lead set 140; Remote start box 260' };
  for (const c of INSTRUMENT_CLASSES) {
    db.instruments.push({ id: `ins_${c.id}`, name: c.label, maker: '', model: '', category: c.category, channels: c.channels, interfaces: c.interfaces.join(', '), accuracy: c.accuracy.percent, characteristics: '', accessories: starterAccessories[c.id] || '', image: '', price: c.costBand, leadTimeWeeks: null, notes: `Generic class, indicative price — replace with what you buy. ${c.notes}`, classId: c.id });
  }
  const starterParts = { 'kelvin-probe': [28, 'kelvin probe, four-wire probe'], 'probe-0.9': [9, 'Ø 0.9, 0.9 mm'], 'probe-1.3': [12, 'Ø 1.3, 1.3 mm'], 'probe-2': [15, 'Ø 2, 2 mm'], 'probe-generic': [12, 'probe, pogo, pad'], 'kelvin-clip': [45, 'kelvin clip'], 'clip-4mm': [18, '4 mm, clip, banana'], 'connector-mated': [120, 'connector, plug, socket, mated, pluggable'], 'terminal-screw': [6, 'terminal, screw, lug'], 'cable': [45, 'cable, lead, harness, patch'] };
  for (const ct of CONTACT_TYPES) {
    if (!(ct.id in starterParts)) continue;
    const [price, matches] = starterParts[ct.id];
    db.parts.push({ id: `prt_${ct.id}`, name: ct.label, kind: /probe/.test(ct.id) ? 'probe' : /clip/.test(ct.id) ? 'clip' : ct.id === 'connector-mated' ? 'connector' : ct.id === 'cable' ? 'cable' : 'other', matches, current: ct.current, resistance: ct.resistance, life: ct.life, channels: null, image: '', price, notes: `Indicative. ${ct.notes}` });
  }
  db.parts.push({ id: 'prt_actuator_pneumatic', name: 'Pneumatic actuator with valve and sensors', kind: 'actuator', matches: 'press, push, mate, present', current: 0, resistance: 0, life: 1000000, channels: null, image: '', price: 620, notes: 'Indicative. One per action to perform.' });
  db.parts.push({ id: 'prt_relay_channel', name: 'Relay channel on the interface board', kind: 'relay', matches: '', current: 2, resistance: 0.1, life: 10000000, channels: 1, image: '', price: 22, notes: 'Indicative. One per switched channel: the routing of an instrument over its points.' });
  db.parts.push({ id: 'prt_relay_card_16', name: 'Relay multiplexer card, 16 channels, 2-wire', kind: 'relay', matches: '', current: 2, resistance: 0.1, life: 10000000, channels: 16, image: '', price: 680, notes: 'Indicative. One card routes one instrument over up to 16 points.' });
  db.parts.push({ id: 'prt_relay_power', name: 'Power relay, 30 A, on the interface board', kind: 'relay', matches: '', current: 30, resistance: 0.005, life: 100000, channels: 1, image: '', price: 45, notes: 'Indicative. For a source or a load routed over several points.' });
  for (const [id, label, unit, price] of [['rat_hardware', 'Hardware engineering', 'h', 75], ['rat_software', 'Software engineering', 'h', 80], ['rat_mechanical', 'Mechanical engineering', 'h', 70], ['rat_test', 'Test engineering', 'h', 65], ['rat_management', 'Project management', 'h', 90], ['rat_onsite', 'Engineer on site', 'day', 650]]) db.rates.push({ id, label, unit, price, notes: 'Indicative.' });
  for (const [id, name, kind, unit, price] of [
    ['itm_cabinet', 'Bench frame and cabinet, standard', 'bench', 'set', 4500], ['itm_power', 'Bench power distribution and wiring', 'bench', 'set', 1800], ['itm_safety', 'Safety circuit: interlocked guard, safety relay, e-stop', 'safety', 'set', 1400], ['itm_hv_cables', 'HV-rated cable and connector set', 'safety', 'set', 650],
    ['itm_fixture_pneumatic', 'Pneumatic bed-of-nails fixture, interlocked', 'fixture', 'pc', 9500], ['itm_fixture_manual', 'Manual clamp fixture', 'fixture', 'pc', 3600], ['itm_board', 'Interface board (design, layout, assembly)', 'fixture', 'pc', 3800], ['itm_harness', 'Fixture harness to the interface board', 'fixture', 'set', 900], ['itm_hood', 'Hood or enclosure around a measurement area', 'fixture', 'pc', 600],
    ['itm_licence', 'Sequencer deployment licence', 'software', 'seat', 1500], ['itm_framework', 'Test framework set-up (sequencer, report, logging)', 'software', 'set', 2400],
    ['itm_docs', 'Documentation set (wiring, manual, calibration, safety file)', 'service', 'set', 2600], ['itm_fat', 'Factory and site acceptance tests', 'service', 'day', 650], ['itm_training', 'Operator and maintenance training', 'service', 'day', 650], ['itm_commissioning', 'Commissioning on site', 'service', 'day', 650], ['itm_spares', 'Spare parts kit (probes, relays, connectors)', 'service', 'kit', 800], ['itm_calibration', 'Initial calibration certificates', 'service', 'set', 1200], ['itm_ce', 'Risk assessment and CE declaration of the bench', 'service', 'set', 1600],
  ]) db.items.push({ id, name, kind, unit, price, image: '', notes: 'Indicative.' });
  return db;
}

/** The tables whose rows can carry a picture (a file in the IMG folder beside this HTML file). */
export const IMAGE_TABLES = TABLE_IDS.filter((t) => TABLES[t].columns.some(([, , type]) => type === 'image'));

export const emptyDb = () => ({ version: DB_VERSION, currency: 'EUR', name: 'My database', company: emptyCompany(), instruments: [], parts: [], rates: [], items: [], checklists: [] });

export function newRow(table) {
  const t = TABLES[table];
  const row = { id: newId(t.prefix) };
  for (const [key, , type] of t.columns) row[key] = type === 'number' ? null : '';
  return row;
}

export const find = (db, table, id) => (db[table] || []).find((r) => r.id === id) || null;
export const priceOf = (row) => (row && row.price != null && row.price !== '' && Number.isFinite(Number(row.price)) ? Number(row.price) : null);

/** The values of a table's grouping field (category, kind, discipline…), each with how many rows carry it — for a filter, or for a collapsible tree. */
export function groupValuesOf(db, table) {
  const t = TABLES[table];
  if (!t || !t.groupKey) return [];
  const counts = new Map();
  for (const r of db[table] || []) {
    const v = String(r[t.groupKey] || '').trim() || '(uncategorised)';
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
}

/** Rows sorted by one of a table's columns, ascending or descending; an empty key leaves the order as it is (as entered, or already ranked). */
export function sortedRows(rows, columns, key, dir = 'asc') {
  if (!key) return rows;
  const col = (columns || []).find((c) => c[0] === key);
  const numeric = col ? col[2] === 'number' : false;
  return sortByField(rows, key, dir, numeric, (r) => r);
}

/** The comparator behind `sortedRows` and the pickers' own sort controls: sorts `list` by `get(item)[key]`. */
export function sortByField(list, key, dir, numeric, get = (x) => x) {
  if (!key) return list;
  const sign = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = get(a)[key];
    const bv = get(b)[key];
    if (numeric) {
      const an = av == null || av === '' ? -Infinity : Number(av);
      const bn = bv == null || bv === '' ? -Infinity : Number(bv);
      return sign * (an - bn);
    }
    return sign * String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Brings a database read from a file or an older block to the current shape. */
export function normaliseDb(input) {
  const db = { ...emptyDb(), ...(input && typeof input === 'object' ? input : {}) };
  for (const t of TABLE_IDS) db[t] = Array.isArray(db[t]) ? db[t].filter((r) => r && typeof r === 'object').map((r) => ({ ...newRow(t), ...r, id: r.id || newId(TABLES[t].prefix) })) : [];
  db.company = { ...emptyCompany(), ...(db.company && typeof db.company === 'object' ? db.company : {}) };
  db.version = DB_VERSION;
  return db;
}

// ---- import / export per table ------------------------------------------------------------------

/** A table as its own envelope (the catalogue and rate card formats are the same files docs/DATA-FILES.md describes). */
export function exportTable(db, table, meta) {
  const t = TABLES[table];
  const rows = (db[table] || []).map((r) => ({ ...r }));
  if (table === 'instruments') for (const r of rows) { r.characteristics = parseCharacteristics(r.characteristics); r.accessories = parseAccessories(r.accessories); }
  return { format: `${t.format}/1`, application: meta.application, applicationVersion: meta.applicationVersion, exported: new Date().toISOString().slice(0, 10), name: `${db.name} — ${t.label}`, currency: db.currency, [t.listKey]: rows };
}

/** Reads a table file; rows with an id already present are replaced, others appended. */
export function importTable(db, table, data) {
  const t = TABLES[table];
  if (!data || typeof data !== 'object') throw new Error('This file does not contain a JSON object.');
  const declared = String(data.format || '').split('/')[0];
  if (declared && declared !== t.format && !(table === 'checklists' && declared === 'vulcano-kb')) throw new Error(`This file is «${data.format}», not a ${t.label.toLowerCase()} file (${t.format}/1).`);
  const version = Number(String(data.format || '').split('/')[1] || 1);
  if (version > 1) throw new Error(`This file is written in ${t.format}/${version}; this build reads up to ${t.format}/1.`);
  const list = data[t.listKey];
  if (!Array.isArray(list)) throw new Error(`This file holds no «${t.listKey}» list.`);
  const report = { added: 0, replaced: 0, skipped: 0 };
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') { report.skipped++; continue; }
    const row = { ...newRow(table), ...pickColumns(table, raw), id: raw.id || newId(t.prefix) };
    if (table === 'instruments') {
      if (Array.isArray(raw.characteristics)) row.characteristics = raw.characteristics.map((c) => `${c.name || ''} ${c.value ?? ''} ${c.unit || ''}`.trim()).join('; ');
      if (Array.isArray(raw.accessories)) row.accessories = raw.accessories.map((a) => `${a.name || ''} ${a.price ?? ''}`.trim()).join('; ');
      if (Array.isArray(raw.accuracy)) { const a = raw.accuracy.find((x) => x.quantity === 'voltage') || raw.accuracy[0]; row.accuracy = a ? Number(a.percent) : null; }
      if (Array.isArray(raw.interfaces)) row.interfaces = raw.interfaces.join(', ');
      if (raw.classId) row.classId = raw.classId;
    }
    if (table === 'checklists' && raw.trigger && !row.when) row.when = triggerWords(raw.trigger);
    const i = db[table].findIndex((r) => r.id === row.id);
    if (i >= 0) { db[table][i] = row; report.replaced++; } else { db[table].push(row); report.added++; }
  }
  if (data.currency && table === 'rates') db.currency = String(data.currency);
  return report;
}

const pickColumns = (table, raw) => {
  const out = {};
  for (const [key, , type] of TABLES[table].columns) if (raw[key] != null && !Array.isArray(raw[key])) out[key] = type === 'number' ? (raw[key] === '' ? null : Number(raw[key])) : String(raw[key]);
  return out;
};
const triggerWords = (trigger) => { const words = []; const walk = (c) => { if (!c) return; if (Array.isArray(c.all)) c.all.forEach(walk); if (Array.isArray(c.any)) c.any.forEach(walk); if (c.value) words.push(...(Array.isArray(c.value) ? c.value : [c.value])); }; walk(trigger); return words.join(', '); };

/** The whole database as one file, and back. */
export const exportDb = (db, meta) => ({ format: 'vulcano-db/1', application: meta.application, applicationVersion: meta.applicationVersion, exported: new Date().toISOString().slice(0, 10), db: { ...db } });
export function importDb(data) {
  if (!data || typeof data !== 'object' || !data.db) throw new Error('This file is not a VULCANO database (vulcano-db/1).');
  const version = Number(String(data.format || 'vulcano-db/1').split('/')[1] || 1);
  if (version > 1) throw new Error(`This database is written in vulcano-db/${version}; this build reads up to vulcano-db/1.`);
  return normaliseDb(data.db);
}

// ---- characteristics text ----------------------------------------------------------------------------

/** «DC voltage 0 … 1000 V; Accuracy ±0.0035 %» → [{ name, value, unit }]. */
export function parseCharacteristics(text) {
  if (Array.isArray(text)) return text;
  return String(text || '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(?:(.*?)\s+)?((?:[<>≤≥±]|\+\/-)?\s*[-+]?\d[\d.,]*(?:\s*(?:…|\.\.\.?|÷|–|-|to)\s*[-+]?\d[\d.,]*)?)\s*([^\d]*)$/.exec(s);
    if (!m) return { name: s, value: '', unit: '' };
    return { name: (m[1] || '').trim(), value: m[2].trim(), unit: m[3].trim() };
  });
}

/** «Test lead set 60; Rack mount kit 110» → [{ name, price }]; a trailing number is the price, else the price is unknown. */
export function parseAccessories(text) {
  if (Array.isArray(text)) return text.map((a) => ({ name: String(a.name || ''), price: a.price == null || a.price === '' ? null : Number(a.price) }));
  return String(text || '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(.*?)\s+([-+]?\d[\d.]*)\s*$/.exec(s);
    return m ? { name: m[1].trim(), price: Number(m[2]) } : { name: s, price: null };
  });
}

/** The inverse of `parseAccessories`: [{ name, price }] → «Test lead set 60; Rack mount kit». */
export function formatAccessories(list) {
  return (list || []).map((a) => (a.price != null && a.price !== '' ? `${a.name} ${a.price}` : a.name)).filter((s) => s && s.trim()).join('; ');
}

/**
 * What in the database can route an instrument over its points: the relay parts first, then
 * anything whose name speaks of switching, then the rest when asked. The suggested quantity
 * follows the channels: one per channel for a relay, one card per `channels` it switches.
 */
export function suggestRouting(db, { channels = 1, search = '', all = false } = {}) {
  const q = String(search || '').toLowerCase();
  const out = [];
  for (const table of ['parts', 'items', 'instruments']) {
    for (const row of db[table] || []) {
      const t = `${row.name} ${row.notes || ''} ${row.category || ''}`.toLowerCase();
      let score = 0; const reasons = [];
      if (table === 'parts' && row.kind === 'relay') { score += 3; reasons.push('a relay part'); }
      if (/relay|mux|multiplex|matrix|switch|routing/.test(t)) { score += 1; reasons.push('speaks of switching'); }
      if (q && !`${row.name} ${row.kind || ''} ${row.category || ''}`.toLowerCase().includes(q)) continue;
      if (!q && !all && !score) continue;
      const per = Number(row.channels) || 0;
      const suggestedQty = per > 1 ? Math.max(1, Math.ceil(channels / per)) : channels;
      out.push({ row, table, score, reasons, suggestedQty });
    }
  }
  return out.sort((a, b) => b.score - a.score || (priceOf(a.row) || 0) - (priceOf(b.row) || 0));
}

// ---- suggestions: what in the database fits a requirement --------------------------------------------

/** Instruments ranked for a resource: category and name first, then channels and accuracy. Every item stays available; the ranking is the help. */
export function suggestInstruments(db, resource, { classIds = [], requiredPercent = null, channels = 1 } = {}) {
  const words = `${resource.name} ${resource.category}`.toLowerCase().split(/[^a-z0-9½]+/).filter((w) => w.length > 3);
  return (db.instruments || []).map((row) => {
    let score = 0;
    const reasons = [];
    if (row.classId && classIds.includes(row.classId)) { score += 3; reasons.push('class fits the resource'); }
    if (row.category && resource.category && row.category.toLowerCase() === resource.category.toLowerCase()) { score += 2; reasons.push('same category'); }
    const t = `${row.name} ${row.maker} ${row.model} ${row.notes}`.toLowerCase();
    const hits = words.filter((w) => t.includes(w));
    if (hits.length) { score += hits.length; reasons.push(`mentions ${hits.join(', ')}`); }
    let accuracy = null;
    if (requiredPercent != null && row.accuracy != null && row.accuracy !== '') { accuracy = Number(row.accuracy) <= requiredPercent; if (accuracy) { score += 1; reasons.push('accuracy sufficient'); } else reasons.push('accuracy short'); }
    const cover = coverage(row, resource);
    if (cover.short) reasons.push(`short on ${cover.short}`); else if (cover.covers) { score += 1; reasons.push(`covers ${cover.covers}`); }
    const units = row.channels ? Math.max(1, Math.ceil(channels / Number(row.channels))) : channels;
    return { row, score, reasons, accuracy, units, cover };
  }).sort((a, b) => b.score - a.score || (priceOf(a.row) || 0) - (priceOf(b.row) || 0));
}

/** Which characteristics of the resource the instrument covers or falls short of, by name and unit family. */
function coverage(row, resource) {
  const have = parseCharacteristics(row.characteristics);
  const covers = []; const short = [];
  for (const c of resource.characteristics || []) {
    const want = parseQuantity(c.value, c.unit);
    if (want.max == null && want.value == null) continue;
    const match = have.find((h) => h.name.toLowerCase() === String(c.name).toLowerCase()) || have.find((h) => unitFamily(h.unit) === unitFamily(c.unit) && unitFamily(c.unit));
    if (!match) continue;
    const got = parseQuantity(match.value, match.unit);
    const wMax = want.max != null ? want.max : want.value; const gMax = got.max != null ? got.max : got.value;
    if (gMax == null) continue;
    if (/accuracy/i.test(c.name)) (gMax <= wMax ? covers : short).push(c.name); else (gMax >= wMax * (1 - 1e-9) ? covers : short).push(c.name);
  }
  return { covers: covers.join(', '), short: short.join(', ') };
}

/** Parts ranked for a contact type text (and a current to carry). */
export function suggestParts(db, { kind = null, contactType = '', current = null } = {}) {
  const t = String(contactType || '').toLowerCase();
  return (db.parts || []).filter((p) => !kind || p.kind === kind || (kind === 'probe' && p.kind === 'clip') || (kind === 'clip' && p.kind === 'probe')).map((p) => {
    let score = 0; const reasons = [];
    const words = String(p.matches || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    const hits = words.filter((w) => t.includes(w));
    if (hits.length) { score += 2 + hits.length; reasons.push(`matches «${hits.join(', ')}»`); }
    if (kind && p.kind === kind) { score += 1; }
    if (current != null && p.current != null && p.current !== '') { if (Number(p.current) >= current) { score += 1; reasons.push(`carries ${current} A`); } else reasons.push(`rated ${p.current} A, ${current} A needed`); }
    return { row: p, score, reasons };
  }).sort((a, b) => b.score - a.score || (priceOf(a.row) || 0) - (priceOf(b.row) || 0));
}

export const itemsOfKind = (db, kind) => (db.items || []).filter((i) => !kind || i.kind === kind);
