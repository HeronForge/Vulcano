// The checklists of a job as a tree: discipline › situation › items. Built-in items apply
// when their trigger matches the specification; the user's own items (rows of the database)
// apply when the specification mentions one of their words, or always. Each item is ticked,
// annotated or turned into an open question; the state lives in the job.
import { select, fill } from './conditions.js';
import { newQuestion, renumber } from './questions.js';

export const DISCIPLINE_LABELS = { bench: 'Bench', hardware: 'Hardware', software: 'Software', fixture: 'Fixture', services: 'Services' };

/** The tree of the items that apply to this job. */
export function checklistTree({ records, kb, db, job }) {
  const items = [];
  for (const item of kb.checklists) {
    const matched = select(item.trigger, records);
    if (!matched.length) continue;
    const subjects = item.once || (item.trigger && item.trigger.entity === 'spec') ? [matched[0]] : matched;
    for (const record of subjects) {
      const key = subjects.length === 1 && (item.once || record.type === 'spec') ? item.id : `${item.id}:${record.id}`;
      items.push({ key, discipline: item.discipline, situation: item.situation, title: fill(item.title, record), why: fill(item.why, record), subject: record.type === 'spec' ? '' : record.label, matches: item.once ? matched.length : 1, source: item.source, question: (item.produces || []).find((p) => p.kind === 'question'), state: (job.checklist || {})[key] || {} });
    }
  }
  const spec = records.find((r) => r.type === 'spec');
  const text = spec ? String(spec.fields.text || '').toLowerCase() : '';
  for (const row of db.checklists || []) {
    const words = String(row.when || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (words.length && !words.some((w) => text.includes(w))) continue;
    items.push({ key: row.id, discipline: row.discipline || 'bench', situation: row.situation || 'Always', title: row.title, why: row.why, subject: '', matches: 1, source: { kind: 'database', ref: 'your checklist items' }, question: null, state: (job.checklist || {})[row.id] || {}, own: true });
  }
  const tree = [];
  for (const d of Object.keys(DISCIPLINE_LABELS)) {
    const own = items.filter((i) => i.discipline === d);
    if (!own.length) continue;
    const situations = [];
    for (const i of own) {
      let s = situations.find((x) => x.situation === i.situation);
      if (!s) { s = { situation: i.situation, items: [] }; situations.push(s); }
      s.items.push(i);
    }
    tree.push({ discipline: d, label: DISCIPLINE_LABELS[d], situations, total: own.length, done: own.filter((i) => i.state.done).length });
  }
  return { tree, total: items.length, done: items.filter((i) => i.state.done).length };
}

export function setItem(job, key, changes) {
  job.checklist[key] = { ...(job.checklist[key] || {}), ...changes, at: new Date().toISOString() };
}

/** Turns an item into an open question of the job. */
export function itemToQuestion(job, item) {
  const q = newQuestion({ key: `checklist|${item.key}`, source: { kind: 'checklist', ref: item.key, label: item.title }, chapter: 'general', elementLabel: item.subject, text: item.question ? item.question.text : `${item.title}: ${item.why}`, why: item.why, severity: 'info' });
  job.questions.push(q);
  renumber(job.questions);
  setItem(job, item.key, { questionId: q.id });
  return q;
}
