// D · The software tools: the sequence skeleton (D1) as a neutral JSON and as a
// TestStand-oriented structure, and the limits table (D2) with one column set per variant and
// the guard-banded limits beside the nominal ones.
import { COMPARISON, EXPECTED_KIND, STEP_TYPE, expectedTextRef, isSetup, stepCriteria } from './schema.js';
import { criterionLimits, expectedText, labelOf, resolveValue, resolveVariant, variableIndex } from './spec.js';
import { seconds } from './derived.js';
import { levels } from './stages.js';

// ---- D1 · sequence skeleton ----------------------------------------------------------------------

const TS_STEP_TYPE = { numeric: 'NumericLimitTest', string: 'StringValueTest', boolean: 'PassFailTest', multiple: 'MultipleNumericLimitTest', action: 'Action', call: 'SequenceCall', wait: 'Wait', label: 'Label' };

/** The sequence as data: stages as sequences, setup stages as callable subsequences, switching and settling inserted, constraints as annotations. */
export function sequenceSkeleton({ derived, switchingFor = () => 'dedicated', sequencer = 'TestStand', accuracy = null, meta }) {
  const doc = derived.doc;
  const variables = derived.variables;
  const label = (id) => labelOf(derived.codes, derived.index, id);
  const commands = new Map((doc.commands || []).map((c) => [c.id, c]));
  const guardOf = new Map(accuracy ? accuracy.rows.filter((r) => r.guard).map((r) => [r.criterion.id, r.guard]) : []);
  const stepsOut = (test, stage) => {
    const out = [];
    for (const step of test.steps || []) {
      const code = derived.codes.get(step.id);
      const wait = step.wait && step.wait.value ? resolveValue(step.wait.value, variables, step.wait.unit) : null;
      const waitSeconds = wait ? seconds(wait.value != null ? wait.value : wait.text, wait.unit) : 0;
      if (step.type === STEP_TYPE.STAGE_CALL) {
        out.push({ id: step.id, code, name: step.description, type: 'call', calls: step.calledStageId, callsCode: derived.codes.get(step.calledStageId), teststand: { type: TS_STEP_TYPE.call, sequence: sequenceName(derived, step.calledStageId) }, annotations: annotations(step, waitSeconds) });
        continue;
      }
      // Switching before a block that reaches a resource behind a multiplexer or a matrix.
      const switched = new Set();
      for (const { block, kind } of blocksOf(step)) {
        for (const rid of resourcesOf(derived, block)) {
          const topology = switchingFor(rid);
          if (topology && topology !== 'dedicated' && !switched.has(rid)) {
            switched.add(rid);
            out.push({ id: `${step.id}:switch:${rid}`, code: `${code}·sw`, name: `Route ${derived.codes.get(rid)} to ${pointsOf(derived, block).map((p) => derived.codes.get(p)).join(', ') || 'the step'}`, type: 'switch', inserted: true, teststand: { type: TS_STEP_TYPE.action, module: `Switch.${topology === 'matrix' ? 'Connect' : 'Select'}` }, annotations: [`settle ${topology === 'matrix' ? 15 : 10} ms`] });
          }
        }
      }
      if (step.type === STEP_TYPE.TABLE) {
        const columns = (step.table || {}).columns || [];
        const rows = ((step.table || {}).rows || []).map((row) => ({ label: row.label, cells: (row.cells || []).map((cell) => { const col = columns.find((c) => c.id === cell.columnId); return col ? { column: col.name, kind: col.kind, value: cell.value ? resolveValue(cell.value, variables, col.unit).text : '', expected: cell.expected ? expectedText({ ...cell.expected, unit: cell.expected.unit || col.unit }, variables) : '', limits: cell.expected ? limitsOut(cell.expected, variables, col.unit, guardOf.get(cell.id)) : null } : null; }).filter(Boolean) }));
        out.push({ id: step.id, code, name: step.description, type: 'table', columns: columns.map((c) => ({ name: c.name, kind: c.kind, unit: c.unit, resource: c.resourceId ? derived.codes.get(c.resourceId) : '', command: c.commandId ? (commands.get(c.commandId) || {}).name : '' })), rows, teststand: { type: TS_STEP_TYPE.multiple, note: 'one MultipleNumericLimitTest per row, or a loop over the rows' }, annotations: annotations(step, waitSeconds) });
        continue;
      }
      const stimulus = step.stimulus ? blockOut(derived, step.stimulus, variables, commands) : null;
      const measurement = step.measurement ? { ...blockOut(derived, step.measurement, variables, commands), computed: step.measurement.computed ? { formula: step.measurement.computed.formula, inputs: (step.measurement.computed.inputStepIds || []).map((id) => derived.codes.get(id)) } : null, expected: expectedText(step.measurement.expected, variables), limits: limitsOut(step.measurement.expected, variables, '', guardOf.get(step.id)) } : null;
      const kind = measurement ? (measurement.limits ? measurement.limits.kind : 'numeric') : 'action';
      out.push({ id: step.id, code, name: step.description, type: step.type, stimulus, measurement, teststand: { type: measurement ? TS_STEP_TYPE[kind] || TS_STEP_TYPE.numeric : TS_STEP_TYPE.action, comparison: measurement && measurement.limits ? measurement.limits.comparison : undefined, kpi: !!test.kpi }, annotations: annotations(step, waitSeconds) });
      if (waitSeconds > 0 && step.type !== STEP_TYPE.MEASUREMENT) out.push({ id: `${step.id}:wait`, code: `${code}·wait`, name: `Wait ${wait.text} ${wait.unit}`, type: 'wait', inserted: true, seconds: waitSeconds, teststand: { type: TS_STEP_TYPE.wait } });
    }
    return out;
  };
  const stageOut = (stage) => ({
    id: stage.id, code: derived.codes.get(stage.id), name: stage.name, kind: isSetup(stage) ? 'setup' : 'test', sequence: sequenceName(derived, stage.id), description: stage.description,
    prerequisites: (stage.prerequisites || []).map((id) => derived.codes.get(id)), exclusions: stage.exclusions && stage.exclusions.mode !== 'none' ? { mode: stage.exclusions.mode, stages: (stage.exclusions.stageIds || []).map((id) => derived.codes.get(id)) } : null,
    heldStimuli: (stage.heldStimuli || []).map((h) => ({ step: derived.codes.get(h.stepId), note: h.note })),
    tests: (stage.tests || []).map((test) => ({ id: test.id, code: derived.codes.get(test.id), name: test.name, purpose: test.purpose, kpi: !!test.kpi, steps: stepsOut(test, stage) })),
  });
  const order = levels(doc).map((level) => level.map((id) => derived.codes.get(id)));
  return {
    format: 'vulcano-sequence/1', application: meta.application, applicationVersion: meta.applicationVersion, exported: new Date().toISOString().slice(0, 10), spec: meta.identity,
    sequencer,
    main: { name: 'MainSequence', order, note: 'Each level may run in parallel where the exclusions allow; each stage is a Sequence Call.' },
    stages: doc.stages.filter((s) => !isSetup(s)).map(stageOut), setups: doc.stages.filter(isSetup).map(stageOut),
    variants: (doc.variants || []).map((v) => ({ code: derived.codes.get(v.id), name: v.name, excludes: (v.overlay || []).filter((op) => op.op === 'remove' && op.path[0] === 'stages' && op.path.length === 2).map((op) => derived.codes.get(op.path[1].slice(1))) })),
  };
}

