// F1 · Import. Reads what DEDALO writes — the document itself (the self-contained HTML), its
// data export (`tsw-export/1`), an authoring file (`tsw-authoring/1`) — and the notes that
// travel beside a specification (`tsw-notes/1`). A newer format version is refused with the
// reason; an older one is upgraded on read and says so; every unresolved reference is reported.
import { DEDALO_SCHEMA_MAX, FORMATS } from '../version.js';
import { migrateDocument } from '../model/schema.js';
import { importAuthoring } from './authoring.js';

function parseFormat(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const [id, version] = text.split('/');
  return { id, version: Number(version) || 1 };
}

/** Checks a declared format against what this build reads; the reason of a refusal reads as a sentence. */
export function checkFormat(declared, spec, { fallbackVersion = null } = {}) {
  const notes = [];
  if (!declared) {
    if (fallbackVersion == null) return { ok: false, reason: `The file says nothing about its format, and a ${spec.label} does (${spec.id}/${spec.reads[spec.reads.length - 1]}).`, notes };
    notes.push(`The file carries no version: read as ${spec.id}/${fallbackVersion}, the newest this build reads.`);
    return { ok: true, version: fallbackVersion, notes };
  }
  if (declared.id !== spec.id) return { ok: false, reason: `This file is «${declared.id}/${declared.version}», not a ${spec.label} (${spec.id}).`, notes };
  const newest = spec.reads[spec.reads.length - 1];
  if (declared.version > newest) return { ok: false, reason: `This file is written in ${spec.id}/${declared.version}, and this build only reads up to ${spec.id}/${newest}. Open it with a newer build.`, notes };
  if (!spec.reads.includes(declared.version)) return { ok: false, reason: `Version ${spec.id}/${declared.version} is no longer read by this build.`, notes };
  if (declared.version < newest) notes.push(`Upgraded from ${spec.id}/${declared.version} to ${spec.id}/${newest}.`);
  return { ok: true, version: declared.version, notes };
}

