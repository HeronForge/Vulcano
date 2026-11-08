// Advanced: what stays in the background — the checklists as a tree, the accuracy check, the
// specification's tables, the exports for software and harness, the prompts for an external
// AI, and the About page.
import { h, table, badge, card, notice, button, select, textarea, copyText, fmt } from '../dom.js';
import { page, tabs, needSpec, kpis, labeller, detailsToggle, showDetails, more, money } from './common.js';
import { checklistTree, setItem, itemToQuestion } from '../../model/checklists.js';
import { VERDICTS } from '../../model/accuracy.js';
import { formatSeconds } from '../../model/derived.js';
import { sequenceSkeleton, limitsTable } from '../../model/software.js';
import { signalList } from '../../model/signals.js';
import { renderPrompt, importAnswer } from '../../model/prompts.js';
import { CHAPTERS as TEXT_CHAPTERS, chapterText } from '../../model/text.js';
import { assignment, switchingOf } from '../../model/project.js';
import { downloadJson, downloadCsv, downloadXlsx, fileName } from '../../io/exports.js';
import { newQuestion, renumber } from '../../model/questions.js';
import { APP_NAME, APP_TAGLINE, APP_VERSION, AUTHOR, LICENSE, FORMATS, CHANGELOG, DEDALO_SCHEMA_MAX } from '../../version.js';

const TABS = [['checklists', 'Checklists'], ['accuracy', 'Accuracy'], ['spec', 'The specification'], ['exports', 'Exports'], ['ai', 'Ask an AI'], ['about', 'About']];

export const advanced = {
  id: 'advanced', title: 'Advanced', tabs: TABS,
  render(ctx) {
    const { active, bar } = tabs(ctx, 'advanced', TABS);
    if (active === 'about') return h('div', bar, about());
    const empty = needSpec(ctx);
    if (empty) return h('div', bar, empty);
    return h('div', bar, active === 'checklists' ? checklists(ctx) : active === 'accuracy' ? accuracy(ctx) : active === 'spec' ? specification(ctx) : active === 'exports' ? exportsView(ctx) : prompts(ctx));
  },
};

function checklists(ctx) {
  const s = ctx.session;
  const t = checklistTree({ records: s.records, kb: s.kb, db: s.db, job: s.job });
  const onlyOpen = ctx.ui.filters.clOpen !== false;
  const tick = (item, done) => ctx.update(() => { setItem(s.job, item.key, { done }); s.dirty = true; });
  return h('div',
    page('Checklists', `${t.done} of ${t.total} items ticked. Discipline › situation › item: what an experienced builder asks before quoting; tick it, note it, or make it a question.`, h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: onlyOpen, onchange: (e) => ctx.update((st) => { st.ui.filters.clOpen = e.target.checked; }) }), ' hide ticked items')),
    t.tree.map((d) => h('details', { class: 'more tree', open: true }, h('summary', h('b', d.label), h('span', { class: 'muted' }, ` ${d.done}/${d.total}`)),
      d.situations.map((sit) => { const items = sit.items.filter((i) => !onlyOpen || !i.state.done); return items.length ? h('div', { class: 'situation' }, h('h4', sit.situation), h('ul', { class: 'list' }, items.map((i) => h('li', { class: i.state.done ? 'done' : '' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!i.state.done, onchange: (e) => tick(i, e.target.checked) }), ' ', h('b', i.title), i.subject ? h('span', { class: 'code' }, ` ${i.subject}`) : null, i.matches > 1 ? h('span', { class: 'muted' }, ` (${i.matches} elements)`) : null),
        h('div', { class: 'sub muted' }, i.why),
        h('div', { class: 'row' }, h('input', { type: 'text', class: 'inline', placeholder: 'note', value: i.state.note || '', style: { width: '320px' }, onchange: (e) => ctx.update(() => { setItem(s.job, i.key, { note: e.target.value }); s.dirty = true; }) }), i.state.questionId ? badge('question taken', 'ok') : button('Make a question', () => ctx.update(() => { itemToQuestion(s.job, i); s.dirty = true; }), { class: 'small' })),
      )))) : null; }))),
  );
}

