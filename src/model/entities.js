// The specification flattened into records the knowledge base can ask questions of: one
// record per resource, point, interface, command, stage, step, stimulus, criterion, variable,
// variant — and one for the specification as a whole. A condition (see conditions.js) reads a
// record through `field(record, name)`, so a checklist item written as data can say
// «resource whose category contains Safety» or «stimulus whose parameter Voltage ≥ 60 V».
import { STEP_TYPE, isSetup } from './schema.js';
import { labelOf, nameOf, parseQuantity } from './spec.js';

const words = (...parts) => parts.filter(Boolean).join(' ');

/** Verbs of a physical action in a step description, so a fixture tool can find what a hand or an actuator must do. */
export const ACTION_VERBS = ['press', 'push', 'hold', 'release', 'mate', 'unmate', 'plug', 'unplug', 'insert', 'remove', 'rotate', 'turn', 'lock', 'unlock', 'open', 'close', 'connect', 'disconnect', 'engage', 'lower', 'lift', 'present', 'withdraw', 'flip', 'toggle', 'move', 'load', 'unload', 'place', 'scan', 'tap', 'swipe', 'touch'];

export function actionVerbs(text) {
  const t = String(text || '').toLowerCase();
  return ACTION_VERBS.filter((v) => new RegExp(`\\b${v}(?:s|ed|ing)?\\b`).test(t));
}

