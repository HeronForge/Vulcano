import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAll } from '../src/model/derived.js';
import { buildRecords, field } from '../src/model/entities.js';
import { runRules } from '../src/model/rules.js';
import { matches, select, fill } from '../src/model/conditions.js';
import { builtInKnowledgeBase, mergeExtension } from '../src/kb/index.js';
import { emptyDocument, newStage, newTest, newStep, newResource, newPoint, newVariable, constant } from '../src/model/schema.js';
import { wallbox, hasWallbox } from './helpers.js';

const kb = builtInKnowledgeBase();
const run = (doc, extra = {}) => { const derived = deriveAll(doc); const records = buildRecords(derived); return { ...runRules({ derived, records, kb: extra.kb || kb, assets: extra.assets || {} }), derived, records }; };

test('every rule runs on the wallbox document and the real inconsistencies of the showcase are found', { skip: !hasWallbox() }, () => {
  const spec = wallbox();
  const { findings, errors } = run(spec.doc, { assets: spec.assets });
  assert.deepEqual(errors, []);
  const ids = (rule) => findings.filter((f) => f.ruleId === rule);
  assert.ok(ids('R-CON-02').length >= 6, 'the hipot voltage exceeds the 300 V rating of the mains clips');
  assert.equal(ids('R-CON-01').length, 1, 'the earth bond current is asked of a tester whose stated current is a trip current');
  assert.equal(ids('R-INC-01').length, 0, 'every measurement of the showcase has a criterion');
  assert.equal(ids('R-INC-09').length, 0, 'every image has its picture');
  assert.ok(ids('R-ASM-06').length === 1, 'no production volume is stated');
  assert.equal(ids('R-ASM-01').length, 0, 'the ambient temperature is a variable');
  assert.ok(ids('R-COST-10').length >= 10, 'the mains and socket points are shared by several resources');
  assert.ok(findings.every((f) => f.key && f.message && f.label), 'every finding has a key, a message and a label');
});

function syntheticDoc() {
  const doc = emptyDocument();
  const psu = Object.assign(newResource(), { name: 'Supply', category: 'Power', characteristics: [{ id: 'c1', name: 'Voltage', value: '0 … 32', unit: 'V' }] });
  const bare = Object.assign(newResource(), { name: 'Meter', category: 'Electrical measurement' });
  const pt = Object.assign(newPoint(), { name: 'VBAT', connector: 'J1', pin: '1', contactType: 'Spring probe', characteristics: [{ id: 'c2', name: 'Max current', value: '3', unit: 'A' }] });
  const pt2 = Object.assign(newPoint(), { name: 'GND', connector: 'J1', pin: '1' });
  const v = Object.assign(newVariable(), { name: 'Imax', unit: 'A' });
  doc.resources = [psu, bare]; doc.points = [pt, pt2]; doc.variables = [v];
  const setup = Object.assign(newStage('setup'), { name: 'Never called' });
  const s1 = Object.assign(newStage(), { name: 'One' });
  const s2 = Object.assign(newStage(), { name: 'Two' });
  s1.prerequisites = [s2.id]; s2.prerequisites = [s1.id];
  const t = newTest();
  const stim = newStep('stimulus');
  stim.stimulus.resourceId = psu.id; stim.stimulus.pointIds = [pt.id]; stim.stimulus.parameters = [{ id: 'p1', name: 'Voltage', value: constant('48'), unit: 'V' }, { id: 'p2', name: 'Current', value: constant('10'), unit: 'A' }];
  const meas = newStep('measurement');
  meas.measurement.resourceId = bare.id; meas.measurement.pointIds = [pt.id]; meas.description = 'Measure the current';
  meas.measurement.expected.unit = 'A';
  const inverted = newStep('measurement');
  inverted.measurement.resourceId = bare.id; inverted.measurement.pointIds = [pt.id]; inverted.measurement.expected = { ...inverted.measurement.expected, min: constant('5'), max: constant('1'), unit: 'V' };
  t.steps = [stim, meas, inverted];
  s1.tests = [t];
  doc.stages = [setup, s1, s2];
  return { doc, psu, bare, pt, pt2, v, setup, s1, s2, stim, meas, inverted };
}

