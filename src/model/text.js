// The specification as plain text, chapter by chapter, with its codes — what a prompt inlines
// and what a reader pastes into an AI. Faithful to the document, no interpretation.
import { STEP_TYPE, isSetup } from './schema.js';
import { expectedText, resolveValue } from './spec.js';

export const CHAPTERS = [
  ['identity', 'Identity and description'], ['references', 'References'], ['glossary', 'Glossary'], ['variables', 'Variables'], ['variants', 'Variants'],
  ['resources', 'Resources'], ['interfaces', 'Interfaces and protocols'], ['commands', 'Commands'], ['points', 'Application points'], ['stages', 'Stages, tests and steps'], ['setups', 'Setup stages'],
];

const line = (...parts) => parts.filter((p) => p != null && String(p).trim() !== '').join(' ');
const chars = (list) => (list || []).filter((c) => c.name || c.value).map((c) => `  - ${line(c.name + ':', c.value, c.unit)}`).join('\n');

export function chapterText(derived, chapterId) {
  const { doc, codes, variables } = derived;
  const code = (id) => codes.get(id) || '';
  const name = (id) => { const e = derived.index.get(id); return e ? `${code(id)} ${e.name || e.description || ''}`.trim() : ''; };
  switch (chapterId) {
    case 'identity': return [
      `Title: ${doc.header.title}`, `Company: ${doc.header.company}`, `Project: ${doc.header.project}`, `Product: ${doc.header.product}`, `Document: ${doc.header.documentCode} rev. ${doc.revision.number} (${doc.revision.date}, ${doc.revision.status})`,
      '', 'Product:', doc.description.product, '', 'Testing:', doc.description.testing, doc.header.disclaimer ? `\nDisclaimer:\n${doc.header.disclaimer}` : '',
    ].join('\n');
    case 'references': return (doc.references || []).map((r) => `${code(r.id)} ${r.code} — ${r.title}${r.revision ? ` (${r.revision})` : ''}${r.notes ? `\n  ${r.notes}` : ''}`).join('\n') || '(none)';
    case 'glossary': return (doc.glossary || []).map((g) => `${g.term}: ${g.meaning}`).join('\n') || '(none)';
    case 'variables': return (doc.variables || []).map((v) => `$${v.name} (${v.type}${v.unit ? `, ${v.unit}` : ''}) = ${v.type === 'range' ? `${v.min} … ${v.max}` : v.value}${v.allowedValues && v.allowedValues.length ? ` [${v.allowedValues.join(', ')}]` : ''}${v.description ? ` — ${v.description}` : ''}`).join('\n') || '(none)';
    case 'variants': return (doc.variants || []).map((v) => `${code(v.id)} ${v.name}: ${v.description}\n${(v.overlay || []).map((op) => `  - ${op.op} ${readablePath(op.path, derived)}${op.op === 'set' ? ` = ${formatValue(op.value)}` : op.op === 'add' ? ` ${op.value && op.value.name ? `«${op.value.name}»` : ''}` : ''}`).join('\n')}`).join('\n') || '(none)';
    case 'resources': return (doc.resources || []).map((r) => `${code(r.id)} ${r.name} [${r.category}]${r.averageTime ? `, ${r.averageTime} s per use` : ''}\n${chars(r.characteristics)}${r.notes ? `\n  ${r.notes}` : ''}`).join('\n') || '(none)';
    case 'interfaces': return [
      ...(doc.interfaces || []).map((i) => `${code(i.id)} ${i.name} — ${i.type}${i.resourceId ? `, spoken by ${name(i.resourceId)}` : ''}${(i.pointIds || []).length ? `, wired to ${i.pointIds.map(code).join(', ')}` : ''}\n${chars(i.parameters)}${i.notes ? `\n  ${i.notes}` : ''}`),
      ...(doc.protocols || []).map((p) => `${code(p.id)} Protocol ${p.name} (${p.family})${p.referenceId ? `, defined in ${name(p.referenceId)}` : ''}\n  ${p.description}\n  Request: ${p.requestFormat}\n  Response: ${p.responseFormat}\n${chars(p.rules)}`),
    ].join('\n') || '(none)';
    case 'commands': return (doc.commands || []).map((c) => `${code(c.id)} ${c.name} — over ${name(c.interfaceId) || '?'}${c.protocolId ? `, ${name(c.protocolId)}` : ''}${c.referenceId ? `, defined in ${name(c.referenceId)}` : ''}\n  address: ${c.address}; request: ${c.requestFormat}; response: ${c.responseFormat}${c.negativeResponse ? `; negative: ${c.negativeResponse}` : ''}${c.encoding ? `; encoding: ${c.encoding}` : ''}${c.decoding && c.decoding.formula ? `; decoding: ${c.decoding.formula} → ${c.decoding.unit}` : ''}${c.nominalTime ? `; ${c.nominalTime} s` : ''}${c.notes ? `\n  ${c.notes}` : ''}`).join('\n') || '(none)';
    case 'points': return (doc.points || []).map((p) => `${code(p.id)} ${p.name} — ${line(p.connector, p.pin ? `pin ${p.pin}` : '', p.signal ? `signal ${p.signal}` : '')}; contact: ${p.contactType || '(not stated)'}; on ${(p.markers || []).length ? p.markers.map((m) => code(m.imageId)).join(', ') : 'no picture'}\n${chars(p.characteristics)}${p.notes ? `\n  ${p.notes}` : ''}`).join('\n') || '(none)';
    case 'stages': return (doc.stages || []).filter((s) => !isSetup(s)).map((s) => stageText(derived, s)).join('\n\n') || '(none)';
    case 'setups': return (doc.stages || []).filter(isSetup).map((s) => stageText(derived, s)).join('\n\n') || '(none)';
    default: return '';
  }
}

