// B3 · Structured prompts for an external AI, and the importer for the answer. The prompt is
// text the user copies; the answer is text the user pastes back. Findings in the answer become
// open questions marked as AI-suggested and unverified.
import { CHAPTERS, chapterText } from './text.js';
import { FINDINGS_FORMAT } from '../kb/prompts.js';
import { newQuestion, renumber, openQuestions, chapterOfElement } from './questions.js';
import { labelOf } from './spec.js';

const identityOf = (doc) => `«${doc.header.title}» (${doc.header.documentCode || 'no code'}, rev. ${doc.revision.number}${doc.header.product ? `, ${doc.header.product}` : ''})`;

/** Fills a template with the chosen chapter(s), the open questions and the resource. */
export function renderPrompt(template, { derived, questions, chapter = 'stages', chapter2 = 'resources', resourceId = '', language = 'English' }) {
  const doc = derived.doc;
  const label = (id) => labelOf(derived.codes, derived.index, id);
  const chapterTitle = (id) => (CHAPTERS.find(([k]) => k === id) || [id, id])[1];
  const open = openQuestions(questions);
  const questionsText = open.length ? open.map((q) => `${q.number}. [${q.elementLabel || q.chapter}] ${q.text}${q.why ? ` — why: ${q.why}` : ''}`).join('\n') : '(none yet)';
  let resourceText = '';
  let usesText = '';
  if (resourceId) {
    const r = derived.index.get(resourceId);
    const row = derived.resources.rows.find((x) => x.resource.id === resourceId);
    resourceText = r ? `${label(resourceId)} [${r.category}]\n${(r.characteristics || []).map((c) => `  - ${c.name}: ${c.value} ${c.unit}`.trim()).join('\n')}${r.notes ? `\n  ${r.notes}` : ''}\nChannels needed at once: ${row ? row.maxChannels : '?'}` : '';
    const stepIds = new Set((row ? row.uses : []).map((u) => u.stepId));
    usesText = derived.steps.filter(({ step }) => stepIds.has(step.id)).map(({ step }) => {
      const crit = derived.criteria.filter((c) => c.stepId === step.id && c.resourceIds.includes(resourceId)).map((c) => `${c.quantity}: ${c.text}`).join('; ');
      const stim = derived.stimuli.filter((s) => s.stepId === step.id && s.resourceIds.includes(resourceId)).map((s) => s.parameters.map((p) => `${p.name} = ${p.text} ${p.unit}`).join(', ')).filter(Boolean).join('; ');
      return `  ${derived.codes.get(step.id)} ${step.description}${stim ? ` [${stim}]` : ''}${crit ? ` — expected ${crit}` : ''}`;
    }).join('\n');
  }
  const text = String(template.template)
    .replace(/\{\{identity\}\}/g, identityOf(doc))
    .replace(/\{\{chapterTitle\}\}/g, chapterTitle(chapter)).replace(/\{\{chapterTitle2\}\}/g, chapterTitle(chapter2))
    .replace(/\{\{chapter\}\}/g, chapterText(derived, chapter)).replace(/\{\{chapter2\}\}/g, chapterText(derived, chapter2))
    .replace(/\{\{questions\}\}/g, questionsText).replace(/\{\{resource\}\}/g, resourceText).replace(/\{\{uses\}\}/g, usesText || '(no step uses it)')
    .replace(/\{\{language\}\}/g, language).replace(/\{\{answerFormat\}\}/g, template.answerFormat === 'json' ? FINDINGS_FORMAT : '');
  return text;
}

/** Reads an answer back: a JSON list of findings (a fence around it is tolerated), or plain text as one note. */
export function importAnswer(answerText, { derived, questions, promptId }) {
  const raw = String(answerText || '').trim();
  const codeIndex = new Map([...derived.codes].map(([id, code]) => [code.toUpperCase(), id]));
  const stripped = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed = null;
  try { parsed = JSON.parse(stripped); } catch { const m = stripped.match(/\[[\s\S]*\]/); if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } } }
  const added = [];
  if (Array.isArray(parsed)) {
    for (const f of parsed) {
      if (!f || typeof f !== 'object') continue;
      const code = String(f.element || '').trim().toUpperCase();
      const elementId = code && code !== 'GENERAL' ? codeIndex.get(code) || '' : '';
      const text = String(f.question || f.finding || '').trim();
      if (!text) continue;
      const q = newQuestion({
        key: '', source: { kind: 'ai', ref: promptId, label: `AI-suggested (${promptId})` }, ai: true, verified: false,
        chapter: elementId ? chapterOfElement(elementId, derived) : 'general', elementId, elementLabel: elementId ? labelOf(derived.codes, derived.index, elementId) : (code && code !== 'GENERAL' ? `${code} (not found)` : 'the specification'),
        text, finding: String(f.finding || ''), why: String(f.why || ''), severity: f.confidence === 'high' ? 'warning' : 'info', blocks: [], confidence: String(f.confidence || ''),
        // A class instrument answer (P-INSTRUMENT) carries class and fit instead of a question.
        ...(f.class ? { text: `${f.class}: ${f.fits === false ? 'does not fit' : 'fits'} — ${f.why || ''}${f.decidingCriterion ? ` (deciding: ${f.decidingCriterion})` : ''}${f.costBand ? ` [${f.costBand}]` : ''}`, informational: true } : {}),
      });
      questions.push(q);
      added.push(q);
    }
  } else if (raw) {
    const q = newQuestion({ key: '', source: { kind: 'ai', ref: promptId, label: `AI answer (${promptId})` }, ai: true, verified: false, chapter: 'general', text: raw.length > 2000 ? raw.slice(0, 2000) + '…' : raw, why: 'Pasted from an external AI as plain text.', severity: 'info', informational: true });
    questions.push(q);
    added.push(q);
  }
  renumber(questions);
  return { added, parsedAsJson: Array.isArray(parsed) };
}
