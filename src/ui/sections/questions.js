// The open questions: what the rules and the notes propose on the left, the list the user
// keeps on the right. Nothing enters the list by itself.
import { h, badge, card, notice, button, select, pickFile, promptDialog } from '../dom.js';
import { page, needSpec, severityKind, more } from './common.js';
import { STATUS, SOURCE_KINDS, chapterLabel, groupByChapter, setStatus, newQuestion, renumber, rfiEnvelope, mergeRfi, fromFinding, fromNote } from '../../model/questions.js';
import { RULE_CATEGORIES } from '../../kb/rules.js';
import { severityLabel } from '../../model/rules.js';
import { downloadJson, downloadXlsx, fileName } from '../../io/exports.js';

export const questions = {
  id: 'questions', title: 'Questions',
  count: (ctx) => (ctx.session.job ? ctx.session.job.questions.filter((q) => q.status === 'open' || q.status === 'asked').length : ''),
  render(ctx) {
    const empty = needSpec(ctx);
    if (empty) return empty;
    const s = ctx.session;
    const job = s.job;
    const id = ctx.meta().identity;
    const taken = new Set(job.questions.map((q) => q.key));
    const proposed = s.findings.filter((f) => !taken.has(f.key));
    const notes = job.spec.notes.filter((n) => !taken.has(`note|${n.id}`) && (n.kind !== 'free' || /\?/.test(n.text || '')));
    const sev = ctx.ui.filters.propSeverity || 'all';
    const shown = proposed.filter((f) => sev === 'all' || (sev === 'errors' ? f.severity === 'error' : f.severity !== 'info'));
    const take = (f) => ctx.update(() => { fromFinding(job.questions, f); s.dirty = true; });
    const takeAll = (list) => ctx.update(() => { for (const f of list) fromFinding(job.questions, f); s.dirty = true; });
    const exportRfi = () => downloadJson(rfiEnvelope(job.questions, id, ctx.meta()), fileName(id, 'rfi', 'json'));
    const importRfi = () => pickFile('.json', (text) => { try { const r = mergeRfi(job.questions, JSON.parse(text)); s.dirty = true; ctx.notify('ok', `Answers merged: ${r.updated} updated, ${r.added} added.`); } catch (e) { ctx.notify('err', e.message); } ctx.update(); });
    const exportXlsx = () => downloadXlsx([{ name: 'Questions', columns: [['number', '#'], ['chapter', 'Chapter'], ['elementLabel', 'Element'], ['text', 'Question'], ['why', 'Why it matters'], ['status', 'Status'], ['answer', 'Answer']], rows: job.questions.map((q) => ({ number: q.number, chapter: chapterLabel(q.chapter), elementLabel: q.elementLabel, text: q.text, why: q.why, status: STATUS[q.status], answer: q.answer || q.waiverReason || '' })) }], fileName(id, 'questions', 'xlsx'));
    const addOwn = () => { const text = promptDialog('The question, as you would send it'); if (!text) return; ctx.update(() => { job.questions.push(newQuestion({ text, source: { kind: 'user', ref: '', label: 'written here' }, chapter: 'general', severity: 'info' })); renumber(job.questions); s.dirty = true; }); };
    const setQ = (q, status) => {
      if (status === 'answered') { const a = promptDialog('The answer received', q.answer || ''); if (a === null) return; ctx.update(() => { setStatus(q, 'answered', { answer: a }); s.dirty = true; }); }
      else if (status === 'waived') { const r = promptDialog('Why (kept with the question)', q.waiverReason || ''); if (r === null) return; ctx.update(() => { setStatus(q, 'waived', { reason: r }); s.dirty = true; }); }
      else ctx.update(() => { setStatus(q, status); s.dirty = true; });
    };
    const mine = job.questions.filter((q) => ctx.ui.filters.qAll || q.status === 'open' || q.status === 'asked');
    const groups = groupByChapter(mine);
    return h('div',
      page('Questions', 'What the rules and the specification’s own notes propose, and the list you keep and send. Take what matters; the rest stays here.',
        button('Add your own', addOwn), button('Print', () => window.print()), button('XLSX', exportXlsx), button('RFI file', exportRfi, { title: 'vulcano-rfi/1' }), button('Merge answers…', importRfi)),
      h('div', { class: 'print-only' }, h('div', { class: 'doc-title' }, `Open questions — ${id.documentCode} ${id.title}`), h('p', `Revision ${id.revision}`)),
      h('div', { class: 'grid2 side no-print' },
        h('div', { class: 'card' },
          h('h2', `Proposed (${proposed.length + notes.length})`),
          h('div', { class: 'row', style: { marginBottom: '8px' } }, select([['all', 'all'], ['warnings', 'errors and warnings'], ['errors', 'errors only']], sev, (v) => ctx.update((st) => { st.ui.filters.propSeverity = v; }), { class: 'inline' }), button(`Take all ${shown.length}`, () => takeAll(shown), { class: 'small', disabled: !shown.length })),
          h('ul', { class: 'list' }, shown.map((f) => h('li', h('div', { class: 'row' }, badge(severityLabel(f.severity), severityKind(f.severity)), h('span', { class: 'code' }, f.label), button('Take', () => take(f), { class: 'small' })), h('div', f.question || f.message), f.question ? h('div', { class: 'sub muted' }, f.message) : null)),
            notes.map((n) => h('li', h('div', { class: 'row' }, badge(n.kind === 'toCheck' ? 'to check' : n.kind === 'leftOut' ? 'left out' : n.kind, 'info'), h('span', { class: 'code' }, n.name || 'note'), button('Take', () => ctx.update(() => { fromNote(job.questions, n, s.derived); s.dirty = true; }), { class: 'small' })), h('div', n.text)))),
          !shown.length && !notes.length ? h('p', { class: 'muted' }, 'Nothing left to propose.') : null,
          more(`Rules that ran (${s.kb.rules.length})`, h('ul', s.kb.rules.map((r) => h('li', r.title, ' ', h('span', { class: 'muted' }, `${RULE_CATEGORIES[r.category]} · ${s.findings.filter((f) => f.ruleId === r.id).length} raised`)))))),
        h('div', { class: 'card' },
          h('h2', `My list (${job.questions.filter((q) => q.status === 'open' || q.status === 'asked').length} open)`),
          h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!ctx.ui.filters.qAll, onchange: (e) => ctx.update((st) => { st.ui.filters.qAll = e.target.checked; }) }), ' also answered and waived'),
          groups.length ? groups.map(([chapter, qs]) => h('div', h('h4', chapterLabel(chapter)), h('ol', { class: 'list' }, qs.map((q) => questionItem(ctx, q, setQ))))) : h('p', { class: 'muted' }, 'Empty. Take proposals on the left, or add your own.'))),
      h('div', { class: 'print-only' }, groupByChapter(job.questions.filter((q) => q.status === 'open' || q.status === 'asked')).map(([chapter, qs]) => h('div', h('h3', chapterLabel(chapter)), h('ol', qs.map((q) => h('li', `#${q.number} `, q.elementLabel ? `[${q.elementLabel}] ` : '', q.text, q.why ? h('div', { class: 'sub' }, q.why) : null)))))),
    );
  },
};