const sequenceName = (derived, stageId) => { const s = derived.index.get(stageId); return s ? `${derived.codes.get(stageId)} ${s.name}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') : ''; };
const blocksOf = (step) => { const out = []; if (step.stimulus) out.push({ kind: 'stimulus', block: step.stimulus }); if (step.measurement && !step.measurement.computed) out.push({ kind: 'measurement', block: step.measurement }); if (step.type === STEP_TYPE.TABLE) for (const c of (step.table || {}).columns || []) out.push({ kind: c.kind, block: c }); return out; };
const resourcesOf = (derived, block) => { const itf = block.commandId ? derived.interfaceOfCommand.get(block.commandId) : null; if (itf) return itf.resourceId ? [itf.resourceId] : []; return block.resourceId ? [block.resourceId] : []; };
const pointsOf = (derived, block) => { const itf = block.commandId ? derived.interfaceOfCommand.get(block.commandId) : null; return itf ? itf.pointIds || [] : block.pointIds || []; };
const annotations = (step, waitSeconds) => { const out = []; if (step.note) out.push(step.note); if (waitSeconds) out.push(`wait ${waitSeconds} s`); if (step.imageId) out.push('refers to a figure'); return out; };

function blockOut(derived, block, variables, commands) {
  const cmd = block.commandId ? commands.get(block.commandId) : null;
  return {
    description: block.description, points: (block.pointIds || []).map((id) => derived.codes.get(id)), resource: block.resourceId ? derived.codes.get(block.resourceId) : (cmd && derived.interfaceOfCommand.get(cmd.id) && derived.interfaceOfCommand.get(cmd.id).resourceId ? derived.codes.get(derived.interfaceOfCommand.get(cmd.id).resourceId) : ''),
    command: cmd ? { code: derived.codes.get(cmd.id), name: cmd.name, address: cmd.address, request: cmd.requestFormat, response: cmd.responseFormat, decoding: cmd.decoding && cmd.decoding.formula ? cmd.decoding : null, nominalTime: cmd.nominalTime } : null,
    parameters: (block.parameters || []).map((p) => { const r = resolveValue(p.value, variables, p.unit); return { name: p.name, value: r.variable ? String(r.variable.value ?? '') : r.text, unit: r.unit || p.unit, variable: r.variable ? r.variable.name : '' }; }),
  };
}

function limitsOut(expected, variables, fallbackUnit, guard) {
  const e = expected.unit ? expected : { ...expected, unit: fallbackUnit };
  const L = criterionLimits(e, variables);
  if (L.kind === EXPECTED_KIND.STRING) {
    const r = resolveValue(expectedTextRef(e), variables);
    return { kind: 'string', comparison: e.regex ? 'REGEX' : (e.stringComparison || 'EQ'), text: r.variable ? String(r.variable.value ?? '') : r.text, caseSensitive: e.caseSensitive !== false, variable: r.variable ? r.variable.name : '' };
  }
  if (L.kind === EXPECTED_KIND.BOOLEAN) return { kind: 'boolean', expected: e.booleanValue !== 'false' };
  const out = { kind: 'numeric', comparison: L.code, unit: L.unit, low: L.min, high: L.max, nominal: L.nominal, tolerance: L.tolerance, toleranceType: L.toleranceType, variables: L.variables.map((v) => v.name) };
  if (guard) out.guarded = { low: guard.min, high: guard.max, collapsed: guard.collapsed };
  return out;
}

// ---- D2 · limits table -------------------------------------------------------------------------------

/** One row per criterion, one column set per variant, the guard-banded limits beside the nominal ones. */
export function limitsTable({ derived, baseDoc, accuracy = null }) {
  const guardOf = new Map(accuracy ? accuracy.rows.filter((r) => r.guard).map((r) => [r.criterion.id, r.guard]) : []);
  const variants = (baseDoc.variants || []).map((variant) => {
    const { doc } = resolveVariant(baseDoc, variant.id);
    const vars = variableIndex(doc);
    const rows = new Map();
    for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) for (const c of stepCriteria(step)) {
      const id = c.cell ? c.cell.id : step.id;
      const e = c.expected.unit ? c.expected : { ...c.expected, unit: c.column ? c.column.unit : '' };
      rows.set(id, { text: expectedText(e, vars), limits: criterionLimits(e, vars) });
    }
    return { variant, code: derived.codes.get(variant.id), rows };
  });
  const rows = derived.criteria.map((c) => {
    const L = c.limits;
    const guard = guardOf.get(c.id);
    const stage = derived.index.get(c.stageId); const test = derived.index.get(c.testId);
    return {
      id: c.id, stage: `${derived.codes.get(c.stageId)} ${stage ? stage.name : ''}`, test: `${derived.codes.get(c.testId)} ${test ? test.name : ''}`, step: derived.codes.get(c.stepId), row: c.rowLabel, quantity: c.quantity,
      unit: L.unit, kind: L.kind, comparison: L.code === 'string' || L.code === 'boolean' ? L.code : L.code, condition: (COMPARISON[L.code] || {}).condition || L.code,
      low: L.min, high: L.max, nominal: L.nominal, tolerance: L.tolerance, toleranceType: L.toleranceType, text: c.text, variables: L.variables.map((v) => `$${v.name}`).join(', '),
      guardedLow: guard ? guard.min : null, guardedHigh: guard ? guard.max : null, kpi: c.kpi ? 'KPI' : '', resource: c.resourceIds.map((id) => derived.codes.get(id)).join(', '), command: c.commandId ? derived.codes.get(c.commandId) : '',
      perVariant: variants.map((v) => { const r = v.rows.get(c.id); return r ? { code: v.code, text: r.text, low: r.limits.min, high: r.limits.max, nominal: r.limits.nominal, tolerance: r.limits.tolerance } : { code: v.code, text: '— excluded —', low: null, high: null, nominal: null, tolerance: null }; }),
    };
  });
  const columns = [['stage', 'Stage'], ['test', 'Test'], ['step', 'Step'], ['row', 'Row'], ['quantity', 'Quantity'], ['unit', 'Unit'], ['comparison', 'Comparison'], ['low', 'Low'], ['high', 'High'], ['nominal', 'Nominal'], ['tolerance', 'Tolerance'], ['toleranceType', 'Tol. type'], ['variables', 'Variable'], ['guardedLow', 'Guarded low'], ['guardedHigh', 'Guarded high'], ['kpi', 'KPI'], ['resource', 'Resource'], ['command', 'Command']];
  for (const v of variants) { columns.push([`v:${v.code}:low`, `${v.code} low`], [`v:${v.code}:high`, `${v.code} high`], [`v:${v.code}:nominal`, `${v.code} nominal`], [`v:${v.code}:tolerance`, `${v.code} tol.`]); }
  const flat = rows.map((r) => { const o = { ...r }; for (const pv of r.perVariant) { o[`v:${pv.code}:low`] = pv.low; o[`v:${pv.code}:high`] = pv.high; o[`v:${pv.code}:nominal`] = pv.nominal; o[`v:${pv.code}:tolerance`] = pv.tolerance; } return o; });
  return { rows, flat, columns, variants: variants.map((v) => ({ code: v.code, name: v.variant.name })) };
}
