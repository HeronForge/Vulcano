// What every page shares: the head, tabs, the «Details» switch, «more» folds, the empty state.
import { h, button, kpi } from '../dom.js';
import { labelOf } from '../../model/spec.js';

export function page(title, lead, ...actions) {
  return h('div', { class: 'head' }, h('div', h('h1', title), lead ? h('div', { class: 'lead' }, lead) : null), actions.filter(Boolean).length ? h('div', { class: 'page-actions' }, ...actions) : null);
}

export function tabs(ctx, section, items, fallback) {
  const active = ctx.ui.sub[section] || fallback || items[0][0];
  return { active, bar: h('div', { class: 'tabs' }, items.map(([k, l]) => h('a', { href: '#', class: k === active ? 'active' : '', onclick: (e) => { e.preventDefault(); ctx.go(section, k); } }, l))) };
}

export function detailsToggle(ctx, key, label = 'Details') {
  return h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!ctx.ui.details[key], onchange: (e) => ctx.update((st) => { st.ui.details[key] = e.target.checked; }) }), ' ', label);
}
export const showDetails = (ctx, key) => !!ctx.ui.details[key];
export const more = (label, ...children) => h('details', { class: 'more' }, h('summary', label), ...children);

export function needSpec(ctx) {
  if (ctx.session.job) return null;
  return h('div', { class: 'welcome' },
    h('h1', 'Open a specification'),
    h('p', { class: 'lead' }, 'Drop a DEDALO document (.html), its data export or an authoring file anywhere in this window. The project starts empty: the specification says what the bench needs, you pick from your database what realises it.'),
    h('div', { class: 'drop' }, 'Drop the specification here'),
    h('div', { class: 'page-actions', style: { marginTop: '12px' } }, button('Open a specification…', ctx.actions.openSpec, { class: 'primary' })),
    h('p', { class: 'muted', style: { marginTop: '16px' } }, 'A saved project is this same HTML file with the project inside: open it by double click. Your database — instruments, parts, rates, standard items — travels in the file too; edit it on the Database page and save. File ▸ Import a project reads a project exported as JSON from another copy.'),
  );
}

/** A figure with its label, for the recap blocks. */
export const figure = (value, label, opts = {}) => h('div', { class: `figure ${opts.class || ''}` }, h('b', value), h('span', label));

/** Maker and model together, wherever an instrument's name is shown — never one without the other's absence hiding it. */
export const makerModel = (row) => [row.maker, row.model].filter(Boolean).join(' ');

export const labeller = (ctx) => (id) => labelOf(ctx.session.derived.codes, ctx.session.derived.index, id);
export const kpis = (...items) => h('div', { class: 'kpis' }, items.map(([v, l]) => kpi(v, l)));
export const severityKind = (s) => ({ error: 'error', warning: 'warning', info: 'info' }[s] || '');
export const money = (n, cur = '') => (n == null || !Number.isFinite(n) ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n))}${cur ? ' ' + cur : ''}`);
/** A column header for a price column: the currency stated once, so the cells below need not repeat it. */
export const moneyHeader = (label, cur) => (cur ? `${label} (${cur})` : label);
export const qty = (n) => (n == null ? '' : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
