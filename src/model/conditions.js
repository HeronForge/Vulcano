// The condition language of the knowledge base — the part that lets a checklist item, a rule
// or a decision guide be written as data and still say something precise. A condition is:
//
//   { all: [c, …] } | { any: [c, …] } | { not: c }
//   { entity: 'resource', field: 'category', op: 'contains', value: 'Safety' }
//   { entity: 'stimulus', field: 'parameter:Voltage', op: 'gte', value: 60, unit: 'V' }
//   { entity: 'spec', field: 'testing', op: 'missing', value: ['temperature', 'ambient'] }
//
// Operators: contains (one of the values, case-insensitive), matches (a regular expression),
// equals, in, exists, missing (the field is empty or does not mention any of the values),
// gte, lte, gt, lt (numbers, in the unit given: a field that parses as «0 … 300 V per phase»
// compares by its top end, a «±0.02 %» by its tolerance). A leaf without `field` matches
// every entity of that type. See docs/KB-FORMAT.md.
import { field } from './entities.js';
import { unitFamily, unitScale } from './spec.js';

const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const lower = (v) => String(v ?? '').toLowerCase();

/** The number a field compares by, scaled to the base unit of the operator's unit. */
function numberOf(value, unit) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value.replace(',', '.')); return Number.isFinite(n) ? n : null; }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') {
    // A parsed quantity: compare by what it has — a value, else a top end, else a tolerance.
    if (unit && value.base && unitFamily(unit) !== unitFamily(value.base) && value.base !== '') return null;
    const n = value.value != null ? value.value : value.max != null ? value.max : value.tolerance != null ? value.tolerance : value.min;
    if (n == null) return null;
    return unit ? n / unitScale(unit).factor : n;
  }
  return null;
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'object') return Array.isArray(value) ? value.map(textOf).join(' ') : String(value.raw ?? value.text ?? '');
  return String(value);
}

function leaf(cond, record) {
  if (cond.entity && cond.entity !== record.type) return false;
  if (!cond.field) return true;
  const value = field(record, cond.field);
  const op = cond.op || 'exists';
  const values = asList(cond.value);
  switch (op) {
    case 'exists': return !(value == null || value === '' || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && value.raw === ''));
    case 'missing': {
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) return true;
      if (!values.length) return false;
      const t = lower(textOf(value));
      return !values.some((v) => t.includes(lower(v)));
    }
    case 'contains': { const t = lower(textOf(value)); return values.some((v) => v !== '' && t.includes(lower(v))); }
    case 'matches': { const t = textOf(value); return values.some((v) => { try { return new RegExp(v, 'i').test(t); } catch { return false; } }); }
    case 'equals': return values.some((v) => (typeof v === 'number' ? numberOf(value, cond.unit) === v : lower(textOf(value)) === lower(v)));
    case 'in': return values.some((v) => lower(textOf(value)) === lower(v));
    case 'gte': case 'lte': case 'gt': case 'lt': {
      const n = numberOf(value, cond.unit);
      const v = Number(values[0]);
      if (n == null || !Number.isFinite(v)) return false;
      return op === 'gte' ? n >= v : op === 'lte' ? n <= v : op === 'gt' ? n > v : n < v;
    }
    default: return false;
  }
}

/** Does a record satisfy a condition? */
export function matches(cond, record) {
  if (!cond) return true;
  if (Array.isArray(cond.all)) return cond.all.every((c) => matches(c, record));
  if (Array.isArray(cond.any)) return cond.any.some((c) => matches(c, record));
  if (cond.not) return !matches(cond.not, record);
  return leaf(cond, record);
}

/** The entity type a condition is about — its leaves must agree, or the condition is about the specification. */
export function conditionEntity(cond) {
  if (!cond) return 'spec';
  if (cond.entity) return cond.entity;
  for (const k of ['all', 'any']) if (Array.isArray(cond[k])) for (const c of cond[k]) { const e = conditionEntity(c); if (e && e !== 'spec') return e; }
  if (cond.not) return conditionEntity(cond.not);
  return 'spec';
}

/** Every record of the condition's entity type that satisfies it. */
export function select(cond, records) {
  const type = conditionEntity(cond);
  return records.filter((r) => r.type === type && matches(cond, r));
}

/** «{{name}} …» templates over a record's fields, with `{{code}}` and `{{label}}` always available. */
export function fill(template, record, extra = {}) {
  return String(template || '').replace(/\{\{\s*([\w.:\- ]+)\s*\}\}/g, (_, key) => {
    const k = key.trim();
    if (k in extra) return String(extra[k] ?? '');
    if (k === 'code') return record.code || '';
    if (k === 'label') return record.label || '';
    if (k === 'name') return record.name || record.label || '';
    const v = field(record, k);
    if (v == null) return '';
    if (typeof v === 'object' && !Array.isArray(v)) return `${v.raw ?? ''}${v.unitText ? ' ' + v.unitText : ''}`.trim();
    return Array.isArray(v) ? v.join(', ') : String(v);
  });
}