/** Builds every record once from the derived set. */
export function buildRecords(derived) {
  const { doc, codes, index } = derived;
  const label = (id) => labelOf(codes, index, id);
  const records = [];
  const push = (type, id, entity, fields, extra = {}) => {
    const r = { type, id, code: codes.get(id) || '', name: nameOf(entity), label: id ? label(id) : type, entity, fields, ...extra };
    records.push(r);
    return r;
  };
  const quantities = (list) => {
    const out = {};
    for (const c of list || []) if (c.name) out[c.name.toLowerCase()] = { ...parseQuantity(c.value, c.unit), name: c.name, unitText: c.unit };
    return out;
  };

  push('spec', '', doc, {
    title: doc.header.title, product: doc.description.product, testing: doc.description.testing, company: doc.header.company,
    text: words(doc.header.title, doc.header.product, doc.description.product, doc.description.testing, doc.header.disclaimer),
    'resources.count': (doc.resources || []).length, 'points.count': (doc.points || []).length, 'variants.count': (doc.variants || []).length,
    'stages.count': (doc.stages || []).length, 'images.count': (doc.images || []).length, 'interfaces.count': (doc.interfaces || []).length,
    'commands.count': (doc.commands || []).length, 'references.count': (doc.references || []).length,
    'kpi.count': derived.steps.filter((s) => s.test.kpi).length, 'steps.count': derived.steps.length,
    'criteria.count': derived.criteria.length,
  }, { label: 'the specification' });

  const rowsByResource = new Map(derived.resources.rows.map((r) => [r.resource.id, r]));
  for (const r of doc.resources || []) {
    const row = rowsByResource.get(r.id);
    push('resource', r.id, r, {
      name: r.name, category: r.category, notes: r.notes, text: words(r.name, r.category, r.notes, ...(r.characteristics || []).map((c) => `${c.name} ${c.value} ${c.unit}`)),
      characteristics: quantities(r.characteristics), 'characteristics.count': (r.characteristics || []).length,
      averageTime: r.averageTime, channels: row ? (row.refinedChannels || row.maxChannels) : 0, dedaloChannels: row ? row.maxChannels : 0, uses: row ? row.uses.length : 0, stages: row ? row.stageIds.length : 0, interfaces: row ? row.interfaceIds.length : 0,
      stimulusUses: row ? row.stimulusUses : 0, measurementUses: row ? row.measurementUses : 0,
    }, { row });
  }
  const pointsById = new Map(derived.points.map((p) => [p.point.id, p]));
  for (const p of doc.points || []) {
    const row = pointsById.get(p.id);
    push('point', p.id, p, {
      name: p.name, connector: p.connector, pin: p.pin, signal: p.signal, contactType: p.contactType, notes: p.notes,
      text: words(p.name, p.connector, p.pin, p.signal, p.contactType, p.notes),
      characteristics: quantities(p.characteristics), 'characteristics.count': (p.characteristics || []).length,
      markers: (p.markers || []).length, resources: row ? row.resourceIds.length : 0, interfaces: row ? row.interfaceIds.length : 0, uses: row ? row.uses.length : 0,
      stimulusUses: row ? row.stimulusUses : 0, measurementUses: row ? row.measurementUses : 0,
    }, { row });
  }
  for (const i of doc.interfaces || []) {
    push('interface', i.id, i, {
      name: i.name, type: i.type, notes: i.notes, text: words(i.name, i.type, i.notes, ...(i.parameters || []).map((c) => `${c.name} ${c.value} ${c.unit}`)),
      characteristics: quantities(i.parameters), 'parameters.count': (i.parameters || []).length, resource: i.resourceId ? label(i.resourceId) : '', points: (i.pointIds || []).length,
      commands: (doc.commands || []).filter((c) => c.interfaceId === i.id).length,
    });
  }
  for (const c of doc.commands || []) {
    push('command', c.id, c, {
      name: c.name, address: c.address, requestFormat: c.requestFormat, responseFormat: c.responseFormat, encoding: c.encoding, notes: c.notes,
      text: words(c.name, c.address, c.requestFormat, c.responseFormat, c.encoding, c.notes), interface: c.interfaceId ? label(c.interfaceId) : '', protocol: c.protocolId ? label(c.protocolId) : '',
      reference: c.referenceId ? label(c.referenceId) : '', nominalTime: c.nominalTime, decodingUnit: (c.decoding || {}).unit || '',
      uses: derived.uses.filter((u) => u.commandId === c.id).length,
    });
  }
  for (const v of doc.variables || []) push('variable', v.id, v, { name: v.name, type: v.type, unit: v.unit, value: v.value, min: v.min, max: v.max, description: v.description, text: words(v.name, v.description) });
  for (const v of doc.variants || []) push('variant', v.id, v, { name: v.name, description: v.description, text: words(v.name, v.description), operations: (v.overlay || []).length });
  for (const s of doc.stages || []) {
    push('stage', s.id, s, {
      name: s.name, description: s.description, kind: isSetup(s) ? 'setup' : 'test', text: words(s.name, s.description),
      prerequisites: (s.prerequisites || []).length, exclusions: (s.exclusions || {}).mode || 'none', held: (s.heldStimuli || []).length, tests: (s.tests || []).length,
      steps: (s.tests || []).reduce((n, t) => n + (t.steps || []).length, 0),
    });
  }
  const stimuliByStep = new Map();
  for (const st of derived.stimuli) { if (!stimuliByStep.has(st.stepId)) stimuliByStep.set(st.stepId, []); stimuliByStep.get(st.stepId).push(st); }
  for (const { stage, test, step } of derived.steps) {
    const verbs = actionVerbs(words(step.description, step.stimulus && step.stimulus.description));
    push('step', step.id, step, {
      description: step.description, note: step.note, type: step.type, text: words(step.description, step.note, step.stimulus && step.stimulus.description, step.measurement && step.measurement.description),
      verbs, stage: stage.name, test: test.name, kpi: !!test.kpi, setup: isSetup(stage), wait: step.wait && step.wait.value ? step.wait.value.value || (step.wait.value.mode === 'variable' ? 'variable' : '') : '',
      rows: step.type === STEP_TYPE.TABLE ? ((step.table || {}).rows || []).length : 0,
    }, { stage, test });
  }
  for (const st of derived.stimuli) {
    const parameters = {};
    for (const p of st.parameters) parameters[String(p.name || '').toLowerCase()] = { ...(p.quantity || parseQuantity(p.text, p.unit)), name: p.name, unitText: p.unit, values: p.values };
    const resources = st.resourceIds.map((id) => index.get(id)).filter(Boolean);
    const step = index.get(st.stepId);
    push('stimulus', st.stepId, st, {
      description: st.description, text: words(st.description, step && step.description), verbs: actionVerbs(words(st.description, step && step.description)),
      characteristics: parameters, 'parameters.count': st.parameters.length, resource: resources.map((r) => r.name).join(', '), resourceCategory: resources.map((r) => r.category).join(', '),
      points: st.pointIds.length, command: st.commandId ? label(st.commandId) : '', table: st.table,
    }, { code: codes.get(st.stepId) || '', label: label(st.stepId) });
  }
  for (const c of derived.criteria) {
    const step = index.get(c.stepId);
    push('criterion', c.stepId, c, {
      quantity: c.quantity, text: words(c.quantity, c.text, step && step.description), unit: c.limits.unit, code: c.limits.code, judged: c.limits.judged, twoSided: c.limits.twoSided,
      span: c.limits.span, kpi: c.kpi, computed: c.computed, resource: c.resourceIds.map((id) => nameOf(index.get(id))).join(', '), command: c.commandId ? label(c.commandId) : '',
    }, { code: codes.get(c.stepId) || '', label: label(c.stepId) + (c.rowLabel ? ` [${c.rowLabel}]` : '') });
  }
  return records;
}

/** Reads one field of a record: a plain field, or `characteristic:Max current` / `parameter:Voltage` as a quantity. */
export function field(record, name) {
  const n = String(name || '');
  const m = /^(characteristic|parameter):(.+)$/i.exec(n);
  if (m) {
    const q = (record.fields.characteristics || {})[m[2].trim().toLowerCase()];
    return q === undefined ? undefined : q;
  }
  return record.fields[n];
}
