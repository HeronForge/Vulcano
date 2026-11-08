// The stage graph as DEDALO reads it: prerequisites, exclusions, who calls a setup stage,
// and which test stages may run alongside each other. The bench count and the cycle time
// depend on these, so they follow DEDALO's compiled output to the letter.
import { EXCLUSION_MODE, STEP_TYPE, isTestStage, testStages } from './schema.js';

export const stageIndex = (doc) => new Map((doc.stages || []).map((s) => [s.id, s]));

const prerequisites = (stage, index) => ((stage && stage.prerequisites) || []).filter((id) => index.has(id));

export function findStep(stage, stepId) {
  for (const t of stage.tests || []) {
    const s = (t.steps || []).find((x) => x.id === stepId);
    if (s) return s;
  }
  return null;
}

/** called stage id → the steps that call it. */
export function callMap(doc) {
  const out = new Map();
  for (const stage of doc.stages || []) for (const test of stage.tests || []) for (const step of test.steps || []) {
    if (step.type !== STEP_TYPE.STAGE_CALL || !step.calledStageId) continue;
    if (!out.has(step.calledStageId)) out.set(step.calledStageId, []);
    out.get(step.calledStageId).push({ stageId: stage.id, testId: test.id, stepId: step.id });
  }
  return out;
}

/** stage id → the test stages in whose run it happens (a setup stage runs inside its callers). */
export function runningStages(doc) {
  const index = stageIndex(doc);
  const calls = callMap(doc);
  const out = new Map();
  const resolve = (id, seen) => {
    const stage = index.get(id);
    if (!stage) return new Set();
    if (isTestStage(stage)) return new Set([id]);
    if (seen.has(id)) return new Set();
    seen.add(id);
    const owners = new Set();
    for (const caller of calls.get(id) || []) for (const owner of resolve(caller.stageId, seen)) owners.add(owner);
    seen.delete(id);
    return owners.size ? owners : new Set([id]);
  };
  for (const id of index.keys()) out.set(id, resolve(id, new Set()));
  return out;
}

export function transitivePrerequisites(doc) {
  const index = new Map(testStages(doc).map((s) => [s.id, s]));
  const memo = new Map();
  const visit = (id, inProgress) => {
    if (memo.has(id)) return memo.get(id);
    if (inProgress.has(id)) return new Set();
    inProgress.add(id);
    const acc = new Set();
    for (const p of prerequisites(index.get(id) || { prerequisites: [] }, index)) {
      acc.add(p);
      for (const t of visit(p, inProgress)) acc.add(t);
    }
    inProgress.delete(id);
    memo.set(id, acc);
    return acc;
  };
  const out = new Map();
  for (const id of index.keys()) out.set(id, visit(id, new Set()));
  return out;
}

export function findCycles(doc) {
  const index = new Map(testStages(doc).map((s) => [s.id, s]));
  const cycles = [];
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const p of prerequisites(index.get(id), index)) {
      if (state.get(p) === 1) cycles.push(stack.slice(stack.indexOf(p)).concat(p));
      else if (!state.get(p)) visit(p);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of index.keys()) if (!state.get(id)) visit(id);
  return cycles;
}

/** Test stages in topological levels: everything in a level has its prerequisites in earlier ones. */
export function levels(doc) {
  const index = new Map(testStages(doc).map((s) => [s.id, s]));
  const remaining = new Set(index.keys());
  const done = new Set();
  const out = [];
  while (remaining.size) {
    const level = [...remaining].filter((id) => prerequisites(index.get(id), index).every((p) => done.has(p) || !remaining.has(p)));
    if (!level.length) { out.push([...remaining]); break; }
    for (const id of level) remaining.delete(id);
    for (const id of level) done.add(id);
    out.push(level);
  }
  return out;
}

function mutuallyExcluded(a, b) {
  const excludes = (x, y) => {
    const e = x.exclusions || { mode: EXCLUSION_MODE.NONE };
    if (e.mode === EXCLUSION_MODE.ALL) return true;
    if (e.mode === EXCLUSION_MODE.LIST) return (e.stageIds || []).includes(y.id);
    return false;
  };
  return excludes(a, b) || excludes(b, a);
}

function canCoexist(a, b, transitive) {
  if (a.id === b.id) return false;
  if (mutuallyExcluded(a, b)) return false;
  if ((transitive.get(a.id) || new Set()).has(b.id)) return false;
  if ((transitive.get(b.id) || new Set()).has(a.id)) return false;
  return true;
}

/**
 * The sets of test stages that may all run at once (maximal cliques of the «can coexist»
 * graph, Bron–Kerbosch with pivot). `truncated` says the search was cut short on a document
 * too large for it, in which case the bench count falls back to the sum.
 */
export function parallelGroupsDetailed(doc) {
  const stages = testStages(doc);
  if (!stages.length) return { groups: [], truncated: false };
  const transitive = transitivePrerequisites(doc);
  const neighbours = stages.map(() => new Set());
  for (let i = 0; i < stages.length; i++) for (let j = i + 1; j < stages.length; j++) {
    if (canCoexist(stages[i], stages[j], transitive)) { neighbours[i].add(j); neighbours[j].add(i); }
  }
  const cliques = [];
  let steps = 0;
  let truncated = false;
  const LIMIT = 2e5;
  const bk = (R, P, X) => {
    if (steps++ > LIMIT) { truncated = true; return; }
    if (!P.size && !X.size) { if (R.size) cliques.push([...R]); return; }
    const pivot = [...P, ...X].reduce((best, v) => (neighbours[v].size > (best == null ? -1 : neighbours[best].size) ? v : best), null);
    const candidates = [...P].filter((v) => !neighbours[pivot].has(v));
    for (const v of candidates) {
      bk(new Set([...R, v]), new Set([...P].filter((u) => neighbours[v].has(u))), new Set([...X].filter((u) => neighbours[v].has(u))));
      P.delete(v);
      X.add(v);
    }
  };
  bk(new Set(), new Set(stages.map((_, i) => i)), new Set());
  const covered = new Set(cliques.flat());
  stages.forEach((_, i) => { if (!covered.has(i)) cliques.push([i]); });
  return { groups: cliques.map((g) => g.map((i) => stages[i].id)).filter((g) => g.length), truncated };
}
