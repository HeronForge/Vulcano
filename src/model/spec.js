// Reading a specification: codes (STG-01, AP-07, $Vbatt), the index of every element, the
// variants as an overlay, the variables behind a value, and the numeric limits behind a
// criterion. Nothing here changes the document.
import { COMPARISON, EXPECTED_KIND, STAGE_KIND, SYMBOL, VARIABLE_TYPE, comparisonOf, expectedKind, expectedTextRef, stringComparisonOf } from './schema.js';

// ---- codes -------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const PREFIXES = { references: 'REF', resources: 'RES', protocols: 'PRT', interfaces: 'IF', commands: 'CMD', points: 'AP', images: 'FIG', variants: 'V' };
const STAGE_PREFIX = { test: 'STG', setup: 'SET' };
const TEST_PREFIX = { test: 'T', setup: 'S' };

/** The printed codes of the document, id → code, exactly as DEDALO numbers them. */
export function computeCodes(doc) {
  const m = new Map();
  const used = new Map();
  const assign = (id, prefix) => {
    const n = (used.get(prefix) || 0) + 1;
    used.set(prefix, n);
    const code = `${prefix}-${pad(n)}`;
    m.set(id, code);
    return code;
  };
  for (const [key, prefix] of Object.entries(PREFIXES)) (doc[key] || []).forEach((e) => assign(e.id, prefix));
  (doc.variables || []).forEach((v) => m.set(v.id, v.name ? `$${v.name}` : '$?'));
  for (const stage of doc.stages || []) {
    const kind = stage.kind === STAGE_KIND.SETUP ? 'setup' : 'test';
    const stageCode = assign(stage.id, STAGE_PREFIX[kind]);
    const n = stageCode.slice(stageCode.indexOf('-') + 1);
    (stage.tests || []).forEach((test, j) => {
      const testCode = `${TEST_PREFIX[kind]}-${n}.${pad(j + 1)}`;
      m.set(test.id, testCode);
      (test.steps || []).forEach((step, k) => m.set(step.id, `${testCode}.${pad(k + 1)}`));
    });
  }
  return m;
}

/** id → element, for every element that has an id, plus the parents of tests and steps. */
export function computeIndex(doc) {
  const m = new Map();
  const add = (arr) => (arr || []).forEach((e) => e && e.id && m.set(e.id, e));
  for (const k of ['references', 'resources', 'protocols', 'interfaces', 'commands', 'points', 'images', 'variants', 'variables', 'glossary']) add(doc[k]);
  for (const stage of doc.stages || []) {
    m.set(stage.id, stage);
    for (const test of stage.tests || []) {
      m.set(test.id, test);
      (test.steps || []).forEach((s) => m.set(s.id, s));
    }
  }
  return m;
}

/** step id → { stage, test, step }, and test id → { stage, test }. */
export function computeParents(doc) {
  const m = new Map();
  for (const stage of doc.stages || []) {
    for (const test of stage.tests || []) {
      m.set(test.id, { stage, test });
      for (const step of test.steps || []) m.set(step.id, { stage, test, step });
    }
  }
  return m;
}

export const nameOf = (e) => (e ? e.name || e.title || e.label || e.description || '' : '');

/** «STG-03 Control Pilot» — code and name, for anything the reader has to find in the document. */
export function labelOf(codes, index, id, maxName = 48) {
  const code = codes.get(id) || '';
  const name = nameOf(index.get(id));
  if (!code && !name) return '⟨missing⟩';
  if (!name) return code;
  const short = name.length > maxName ? name.slice(0, maxName - 1) + '…' : name;
  return code ? `${code} ${short}` : short;
}

// ---- variants: an overlay of operations on the base document ------------------------------

