// The tables computed once from the specification and shared by every tool (SCOPE §3.1):
// resources with their channels as DEDALO counts them, points against what touches them,
// every criterion with its limits, and the cycle time estimate. Plus the flat lists — uses,
// stimuli, criteria — the rules and the realisation model read.
import { STEP_TYPE, isSetup, setupStages, stepBlocks, stepCriteria, testStages } from './schema.js';
import { blockPoints, blockResources, commandInterfaces, computeCodes, computeIndex, computeParents, criterionLimits, expectedText, parseQuantity, resolveValue, resolveVariant, variableIndex } from './spec.js';
import { findStep, parallelGroupsDetailed, runningStages, transitivePrerequisites } from './stages.js';

// ---- uses: every time a block of a step needs a resource ------------------------------------

export function collectUses(doc) {
  const uses = [];
  const interfaceOfCommand = commandInterfaces(doc);
  for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) {
    for (const { kind, block, column } of stepBlocks(step)) {
      const points = blockPoints(block, interfaceOfCommand);
      const itf = block.commandId ? interfaceOfCommand.get(block.commandId) : null;
      for (const resourceId of blockResources(block, interfaceOfCommand)) {
        uses.push({ resourceId, kind, block, column: column || null, stageId: stage.id, testId: test.id, stepId: step.id, pointIds: points, interfaceId: itf ? itf.id : '', commandId: block.commandId || '' });
      }
      if (!blockResources(block, interfaceOfCommand).length) {
        uses.push({ resourceId: '', kind, block, column: column || null, stageId: stage.id, testId: test.id, stepId: step.id, pointIds: points, interfaceId: itf ? itf.id : '', commandId: block.commandId || '' });
      }
    }
  }
  return uses;
}

const channelKeys = (use) => (use.pointIds.length ? use.pointIds.map((p) => 'pt:' + p) : ['step:' + use.stepId]);

function heldChannels(doc, owners) {
  const interfaces = commandInterfaces(doc);
  const perStage = new Map();
  const add = (stageId, resourceId, keys) => {
    if (!perStage.has(stageId)) perStage.set(stageId, new Map());
    const m = perStage.get(stageId);
    if (!m.has(resourceId)) m.set(resourceId, new Set());
    for (const k of keys) m.get(resourceId).add(k);
  };
  for (const stage of doc.stages || []) for (const held of stage.heldStimuli || []) {
    const step = findStep(stage, held.stepId);
    const block = step && step.stimulus;
    if (!block) continue;
    const keys = channelKeys({ pointIds: blockPoints(block, interfaces), stepId: step.id });
    for (const resourceId of blockResources(block, interfaces)) for (const ownerId of owners.get(stage.id) || [stage.id]) add(ownerId, resourceId, keys);
  }
  return perStage;
}

/**
 * The resource / channel table: for each resource, the channels needed at once — the largest
 * sum over any set of stages that may run together, held stimuli included — the stages that
 * use it, the points it touches and the parameters the steps set on it.
 */
export function resourceSummary(doc) {
  const uses = collectUses(doc).filter((u) => u.resourceId);
  const transitive = transitivePrerequisites(doc);
  const { groups, truncated } = parallelGroupsDetailed(doc);
  const owners = runningStages(doc);
  const held = heldChannels(doc, owners);
  const channels = new Map();
  const add = (resourceId, stageId, keys) => {
    if (!channels.has(resourceId)) channels.set(resourceId, new Map());
    const perStage = channels.get(resourceId);
    if (!perStage.has(stageId)) perStage.set(stageId, new Set());
    for (const k of keys) perStage.get(stageId).add(k);
  };
  for (const use of uses) for (const stageId of owners.get(use.stageId) || [use.stageId]) add(use.resourceId, stageId, channelKeys(use));
  for (const stage of doc.stages || []) for (const prereqId of transitive.get(stage.id) || []) {
    const m = held.get(prereqId);
    if (!m) continue;
    for (const [resourceId, keys] of m) add(resourceId, stage.id, keys);
  }
  const rows = [];
  for (const resource of doc.resources || []) rows.push(buildRow(doc, resource, channels.get(resource.id) || new Map(), uses, groups, truncated));
  for (const [resourceId, perStage] of channels) {
    if ((doc.resources || []).some((r) => r.id === resourceId)) continue;
    rows.push(buildRow(doc, { id: resourceId, name: '⟨missing resource⟩', missing: true, characteristics: [] }, perStage, uses, groups, truncated));
  }
  return { rows, groups, truncated };
}

