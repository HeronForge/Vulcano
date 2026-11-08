// The DEDALO document as VULCANO reads it: the constants and the few structural helpers that
// give a specification its meaning. Ported from DEDALO's compiled output in
// ../heronforge-kb/interchange/dedalo/ (schema 2) — the semantics must match, the code need not.
import { newId, today } from './ids.js';

export const SCHEMA_VERSION = 2;

export const STEP_TYPE = {
  STIMULUS: 'stimulus',
  MEASUREMENT: 'measurement',
  STIMULUS_MEASUREMENT: 'stimulusMeasurement',
  STAGE_CALL: 'stageCall',
  TABLE: 'table',
};
export const STEP_TYPE_SHORT = { stimulus: 'STIM', measurement: 'MEAS', stimulusMeasurement: 'STIM+MEAS', stageCall: 'CALL', table: 'TABLE' };
export const VARIABLE_TYPE = { NUMBER: 'number', TEXT: 'text', ENUM: 'enum', BOOLEAN: 'boolean', RANGE: 'range' };
export const EXCLUSION_MODE = { NONE: 'none', ALL: 'all', LIST: 'list' };
export const STAGE_KIND = { TEST: 'test', SETUP: 'setup' };
export const EXPECTED_KIND = { NUMERIC: 'numeric', STRING: 'string', BOOLEAN: 'boolean' };
export const TABLE_COLUMN_KIND = { STIMULUS: 'stimulus', MEASUREMENT: 'measurement' };

export const constant = (value = '') => ({ mode: 'constant', value });
export const variableRef = (variableId) => ({ mode: 'variable', variableId });

/** The comparison set TestStand uses, as DEDALO writes it. */
export const COMPARISON = {
  EQ: { code: '==', condition: 'Value = Limit', sides: 1, slot: 'min' },
  GELE: { code: '>=<=', condition: 'Low ≤ Value ≤ High', sides: 2, low: '≥', high: '≤' },
  EQT: { code: '==+/-', condition: 'Nominal − Tol ≤ Value ≤ Nominal + Tol', sides: 2, mode: 'nominal' },
  NE: { code: '!=', condition: 'Value ≠ Limit', sides: 1, slot: 'min' },
  GT: { code: '>', condition: 'Value > Limit', sides: 1, slot: 'min' },
  LT: { code: '<', condition: 'Value < Limit', sides: 1, slot: 'max' },
  GE: { code: '>=', condition: 'Value ≥ Limit', sides: 1, slot: 'min' },
  LE: { code: '<=', condition: 'Value ≤ Limit', sides: 1, slot: 'max' },
  GTLT: { code: '><', condition: 'Low < Value < High', sides: 2, low: '>', high: '<' },
  GELT: { code: '>=<', condition: 'Low ≤ Value < High', sides: 2, low: '≥', high: '<' },
  GTLE: { code: '><=', condition: 'Low < Value ≤ High', sides: 2, low: '>', high: '≤' },
  LTGT: { code: '<>', condition: 'Value < Low or Value > High', sides: 2, outside: true, low: '<', high: '>' },
  LEGE: { code: '<=>=', condition: 'Value ≤ Low or Value ≥ High', sides: 2, outside: true, low: '≤', high: '≥' },
  LEGT: { code: '<=>', condition: 'Value ≤ Low or Value > High', sides: 2, outside: true, low: '≤', high: '>' },
  LTGE: { code: '<>=', condition: 'Value < Low or Value ≥ High', sides: 2, outside: true, low: '<', high: '≥' },
  NONE: { code: 'no comparison', condition: 'the value is recorded, nothing is judged', sides: 0 },
};
const COMPARISON_ALIAS = { GELI: 'GELE' };
export const SYMBOL = { EQ: '=', NE: '≠', GT: '>', GE: '≥', LT: '<', LE: '≤' };
export const STRING_COMPARISON = {
  EQ: { label: 'Equal to', symbol: '=' },
  NE: { label: 'Not equal to', symbol: '≠' },
  CONTAINS: { label: 'Contains', symbol: 'contains' },
  STARTS: { label: 'Starts with', symbol: 'starts with' },
  ENDS: { label: 'Ends with', symbol: 'ends with' },
};

export const filled = (ref) => !!(ref && (ref.mode === 'variable' ? ref.variableId : String(ref.value ?? '').trim() !== ''));

export const expectedKind = (e) => {
  const k = (e || {}).kind;
  return k === EXPECTED_KIND.STRING || k === EXPECTED_KIND.BOOLEAN ? k : EXPECTED_KIND.NUMERIC;
};

export function comparisonOf(expected) {
  const e = expected || {};
  const declared = COMPARISON_ALIAS[e.comparison] || e.comparison;
  if (e.mode === 'nominal') return 'EQT';
  if (COMPARISON[declared] && declared !== 'EQT') return declared;
  const low = filled(e.min);
  const high = filled(e.max);
  if (low && high) return 'GELE';
  if (low) return 'GE';
  if (high) return 'LE';
  return 'GELE';
}

