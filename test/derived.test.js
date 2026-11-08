import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAll, formatSeconds, criteriaTable } from '../src/model/derived.js';
import { parseQuantity, unitFamily, unitScale, criterionLimits, resolveVariant, expectedText, variableIndex } from '../src/model/spec.js';
import { wallbox, hasWallbox } from './helpers.js';

test('the derived tables of the wallbox document match what DEDALO shows', { skip: !hasWallbox() }, () => {
  const d = deriveAll(wallbox().doc);
  const row = (code) => d.resources.rows.find((r) => d.codes.get(r.resource.id) === code);
  assert.equal(d.codes.get(d.doc.stages[0].id), 'STG-01');
  assert.equal(d.codes.get(d.doc.stages.find((s) => s.kind === 'setup').id), 'SET-01');
  assert.equal(row('RES-04').maxChannels, 10, 'the multimeter needs ten channels at once as DEDALO counts them');
  assert.equal(row('RES-01').maxChannels, 20, 'the mains source is counted per stage in the busiest group');
  assert.equal(row('RES-01').refinedChannels, 5, 'but only five distinct points get wired');
  assert.equal(d.criteria.length, 104);
  assert.equal(d.steps.length, 106);
  assert.equal(d.stimuli.filter((s) => s.table).length, 1, 'the PP table has one stimulus column');
  assert.equal(formatSeconds(d.cycle.serial), '3 min 17 s');
  assert.equal(formatSeconds(d.cycle.parallel), '2 min 32 s');
  assert.ok(d.cycle.schedule.some((slot) => slot.ids.length === 4), 'four stages share a slot');
  assert.deepEqual(d.cycle.missing, { resources: [], commands: [] });
});

test('a variant resolves through its overlay and the criteria table has a column set per variant', { skip: !hasWallbox() }, () => {
  const base = wallbox().doc;
  const evc7 = base.variants.find((v) => v.name === 'EVC-7 S');
  const { doc, dropped } = resolveVariant(base, evc7.id);
  assert.deepEqual(dropped, []);
  assert.equal(doc.stages.length, base.stages.length - 1, 'the RFID stage is excluded');
  const t = criteriaTable(base);
  assert.equal(t.variants.length, 4);
  const evc11 = t.variants.find((v) => v.variant.name === 'EVC-11');
  const changed = t.rows.filter((r) => { const v = evc11.rows.get(r.id); return v && v.text !== r.text; });
  assert.ok(changed.length >= 1, 'the duty-cycle criterion follows MaxCurrent in EVC-11');
});

test('quantities in free text parse to numbers in base units', () => {
  assert.deepEqual([parseQuantity('0 … 300', 'V per phase').min, parseQuantity('0 … 300', 'V per phase').max], [0, 300]);
  assert.equal(parseQuantity('0.1 … 20', 'mA').max, 0.02);
  assert.equal(parseQuantity('±0.02', '%').tolerance, 0.02);
  assert.equal(parseQuantity('< 10', 'mΩ').max, 0.01);
  assert.deepEqual(parseQuantity('100 / 220 / 680 / 1500', 'Ω').list, [100, 220, 680, 1500]);
  assert.equal(parseQuantity('10 Ω … 1 MΩ', '').max, 1e6);
  assert.equal(parseQuantity('galvanic, PE switchable', '').value, null);
  assert.equal(unitFamily('kV AC'), 'voltage');
  assert.equal(unitFamily('A per phase'), 'current');
  assert.equal(unitScale('ms').factor, 1e-3);
  assert.equal(unitScale('mm').base, 'm');
  assert.equal(unitScale('min').base, 'min');
});

test('criterion limits: nominal with percent tolerance, one-sided, recorded, variables', () => {
  const variables = variableIndex({ variables: [{ id: 'var_1', name: 'Vbatt', type: 'number', unit: 'V', value: '13.5' }] });
  const eqt = criterionLimits({ kind: 'numeric', mode: 'nominal', nominal: { mode: 'variable', variableId: 'var_1' }, tolerance: { mode: 'constant', value: '5' }, toleranceType: 'percent', unit: 'V' }, variables);
  assert.equal(eqt.code, 'EQT');
  assert.ok(Math.abs(eqt.min - 12.825) < 1e-9 && Math.abs(eqt.max - 14.175) < 1e-9);
  assert.equal(eqt.twoSided, true);
  assert.equal(eqt.variables[0].name, 'Vbatt');
  const le = criterionLimits({ kind: 'numeric', mode: 'minmax', min: { mode: 'constant', value: '' }, max: { mode: 'constant', value: '45' }, unit: 'mA', comparison: 'LE' }, variables);
  assert.equal(le.code, 'LE');
  assert.equal(le.max, 45);
  assert.equal(le.twoSided, false);
  const none = criterionLimits({ kind: 'numeric', mode: 'minmax', min: { mode: 'constant', value: '' }, max: { mode: 'constant', value: '' }, comparison: 'NONE' }, variables);
  assert.equal(none.judged, false);
  assert.equal(expectedText({ kind: 'numeric', mode: 'nominal', nominal: { mode: 'variable', variableId: 'var_1' }, tolerance: { mode: 'constant', value: '5' }, toleranceType: 'percent', unit: 'V' }, variables), '13.5 V (Vbatt) ± 5 %');
});