const isRef = (seg) => typeof seg === 'string' && seg.startsWith('#');
const idOf = (seg) => seg.slice(1);
const descend = (node, seg) => {
  if (node == null) return undefined;
  if (isRef(seg)) return Array.isArray(node) ? node.find((e) => e && e.id === idOf(seg)) : undefined;
  return node[seg];
};
function getAt(root, path) {
  let n = root;
  for (const seg of path) { n = descend(n, seg); if (n === undefined) return undefined; }
  return n;
}
function container(root, path) {
  if (!path.length) return null;
  const parent = getAt(root, path.slice(0, -1));
  return parent === undefined ? null : { parent, seg: path[path.length - 1] };
}
function setAt(root, path, value) {
  const c = container(root, path);
  if (!c) return false;
  if (isRef(c.seg)) {
    if (!Array.isArray(c.parent)) return false;
    const i = c.parent.findIndex((e) => e && e.id === idOf(c.seg));
    if (i < 0) return false;
    c.parent[i] = value;
    return true;
  }
  if (c.parent == null || typeof c.parent !== 'object') return false;
  c.parent[c.seg] = value;
  return true;
}
function addAt(root, path, value, index) {
  const arr = getAt(root, path);
  if (!Array.isArray(arr)) return false;
  if (typeof index === 'number' && index >= 0 && index <= arr.length) arr.splice(index, 0, value);
  else arr.push(value);
  return true;
}
function removeAt(root, path) {
  const c = container(root, path);
  if (!c) return false;
  if (isRef(c.seg)) {
    if (!Array.isArray(c.parent)) return false;
    const i = c.parent.findIndex((e) => e && e.id === idOf(c.seg));
    if (i < 0) return false;
    c.parent.splice(i, 1);
    return true;
  }
  if (c.parent == null || typeof c.parent !== 'object') return false;
  delete c.parent[c.seg];
  return true;
}

export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/** The document as one variant sees it; operations the base no longer supports are reported. */
export function applyVariant(baseDoc, variant) {
  const doc = clone(baseDoc);
  const dropped = [];
  if (!variant || !Array.isArray(variant.overlay)) return { doc, dropped };
  for (const op of variant.overlay) {
    let ok = false;
    try {
      if (op.op === 'set') ok = setAt(doc, op.path, clone(op.value));
      else if (op.op === 'add') ok = addAt(doc, op.path, clone(op.value), op.index);
      else if (op.op === 'remove') ok = removeAt(doc, op.path);
    } catch { ok = false; }
    if (!ok) dropped.push(op);
  }
  return { doc, dropped };
}

export function resolveVariant(baseDoc, variantId) {
  if (!variantId) return { doc: baseDoc, variant: null, dropped: [] };
  const variant = (baseDoc.variants || []).find((v) => v.id === variantId);
  if (!variant) return { doc: baseDoc, variant: null, dropped: [] };
  const { doc, dropped } = applyVariant(baseDoc, variant);
  return { doc, variant, dropped };
}

/** The stages a variant removes, without applying the whole overlay. */
export const variantExcludedStages = (variant) => (variant && variant.overlay || [])
  .filter((op) => op.op === 'remove' && Array.isArray(op.path) && op.path.length === 2 && op.path[0] === 'stages' && isRef(op.path[1]))
  .map((op) => idOf(op.path[1]));

// ---- values and variables -----------------------------------------------------------------

export const toNumber = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const variableIndex = (doc) => new Map((doc.variables || []).map((v) => [v.id, v]));

export function variableText(v) {
  switch (v.type) {
    case VARIABLE_TYPE.RANGE: return `${v.min ?? ''} … ${v.max ?? ''}${v.unit ? ' ' + v.unit : ''}`;
    case VARIABLE_TYPE.BOOLEAN: return v.value === true || v.value === 'true' ? 'true' : 'false';
    case VARIABLE_TYPE.NUMBER: return `${v.value ?? ''}${v.unit ? ' ' + v.unit : ''}`;
    default: return String(v.value ?? '');
  }
}

