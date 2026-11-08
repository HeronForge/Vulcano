// tsw-authoring/1 → the DEDALO document shape. A port of DEDALO's own importer, so an
// authoring file reads the same here as there: keys become identifiers, every unresolved
// reference is reported, nothing is silently dropped. The «TO CHECK:», «CONDITION:» lines and
// the conversion block do not enter the document: they come back as notes, which VULCANO turns
// into open questions.
import {
  COMPARISON, EXCLUSION_MODE, EXPECTED_KIND, STAGE_KIND, STEP_TYPE, TABLE_COLUMN_KIND, VARIABLE_TYPE,
  constant, emptyDocument, migrateDocument, newCharacteristic, newCommand, newComputed, newExpected, newGlossaryEntry, newHeldStimulus,
  newImage, newInterface, newMarker, newParameter, newPoint, newProtocol, newReference, newResource, newSignatory, newStage,
  newStep, newTableCell, newTableColumn, newTableRow, newTest, newVariable, newVariant, variableRef,
} from '../model/schema.js';
import { newId, now } from '../model/ids.js';

const IMPORT_AUTHOR = 'Import';
const NOTE_MARKERS = [['TO CHECK:', 'toCheck'], ['CONDITION:', 'condition']];

const newNote = ({ name = '', kind = 'free', text = '', anchor = null }) => ({ id: newId('nt'), name, kind, text, anchor, created: now(), modified: now() });

function liftNoteLines(text) {
  const kept = [];
  const found = [];
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    const marker = NOTE_MARKERS.find(([m]) => trimmed.toUpperCase().startsWith(m));
    if (!marker) { kept.push(line); continue; }
    const body = trimmed.slice(marker[0].length).trim();
    if (body) found.push({ kind: marker[1], text: body });
  }
  return { kept: kept.join('\n').trim(), found };
}

const asArray = (v) => (Array.isArray(v) ? v : []);
function objects(list, where, problems) {
  const out = [];
  asArray(list).forEach((e, i) => {
    if (e && typeof e === 'object' && !Array.isArray(e)) out.push(e);
    else if (problems) problems.push(`${where}: entry ${i + 1} is ${e === null ? 'null' : Array.isArray(e) ? 'a list' : 'a ' + typeof e}, not an object, and was skipped.`);
  });
  return out;
}
const normaliseKey = (k) => String(k == null ? '' : k).trim().toLowerCase();
const clamp = (n) => Math.min(1, Math.max(0, Number(n) || 0));
const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) if (obj && obj[f] != null) out[f] = String(obj[f]);
  return out;
};
const characteristics = (list) => objects(list).map((c) => Object.assign(newCharacteristic(), { name: String(c.name || ''), value: String(c.value ?? ''), unit: String(c.unit || '') }));
const singular = (kind) => ({ references: 'reference', variables: 'variable', resources: 'resource', protocols: 'protocol', interfaces: 'interface', commands: 'command', points: 'point', images: 'image', stages: 'stage', steps: 'step' })[kind] || kind;

function knownValue(value, allowed, fallback, context, problems) {
  if (value == null || value === '') return fallback;
  if (allowed.includes(value)) return value;
  problems.push(`${context}: «${value}» is not a known value, «${fallback}» used instead.`);
  return fallback;
}
function guessStepType(st) {
  if (st.callStage || st.stage) return STEP_TYPE.STAGE_CALL;
  if (st.table) return STEP_TYPE.TABLE;
  if (st.stimulus && st.measurement) return STEP_TYPE.STIMULUS_MEASUREMENT;
  if (st.measurement) return STEP_TYPE.MEASUREMENT;
  return STEP_TYPE.STIMULUS;
}

// -- the compact criterion notation of table cells --------------------------------------------