function accuracy(ctx) {
  const s = ctx.session;
  const a = s.accuracy;
  const label = labeller(ctx);
  const det = showDetails(ctx, 'accuracy');
  const filter = ctx.ui.filters.accuracyVerdict || '';
  const rows = a.rows.filter((r) => r.verdict !== 'notJudged' && (!filter || r.verdict === filter));
  const verdicts = ['adequate', 'marginal', 'inadequate', 'oneSided', 'noInstrument', 'dutReported', 'computed'].filter((v) => a.summary[v]);
  const ask = (r) => ctx.update(() => { const key = `accuracy|${r.criterion.id}`; if (s.job.questions.some((q) => q.key === key)) return; s.job.questions.push(newQuestion({ key, source: { kind: 'tool', ref: 'accuracy', label: 'Accuracy check' }, chapter: 'stages', elementId: r.stepId, elementLabel: label(r.stepId), text: `«${r.quantity}» (${r.code}) is judged ${r.text}: is that tolerance meant? With ${r.instrument ? r.instrument.from : 'the assigned instrument'} the test uncertainty ratio is ${fmt(r.tur, 2)}:1 against a target of ${a.target}:1.`, why: 'A tolerance tighter than the instrument can resolve forces a better instrument or a wider tolerance.', severity: 'warning' })); renumber(s.job.questions); s.dirty = true; });
  return h('div',
    page('Accuracy', `Target TUR ${a.target}:1. Per resource: the accuracy its criteria demand, known before any instrument is chosen. Per criterion: what the assigned instrument and contacts resolve, and a verdict.`, detailsToggle(ctx, 'accuracy')),
    kpis(...['adequate', 'marginal', 'inadequate', 'noInstrument'].filter((v) => a.summary[v]).map((v) => [a.summary[v], VERDICTS[v]])),
    table([
      [(g) => label(g.resourceId), 'Resource'],
      [(g) => g.tightest ? h('span', `${g.tightest.code} ${g.tightest.text}`, h('span', { class: 'sub' }, `«${g.tightest.quantity}» — ±${(g.tightestRelative * 100).toFixed(3)} % of the nominal`)) : h('span', { class: 'muted' }, 'no two-sided criterion'), 'Tightest criterion'],
      [(g) => g.requiredPercent != null ? `≤ ${fmt(g.requiredPercent, 3)} %` : '—', 'Accuracy needed', { class: 'num' }],
      [(g) => g.classNeeded ? badge(g.classNeeded.label, 'fits') : g.noneFits ? h('span', badge('none of its usual classes', 'short'), g.alternatives.length ? h('span', { class: 'sub' }, `would fit: ${g.alternatives.map((c) => c.label).join(', ')}`) : null) : h('span', { class: 'muted' }, '—'), 'Class needed'],
      [(g) => Object.entries(g.counts).map(([k, n]) => h('span', badge(`${n} ${VERDICTS[k]}`, k), ' ')), 'With what is assigned'],
    ], [...a.byResource.values()]),
    h('div', { class: 'filters' }, h('span', { class: `badge pill ${filter === '' ? 'active' : ''}`, onclick: () => ctx.update((st) => { st.ui.filters.accuracyVerdict = ''; }) }, 'all'), verdicts.map((v) => h('span', { class: `badge pill ${v} ${filter === v ? 'active' : ''}`, onclick: () => ctx.update((st) => { st.ui.filters.accuracyVerdict = v; }) }, `${VERDICTS[v]} (${a.summary[v]})`))),
    table([
      [(r) => r.code, '', { class: 'code' }], [(r) => h('span', r.quantity, h('span', { class: 'sub' }, r.text)), 'Criterion'],
      [(r) => r.combined ? `${fmt(r.combined.U)} ${r.unit}` : '—', 'Uncertainty', { class: 'num' }],
      [(r) => r.tur != null ? `${fmt(r.tur, 3)}:1` : r.atLimit && r.atLimit.relative != null ? h('span', { class: 'muted' }, `${(r.atLimit.relative * 100).toFixed(2)} % of the limit`) : '—', 'TUR', { class: 'num' }],
      [(r) => h('span', badge(VERDICTS[r.verdict], r.verdict), (r.verdict === 'inadequate' || r.verdict === 'marginal') && !s.job.questions.some((q) => q.key === `accuracy|${r.criterion.id}`) ? [' ', button('Ask', () => ask(r), { class: 'small' })] : null), 'Verdict'],
      ...(det ? [[(r) => r.required ? `${fmt(r.required.U)} ${r.unit}` : '—', 'Required U', { class: 'num' }], [(r) => r.instrument ? h('span', `${fmt(r.instrument.U)} ${r.unit}`, h('span', { class: 'sub' }, `${r.instrument.percent} % · ${r.instrument.from}`)) : '—', 'Instrument'], [(r) => r.path ? (r.path.contributions.length ? r.path.contributions.map((c) => `${c.label}: ${fmt(c.value)}`).join('; ') : `no effect (${r.path.sensed ? 'four-wire' : r.path.switching})`) : '—', 'Contacts'], [(r) => r.guard ? `${fmt(r.guard.min, 5)} … ${fmt(r.guard.max, 5)}${r.guard.collapsed ? ' (collapsed)' : ''}` : '—', 'Guarded limits', { class: 'num' }], [(r) => h('span', r.notes.join(' '), r.calcs.length ? more('calc', r.calcs.map((c) => h('div', { class: 'calc' }, `${c.calculation.name}: ${c.calculation.formula}`, c.steps.map((st) => h('div', `${st.label}: ${st.expression} = ${fmt(typeof st.value === 'object' ? NaN : st.value, 4)}`))))) : null), 'Notes']] : []),
    ], rows),
  );
}