/** A value reference resolved: its text, its number when it has one, its unit, its variable. */
export function resolveValue(ref, variables, fieldUnit = '') {
  if (!ref || typeof ref !== 'object') return { text: '', value: null, unit: fieldUnit, variable: null, missing: false };
  if (ref.mode === 'variable') {
    const v = variables.get(ref.variableId);
    if (!v) return { text: '⟨missing variable⟩', value: null, unit: fieldUnit, variable: null, missing: true };
    return { text: variableText(v), value: v.type === VARIABLE_TYPE.NUMBER ? toNumber(v.value) : (v.type === VARIABLE_TYPE.RANGE ? null : toNumber(v.value)), unit: v.unit || fieldUnit, variable: v, missing: false, range: v.type === VARIABLE_TYPE.RANGE ? { min: toNumber(v.min), max: toNumber(v.max) } : null };
  }
  return { text: String(ref.value ?? ''), value: toNumber(ref.value), unit: fieldUnit, variable: null, missing: false };
}

export function valueText(ref, variables, fieldUnit = '') {
  const r = resolveValue(ref, variables, fieldUnit);
  if (!r.text) return '';
  const u = r.variable ? '' : r.unit ? ' ' + r.unit : '';
  return r.variable ? `${r.text} (${r.variable.name})` : `${r.text}${u}`;
}

// ---- criteria --------------------------------------------------------------------------------

/** The criterion as the document prints it. */
export function expectedText(expected, variables, fallbackUnit = '') {
  const raw = expected;
  if (!raw) return '';
  const e = fallbackUnit && !String(raw.unit || '').trim() ? { ...raw, unit: fallbackUnit } : raw;
  const kind = expectedKind(e);
  if (kind === EXPECTED_KIND.BOOLEAN) return e.booleanValue === 'false' ? 'FALSE' : 'TRUE';
  if (kind === EXPECTED_KIND.STRING) {
    const ref = expectedTextRef(e);
    const r = resolveValue(ref, variables);
    if (r.missing) return '⟨missing variable⟩';
    const text = r.variable ? String(r.variable.value ?? '') : r.text;
    if (!text) return '';
    const from = r.variable && r.variable.name ? ` (${r.variable.name})` : '';
    if (e.regex) return `/${text}/${from}`;
    return `${STRING_COMPARISON_SYMBOL[stringComparisonOf(e)]} "${text}"${from}`;
  }
  const code = comparisonOf(e);
  const spec = COMPARISON[code] || {};
  if (code === 'EQT') {
    const nom = valueText(e.nominal, variables, e.unit);
    const tol = valueText(e.tolerance, variables, e.toleranceType === 'percent' ? '%' : e.unit);
    if (!nom) return '';
    return `${nom} ± ${tol || '⟨missing tolerance⟩'}`;
  }
  if (code === 'NONE') return 'recorded, no pass/fail';
  const min = valueText(e.min, variables, e.unit);
  const max = valueText(e.max, variables, e.unit);
  if (spec.sides === 1) {
    const value = spec.slot === 'max' ? max : min;
    return value ? `${SYMBOL[code]} ${value}` : e.unit || '';
  }
  if (spec.outside) {
    if (min && max) return `${spec.low} ${min} or ${spec.high} ${max}`;
    if (min) return `${spec.low} ${min}`;
    return max ? `${spec.high} ${max}` : e.unit || '';
  }
  if (min && max) return `${spec.low === '>' ? '>' : ''}${min} … ${spec.high === '<' ? '<' : ''}${max}`;
  if (min) return `${spec.low === '>' ? '>' : '≥'} ${min}`;
  if (max) return `${spec.high === '<' ? '<' : '≤'} ${max}`;
  return e.unit || '';
}
const STRING_COMPARISON_SYMBOL = { EQ: '=', NE: '≠', CONTAINS: 'contains', STARTS: 'starts with', ENDS: 'ends with' };

/**
 * The numeric content of a criterion, for the limits table and the accuracy work: low and
 * high limit, nominal and tolerance where the criterion has them, the comparison code, and
 * whether the criterion judges anything at all.
 */
