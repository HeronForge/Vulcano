// B2 · Running the rules. The built-in rules carry code; the rules a user adds through a
// knowledge-base extension are declarative (`when` + `message` + `question`), evaluated over
// the flattened records. Every finding is keyed on rule and element so that, run again after a
// change, it lands on the same open question and keeps its status.
import { fill, select } from './conditions.js';
import { labelOf } from './spec.js';

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 };

export function runRules({ derived, records, kb, assets = {}, source = null }) {
  const ctx = { derived, records, doc: derived.doc, codes: derived.codes, index: derived.index, assets, source, label: (id) => labelOf(derived.codes, derived.index, id) };
  const findings = [];
  const errors = [];
  for (const rule of kb.rules) {
    try {
      const out = typeof rule.check === 'function' ? rule.check(ctx) : declarative(rule, ctx);
      for (const f of out || []) findings.push({ ...f, key: `${f.ruleId}|${f.elementId || ''}|${(f.data && f.data.criterionId) || ''}`, title: rule.title, category: rule.category });
    } catch (e) {
      errors.push({ ruleId: rule.id, error: String(e && e.message || e) });
    }
  }
  findings.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) || a.ruleId.localeCompare(b.ruleId));
  return { findings, errors };
}

const CHAPTER_OF = { resource: 'resources', point: 'points', interface: 'interfaces', command: 'commands', variable: 'variables', variant: 'variants', stage: 'stages', step: 'stages', stimulus: 'stages', criterion: 'stages', image: 'images', spec: 'testing' };

/** A rule written as data: every record its condition selects is one finding. */
function declarative(rule, ctx) {
  const matched = select(rule.when, ctx.records);
  return matched.map((record) => ({
    ruleId: rule.id, severity: rule.severity || 'info', elementId: record.id, elementType: record.type, chapter: CHAPTER_OF[record.type] || 'general',
    label: record.label, message: fill(rule.message || rule.title, record), question: fill(rule.question || '', record), why: rule.rationale || '', blocks: rule.blocks || [], data: {},
  }));
}

export const severityLabel = (s) => ({ error: 'Error', warning: 'Warning', info: 'Information' }[s] || s);