function specification(ctx) {
  const s = ctx.session;
  const d = s.derived;
  const label = labeller(ctx);
  const sub = ctx.ui.filters.specTable || 'resources';
  const det = showDetails(ctx, 'spec');
  const pick = (k) => ctx.update((st) => { st.ui.filters.specTable = k; });
  let body;
  if (sub === 'resources') body = table([[(r) => d.codes.get(r.resource.id), '', { class: 'code' }], [(r) => r.resource.name, 'Resource'], [(r) => r.resource.category, 'Category'], [(r) => String(r.maxChannels), 'Channels (DEDALO)', { class: 'num' }], [(r) => String(r.refinedChannels), 'Wired', { class: 'num' }], [(r) => r.stageIds.map((id) => d.codes.get(id)).join(', '), 'Stages'], ...(det ? [[(r) => r.criticalGroup ? r.criticalGroup.map((id) => d.codes.get(id)).join(' + ') : '', 'Busiest group'], [(r) => r.interfaceIds.map(label).join(', '), 'Interfaces'], [(r) => (r.resource.characteristics || []).map((c) => `${c.name} ${c.value} ${c.unit}`.trim()).join('; '), 'Characteristics']] : [])], d.resources.rows);
  else if (sub === 'points') body = table([[(p) => d.codes.get(p.point.id), '', { class: 'code' }], [(p) => p.point.name, 'Point'], [(p) => `${p.point.connector || ''}${p.point.pin ? ' · ' + p.point.pin : ''}`, 'Connector · pin'], [(p) => p.point.contactType, 'Contact'], [(p) => p.resourceIds.map((id) => d.codes.get(id)).join(', '), 'Resources'], ...(det ? [[(p) => p.point.signal, 'Signal'], [(p) => p.characteristics.map((c) => `${c.name} ${c.value} ${c.unit}`.trim()).join('; '), 'Characteristics'], [(p) => p.interfaceIds.map((id) => d.codes.get(id)).join(', '), 'Interfaces'], [(p) => p.stageIds.map((id) => d.codes.get(id)).join(', '), 'Stages']] : [])], d.points);
  else if (sub === 'criteria') body = table([[(c) => d.codes.get(c.stepId) + (c.rowLabel ? ` [${c.rowLabel}]` : ''), '', { class: 'code' }], [(c) => c.quantity, 'Quantity'], [(c) => c.text, 'Criterion'], [(c) => c.resourceIds.map((id) => d.codes.get(id)).join(', '), 'Resource'], [(c) => c.kpi ? badge('KPI', 'kind') : '', ''], ...(det ? [[(c) => c.limits.code, 'Cmp', { class: 'code' }], [(c) => fmt(c.limits.min, 5), 'Low', { class: 'num' }], [(c) => fmt(c.limits.max, 5), 'High', { class: 'num' }], [(c) => c.limits.variables.map((v) => '$' + v.name).join(', '), 'Variable']] : [])], d.criteria);
  else if (sub === 'cycle') body = h('div', kpis([formatSeconds(d.cycle.serial), 'serial'], [formatSeconds(d.cycle.parallel), 'with parallel stages']), table([[(x) => x.ids.map((id) => label(id)).join(' + '), 'Stages that run together'], [(x) => formatSeconds(x.seconds), 'Duration', { class: 'num' }]], d.cycle.schedule));
  else { const chapter = ctx.ui.filters.textChapter || 'stages'; body = h('div', h('div', { class: 'filters' }, select(TEXT_CHAPTERS, chapter, (v) => ctx.update((st) => { st.ui.filters.textChapter = v; }))), h('pre', chapterText(d, chapter))); }
  return h('div', page('The specification', 'What it provides, as VULCANO reads it: resources and channels as DEDALO counts them, points, criteria, cycle time, and the text chapter by chapter.', detailsToggle(ctx, 'spec')),
    h('div', { class: 'filters' }, [['resources', 'Resources'], ['points', 'Points'], ['criteria', 'Criteria'], ['cycle', 'Cycle time'], ['text', 'As text']].map(([k, l]) => h('span', { class: `badge pill ${k === sub ? 'active' : ''}`, onclick: () => pick(k) }, l))), body);
}