export function criterionLimits(expected, variables) {
  const e = expected || {};
  const kind = expectedKind(e);
  const out = { kind, code: null, min: null, max: null, nominal: null, tolerance: null, toleranceType: e.toleranceType || 'absolute', unit: String(e.unit || ''), judged: true, twoSided: false, span: null, variables: [] };
  const note = (r) => { if (r && r.variable) out.variables.push(r.variable); };
  if (kind !== EXPECTED_KIND.NUMERIC) { out.code = kind; return out; }
  const code = comparisonOf(e);
  out.code = code;
  if (code === 'NONE') { out.judged = false; return out; }
  if (code === 'EQT') {
    const nom = resolveValue(e.nominal, variables); note(nom);
    const tol = resolveValue(e.tolerance, variables); note(tol);
    out.nominal = nom.value;
    out.tolerance = tol.value;
    if (nom.value != null && tol.value != null) {
      const d = out.toleranceType === 'percent' ? Math.abs(nom.value * tol.value / 100) : Math.abs(tol.value);
      out.min = nom.value - d;
      out.max = nom.value + d;
      out.twoSided = true;
      out.span = 2 * d;
      out.toleranceAbsolute = d;
    }
    return out;
  }
  const spec = COMPARISON[code] || {};
  const min = resolveValue(e.min, variables); note(min);
  const max = resolveValue(e.max, variables); note(max);
  if (spec.outside) { out.min = min.value; out.max = max.value; out.outside = true; return out; }
  if (spec.sides === 1) {
    const only = spec.slot === 'max' ? max.value : min.value;
    if (code === 'EQ') { out.min = only; out.max = only; out.nominal = only; out.twoSided = true; out.span = 0; return out; }
    if (code === 'NE') { out.min = null; out.max = null; out.exclude = only; return out; }
    if (spec.slot === 'max') out.max = only; else out.min = only;
    return out;
  }
  out.min = min.value;
  out.max = max.value;
  if (out.min != null && out.max != null) {
    out.twoSided = true;
    out.span = out.max - out.min;
    out.nominal = (out.max + out.min) / 2;
    out.toleranceAbsolute = out.span / 2;
  }
  return out;
}

// ---- resources behind a block --------------------------------------------------------------

export function commandInterfaces(doc) {
  const interfaces = new Map((doc.interfaces || []).map((i) => [i.id, i]));
  const out = new Map();
  for (const c of doc.commands || []) if (c.interfaceId) out.set(c.id, interfaces.get(c.interfaceId) || null);
  return out;
}
/** The points a block touches: the interface's when it sends a command, its own otherwise. */
export function blockPoints(block, interfaceOfCommand) {
  const itf = block.commandId ? interfaceOfCommand.get(block.commandId) : null;
  if (itf) return [...new Set(itf.pointIds || [])];
  return [...new Set(block.pointIds || [])];
}
export function blockResources(block, interfaceOfCommand) {
  const itf = block.commandId ? interfaceOfCommand.get(block.commandId) : null;
  if (itf) return itf.resourceId ? [itf.resourceId] : [];
  return block.resourceId ? [block.resourceId] : [];
}

// ---- parsing the free text of characteristics and parameters ----------------------------------

const NUM = '[-+]?\\d+(?:[.,]\\d+)?(?:[eE][-+]?\\d+)?';
const SI = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

/**
 * A characteristic value as a number or a range, in base units of its unit's family when the
 * unit carries an SI prefix: «0 … 300» V → { min: 0, max: 300 }; «±0.02» % → { tolerance: 0.02 };
 * «< 10» mΩ → { max: 0.01, base: 'Ω' }. Text that is none of these stays text.
 */