function buildRow(doc, resource, perStage, uses, groups, truncated) {
  const channelsPerStage = new Map([...perStage].map(([stageId, set]) => [stageId, set.size]));
  // The refined count: a channel is a wire to a point, and two coexisting stages that reach the
  // same point share it. DEDALO sums per stage; the largest union over a group is what gets built.
  let refinedChannels = 0;
  let refinedGroup = null;
  for (const group of groups) {
    const union = new Set();
    for (const stageId of group) for (const k of perStage.get(stageId) || []) union.add(k);
    if (union.size > refinedChannels) { refinedChannels = union.size; refinedGroup = group; }
  }
  for (const [, set] of perStage) if (set.size > refinedChannels) refinedChannels = set.size;
  let maxChannels = 0;
  let criticalGroup = null;
  for (const group of groups) {
    const sum = group.reduce((acc, stageId) => acc + (channelsPerStage.get(stageId) || 0), 0);
    if (sum > maxChannels) { maxChannels = sum; criticalGroup = group; }
  }
  for (const [, n] of channelsPerStage) if (n > maxChannels) maxChannels = n;
  if (truncated) {
    const total = [...channelsPerStage.values()].reduce((a, b) => a + b, 0);
    if (total > maxChannels) { maxChannels = total; criticalGroup = null; }
  }
  const own = uses.filter((u) => u.resourceId === resource.id);
  const usedPoints = new Set();
  let usesWithoutPoint = 0;
  for (const u of own) {
    if (u.pointIds.length) u.pointIds.forEach((p) => usedPoints.add(p));
    else usesWithoutPoint++;
  }
  const points = (doc.points || []).filter((p) => usedPoints.has(p.id)).map((p) => p.id);
  for (const id of usedPoints) if (!points.includes(id)) points.push(id);
  const stageIds = [...new Set(own.map((u) => u.stageId))];
  const interfaceIds = [...new Set(own.map((u) => u.interfaceId).filter(Boolean))];
  const parameters = new Map();
  for (const u of own) for (const p of u.block.parameters || []) {
    if (!p.name) continue;
    if (!parameters.has(p.name)) parameters.set(p.name, { name: p.name, unit: p.unit || '', values: [] });
    parameters.get(p.name).values.push(p.value);
  }
  return {
    resource, approximate: !!truncated, uses: own, points, usesWithoutPoint, channelsPerStage, maxChannels, criticalGroup, refinedChannels, refinedGroup,
    stageIds, interfaceIds, parameters: [...parameters.values()],
    stimulusUses: own.filter((u) => u.kind === 'stimulus').length,
    measurementUses: own.filter((u) => u.kind === 'measurement').length,
  };
}

// ---- cycle time -----------------------------------------------------------------------------

export const seconds = (value, unit) => {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n === 0) return 0;
  const u = String(unit || 's').trim().toLowerCase();
  if (u === 'ms') return n / 1e3;
  if (u === 'us' || u === 'µs' || u === 'μs') return n / 1e6;
  if (u === 'min' || u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  return n;
};
const parseSeconds = (value) => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const buildIndex = (doc) => ({
  variables: variableIndex(doc),
  interfaceOfCommand: commandInterfaces(doc),
  commands: new Map((doc.commands || []).map((c) => [c.id, c])),
  resources: new Map((doc.resources || []).map((r) => [r.id, r])),
  stages: new Map((doc.stages || []).map((s) => [s.id, s])),
});

function waitSeconds(step, index) {
  const w = step.wait || {};
  const r = resolveValue(w.value, index.variables, w.unit);
  return seconds(r.value != null ? r.value : r.text, r.unit);
}

function stepTime(doc, step, index) {
  const wait = waitSeconds(step, index);
  let commands = 0;
  let resources = 0;
  const times = step.type === STEP_TYPE.TABLE ? Math.max(1, ((step.table || {}).rows || []).length) : 1;
  for (const { block } of stepBlocks(step)) {
    if (block.commandId) commands += times * parseSeconds((index.commands.get(block.commandId) || {}).nominalTime);
    for (const id of blockResources(block, index.interfaceOfCommand)) resources += times * parseSeconds((index.resources.get(id) || {}).averageTime);
  }
  return { wait, commands, resources, total: wait + commands + resources };
}

function stageTime(doc, stage, index, seen = new Set()) {
  let total = 0;
  const parts = { wait: 0, commands: 0, resources: 0, calls: 0 };
  for (const test of stage.tests || []) for (const step of test.steps || []) {
    if (step.type === STEP_TYPE.STAGE_CALL) {
      const called = index.stages.get(step.calledStageId);
      if (called && !seen.has(called.id)) {
        const inner = stageTime(doc, called, index, new Set([...seen, called.id]));
        parts.calls += inner.total;
        total += inner.total;
      }
      const wait = waitSeconds(step, index);
      total += wait;
      parts.wait += wait;
      continue;
    }
    const t = stepTime(doc, step, index);
    parts.wait += t.wait; parts.commands += t.commands; parts.resources += t.resources;
    total += t.total;
  }
  return { ...parts, total };
}