const NUMBER = '[-+]?\\d+(?:[.,]\\d+)?';
const VARIABLE = '\\$[A-Za-z_][\\w]*';
const OPERAND = `(${NUMBER}|${VARIABLE})`;
const ONE_SIDED = { '<': 'LT', '<=': 'LE', '≤': 'LE', '>': 'GT', '>=': 'GE', '≥': 'GE', '=': 'EQ', '==': 'EQ', '!=': 'NE', '≠': 'NE' };
const BOOLEANS = { yes: 'true', ok: 'true', true: 'true', pass: 'true', no: 'false', false: 'false' };

export function parseCriterion(text, { unit = '', variable = () => null } = {}) {
  const e = { ...newExpected(), unit };
  const unresolved = [];
  const raw = String(text || '').trim();
  const operand = (token) => {
    if (token.startsWith('$')) {
      const id = variable(token.slice(1));
      if (id) return variableRef(id);
      unresolved.push(token.slice(1));
      return null;
    }
    return constant(token.replace(',', '.'));
  };
  const asText = () => ({ ...e, kind: EXPECTED_KIND.STRING, text: constant(raw), stringComparison: 'EQ', caseSensitive: true, regex: false });
  if (!raw) return { expected: e, unresolved };
  if (/^recorded$/i.test(raw)) return { expected: { ...e, comparison: 'NONE' }, unresolved };
  const bool = BOOLEANS[raw.toLowerCase()];
  if (bool) return { expected: { ...e, kind: EXPECTED_KIND.BOOLEAN, booleanValue: bool }, unresolved };
  let m = new RegExp(`^${OPERAND}\\s*(?:±|\\+-|\\+/-)\\s*${OPERAND}\\s*(%?)$`).exec(raw);
  if (m) {
    const nominal = operand(m[1]);
    const tolerance = operand(m[2]);
    if (nominal && tolerance) return { expected: { ...e, mode: 'nominal', comparison: 'EQT', nominal, tolerance, toleranceType: m[3] ? 'percent' : 'absolute' }, unresolved };
    return { expected: asText(), unresolved };
  }
  m = new RegExp(`^(<=|>=|!=|==|<|>|=|≤|≥|≠)\\s*${OPERAND}$`).exec(raw);
  if (m) {
    const code = ONE_SIDED[m[1]];
    const limit = operand(m[2]);
    if (limit) return { expected: { ...e, comparison: code, [COMPARISON[code].slot]: limit }, unresolved };
    return { expected: asText(), unresolved };
  }
  m = new RegExp(`^${OPERAND}\\s*(?:…|\\.\\.\\.?|÷|\\s-\\s)\\s*${OPERAND}$`).exec(raw) || new RegExp(`^${OPERAND}\\s+-\\s+${OPERAND}$`).exec(raw);
  if (m) {
    const min = operand(m[1]);
    const max = operand(m[2]);
    if (min && max) return { expected: { ...e, comparison: 'GELE', min, max }, unresolved };
    return { expected: asText(), unresolved };
  }
  return { expected: asText(), unresolved };
}

function parseCellValue(text, { variable = () => null } = {}) {
  const raw = String(text || '').trim();
  if (new RegExp(`^${VARIABLE}$`).test(raw)) {
    const id = variable(raw.slice(1));
    return id ? { value: variableRef(id), unresolved: [] } : { value: constant(raw), unresolved: [raw.slice(1)] };
  }
  return { value: constant(raw), unresolved: [] };
}