function readBlock(html, id) {
  const re = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)<\\/script>`);
  const m = re.exec(html);
  if (!m) return { present: false, valid: false, value: null };
  try { return { present: true, valid: true, value: JSON.parse(m[1] || 'null') }; } catch { return { present: true, valid: false, value: null }; }
}

const looksLikeSpecification = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && (typeof v.schemaVersion === 'number' || Array.isArray(v.stages));

function readDedaloHtml(text, fileName) {
  const docBlock = readBlock(text, 'tsw-doc');
  if (!docBlock.present) throw new Error('This HTML file is not a DEDALO specification: it carries no data block.');
  if (!docBlock.valid) throw new Error('The data block of this file is damaged: its JSON could not be read.');
  if (!looksLikeSpecification(docBlock.value)) throw new Error('The data block of this file does not hold a specification.');
  const problems = [];
  if (typeof docBlock.value.schemaVersion === 'number' && docBlock.value.schemaVersion > DEDALO_SCHEMA_MAX) {
    throw new Error(`The document uses DEDALO data schema ${docBlock.value.schemaVersion}, and this build understands up to ${DEDALO_SCHEMA_MAX}. Open it with a newer VULCANO.`);
  }
  const { doc, applied, from } = migrateDocument(docBlock.value);
  for (const step of applied) problems.push(`Document upgraded from DEDALO data schema ${from} to ${step.to}: ${step.what}.`);
  const history = readBlock(text, 'tsw-history').value || { revisions: [] };
  const assets = readBlock(text, 'tsw-assets').value || {};
  return { doc, history, assets, notes: [], problems, source: { kind: 'html', format: 'dedalo-html', version: doc.schemaVersion, fileName } };
}

function readDedaloJson(data, fileName) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file does not contain a JSON object.');
  const declared = parseFormat(data.format);
  const looksLikeExport = !!data.doc;
  const kind = declared
    ? (declared.id === FORMATS.tswExport.id ? 'export' : declared.id === FORMATS.tswAuthoring.id ? 'authoring' : declared.id === FORMATS.tswNotes.id ? 'notes' : null)
    : looksLikeExport ? 'export' : Array.isArray(data.stages) ? 'authoring' : null;
  if (kind === 'notes') throw new Error('This is a DEDALO notes file, not a specification: load it beside the specification with «Add notes…».');
  if (!kind) {
    if (declared && declared.id.startsWith('vulcano-')) throw new Error(`This is a VULCANO ${declared.id} file, not a specification. Open it from the matching command.`);
    throw new Error(declared ? `Unknown format «${data.format}». This build reads ${FORMATS.tswExport.id}/1, ${FORMATS.tswAuthoring.id}/1 and the DEDALO document itself.` : 'The file says nothing about its format, and its content resembles neither an authoring file nor a data export.');
  }
  const spec = kind === 'export' ? FORMATS.tswExport : FORMATS.tswAuthoring;
  const check = checkFormat(declared, spec, { fallbackVersion: spec.reads[spec.reads.length - 1] });
  if (!check.ok) throw new Error(check.reason);
  const problems = [...check.notes];
  if (kind === 'export') {
    if (!looksLikeSpecification(data.doc)) throw new Error('The «doc» field of this export does not hold a specification: it has neither a schema version nor a list of stages.');
    if (typeof data.doc.schemaVersion === 'number' && data.doc.schemaVersion > DEDALO_SCHEMA_MAX) throw new Error(`The document inside uses DEDALO data schema ${data.doc.schemaVersion}, and this build understands up to ${DEDALO_SCHEMA_MAX}.`);
    const { doc, applied, from } = migrateDocument(data.doc);
    for (const step of applied) problems.push(`Document upgraded from DEDALO data schema ${from} to ${step.to}: ${step.what}.`);
    return { doc, history: data.history || { revisions: [] }, assets: data.assets || {}, notes: [], problems, source: { kind: 'json', format: spec.id, version: check.version, fileName, application: data.application || '', applicationVersion: data.applicationVersion || '' } };
  }
  const { doc, problems: p2, notes } = importAuthoring(data);
  return { doc, history: { revisions: [] }, assets: {}, notes, problems: [...problems, ...p2], source: { kind: 'json', format: spec.id, version: check.version, fileName } };
}

/**
 * Reads a specification from the text of a file. The result carries the document (schema 2),
 * its history and assets when the file had them, the notes an authoring file produced, the
 * problems to show the reader, and where it all came from.
 */
export function readSpecification(text, fileName = '') {
  const trimmed = String(text || '').trimStart();
  if (/^<!doctype html|^<html/i.test(trimmed) || /<script type="application\/json" id="tsw-doc">/.test(trimmed)) return readDedaloHtml(trimmed, fileName);
  let data;
  try { data = JSON.parse(trimmed); } catch { throw new Error('This file is neither a DEDALO document (HTML) nor a JSON file this build reads.'); }
  return readDedaloJson(data, fileName);
}

/** Reads a `tsw-notes/1` file and checks it belongs to the open specification. */
export function readNotes(text, doc) {
  let data;
  try { data = JSON.parse(String(text || '')); } catch { throw new Error('This file is not JSON.'); }
  const check = checkFormat(parseFormat(data.format), FORMATS.tswNotes);
  if (!check.ok) throw new Error(check.reason);
  if (!Array.isArray(data.notes)) throw new Error('This file does not hold notes: it has no «notes» list.');
  const theirs = data.spec || {};
  const h = (doc || {}).header || {};
  const sameCode = theirs.documentCode && h.documentCode ? theirs.documentCode === h.documentCode : theirs.title === h.title;
  const warnings = [...check.notes];
  if (!sameCode) throw new Error(`These notes belong to another specification — ${[theirs.documentCode, theirs.title].filter(Boolean).join(' — ') || '(unnamed)'} — and this is ${[h.documentCode, h.title].filter(Boolean).join(' — ') || '(unnamed)'}.`);
  const mine = String(((doc || {}).revision || {}).number || '');
  if (String(theirs.revision || '') !== mine) warnings.push(`These notes were written on revision ${theirs.revision || '—'} of the specification, and the one open is revision ${mine || '—'}: their anchors may point beside the wrong lines.`);
  return { notes: data.notes.map((n) => ({ ...n })), warnings };
}

/** The identity every VULCANO output records: which specification, which revision. */
export function specIdentity(doc) {
  const h = (doc || {}).header || {};
  const r = (doc || {}).revision || {};
  return { documentCode: h.documentCode || '', title: h.title || '', product: h.product || '', company: h.company || '', revision: r.number || '', revisionDate: r.date || '', revisionStatus: r.status || '' };
}