export function stageText(derived, stage) {
  const { codes, variables } = derived;
  const code = (id) => codes.get(id) || '';
  const head = [`${code(stage.id)} ${stage.name}${isSetup(stage) ? ' (setup stage, runs when called)' : ''}`, stage.description,
    (stage.prerequisites || []).length ? `Prerequisites: ${stage.prerequisites.map(code).join(', ')}` : '',
    stage.exclusions && stage.exclusions.mode !== 'none' ? `Cannot run alongside: ${stage.exclusions.mode === 'all' ? 'any other stage' : (stage.exclusions.stageIds || []).map(code).join(', ')}` : '',
    (stage.heldStimuli || []).length ? `Held on exit: ${stage.heldStimuli.map((h) => `${code(h.stepId)}${h.note ? ` (${h.note})` : ''}`).join('; ')}` : ''].filter(Boolean);
  const tests = (stage.tests || []).map((t) => [`${code(t.id)} ${t.name}${t.kpi ? ' [KPI]' : ''} — ${t.purpose}`, ...(t.steps || []).map((s) => stepText(derived, s))].join('\n'));
  return [...head, ...tests].join('\n');
}

export function stepText(derived, step) {
  const { codes, variables, index } = derived;
  const code = (id) => codes.get(id) || '';
  const cmd = (id) => { const c = index.get(id); return c ? `${code(id)} ${c.name}` : ''; };
  const block = (b, tag) => {
    if (!b) return '';
    const pars = (b.parameters || []).map((p) => { const r = resolveValue(p.value, variables, p.unit); return `${p.name} = ${r.text}${r.variable ? '' : r.unit ? ' ' + r.unit : ''}`; }).join(', ');
    return `    ${tag} ${b.description}${(b.pointIds || []).length ? ` at ${b.pointIds.map(code).join(', ')}` : ''}${b.resourceId ? ` with ${code(b.resourceId)}` : ''}${b.commandId ? ` via ${cmd(b.commandId)}` : ''}${pars ? ` [${pars}]` : ''}`;
  };
  const wait = step.wait && step.wait.value && (step.wait.value.value || step.wait.value.mode === 'variable') ? ` (wait ${resolveValue(step.wait.value, variables, step.wait.unit).text}${step.wait.value.mode === 'variable' ? '' : ' ' + step.wait.unit})` : '';
  const lines = [`  ${code(step.id)} ${step.description}${wait}${step.note ? ` — note: ${step.note}` : ''}`];
  if (step.type === STEP_TYPE.STAGE_CALL) { lines.push(`    CALL ${code(step.calledStageId)} ${(index.get(step.calledStageId) || {}).name || ''}`); return lines.join('\n'); }
  if (step.type === STEP_TYPE.TABLE) {
    const cols = (step.table || {}).columns || [];
    lines.push(`    TABLE columns: ${cols.map((c) => `${c.name} (${c.kind}${c.unit ? `, ${c.unit}` : ''}${c.resourceId ? `, ${code(c.resourceId)}` : ''}${c.commandId ? `, ${cmd(c.commandId)}` : ''})`).join(' | ')}`);
    for (const row of (step.table || {}).rows || []) lines.push(`      ${row.label}: ${(row.cells || []).map((cell) => { const col = cols.find((c) => c.id === cell.columnId); if (!col) return ''; return `${col.name} = ${cell.value ? resolveValue(cell.value, variables, col.unit).text : expectedText({ ...cell.expected, unit: cell.expected.unit || col.unit }, variables)}`; }).filter(Boolean).join('; ')}`);
    return lines.join('\n');
  }
  if (step.stimulus) lines.push(block(step.stimulus, step.stimulus.commandId ? 'SET' : 'APPLY'));
  if (step.measurement) {
    const m = step.measurement;
    if (m.computed) lines.push(`    COMPUTED ${m.description} = ${m.computed.formula} from ${(m.computed.inputStepIds || []).map(code).join(', ')} — expected ${expectedText(m.expected, variables)}`);
    else lines.push(`${block(m, m.commandId ? 'GET' : 'MEASURE')} — expected ${expectedText(m.expected, variables) || '(no criterion)'}`);
  }
  return lines.join('\n');
}

function readablePath(path, derived) {
  return (path || []).map((seg) => (typeof seg === 'string' && seg.startsWith('#') ? derived.codes.get(seg.slice(1)) || seg : seg)).join(' › ');
}
const formatValue = (v) => (v == null ? '' : typeof v !== 'object' ? String(v) : v.mode === 'constant' ? String(v.value ?? '') : v.mode === 'variable' ? '→ variable' : Array.isArray(v) ? `${v.length} elements` : v.name || '(object)');

export function wholeText(derived) {
  return CHAPTERS.map(([id, title]) => `## ${title}\n${chapterText(derived, id)}`).join('\n\n');
}