export const expectedTextRef = (e) => {
  const t = (e || {}).text;
  return t && typeof t === 'object' ? t : constant(t == null ? '' : String(t));
};
export const stringComparisonOf = (e) => (STRING_COMPARISON[(e || {}).stringComparison] ? e.stringComparison : 'EQ');

export const isComputed = (measurement) => !!(measurement && measurement.computed);
export const isSetup = (stage) => !!stage && stage.kind === STAGE_KIND.SETUP;
export const isTestStage = (stage) => !isSetup(stage);
export const testStages = (doc) => (doc.stages || []).filter(isTestStage);
export const setupStages = (doc) => (doc.stages || []).filter(isSetup);

/**
 * The blocks of a step that touch the bench: a stimulus, a measurement that is not computed,
 * or one block per column of a table. A stage call has none.
 */
export function stepBlocks(step) {
  if (!step) return [];
  if (step.type === STEP_TYPE.TABLE) {
    return ((step.table || {}).columns || []).map((c) => ({
      kind: c.kind === TABLE_COLUMN_KIND.STIMULUS ? 'stimulus' : 'measurement',
      block: { description: c.name || '', pointIds: c.pointIds || [], resourceId: c.resourceId || '', commandId: c.commandId || '', parameters: [] },
      column: c,
    }));
  }
  const out = [];
  if (step.stimulus) out.push({ kind: 'stimulus', block: step.stimulus });
  if (step.measurement && !isComputed(step.measurement)) out.push({ kind: 'measurement', block: step.measurement });
  return out;
}

/** Every criterion of a step: one for a measurement, one per measurement cell of a table. */
export function stepCriteria(step) {
  const out = [];
  if (step.type === STEP_TYPE.TABLE) {
    const columns = new Map(((step.table || {}).columns || []).map((c) => [c.id, c]));
    for (const row of (step.table || {}).rows || []) {
      for (const cell of row.cells || []) {
        const column = columns.get(cell.columnId);
        if (!column || column.kind !== TABLE_COLUMN_KIND.MEASUREMENT || !cell.expected) continue;
        out.push({ expected: cell.expected, column, row, cell, block: { pointIds: column.pointIds || [], resourceId: column.resourceId || '', commandId: column.commandId || '' } });
      }
    }
    return out;
  }
  if (step.measurement && step.measurement.expected) out.push({ expected: step.measurement.expected, block: step.measurement, computed: isComputed(step.measurement) });
  return out;
}

// ---- factories, for the authoring import and for the tests -------------------------------

export const newSignatory = (role = '', name = '') => ({ id: newId('sig'), role, name });
export const newReference = () => ({ id: newId('ref'), title: '', code: '', revision: '', notes: '' });
export const newVariable = () => ({ id: newId('var'), name: '', type: VARIABLE_TYPE.NUMBER, unit: '', value: '', min: '', max: '', allowedValues: [], description: '' });
export const newVariant = () => ({ id: newId('vnt'), name: '', description: '', overlay: [] });
export const newResource = () => ({ id: newId('res'), name: '', category: '', characteristics: [], notes: '', averageTime: '' });
export const newInterface = () => ({ id: newId('itf'), name: '', type: '', parameters: [], pointIds: [], resourceId: '', notes: '' });
export const newProtocol = () => ({ id: newId('prt'), name: '', family: '', description: '', requestFormat: '', responseFormat: '', rules: [], notes: '', referenceId: '' });
export const newCommand = () => ({ id: newId('cmd'), name: '', interfaceId: '', protocolId: '', address: '', requestFormat: '', responseFormat: '', negativeResponse: '', encoding: '', example: '', notes: '', nominalTime: '', referenceId: '', decoding: { formula: '', unit: '' } });
export const newPoint = () => ({ id: newId('pt'), name: '', connector: '', pin: '', signal: '', contactType: '', characteristics: [], markers: [], notes: '' });
export const newMarker = (imageId, x, y) => ({ id: newId('mk'), imageId, x, y, area: 0.3 });
export const newImage = (assetId, name) => ({ id: newId('img'), name: name || '', assetId, caption: '' });
export const newCharacteristic = () => ({ id: newId('chr'), name: '', value: '', unit: '' });
export const newParameter = () => ({ id: newId('par'), name: '', value: constant(''), unit: '' });
export const newGlossaryEntry = (term = '', meaning = '') => ({ id: newId('gls'), term, meaning });
export const newStage = (kind = STAGE_KIND.TEST) => ({ id: newId('stg'), name: '', description: '', kind, prerequisites: [], exclusions: { mode: EXCLUSION_MODE.NONE, stageIds: [] }, heldStimuli: [], tests: [] });
export const newTest = () => ({ id: newId('tc'), name: '', purpose: '', kpi: false, steps: [] });
export const newHeldStimulus = () => ({ id: newId('hs'), stepId: '', note: '' });
export const newComputed = () => ({ formula: '', inputStepIds: [] });
export const newStimulus = () => ({ description: '', pointIds: [], resourceId: '', parameters: [], commandId: '' });
export const newExpected = () => ({
  kind: EXPECTED_KIND.NUMERIC, mode: 'minmax',
  min: constant(''), max: constant(''), nominal: constant(''), tolerance: constant(''), toleranceType: 'absolute', unit: '',
  text: constant(''), stringComparison: 'EQ', caseSensitive: true, regex: false,
  booleanValue: 'true',
});
export const newMeasurement = () => ({ description: '', pointIds: [], resourceId: '', parameters: [], commandId: '', expected: newExpected() });
export const newTableColumn = (kind = TABLE_COLUMN_KIND.MEASUREMENT) => ({ id: newId('col'), name: '', kind, pointIds: [], resourceId: '', commandId: '', unit: '' });
export const newTableRow = () => ({ id: newId('row'), label: '', cells: [] });
export const newTableCell = (column) => column.kind === TABLE_COLUMN_KIND.STIMULUS
  ? { id: newId('cel'), columnId: column.id, value: constant('') }
  : { id: newId('cel'), columnId: column.id, expected: { ...newExpected(), unit: column.unit || '' } };