/** DEDALO's cycle time estimate: serial sum, and the parallel schedule over the coexisting groups. */
export function estimateCycleTime(doc) {
  const index = buildIndex(doc);
  const tests = testStages(doc);
  const rows = tests.map((stage) => ({ stage, ...stageTime(doc, stage, index) }));
  const byId = new Map(rows.map((r) => [r.stage.id, r]));
  const serial = rows.reduce((n, r) => n + r.total, 0);
  const { groups, truncated } = parallelGroupsDetailed(doc);
  const covered = new Set();
  let parallel = 0;
  const schedule = [];
  for (const group of groups) {
    const members = group.filter((id) => !covered.has(id) && byId.has(id));
    if (!members.length) continue;
    const longest = Math.max(...members.map((id) => byId.get(id).total));
    parallel += longest;
    schedule.push({ ids: members, seconds: longest });
    for (const id of members) covered.add(id);
  }
  for (const row of rows) {
    if (covered.has(row.stage.id)) continue;
    parallel += row.total;
    schedule.push({ ids: [row.stage.id], seconds: row.total });
  }
  const usedResources = new Set();
  const usedCommands = new Set();
  for (const stage of doc.stages || []) for (const t of stage.tests || []) for (const s of t.steps || []) for (const { block } of stepBlocks(s)) {
    for (const id of blockResources(block, index.interfaceOfCommand)) usedResources.add(id);
    if (block.commandId) usedCommands.add(block.commandId);
  }
  const missing = {
    resources: (doc.resources || []).filter((r) => usedResources.has(r.id) && !parseSeconds(r.averageTime)),
    commands: (doc.commands || []).filter((c) => usedCommands.has(c.id) && !parseSeconds(c.nominalTime)),
  };
  return { stages: rows, setups: setupStages(doc).map((s) => ({ stage: s, ...stageTime(doc, s, index) })), serial, parallel, schedule, truncated, missing };
}