export function parseQuantity(value, unit = '') {
  const raw = String(value ?? '').trim();
  const u = String(unit || '').trim();
  const scale = unitScale(u);
  const out = { raw, unit: u, base: scale.base, text: raw, min: null, max: null, value: null, tolerance: null, list: null };
  if (!raw) return out;
  let m = new RegExp(`^(${NUM})\\s*(?:…|\\.\\.\\.?|÷|–|—|-|to)\\s*(${NUM})\\s*([A-Za-zµμΩ%°/]*)$`).exec(raw);
  if (m) { out.min = num(m[1]) * scale.factor; out.max = num(m[2]) * scale.factor; out.value = out.max; return out; }
  m = new RegExp(`^(?:±|\\+/-|\\+-)\\s*(${NUM})\\s*([A-Za-zµμΩ%°/]*)$`).exec(raw);
  if (m) { out.tolerance = num(m[1]) * (m[2] === '%' ? 1 : scale.factor); out.value = out.tolerance; if (m[2]) out.unit = out.unit || m[2]; return out; }
  m = new RegExp(`^(<=|>=|<|>|≤|≥)\\s*(${NUM})\\s*([A-Za-zµμΩ%°/]*)$`).exec(raw);
  if (m) {
    const n = num(m[2]) * scale.factor;
    if (m[1].startsWith('<') || m[1] === '≤') out.max = n; else out.min = n;
    out.value = n;
    return out;
  }
  m = new RegExp(`^(${NUM})\\s*([A-Za-zµμΩ%°/()]*)$`).exec(raw);
  if (m) { out.value = num(m[1]) * scale.factor; if (m[2] && !u) { const s2 = unitScale(m[2]); out.value = num(m[1]) * s2.factor; out.base = s2.base; out.unit = m[2]; } return out; }
  // «100 / 220 / 680 / 1500» Ω — a list of values
  if (new RegExp(`^${NUM}(\\s*[/,;]\\s*${NUM})+$`).test(raw)) {
    out.list = raw.split(/\s*[/,;]\s*/).map((t) => num(t) * scale.factor);
    out.min = Math.min(...out.list); out.max = Math.max(...out.list); out.value = out.max;
    return out;
  }
  // «10 Ω … 1 MΩ» — a range with a unit on each side
  m = new RegExp(`^(${NUM})\\s*([A-Za-zµμΩ]+)\\s*(?:…|\\.\\.\\.?|÷|–|-|to)\\s*(${NUM})\\s*([A-Za-zµμΩ]+)$`).exec(raw);
  if (m) {
    const a = unitScale(m[2]); const b = unitScale(m[4]);
    out.min = num(m[1]) * a.factor; out.max = num(m[3]) * b.factor; out.value = out.max; out.base = b.base; out.unit = out.unit || b.base;
    return out;
  }
  return out;
}
const num = (t) => Number(String(t).replace(',', '.'));

/** «mA» → { factor: 1e-3, base: 'A' }; «V per phase» → { factor: 1, base: 'V' }; «kV AC» → { factor: 1e3, base: 'V' }. */
export function unitScale(unit) {
  const u = String(unit || '').trim();
  if (!u) return { factor: 1, base: '' };
  const first = u.split(/[\s/]/)[0];
  if (first === '%' || first === '°C' || first === 'ppm' || first === 'dB' || first.startsWith('dB')) return { factor: 1, base: first };
  const m = /^([pnuµμmkKMG])?([A-Za-zΩ°]+)$/.exec(first);
  if (!m) return { factor: 1, base: first };
  const prefix = m[1];
  const base = m[2];
  // «m» alone is metres, «mm» millimetres: only strip a prefix when a base remains and the
  // pair is not a unit in its own right (min, ms handled: ms → s with 1e-3; min → min).
  if (first === 'min' || first === 'mm' && base === 'm') return { factor: first === 'mm' ? 1e-3 : 1, base: first === 'mm' ? 'm' : 'min' };
  if (!prefix) return { factor: 1, base };
  return { factor: SI[prefix] || 1, base };
}

/** The dimensional family of a unit, so «mA» and «A» compare and «V» and «A» do not. */
export function unitFamily(unit) {
  const base = unitScale(unit).base.replace(/[^A-Za-zΩ°%]/g, '');
  const FAMILIES = { V: 'voltage', A: 'current', Ω: 'resistance', Ohm: 'resistance', ohm: 'resistance', W: 'power', Hz: 'frequency', s: 'time', min: 'time', h: 'time', F: 'capacitance', H: 'inductance', '°C': 'temperature', '%': 'ratio', ppm: 'ratio', bar: 'pressure', N: 'force', mm: 'length', m: 'length', dB: 'level', 'dB(A)': 'level', bit: 'data', B: 'data', kVA: 'power', VA: 'power', kW: 'power' };
  return FAMILIES[base] || base.toLowerCase();
}