function exportsView(ctx) {
  const s = ctx.session;
  const id = ctx.meta().identity;
  const switchingFor = (rid) => { const req = s.reqs.find((r) => r.kind === 'instrument' && r.subjectId === rid); return switchingOf(req ? assignment(s.job, req.id) : null); };
  const seq = () => sequenceSkeleton({ derived: s.derivedBase, switchingFor, accuracy: s.accuracy, meta: ctx.meta() });
  const lim = () => limitsTable({ derived: s.derivedBase, baseDoc: s.job.spec.doc, accuracy: s.accuracy });
  const sl = () => signalList(s.derivedBase);
  return h('div',
    page('Exports', 'What the software and the harness people need, produced from the specification and the assignments.'),
    h('div', { class: 'cards' },
      card('Sequence skeleton', h('p', { class: 'muted' }, 'Stages as sequences, setup stages as subsequences, the switching steps where an instrument is multiplexed, a TestStand step type per step. vulcano-sequence/1.'), button('Download', () => downloadJson(seq(), fileName(id, 'sequence', 'json')))),
      card('Limits table', h('p', { class: 'muted' }, 'Every criterion with its limits, the guard-banded ones from the accuracy check, one column set per variant.'), h('div', { class: 'row' }, button('CSV', () => { const t = lim(); downloadCsv(t.columns, t.flat, fileName(id, 'limits', 'csv')); }), button('XLSX', () => { const t = lim(); downloadXlsx([{ name: 'Limits', columns: t.columns, rows: t.flat }], fileName(id, 'limits', 'xlsx')); }))),
      card('Signal list and pin map', h('p', { class: 'muted' }, 'Every point with its contact and every instrument channel and interface that reaches it.'), h('div', { class: 'row' }, button('CSV', () => { const t = sl(); downloadCsv(t.columns, t.rows, fileName(id, 'signals', 'csv')); }), button('XLSX', () => { const t = sl(); downloadXlsx([{ name: 'Signals', columns: t.columns, rows: t.rows }], fileName(id, 'signals', 'xlsx')); }))),
    ),
  );
}