function questionItem(ctx, q, setQ) {
  const s = ctx.session;
  return h('li',
    h('div', { class: 'row' }, h('b', `#${q.number}`), badge(STATUS[q.status], q.status === 'open' ? severityKind(q.severity) : q.status), q.ai ? badge('AI', 'ai') : null, q.elementLabel ? h('span', { class: 'code' }, q.elementLabel) : null),
    h('div', { class: 'qtext' }, q.text),
    q.answer ? h('div', { class: 'sub' }, h('b', 'Answer: '), q.answer) : null,
    q.waiverReason ? h('div', { class: 'sub' }, h('b', 'Waived: '), q.waiverReason) : null,
    h('div', { class: 'row', style: { marginTop: '4px' } },
      q.status === 'open' ? button('Asked', () => setQ(q, 'asked'), { class: 'small' }) : null,
      q.status !== 'answered' ? button('Answered…', () => setQ(q, 'answered'), { class: 'small' }) : null,
      q.status === 'open' || q.status === 'asked' ? button('Waive…', () => setQ(q, 'waived'), { class: 'small' }) : button('Reopen', () => setQ(q, 'open'), { class: 'small' }),
      more('more', h('div', { class: 'row' }, h('span', { class: 'muted' }, `${SOURCE_KINDS[q.source.kind] || q.source.kind}${q.source.label ? `: ${q.source.label}` : ''}${q.why ? ` — ${q.why}` : ''}`), button('Edit…', () => { const t = promptDialog('Edit the wording', q.text); if (t) ctx.update(() => { q.text = t; q.editedText = true; s.dirty = true; }); }, { class: 'small' }), button('Price impact…', () => { const t = promptDialog('What it does to the price', q.priceImpact || ''); if (t !== null) ctx.update(() => { q.priceImpact = t; s.dirty = true; }); }, { class: 'small' }), button('Remove from the list', () => ctx.update(() => { s.job.questions.splice(s.job.questions.indexOf(q), 1); s.dirty = true; }), { class: 'small' }))),
    ),
  );
}