export function formatSeconds(total) {
  if (!total) return '—';
  if (total < 60) return `${Math.round(total * 10) / 10} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  return [h ? `${h} h` : null, h || m ? `${m} min` : null, `${s} s`].filter(Boolean).join(' ');
}

// ---- stimuli: what is applied, with numbers ---------------------------------------------------

/** The value without its unit: a variable's text carries the unit, a constant's does not. */
const plainText = (r) => {
  if (!r.variable) return r.text;
  const v = r.variable;
  if (v.type === 'range') return `${v.min ?? ''} … ${v.max ?? ''}`;
  return String(v.value ?? '');
};

/** Every stimulus block with its parameters resolved to numbers in base units where they parse. */
export function collectStimuli(doc) {
  const variables = variableIndex(doc);
  const interfaceOfCommand = commandInterfaces(doc);
  const out = [];
  for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) {
    if (step.type === STEP_TYPE.TABLE) {
      const columns = ((step.table || {}).columns || []).filter((c) => c.kind === 'stimulus');
      for (const column of columns) {
        const values = [];
        for (const row of (step.table || {}).rows || []) {
          const cell = (row.cells || []).find((c) => c.columnId === column.id);
          if (!cell) continue;
          const r = resolveValue(cell.value, variables, column.unit);
          values.push({ row, text: plainText(r), value: r.value, unit: r.unit || column.unit, variable: r.variable, range: r.range });
        }
        out.push({ stageId: stage.id, testId: test.id, stepId: step.id, description: column.name, pointIds: blockPoints(column, interfaceOfCommand), resourceIds: blockResources(column, interfaceOfCommand), commandId: column.commandId || '', parameters: [{ name: column.name, unit: column.unit, values }], table: true });
      }
      continue;
    }
    if (!step.stimulus) continue;
    const s = step.stimulus;
    const parameters = (s.parameters || []).map((p) => {
      const r = resolveValue(p.value, variables, p.unit);
      const text = plainText(r);
      const q = parseQuantity(text, r.unit);
      return { name: p.name, unit: r.unit || p.unit, text, value: r.value, variable: r.variable, quantity: q, values: [{ text, value: r.value, unit: r.unit || p.unit, variable: r.variable, range: r.range }] };
    });
    out.push({ stageId: stage.id, testId: test.id, stepId: step.id, description: s.description, pointIds: blockPoints(s, interfaceOfCommand), resourceIds: blockResources(s, interfaceOfCommand), commandId: s.commandId || '', parameters, table: false, block: s });
  }
  return out;
}

// ---- criteria table ---------------------------------------------------------------------------

/** One row per criterion, with its limits resolved for the base document. */
export function criteriaRows(doc) {
  const variables = variableIndex(doc);
  const interfaceOfCommand = commandInterfaces(doc);
  const commands = new Map((doc.commands || []).map((c) => [c.id, c]));
  const out = [];
  for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) {
    for (const c of stepCriteria(step)) {
      const command = c.block.commandId ? commands.get(c.block.commandId) : null;
      const fallbackUnit = command && command.decoding && command.decoding.unit ? command.decoding.unit : (c.column ? c.column.unit : '');
      const e = c.expected.unit ? c.expected : { ...c.expected, unit: fallbackUnit };
      const limits = criterionLimits(e, variables);
      const resourceIds = blockResources(c.block, interfaceOfCommand);
      out.push({
        id: c.cell ? c.cell.id : step.id,
        stageId: stage.id, testId: test.id, stepId: step.id, cellId: c.cell ? c.cell.id : '', rowLabel: c.row ? c.row.label : '', columnName: c.column ? c.column.name : '',
        setup: isSetup(stage), kpi: !!test.kpi,
        quantity: c.column ? c.column.name : (c.block.description || step.description || ''),
        text: expectedText(e, variables),
        expected: e, limits, resourceIds, pointIds: blockPoints(c.block, interfaceOfCommand), commandId: c.block.commandId || '', computed: !!c.computed,
      });
    }
  }
  return out;
}

/**
 * The criteria table with one column set per variant: the base row and, for each variant,
 * the same criterion resolved through the variant's overlay (or «excluded» when the variant
 * removes the stage, the step or the cell).
 */
export function criteriaTable(baseDoc) {
  const base = criteriaRows(baseDoc);
  const variants = (baseDoc.variants || []).map((variant) => {
    const { doc } = resolveVariant(baseDoc, variant.id);
    const rows = new Map(criteriaRows(doc).map((r) => [r.id, r]));
    return { variant, rows };
  });
  return { rows: base, variants };
}

// ---- point table --------------------------------------------------------------------------------

export function pointTable(doc, uses = collectUses(doc), stimuli = collectStimuli(doc)) {
  const out = [];
  const byPoint = new Map();
  for (const u of uses) for (const p of u.pointIds) { if (!byPoint.has(p)) byPoint.set(p, []); byPoint.get(p).push(u); }
  const stimuliByPoint = new Map();
  for (const s of stimuli) for (const p of s.pointIds) { if (!stimuliByPoint.has(p)) stimuliByPoint.set(p, []); stimuliByPoint.get(p).push(s); }
  for (const point of doc.points || []) {
    const own = byPoint.get(point.id) || [];
    const resourceIds = [...new Set(own.map((u) => u.resourceId).filter(Boolean))];
    const interfaceIds = [...new Set([...(doc.interfaces || []).filter((i) => (i.pointIds || []).includes(point.id)).map((i) => i.id), ...own.map((u) => u.interfaceId).filter(Boolean)])];
    const characteristics = (point.characteristics || []).map((c) => ({ ...c, quantity: parseQuantity(c.value, c.unit) }));
    out.push({
      point, uses: own, resourceIds, interfaceIds, stimuli: stimuliByPoint.get(point.id) || [], characteristics,
      stageIds: [...new Set(own.map((u) => u.stageId))],
      stimulusUses: own.filter((u) => u.kind === 'stimulus').length,
      measurementUses: own.filter((u) => u.kind === 'measurement').length,
      marked: (point.markers || []).length > 0,
    });
  }
  return out;
}

// ---- the whole derived set ---------------------------------------------------------------------

/** Everything computed from one document (base or one variant), in one object every tool reads. */
export function deriveAll(doc) {
  const codes = computeCodes(doc);
  const index = computeIndex(doc);
  const parents = computeParents(doc);
  const uses = collectUses(doc);
  const stimuli = collectStimuli(doc);
  const resources = resourceSummary(doc);
  const cycle = estimateCycleTime(doc);
  const points = pointTable(doc, uses, stimuli);
  const criteria = criteriaRows(doc);
  const variables = variableIndex(doc);
  const stepsList = [];
  for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) stepsList.push({ stage, test, step });
  return { doc, codes, index, parents, uses, stimuli, resources, cycle, points, criteria, variables, steps: stepsList, interfaceOfCommand: commandInterfaces(doc) };
}
