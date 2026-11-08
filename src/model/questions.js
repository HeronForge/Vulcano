// B1 · Open questions: one numbered, living list. Each question knows where it comes from (a
// rule and the element it pointed at, a note that travelled with the specification, an AI
// suggestion, a checklist item, the user), why it matters, what it blocks, its status and its
// answer. Rules re-run after a change land on the same question through its key, so a status
// survives; findings that disappear close their question as «resolved» rather than deleting it.
import { newId, now } from './ids.js';

export const STATUS = { open: 'Open', asked: 'Asked', answered: 'Answered', waived: 'Waived', resolved: 'Resolved' };
export const SOURCE_KINDS = { rule: 'Rule', note: 'Specification note', ai: 'AI-suggested', checklist: 'Checklist', user: 'Written here', tool: 'Tool' };

export const CHAPTERS = [
  ['general', 'General'], ['testing', 'Description and testing'], ['references', 'References'], ['variables', 'Variables'], ['variants', 'Variants'],
  ['resources', 'Resources'], ['interfaces', 'Interfaces'], ['commands', 'Commands and protocols'], ['points', 'Application points'], ['images', 'Images'], ['stages', 'Stages, tests and steps'],
];
export const chapterLabel = (id) => (CHAPTERS.find(([k]) => k === id) || [id, id])[1];

export function newQuestion(fields) {
  const at = now();
  return {
    id: newId('q'), number: 0, key: '', source: { kind: 'user', ref: '', label: '' }, chapter: 'general', elementId: '', elementLabel: '',
    text: '', why: '', blocks: [], status: 'open', answer: '', waiverReason: '', ai: false, verified: false, severity: 'info', priceImpact: '',
    created: at, modified: at, history: [], ...fields,
  };
}

/** Renumbers by chapter order then creation, keeping numbers stable for questions already numbered. */
export function renumber(questions) {
  let next = questions.reduce((n, q) => Math.max(n, q.number || 0), 0);
  for (const q of questions) if (!q.number) q.number = ++next;
  return questions;
}

/** One finding of the rules taken into the list, by the user's choice. */
export function fromFinding(questions, f) {
  const existing = questions.find((q) => q.key === f.key);
  if (existing) return existing;
  const q = newQuestion({ key: f.key, source: { kind: 'rule', ref: f.ruleId, label: f.title }, chapter: f.chapter, elementId: f.elementId, elementLabel: f.label, text: f.question || f.message, why: f.why, blocks: f.blocks, severity: f.severity, finding: f.message, informational: !f.question });
  questions.push(q);
  renumber(questions);
  return q;
}

/** One note that travelled with the specification, taken into the list. */
export function fromNote(questions, n, derived) {
  const key = `note|${n.id}`;
  const existing = questions.find((q) => q.key === key);
  if (existing) return existing;
  const kind = n.kind || 'free';
  const anchorId = String((n.anchor || {}).id || '').replace(/^ref-/, '');
  const element = derived.index.get(anchorId);
  const q = newQuestion({
    key, source: { kind: 'note', ref: n.id, label: `${{ toCheck: 'To check', condition: 'Condition', leftOut: 'Left out', free: 'Note' }[kind] || 'Note'} by ${n.name || 'the specification'}` },
    chapter: element ? chapterOfElement(anchorId, derived) : 'testing', elementId: element ? anchorId : '', elementLabel: element ? `${derived.codes.get(anchorId) || ''} ${element.name || element.description || ''}`.trim() : '',
    text: kind === 'leftOut' ? `Left out of the specification (${n.name}): ${n.text}. Is it needed for the bench?` : kind === 'condition' ? `Condition: ${n.text}. How does the bench know when it applies?` : n.text,
    why: kind === 'toCheck' ? 'The author of the specification marked it as unverified.' : kind === 'leftOut' ? 'Something the source had and the specification has not.' : 'A condition on when a line applies.', severity: kind === 'toCheck' ? 'warning' : 'info',
  });
  questions.push(q);
  renumber(questions);
  return q;
}

/** Merges the findings of a rule run into the list: new keys become questions, gone keys resolve. */
export function syncFindings(questions, findings) {
  const byKey = new Map(questions.filter((q) => q.key).map((q) => [q.key, q]));
  const report = { added: 0, kept: 0, resolved: 0, reopened: 0 };
  const seen = new Set();
  for (const f of findings) {
    seen.add(f.key);
    const existing = byKey.get(f.key);
    const text = f.question || f.message;
    if (existing) {
      // The wording follows the specification; the status is the user's.
      existing.text = existing.editedText ? existing.text : text;
      existing.why = f.why;
      existing.blocks = f.blocks;
      existing.elementLabel = f.label;
      existing.severity = f.severity;
      existing.finding = f.message;
      if (existing.status === 'resolved') { existing.status = 'open'; existing.modified = now(); report.reopened++; }
      report.kept++;
      continue;
    }
    questions.push(newQuestion({
      key: f.key, source: { kind: 'rule', ref: f.ruleId, label: f.title }, chapter: f.chapter, elementId: f.elementId, elementLabel: f.label,
      text, why: f.why, blocks: f.blocks, severity: f.severity, finding: f.message, status: 'open', informational: !f.question,
    }));
    report.added++;
  }
  for (const q of questions) {
    if (q.source.kind === 'rule' && q.key && !seen.has(q.key) && q.status !== 'resolved' && q.status !== 'answered' && q.status !== 'waived') {
      q.status = 'resolved';
      q.history.push({ at: now(), status: 'resolved', note: 'The rule no longer raises it.' });
      q.modified = now();
      report.resolved++;
    }
  }
  renumber(questions);
  return report;
}