function prompts(ctx) {
  const s = ctx.session;
  const f = ctx.ui.filters;
  const template = s.kb.prompts.find((p) => p.id === f.promptId) || s.kb.prompts[0];
  const chapter = f.promptChapter || 'stages'; const chapter2 = f.promptChapter2 || 'resources';
  const resourceId = f.promptResource || (s.derived.doc.resources[0] || {}).id || '';
  const text = renderPrompt(template, { derived: s.derived, questions: s.job.questions, chapter, chapter2, resourceId, language: s.job.settings.language || 'English' });
  let answer = f.promptAnswer || '';
  return h('div',
    page('Ask an AI', 'Copy the prompt into the AI you use and paste the answer back: findings become questions marked AI-suggested until you verify them. Nothing leaves this machine by itself.'),
    h('div', { class: 'row', style: { marginBottom: '8px' } },
      select(s.kb.prompts.map((p) => [p.id, p.title]), template.id, (v) => ctx.update((st) => { st.ui.filters.promptId = v; })),
      template.scope === 'chapter' || template.scope === 'twoChapters' ? select(TEXT_CHAPTERS, chapter, (v) => ctx.update((st) => { st.ui.filters.promptChapter = v; })) : null,
      template.scope === 'twoChapters' ? select(TEXT_CHAPTERS, chapter2, (v) => ctx.update((st) => { st.ui.filters.promptChapter2 = v; })) : null,
      template.scope === 'resource' ? select(s.derived.doc.resources.map((r) => [r.id, `${s.derived.codes.get(r.id)} ${r.name}`]), resourceId, (v) => ctx.update((st) => { st.ui.filters.promptResource = v; })) : null,
      button('Copy the prompt', async () => { const ok = await copyText(text); ctx.notify(ok ? 'ok' : 'warn', ok ? 'Copied.' : 'Clipboard unavailable: select the text and copy it.'); }, { class: 'primary' })),
    h('div', { class: 'grid2' }, h('textarea', { class: 'mono', rows: 16, readonly: true }, text), h('div', textarea(answer, (v) => { answer = v; ctx.ui.filters.promptAnswer = v; }, { class: 'mono', rows: 14, placeholder: 'Paste the answer here' }), h('div', { class: 'page-actions' }, button('Import the answer as questions', () => ctx.update(() => { const r = importAnswer(answer, { derived: s.derived, questions: s.job.questions, promptId: template.id }); s.dirty = true; ctx.ui.filters.promptAnswer = ''; ctx.notify(r.added.length ? 'ok' : 'warn', r.added.length ? `${r.added.length} findings imported.` : 'Nothing to import.'); }), { class: 'primary' })))),
  );
}

function about() {
  return h('div',
    page(`${APP_NAME} ${APP_VERSION}`, `${APP_TAGLINE}. Written by ${AUTHOR.name} with the assistance of ${AUTHOR.assistedBy}. ${LICENSE.name}, ${LICENSE.copyright}.`),
    h('p', { class: 'muted' }, 'Reads DEDALO’s interchange, never its source. The knowledge base ships as data and is shown whenever it is used; the database is yours and travels in this file. No AI dependency: everything decided, checked or computed works offline. Nothing is chosen for you: the specification says what is needed, you say what realises it.'),
    more('Formats', h('p', { class: 'muted' }, `Reads DEDALO documents up to data schema ${DEDALO_SCHEMA_MAX}.`), table([[(f) => f.id, '', { class: 'code' }], [(f) => f.label, 'What'], [(f) => f.owner || 'VULCANO', 'Owner'], [(f) => (f.writes ? String(f.writes) : '—'), 'Writes'], [(f) => f.reads.join(', '), 'Reads']], Object.values(FORMATS), { wrap: false })),
    more('Changelog', CHANGELOG.map((v) => h('div', h('h3', `${v.version} — ${v.date}`), h('ul', v.changes.map((c) => h('li', c)))))),
  );
}