function expected(raw, parseValue, context, problems) {
  const out = { ...newExpected(), text: '' };
  if (!raw) return out;
  out.unit = String(raw.unit || '');
  if (raw.nominal != null && raw.nominal !== '') {
    out.mode = 'nominal';
    out.nominal = parseValue(raw.nominal, `${context} nominal`);
    out.tolerance = parseValue(raw.tolerance, `${context} tolerance`);
    out.toleranceType = raw.toleranceType === 'percent' ? 'percent' : 'absolute';
    return out;
  }
  const kind = String(raw.kind || '').toLowerCase();
  if (kind === 'boolean' || raw.boolean != null) {
    out.kind = 'boolean';
    const value = raw.boolean != null ? raw.boolean : raw.value;
    out.booleanValue = value === false || value === 'false' ? 'false' : 'true';
    return out;
  }
  if (kind === 'string' || kind === 'text' || raw.text != null || raw.pattern != null) {
    out.kind = 'string';
    out.text = parseValue(raw.pattern != null ? raw.pattern : raw.text, `${context} expected text`);
    out.regex = raw.pattern != null || raw.regex === true || raw.regex === 'true';
    out.caseSensitive = !(raw.caseSensitive === false || raw.caseSensitive === 'false');
    const sc = String(raw.stringComparison || raw.comparison || '').toUpperCase();
    if (['EQ', 'NE', 'CONTAINS', 'STARTS', 'ENDS'].includes(sc)) out.stringComparison = sc;
    return out;
  }
  out.min = parseValue(raw.min, `${context} minimum`);
  out.max = parseValue(raw.max, `${context} maximum`);
  const code = String(raw.comparison || '').toUpperCase();
  if (code === 'EQT') {
    out.mode = 'nominal';
    out.comparison = 'EQT';
    problems.push(`${context}: comparison EQT (nominal ± tolerance) has no nominal value; the criterion is left empty.`);
    return out;
  }
  if (code && COMPARISON[code]) {
    out.comparison = code;
    const spec = COMPARISON[code];
    if (spec.sides === 1 && raw.limit != null && raw.limit !== '') out[spec.slot] = parseValue(raw.limit, `${context} limit`);
  }
  return out;
}

