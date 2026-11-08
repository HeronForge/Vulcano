import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSpecification, readNotes, checkFormat } from '../src/io/dedalo.js';
import { FORMATS } from '../src/version.js';
import { wallbox, hasWallbox, fixture } from './helpers.js';

test('the DEDALO document itself opens from its embedded data block', { skip: !hasWallbox() }, () => {
  const spec = wallbox();
  assert.equal(spec.source.format, 'dedalo-html');
  assert.equal(spec.doc.schemaVersion, 2);
  assert.equal(spec.doc.header.documentCode, 'TS-EVC-0117');
  assert.equal(spec.doc.stages.length, 17);
  assert.ok(Object.keys(spec.assets).length >= 4, 'the pictures come with the document');
  assert.ok(spec.history.revisions.length >= 1, 'the revision history comes with the document');
  assert.deepEqual(spec.problems, []);
});

test('a tsw-export envelope opens and an older schema is upgraded with a note', () => {
  const doc = { schemaVersion: 1, header: { title: 'T', preparedBy: 'A' }, stages: [{ id: 'stg_1', name: 'S', tests: [{ id: 'tc_1', steps: [{ id: 'stp_1', description: 'd', type: 'stimulus', wait: { value: '2', unit: 's' } }] }] }] };
  const spec = readSpecification(JSON.stringify({ format: 'tsw-export/1', application: 'DEDALO', applicationVersion: '1.30.0', doc, history: { revisions: [] }, assets: {} }), 'x.json');
  assert.equal(spec.source.format, 'tsw-export');
  assert.equal(spec.doc.schemaVersion, 2);
  assert.equal(spec.doc.header.signatories[0].name, 'A');
  assert.deepEqual(spec.doc.stages[0].tests[0].steps[0].wait, { value: { mode: 'constant', value: '2' }, unit: 's' });
  assert.match(spec.problems[0], /upgraded from DEDALO data schema 1 to 2/);
});

test('a newer export format or a newer document schema is refused with the reason', () => {
  assert.throws(() => readSpecification(JSON.stringify({ format: 'tsw-export/2', doc: { schemaVersion: 2, stages: [] } })), /tsw-export\/2.*only reads up to tsw-export\/1/);
  assert.throws(() => readSpecification(JSON.stringify({ format: 'tsw-export/1', doc: { schemaVersion: 3, stages: [] } })), /data schema 3/);
  assert.throws(() => readSpecification(JSON.stringify({ format: 'vulcano-job/1' })), /VULCANO vulcano-job file/);
  assert.throws(() => readSpecification('just text'), /neither a DEDALO document/);
});

test('the authoring file of the import guide reads as DEDALO reads it, notes lifted', () => {
  const spec = readSpecification(fixture('example-authoring.json'), 'example-spec.json');
  assert.equal(spec.source.format, 'tsw-authoring');
  const doc = spec.doc;
  assert.equal(doc.stages.length, 2);
  assert.equal(doc.stages[0].kind, 'setup');
  assert.equal(doc.variants.length, 2);
  const v24 = doc.variants[1];
  assert.equal(v24.overlay.length, 2, 'two variable overrides become two set operations');
  assert.equal(v24.overlay[0].op, 'set');
  const call = doc.stages[1].tests[0].steps[0];
  assert.equal(call.type, 'stageCall');
  assert.equal(call.calledStageId, doc.stages[0].id);
  const table = doc.stages[1].tests[0].steps[3];
  assert.equal(table.type, 'table');
  assert.equal(table.table.rows.length, 3);
  assert.equal(table.table.rows[1].cells[1].expected.mode, 'nominal', 'a «$Vbatt ±5%» cell is a nominal with a percent tolerance');
  assert.equal(table.table.rows[1].cells[1].expected.nominal.mode, 'variable');
  const toCheck = spec.notes.filter((n) => n.kind === 'toCheck');
  assert.equal(toCheck.length, 1, 'the TO CHECK line leaves the step note and becomes a note');
  assert.equal(spec.notes.filter((n) => n.kind === 'leftOut').length, 1);
  assert.match(doc.stages[1].tests[0].steps[2].note, /^$/, 'the lifted line is gone from the note');
  assert.ok(spec.problems.some((p) => /image/.test(p)), 'the declared image without a picture is reported');
  assert.ok(doc.commands[0].decoding.unit === 'mV');
});

test('a notes file must belong to the open specification', () => {
  const doc = { header: { documentCode: 'A-1', title: 'T' }, revision: { number: '02' } };
  const notes = { format: 'tsw-notes/1', spec: { documentCode: 'A-1', title: 'T', revision: '01' }, notes: [{ id: 'nt_1', kind: 'toCheck', text: 'x', anchor: { id: 'ref-stp_1' } }] };
  const r = readNotes(JSON.stringify(notes), doc);
  assert.equal(r.notes.length, 1);
  assert.match(r.warnings[0], /revision 01/);
  assert.throws(() => readNotes(JSON.stringify({ ...notes, spec: { documentCode: 'B-9', title: 'Other' } }), doc), /another specification/);
  assert.throws(() => readNotes(JSON.stringify({ ...notes, format: 'tsw-notes/2' }), doc), /only reads up to/);
});

test('format checks read older versions with a note and refuse newer ones', () => {
  const spec = { ...FORMATS.job, reads: [1, 2], writes: 2 };
  assert.equal(checkFormat({ id: 'vulcano-job', version: 1 }, spec).notes[0], 'Upgraded from vulcano-job/1 to vulcano-job/2.');
  assert.equal(checkFormat({ id: 'vulcano-job', version: 3 }, spec).ok, false);
  assert.equal(checkFormat({ id: 'vulcano-quote', version: 1 }, spec).ok, false);
  assert.equal(checkFormat(null, spec).ok, false);
  assert.equal(checkFormat(null, spec, { fallbackVersion: 2 }).ok, true);
});
