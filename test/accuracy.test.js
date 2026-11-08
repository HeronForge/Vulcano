import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accuracyAnalysis } from '../src/model/accuracy.js';
import { runCalculation } from '../src/kb/calculations.js';
import { deriveAll } from '../src/model/derived.js';
import { emptyDocument, newStage, newTest, newStep, newResource, newPoint, constant } from '../src/model/schema.js';

function docWith(criteria) {
  const doc = emptyDocument();
  const dmm = Object.assign(newResource(), { name: '6½ digit multimeter', category: 'Electrical measurement', characteristics: [{ id: 'c', name: 'Accuracy', value: '±0.0035', unit: '%' }] });
  const pt = Object.assign(newPoint(), { name: 'P', contactType: 'Ø 1.3 mm spring probe' });
  doc.resources = [dmm]; doc.points = [pt];
  const stage = newStage(); const t = newTest();
  t.steps = criteria.map((e, i) => { const s = newStep('measurement'); s.description = `m${i}`; s.measurement.description = `q${i}`; s.measurement.resourceId = dmm.id; s.measurement.pointIds = [pt.id]; s.measurement.expected = { ...s.measurement.expected, ...e }; return s; });
  stage.tests = [t]; doc.stages = [stage];
  return doc;
}

test('the reference calculations show their steps and give the textbook numbers', () => {
  const tur = runCalculation('CALC-TUR', { span: 1.2, U: 0.05 });
  assert.ok(Math.abs(tur.value - 12) < 1e-9);
  assert.equal(tur.steps.length, 3);
  const inst = runCalculation('CALC-UINST', { percent: 0.0035, offset: 0, reading: 12 });
  assert.ok(Math.abs(inst.value - 2 * 0.00042 / Math.sqrt(3)) < 1e-9);
  const guard = runCalculation('CALC-GUARD', { min: 11.4, max: 12.6, U: 0.1, g: 1 });
  assert.ok(Math.abs(guard.value.min - 11.5) < 1e-9 && Math.abs(guard.value.max - 12.5) < 1e-9 && guard.value.collapsed === false);
  assert.equal(runCalculation('CALC-GUARD', { min: 0, max: 0.1, U: 0.2, g: 1 }).value.collapsed, true);
  const rss = runCalculation('CALC-RSS', { terms: [{ label: 'a', value: 3 }, { label: 'b', value: 4 }] });
  assert.equal(rss.value, 5);
  assert.ok(Math.abs(runCalculation('CALC-SETTLE', { R: 1e4, C: 1e-9, epsilon: 0.001 }).value - 6.9e-5) < 1e-6);
  assert.equal(runCalculation('CALC-STATIONS', { cycle: 150, handling: 20, takt: 60 }).value, 3);
  assert.match(runCalculation('CALC-PATH-R', { contacts: [0.03, 0.03], switches: [0.1], cable: 0.02 }).steps[0].expression, /0.03 \+ 0.03/);
});

test('a criterion at 12 V ± 5 % on a 6½-digit meter is adequate; at ± 0.001 % it is not; a one-sided limit gets its uncertainty at the limit', () => {
  const doc = docWith([
    { mode: 'nominal', nominal: constant('12'), tolerance: constant('5'), toleranceType: 'percent', unit: 'V' },
    { mode: 'nominal', nominal: constant('12'), tolerance: constant('0.001'), toleranceType: 'percent', unit: 'V' },
    { mode: 'minmax', min: constant(''), max: constant('45'), unit: 'mA', comparison: 'LE' },
    { mode: 'minmax', min: constant(''), max: constant(''), comparison: 'NONE', unit: 'V' },
  ]);
  const derived = deriveAll(doc);
  const dmmClass = { percent: 0.0035, offset: 0, from: '6½-digit bench multimeter', switching: 'mux', classId: 'dmm-6.5' };
  const a = accuracyAnalysis(derived, { settings: { turTarget: 4, guardFactor: 1 }, instrumentFor: () => dmmClass, contactFor: () => ({ resistance: 0.03, qty: 1, sense: false }) });
  assert.equal(a.rows[0].verdict, 'adequate');
  assert.ok(a.rows[0].tur > 100);
  assert.ok(a.rows[0].guard.min > 11.4 && a.rows[0].guard.max < 12.6);
  assert.equal(a.rows[1].verdict, 'inadequate');
  assert.equal(a.rows[1].guard.collapsed, true);
  assert.equal(a.rows[2].verdict, 'oneSided');
  assert.ok(a.rows[2].atLimit.relative < 0.01, 'the DMM uncertainty at 45 mA is well under 1 % of the limit');
  assert.equal(a.rows[3].verdict, 'notJudged');
  const agg = a.byResource.get(doc.resources[0].id);
  assert.ok(agg.requiredPercent < 0.001, 'the 0.001 % criterion sets the class');
  assert.equal(agg.noneFits, true, 'no class of the knowledge base reaches 0.0004 %');
  const none = accuracyAnalysis(derived, { settings: {} });
  assert.equal(none.rows[0].verdict, 'noInstrument', 'with nothing assigned the verdict says so');
  assert.equal(none.byResource.get(doc.resources[0].id).requiredPercent, agg.requiredPercent, 'the requirement does not depend on the choice');
  assert.equal(agg.tightest.code, derived.codes.get(doc.stages[0].tests[0].steps[1].id));
});

test('a two-wire resistance measurement carries the path resistance and a four-wire one does not', () => {
  const doc = docWith([{ mode: 'nominal', nominal: constant('0.1'), tolerance: constant('10'), toleranceType: 'percent', unit: 'Ω' }]);
  const derived = deriveAll(doc);
  const dmmClass = { percent: 0.0035, offset: 0, from: 'DMM', switching: 'dedicated' };
  const two = accuracyAnalysis(derived, { settings: {}, instrumentFor: () => dmmClass, contactFor: () => ({ resistance: 0.03, qty: 1, sense: false }) });
  assert.ok(two.rows[0].path.contributions[0].value > 0, 'the probe adds its resistance two-wire');
  assert.equal(two.rows[0].verdict, 'inadequate', '30 mΩ of probe on a ±10 mΩ criterion');
  const four = accuracyAnalysis(derived, { settings: {}, instrumentFor: () => dmmClass, contactFor: () => ({ resistance: 0.03, qty: 1, sense: true }) });
  assert.equal(four.rows[0].path.sensed, true);
  assert.equal(four.rows[0].verdict, 'adequate');
});