/** Reads an authoring file into a document; returns the document, the problems and the notes. */
export function importAuthoring(input) {
  const problems = [];
  const notes = [];
  const src = input && typeof input === 'object' ? input : {};
  const doc = emptyDocument();
  const lift = (text, anchorId) => {
    const { kept, found } = liftNoteLines(text);
    for (const f of found) notes.push(newNote({ name: IMPORT_AUTHOR, kind: f.kind, text: f.text, anchor: { id: 'ref-' + anchorId, fraction: 0 } }));
    return kept;
  };
  const keys = Object.fromEntries(['references', 'variables', 'resources', 'protocols', 'interfaces', 'commands', 'points', 'images', 'stages', 'steps'].map((k) => [k, new Map()]));
  const register = (kind, key, id) => {
    const k = normaliseKey(key);
    if (!k) return;
    const already = keys[kind].get(k);
    if (already && already !== id) problems.push(`Duplicate ${singular(kind)} key «${key}»: the second one wins.`);
    keys[kind].set(k, id);
  };
  const lookup = (kind, key, context) => {
    if (key == null || key === '') return '';
    const id = keys[kind].get(normaliseKey(key));
    if (!id) { problems.push(`${context}: unknown ${singular(kind)} «${key}».`); return ''; }
    return id;
  };

  const header = src.header || {};
  Object.assign(doc.header, pick(header, ['title', 'company', 'project', 'product', 'documentCode', 'confidentiality', 'disclaimer']));
  const signed = objects(header.signatories, 'Header signatories', problems).map((s) => newSignatory(String(s.role || ''), String(s.name || '')));
  const legacy = [['Prepared by', header.preparedBy], ['Checked by', header.checkedBy], ['Approved by', header.approvedBy]].filter(([, name]) => name != null && String(name).trim() !== '').map(([role, name]) => newSignatory(role, String(name)));
  doc.header.signatories = [...legacy, ...signed];
  if (src.settings && typeof src.settings === 'object') doc.settings.noDirectEditing = src.settings.noDirectEditing === true || src.settings.noDirectEditing === 'true';
  if (header.revision) Object.assign(doc.revision, pick(header.revision, ['number', 'date', 'author', 'reason']));
  Object.assign(doc.description, pick(src.description || {}, ['product', 'testing']));

  doc.references = objects(src.references, 'References', problems).map((r) => {
    const reference = Object.assign(newReference(), pick(r, ['code', 'title', 'revision', 'notes']));
    reference.notes = lift(reference.notes, reference.id);
    register('references', r.key || reference.code, reference.id);
    register('references', reference.code, reference.id);
    return reference;
  });
  doc.variables = objects(src.variables, 'Variables', problems).map((v) => {
    const variable = Object.assign(newVariable(), pick(v, ['name', 'unit', 'value', 'min', 'max', 'description']));
    variable.description = lift(variable.description, variable.id);
    variable.type = knownValue(v.type, Object.values(VARIABLE_TYPE), VARIABLE_TYPE.NUMBER, `Variable «${v.name || v.key}»: type`, problems);
    if (Array.isArray(v.allowedValues)) variable.allowedValues = v.allowedValues.map(String);
    if (!variable.name) variable.name = String(v.key || '');
    register('variables', v.key || v.name, variable.id);
    register('variables', variable.name, variable.id);
    return variable;
  });
  doc.resources = objects(src.resources, 'Resources', problems).map((r) => {
    const resource = Object.assign(newResource(), pick(r, ['name', 'category', 'notes', 'averageTime']));
    resource.notes = lift(resource.notes, resource.id);
    resource.characteristics = characteristics(r.characteristics);
    register('resources', r.key || r.name, resource.id);
    return resource;
  });
  doc.protocols = objects(src.protocols, 'Protocols', problems).map((p) => {
    const protocol = Object.assign(newProtocol(), pick(p, ['name', 'family', 'description', 'requestFormat', 'responseFormat', 'notes']));
    protocol.notes = lift(protocol.notes, protocol.id);
    protocol.rules = characteristics(p.rules);
    register('protocols', p.key || p.name, protocol.id);
    protocol._referenceKey = p.reference;
    return protocol;
  });
  doc.interfaces = objects(src.interfaces, 'Interfaces', problems).map((i) => {
    const itf = Object.assign(newInterface(), pick(i, ['name', 'type', 'notes']));
    itf.notes = lift(itf.notes, itf.id);
    itf.parameters = characteristics(i.parameters);
    itf._pointKeys = asArray(i.points);
    itf._resourceKey = i.resource;
    register('interfaces', i.key || i.name, itf.id);
    return itf;
  });
  doc.commands = objects(src.commands, 'Commands', problems).map((c) => {
    const command = Object.assign(newCommand(), pick(c, ['name', 'address', 'requestFormat', 'responseFormat', 'negativeResponse', 'encoding', 'example', 'notes', 'nominalTime']));
    command.notes = lift(command.notes, command.id);
    register('commands', c.key || c.name, command.id);
    command._interfaceKey = c.interface; command._protocolKey = c.protocol; command._referenceKey = c.reference;
    if (c.decoding && typeof c.decoding === 'object') command.decoding = { formula: String(c.decoding.formula || ''), unit: String(c.decoding.unit || '') };
    return command;
  });
  doc.glossary = objects(src.glossary, 'Glossary', problems).map((g) => newGlossaryEntry(String(g.term || ''), String(g.meaning || ''))).filter((g) => g.term.trim());
  if (Array.isArray((src.settings || {}).chapterOrder)) doc.settings.chapterOrder = src.settings.chapterOrder.map(String);
  doc.images = objects(src.images, 'Images', problems).map((i) => {
    const image = newImage('', i.name || i.key || '');
    image.caption = String(i.caption || '');
    register('images', i.key || i.name, image.id);
    return image;
  });
  if (doc.images.length) problems.push(`${doc.images.length} image${doc.images.length > 1 ? 's are' : ' is'} declared without a picture: an authoring file cannot carry them. Open the DEDALO document or its data export to have them.`);
  doc.points = objects(src.points, 'Points', problems).map((p) => {
    const point = Object.assign(newPoint(), pick(p, ['name', 'connector', 'pin', 'signal', 'contactType', 'notes']));
    point.notes = lift(point.notes, point.id);
    point.characteristics = characteristics(p.characteristics);
    if (!point.name) point.name = String(p.key || '');
    register('points', p.key || p.name, point.id);
    point._markers = objects(p.markers, `Point «${point.name}» markers`, problems);
    return point;
  });
  doc.stages = objects(src.stages, 'Stages', problems).map((s) => {
    const stage = newStage(s.kind === 'setup' ? STAGE_KIND.SETUP : STAGE_KIND.TEST);
    Object.assign(stage, pick(s, ['name', 'description']));
    stage.description = lift(stage.description, stage.id);
    if (!stage.name) stage.name = String(s.key || '');
    register('stages', s.key || s.name, stage.id);
    stage._src = s;
    stage.tests = objects(s.tests, `Stage «${stage.name}» tests`, problems).map((t) => {
      const test = Object.assign(newTest(), pick(t, ['name', 'purpose']));
      test.purpose = lift(test.purpose, test.id);
      test.kpi = t.kpi === true || t.kpi === 'true';
      test.steps = objects(t.steps, `Test «${test.name}» steps`, problems).map((st) => {
        const type = knownValue(st.type, Object.values(STEP_TYPE), guessStepType(st), `Step «${st.description || st.key}»: type`, problems);
        const step = newStep(type);
        Object.assign(step, pick(st, ['description', 'note']));
        step.note = lift(step.note, step.id);
        if (st.wait) step.wait = { value: constant(String(st.wait.value ?? '')), unit: String(st.wait.unit || 's') };
        register('steps', st.key, step.id);
        step._src = st;
        return step;
      });
      return test;
    });
    return stage;
  });

  for (const command of doc.commands) {
    command.interfaceId = lookup('interfaces', command._interfaceKey, `Command «${command.name}»`);
    command.protocolId = lookup('protocols', command._protocolKey, `Command «${command.name}»`);
    command.referenceId = lookup('references', command._referenceKey, `Command «${command.name}»`);
    delete command._interfaceKey; delete command._protocolKey; delete command._referenceKey;
  }
  for (const protocol of doc.protocols) { protocol.referenceId = lookup('references', protocol._referenceKey, `Protocol «${protocol.name}»`); delete protocol._referenceKey; }
  for (const itf of doc.interfaces) {
    itf.pointIds = itf._pointKeys.map((k) => lookup('points', k, `Interface «${itf.name}»`)).filter(Boolean);
    itf.resourceId = lookup('resources', itf._resourceKey, `Interface «${itf.name}»`);
    delete itf._pointKeys; delete itf._resourceKey;
  }
  for (const point of doc.points) {
    point.markers = point._markers.map((m) => {
      const imageId = lookup('images', m.image, `Point «${point.name}» marker`);
      const marker = newMarker(imageId, clamp(m.x), clamp(m.y));
      if (Number(m.area) > 0 && Number(m.area) <= 1) marker.area = Number(m.area);
      return marker;
    }).filter((m) => m.imageId);
    delete point._markers;
  }

  const parseValue = (raw, context) => {
    if (raw == null || raw === '') return constant('');
    const text = String(raw).trim();
    if (text.startsWith('$')) {
      const id = lookup('variables', text.slice(1), context);
      return id ? variableRef(id) : constant(text);
    }
    return constant(text);
  };
  const variableByName = (name) => keys.variables.get(normaliseKey(name)) || null;
  const tableOf = (raw, context) => {
    const table = { columns: [], rows: [] };
    if (!raw || typeof raw !== 'object') { problems.push(`${context}: a table step with no «table»; it stays empty.`); return table; }
    const byKey = new Map();
    for (const c of objects(raw.columns, `${context} table columns`, problems)) {
      const kind = String(c.kind || '').toLowerCase() === 'stimulus' ? TABLE_COLUMN_KIND.STIMULUS : TABLE_COLUMN_KIND.MEASUREMENT;
      if (c.kind && !['stimulus', 'measurement'].includes(String(c.kind).toLowerCase())) problems.push(`${context}: column «${c.name || c.key}» has kind «${c.kind}», read as measurement.`);
      const column = Object.assign(newTableColumn(kind), { name: String(c.name || c.key || ''), unit: String(c.unit || '') });
      column.pointIds = asArray(c.points).map((k) => lookup('points', k, `${context} column «${column.name}»`)).filter(Boolean);
      column.resourceId = lookup('resources', c.resource, `${context} column «${column.name}»`);
      column.commandId = lookup('commands', c.command, `${context} column «${column.name}»`);
      const key = normaliseKey(c.key || c.name);
      if (key) byKey.set(key, column);
      table.columns.push(column);
    }
    for (const r of objects(raw.rows, `${context} table rows`, problems)) {
      const row = Object.assign(newTableRow(), { label: String(r.label || '') });
      const cells = r.cells && !Array.isArray(r.cells) && typeof r.cells === 'object'
        ? Object.entries(r.cells).map(([column, v]) => (v && typeof v === 'object' ? { column, expected: v } : { column, value: v }))
        : r.cells;
      for (const c of objects(cells, `${context} row «${row.label}» cells`, problems)) {
        const column = byKey.get(normaliseKey(c.column));
        if (!column) { problems.push(`${context}, row «${row.label}»: a cell names a column «${c.column}» the table does not declare; dropped.`); continue; }
        const cell = newTableCell(column);
        if (column.kind === TABLE_COLUMN_KIND.STIMULUS) {
          const { value, unresolved } = parseCellValue(c.value, { variable: variableByName });
          cell.value = value;
          for (const name of unresolved) problems.push(`${context}, row «${row.label}», column «${column.name}»: unknown variable «${name}»; kept as text.`);
        } else if (c.expected && typeof c.expected === 'object') {
          cell.expected = expected(c.expected, parseValue, `${context}, row «${row.label}», column «${column.name}»`, problems);
          if (!cell.expected.unit) cell.expected.unit = column.unit;
        } else {
          const { expected: e, unresolved } = parseCriterion(c.expected != null ? c.expected : c.value, { unit: column.unit, variable: variableByName });
          cell.expected = e;
          for (const name of unresolved) problems.push(`${context}, row «${row.label}», column «${column.name}»: unknown variable «${name}»; the cell is read as text.`);
        }
        row.cells.push(cell);
      }
      table.rows.push(row);
    }
    return table;
  };
  const block = (raw, out, context) => {
    if (!raw) return null;
    out.description = String(raw.description || '');
    out.pointIds = asArray(raw.points).map((k) => lookup('points', k, context)).filter(Boolean);
    out.resourceId = lookup('resources', raw.resource, context);
    out.commandId = lookup('commands', raw.command, context);
    out.parameters = objects(raw.parameters, `${context} parameters`, problems).map((p) => {
      const parameter = newParameter();
      parameter.name = String(p.name || '');
      parameter.unit = String(p.unit || '');
      parameter.value = parseValue(p.value, `${context} parameter «${parameter.name}»`);
      return parameter;
    });
    return out;
  };

  for (const stage of doc.stages) {
    const s = stage._src;
    delete stage._src;
    stage.prerequisites = asArray(s.prerequisites).map((k) => lookup('stages', k, `Stage «${stage.name}» prerequisites`)).filter(Boolean);
    const parallel = s.parallel || {};
    const mode = knownValue(parallel.mode, Object.values(EXCLUSION_MODE), EXCLUSION_MODE.NONE, `Stage «${stage.name}»: parallel mode`, problems);
    stage.exclusions = { mode, stageIds: mode === EXCLUSION_MODE.LIST ? asArray(parallel.stages).map((k) => lookup('stages', k, `Stage «${stage.name}» exclusions`)).filter(Boolean) : [] };
    stage.heldStimuli = objects(s.heldStimuli, `Stage «${stage.name}» held stimuli`, problems).map((held) => {
      const entry = newHeldStimulus();
      entry.stepId = lookup('steps', held.step, `Stage «${stage.name}» held stimulus`);
      entry.note = String(held.note || '');
      return entry;
    }).filter((held) => held.stepId);
    for (const test of stage.tests) for (const step of test.steps) {
      const raw = step._src;
      delete step._src;
      const context = `Step «${step.description || raw.key || ''}»`;
      if (step.type === STEP_TYPE.STAGE_CALL) { step.calledStageId = lookup('stages', raw.callStage || raw.stage, context); continue; }
      step.wait.value = parseValue(step.wait.value.value, `${context} wait`);
      step.imageId = lookup('images', raw.image, `${context} image`);
      if (step.type === STEP_TYPE.TABLE) { step.table = tableOf(raw.table, context); continue; }
      if (step.stimulus) step.stimulus = block(raw.stimulus, step.stimulus, `${context} stimulus`) || step.stimulus;
      if (step.measurement) {
        step.measurement = block(raw.measurement, step.measurement, `${context} measurement`) || step.measurement;
        step.measurement.expected = expected(raw.measurement && raw.measurement.expected, parseValue, context, problems);
        const computed = raw.measurement && raw.measurement.computed;
        if (computed && typeof computed === 'object') {
          step.measurement.computed = Object.assign(newComputed(), { formula: String(computed.formula || '') });
          step.measurement.computed.inputStepIds = asArray(computed.inputs).map((k) => lookup('steps', k, `${context} computed inputs`)).filter(Boolean);
        }
      }
    }
  }
  if (String(src.stageOrder || '').toLowerCase() === 'sequential') {
    const sequence = doc.stages.filter((s) => s.kind !== STAGE_KIND.SETUP);
    let chained = 0;
    for (let i = 1; i < sequence.length; i++) {
      if ((sequence[i].prerequisites || []).length) continue;
      sequence[i].prerequisites = [sequence[i - 1].id];
      chained++;
    }
    if (chained) problems.push(`Stage order «sequential»: ${chained} stage${chained > 1 ? 's were' : ' was'} chained to the one before it.`);
  }
  doc.variants = objects(src.variants, 'Variants', problems).map((v) => {
    const variant = Object.assign(newVariant(), pick(v, ['name', 'description']));
    if (!variant.name) variant.name = String(v.key || '');
    for (const key of asArray(v.excludeStages)) {
      const id = lookup('stages', key, `Variant «${variant.name}»`);
      if (id) variant.overlay.push({ op: 'remove', path: ['stages', '#' + id] });
    }
    for (const [key, value] of Object.entries(v.variableValues || {})) {
      const id = lookup('variables', key, `Variant «${variant.name}»`);
      if (!id) continue;
      const variable = doc.variables.find((x) => x.id === id);
      const set = (field, val) => variant.overlay.push({ op: 'set', path: ['variables', '#' + id, field], value: String(val) });
      if (variable && variable.type === VARIABLE_TYPE.RANGE) {
        if (value && typeof value === 'object') { if (value.min != null) set('min', value.min); if (value.max != null) set('max', value.max); }
        else { set('min', value); problems.push(`Variant «${variant.name}»: «${key}» is a range, and one value sets its minimum only.`); }
      } else set('value', value);
    }
    return variant;
  });

  // The conversion block: what stayed out of the specification, as notes anchored to the test description.
  const conv = src.conversion;
  if (conv && typeof conv === 'object') {
    const source = String(conv.source || '').trim();
    const leftOut = objects(conv.leftOut, 'Conversion: left out', problems).map((e) => ({ where: String(e.where || '').trim(), what: String(e.what || '').trim(), why: String(e.why || '').trim() })).filter((e) => e.what || e.where);
    for (const e of leftOut) notes.push(newNote({ name: e.where || IMPORT_AUTHOR, kind: 'leftOut', text: [e.what, e.why].filter(Boolean).join(' — '), anchor: { id: 'chap-testing', fraction: 0 } }));
    const remarks = String(conv.notes || '').trim();
    if (remarks) notes.push(newNote({ name: IMPORT_AUTHOR, kind: 'free', text: remarks, anchor: { id: 'chap-testing', fraction: 0 } }));
    const reason = String(doc.revision.reason || '').trim();
    if (source && (!reason || reason === 'First issue')) doc.revision.reason = `Converted from ${source}`;
  }
  return { doc: migrateDocument(doc).doc, problems, notes };
}