test('incompleteness and inconsistency rules on a synthetic document', () => {
  const x = syntheticDoc();
  const { findings, errors } = run(x.doc);
  assert.deepEqual(errors, []);
  const of = (rule) => findings.filter((f) => f.ruleId === rule);
  assert.equal(of('R-INC-01').length, 1, 'a measurement with no criterion');
  assert.equal(of('R-INC-01')[0].elementId, x.meas.id);
  assert.equal(of('R-INC-03')[0].elementId, x.bare.id, 'a resource with no characteristics');
  assert.equal(of('R-INC-04')[0].elementId, x.v.id, 'a variable with no value');
  assert.equal(of('R-INC-05').length, 2, 'two points on no picture');
  assert.equal(of('R-INC-06')[0].elementId, x.pt2.id, 'a point with no contact type');
  assert.equal(of('R-CON-01').length, 1, '48 V asked of a 32 V supply');
  assert.match(of('R-CON-01')[0].question, /Voltage 0 … 32 V/);
  assert.equal(of('R-CON-02').length, 1, '10 A through a 3 A point');
  assert.equal(of('R-CON-03')[0].elementId, x.inverted.id, 'inverted limits');
  assert.equal(of('R-CON-07')[0].elementId, x.setup.id, 'a setup stage never called');
  assert.equal(of('R-CON-09').length, 1, 'a prerequisite cycle');
  assert.equal(of('R-CON-12').length, 1, 'two points on J1 pin 1');
  assert.ok(of('R-COST-05').length >= 1, '10 A is a high current');
  assert.ok(findings.filter((f) => f.severity === 'error').length >= 5);
});

test('the condition language selects records and fills templates', () => {
  const x = syntheticDoc();
  const derived = deriveAll(x.doc);
  const records = buildRecords(derived);
  const psu = records.find((r) => r.type === 'resource' && r.id === x.psu.id);
  assert.equal(matches({ entity: 'resource', field: 'category', op: 'contains', value: ['power'] }, psu), true);
  assert.equal(matches({ entity: 'resource', field: 'characteristic:Voltage', op: 'gte', value: 30, unit: 'V' }, psu), true, 'a range compares by its top end');
  assert.equal(matches({ entity: 'resource', field: 'characteristic:Voltage', op: 'gte', value: 30, unit: 'mV' }, psu), true, 'units scale: 32 V ≥ 30 mV');
  assert.equal(matches({ entity: 'resource', field: 'characteristic:Voltage', op: 'gte', value: 30, unit: 'A' }, psu), false, 'a voltage does not compare with a current');
  assert.equal(matches({ all: [{ entity: 'resource', field: 'name', op: 'matches', value: '^Sup' }, { not: { field: 'category', op: 'equals', value: 'Load' } }] }, psu), true);
  const hv = select({ entity: 'stimulus', field: 'parameter:Voltage', op: 'gte', value: 40, unit: 'V' }, records);
  assert.equal(hv.length, 1);
  assert.equal(field(hv[0], 'parameter:Current').value, 10);
  assert.equal(select({ entity: 'spec', field: 'testing', op: 'missing', value: ['temperature'] }, records).length, 1);
  assert.equal(fill('{{code}} {{name}} needs {{characteristic:Voltage}}', psu), 'RES-01 Supply needs 0 … 32 V');
});

test('a declarative rule from an extension runs beside the built-in ones and can replace one', () => {
  const x = syntheticDoc();
  const ext = builtInKnowledgeBase();
  const report = mergeExtension(ext, { name: 'ext', rules: [
    { id: 'X-1', title: 'Point on connector J1', severity: 'info', when: { entity: 'point', field: 'connector', op: 'equals', value: 'J1' }, message: '{{label}} sits on J1', question: 'Is {{name}} really on J1?' },
    { id: 'R-INC-05', title: 'replaced', severity: 'info', when: { entity: 'point', field: 'markers', op: 'gte', value: 99 }, message: 'never' },
    { id: 'nope', title: 'no condition' },
  ] });
  assert.equal(report.added, 1);
  assert.equal(report.replaced, 1);
  assert.equal(report.skipped.length, 1);
  const { findings } = run(x.doc, { kb: ext });
  assert.equal(findings.filter((f) => f.ruleId === 'X-1').length, 2);
  assert.match(findings.find((f) => f.ruleId === 'X-1').question, /^Is VBAT really on J1\?$/);
  assert.equal(findings.filter((f) => f.ruleId === 'R-INC-05').length, 0, 'the replaced rule no longer fires');
});