/** The notes that travel beside a DEDALO specification — TO CHECK, CONDITION, left out — become questions once each. */
export function questionsFromNotes(questions, notes, derived) {
  let added = 0;
  const keys = new Set(questions.map((q) => q.key));
  for (const n of notes || []) {
    const key = `note|${n.id}`;
    if (keys.has(key)) continue;
    const kind = n.kind || 'free';
    if (kind === 'free' && !/\?/.test(n.text || '')) continue;
    const anchorId = String((n.anchor || {}).id || '').replace(/^ref-/, '');
    const element = derived.index.get(anchorId);
    const chapter = element ? chapterOfElement(anchorId, derived) : 'testing';
    questions.push(newQuestion({
      key, source: { kind: 'note', ref: n.id, label: `${{ toCheck: 'To check', condition: 'Condition', leftOut: 'Left out', free: 'Note' }[kind] || 'Note'} by ${n.name || 'the specification'}` },
      chapter, elementId: element ? anchorId : '', elementLabel: element ? `${derived.codes.get(anchorId) || ''} ${element.name || element.description || ''}`.trim() : '',
      text: kind === 'leftOut' ? `Left out of the specification (${n.name}): ${n.text}. Is it needed for the bench?` : kind === 'condition' ? `Condition: ${n.text}. How does the bench know when it applies?` : n.text,
      why: kind === 'toCheck' ? 'The author of the specification marked it as unverified.' : kind === 'leftOut' ? 'Something the source had and the specification has not; the bench may need it.' : 'A condition on when a line applies.',
      severity: kind === 'toCheck' ? 'warning' : 'info',
    }));
    added++;
  }
  renumber(questions);
  return added;
}

export function chapterOfElement(id, derived) {
  const prefix = String(id).split('_')[0];
  return { res: 'resources', pt: 'points', itf: 'interfaces', cmd: 'commands', prt: 'commands', var: 'variables', vnt: 'variants', stg: 'stages', tc: 'stages', stp: 'stages', img: 'images', ref: 'references' }[prefix] || 'general';
}

export function setStatus(q, status, { answer = null, reason = null } = {}) {
  q.status = status;
  if (answer != null) q.answer = answer;
  if (reason != null) q.waiverReason = reason;
  q.modified = now();
  q.history.push({ at: q.modified, status, note: answer || reason || '' });
  return q;
}

export const openQuestions = (questions) => questions.filter((q) => q.status === 'open' || q.status === 'asked');
export const groupByChapter = (questions) => {
  const groups = new Map(CHAPTERS.map(([k]) => [k, []]));
  for (const q of questions) { if (!groups.has(q.chapter)) groups.set(q.chapter, []); groups.get(q.chapter).push(q); }
  return [...groups].filter(([, list]) => list.length);
};

/** The `vulcano-rfi/1` envelope: the list as it stands, reloadable so answers travel with the job. */
export function rfiEnvelope(questions, identity, meta) {
  return { format: 'vulcano-rfi/1', application: meta.application, applicationVersion: meta.applicationVersion, exported: now().slice(0, 10), spec: identity, questions: questions.map((q) => ({ ...q })) };
}

/** Reads an RFI file back: answers and statuses merge onto the same keys or ids; new questions are added. */
export function mergeRfi(questions, envelope) {
  if (!envelope || !Array.isArray(envelope.questions)) throw new Error('This file holds no «questions» list.');
  const byKey = new Map(questions.map((q) => [q.key || q.id, q]));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const report = { updated: 0, added: 0, same: 0 };
  for (const t of envelope.questions) {
    const mine = byId.get(t.id) || (t.key && byKey.get(t.key));
    if (!mine) { questions.push({ ...newQuestion({}), ...t, id: t.id || newId('q') }); report.added++; continue; }
    // A status the file has and this list has not (an answer that came back) wins; otherwise the later edit does.
    const settled = (q) => q.status && q.status !== 'open';
    if ((settled(t) && !settled(mine)) || String(t.modified || '') > String(mine.modified || '')) {
      Object.assign(mine, { status: t.status, answer: t.answer, waiverReason: t.waiverReason, text: t.text, editedText: t.editedText, modified: t.modified, history: [...(mine.history || []), ...(t.history || []).filter((h) => !(mine.history || []).some((m) => m.at === h.at))] });
      report.updated++;
    } else report.same++;
  }
  renumber(questions);
  return report;
}