export function newStep(type = STEP_TYPE.STIMULUS_MEASUREMENT) {
  const s = { id: newId('stp'), description: '', type, wait: { value: constant(''), unit: 's' }, note: '', calledStageId: '', imageId: '' };
  if (type === STEP_TYPE.STIMULUS || type === STEP_TYPE.STIMULUS_MEASUREMENT) s.stimulus = newStimulus();
  if (type === STEP_TYPE.MEASUREMENT || type === STEP_TYPE.STIMULUS_MEASUREMENT) s.measurement = newMeasurement();
  if (type === STEP_TYPE.TABLE) s.table = { columns: [], rows: [] };
  return s;
}

export function emptyDocument() {
  return {
    schemaVersion: SCHEMA_VERSION,
    header: { title: 'Test specification', company: '', logoAssetId: '', project: '', product: '', documentCode: '', confidentiality: '', disclaimer: '', signatories: [] },
    settings: { noDirectEditing: false, chapterOrder: [] },
    revision: { number: '00', date: today(), author: '', reason: 'First issue', status: 'draft' },
    description: { product: '', testing: '' },
    references: [], variables: [], protocols: [], variants: [], resources: [], interfaces: [], commands: [], points: [], images: [], glossary: [], stages: [],
  };
}

// ---- migrations of the DEDALO document shape, mirrored so an older export still opens ------

const MIGRATIONS = [
  { to: 1, what: 'setup stages introduced: every stage without a kind is a test stage', apply(doc) { for (const s of doc.stages || []) if (!s.kind) s.kind = STAGE_KIND.TEST; } },
  {
    to: 2,
    what: 'signatories became a list; a wait may follow a variable, so its value became a value reference',
    apply(doc) {
      const h = doc.header || (doc.header = {});
      if (!Array.isArray(h.signatories)) {
        h.signatories = [['Prepared by', h.preparedBy], ['Checked by', h.checkedBy], ['Approved by', h.approvedBy]].map(([role, name]) => newSignatory(role, String(name || '')));
      }
      delete h.preparedBy; delete h.checkedBy; delete h.approvedBy;
      for (const stage of doc.stages || []) for (const t of stage.tests || []) for (const s of t.steps || []) {
        if (!s.wait) s.wait = { value: constant(''), unit: 's' };
        else if (!s.wait.value || typeof s.wait.value !== 'object') s.wait.value = constant(String(s.wait.value ?? ''));
      }
    },
  },
];

/** Brings a document to schema 2, filling what an older shape lacks; says which steps applied. */
export function migrateDocument(input) {
  const empty = emptyDocument();
  const src = input && typeof input === 'object' ? input : {};
  const doc = { ...empty, ...src };
  doc.header = { ...empty.header, ...(src.header || {}) };
  if (!Array.isArray((src.header || {}).signatories)) delete doc.header.signatories;
  doc.settings = { ...empty.settings, ...(src.settings || {}) };
  doc.revision = { ...empty.revision, ...(src.revision || {}) };
  doc.description = { ...empty.description, ...(src.description || {}) };
  for (const k of ['references', 'variables', 'protocols', 'variants', 'resources', 'interfaces', 'commands', 'points', 'images', 'glossary', 'stages']) {
    if (!Array.isArray(doc[k])) doc[k] = [];
  }
  const from = Number(src.schemaVersion) || 0;
  const applied = [];
  for (const step of MIGRATIONS) {
    if (from >= step.to) continue;
    step.apply(doc);
    applied.push({ to: step.to, what: step.what });
  }
  doc.schemaVersion = SCHEMA_VERSION;
  return { doc, applied, from };
}
