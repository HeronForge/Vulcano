// The tool in memory: the database (always there), the job (when a specification is open),
// and what is derived from the specification — tables, findings, requirements, accuracy.
// The interface reads from here and writes through here; `recompute()` re-derives after a
// change to the specification, `touch()` after a change to the project.
import { readSpecification, readNotes, specIdentity } from '../io/dedalo.js';
import { builtInKnowledgeBase, mergeExtension } from '../kb/index.js';
import { deriveAll } from './derived.js';
import { buildRecords } from './entities.js';
import { runRules } from './rules.js';
import { accuracyAnalysis } from './accuracy.js';
import { requirements, emptyJob, assignment, switchingOf, normaliseQuoteDetails } from './project.js';
import { normaliseDb, starterDb, find } from './db.js';
import { INSTRUMENT_CLASSES } from '../kb/reference.js';
import { APP_NAME, APP_VERSION } from '../version.js';
import { renumber } from './questions.js';

export function createSession({ db = null, job = null } = {}) {
  // `specText` is the raw text of the specification when it was the DEDALO document itself
  // (never a data export): a resource's «Open in the specification» opens a fresh copy of it in
  // a new tab. It travels with this session only, never with the file or a JSON export — the
  // document can be megabytes, and this file stays one, self-contained, of a sane size. A
  // project reopened later (the saved file, or an imported job) has no specification file
  // loaded, so the button says so instead of pretending.
  const s = { db: db ? normaliseDb(db) : starterDb(), kb: builtInKnowledgeBase(), job: null, derived: null, derivedBase: null, records: [], findings: [], ruleErrors: [], accuracy: null, reqs: [], dirty: false, log: [], specText: null };
  if (job) loadJob(s, job);
  return s;
}

export const meta = (s) => ({ application: APP_NAME, applicationVersion: APP_VERSION, identity: s.job && s.job.spec ? specIdentity(s.job.spec.doc) : {} });

/** Opens a specification: a new, empty project over it. */
export function openSpecification(s, text, fileName) {
  const spec = readSpecification(text, fileName);
  const job = emptyJob();
  job.spec = spec;
  job.name = spec.doc.header.documentCode || spec.doc.header.title || fileName;
  // A starting point for the quote's «To»: the specification's own company, if it names one — never overwriting what the user later types.
  const id = specIdentity(spec.doc);
  if (id.company) job.quote.details.client.name = id.company;
  s.job = job;
  s.specText = spec.source.kind === 'html' ? text : null;
  recompute(s);
  s.dirty = true;
  s.log.push({ at: new Date().toISOString(), what: `Opened ${fileName} (${spec.source.format})` });
  return spec;
}

export function loadJob(s, job) {
  s.specText = null;
  const base = emptyJob();
  s.job = { ...base, ...job, assignments: job.assignments || {}, choices: job.choices || {}, lines: job.lines || [], questions: job.questions || [], checklist: job.checklist || {}, quote: { ...base.quote, ...(job.quote || {}), details: normaliseQuoteDetails((job.quote || {}).details) }, settings: { ...base.settings, ...(job.settings || {}) } };
  delete s.job.variantId;
  if (!s.job.spec || !s.job.spec.doc) { s.job = null; return; }
  for (const a of Object.values(s.job.assignments)) { a.routing = Array.isArray(a.routing) ? a.routing : []; a.accessories = Array.isArray(a.accessories) ? a.accessories : []; delete a.topology; delete a.relayPartId; }
  s.job.spec.history = s.job.spec.history || { revisions: [] };
  s.job.spec.assets = s.job.spec.assets || {};
  s.job.spec.notes = s.job.spec.notes || [];
  s.job.spec.problems = s.job.spec.problems || [];
  recompute(s);
  renumber(s.job.questions);
}

export function closeJob(s) { s.job = null; s.derived = null; s.derivedBase = null; s.records = []; s.findings = []; s.accuracy = null; s.reqs = []; s.specText = null; }

export function addNotes(s, text) {
  if (!s.job) throw new Error('Open a specification first.');
  const { notes, warnings } = readNotes(text, s.job.spec.doc);
  const known = new Set(s.job.spec.notes.map((n) => n.id));
  const fresh = notes.filter((n) => !known.has(n.id));
  s.job.spec.notes.push(...fresh);
  s.dirty = true;
  return { added: fresh.length, warnings, total: notes.length };
}

/** Re-derives everything from the specification as it stands (the base document: a bench is built for every variant). */
export function recompute(s) {
  if (!s.job) return;
  s.derivedBase = deriveAll(s.job.spec.doc);
  s.derived = s.derivedBase;
  s.records = buildRecords(s.derived);
  const { findings, errors } = runRules({ derived: s.derived, records: s.records, kb: s.kb, assets: s.job.spec.assets, source: s.job.spec.source });
  s.findings = findings;
  s.ruleErrors = errors;
  touch(s, { dirty: false });
}

/** After a change to the project: the accuracy follows the assignments; the requirements keep their slots. */
export function touch(s, { dirty = true } = {}) {
  if (!s.job) return;
  const accuracyBase = accuracyAnalysis(s.derivedBase, { settings: s.job.settings });
  s.reqs = requirements(s.derivedBase, accuracyBase);
  s.accuracy = accuracyAnalysis(s.derivedBase, { settings: s.job.settings, instrumentFor: (id) => instrumentFor(s, id), contactFor: (id) => contactFor(s, id) });
  if (dirty) s.dirty = true;
}

/** The accuracy of the instrument assigned to a resource: the row's own figure, or its class's. */
export function instrumentFor(s, resourceId) {
  const req = s.reqs.find((r) => r.kind === 'instrument' && r.subjectId === resourceId);
  const a = req ? assignment(s.job, req.id) : null;
  if (!a || a.none || !a.itemId) return null;
  const row = find(s.db, 'instruments', a.itemId);
  if (!row) return null;
  const cls = row.classId ? INSTRUMENT_CLASSES.find((c) => c.id === row.classId) : null;
  const percent = row.accuracy != null && row.accuracy !== '' ? Number(row.accuracy) : cls ? cls.accuracy.percent : null;
  if (percent == null) return null;
  return { percent, offset: cls ? cls.accuracy.offset : 0, from: row.name, switching: switchingOf(a), classId: row.classId || '' };
}

export function contactFor(s, pointId) {
  const req = s.reqs.find((r) => r.kind === 'part' && r.subjectIds && r.subjectIds.includes(pointId));
  const a = req ? assignment(s.job, req.id) : null;
  if (!a || a.none || !a.itemId) return null;
  const row = find(s.db, 'parts', a.itemId);
  if (!row) return null;
  const perPoint = req.count ? Math.max(1, Math.round((Number(a.qty) || req.count) / req.count)) : 1;
  return { resistance: row.resistance, qty: perPoint, sense: /kelvin|four-wire|4-wire/i.test(`${row.name} ${row.notes}`) };
}

export function loadExtension(s, extension, fileName) {
  const report = mergeExtension(s.kb, extension);
  s.kb.extensions[s.kb.extensions.length - 1].fileName = fileName;
  if (s.job) recompute(s);
  return report;
}
