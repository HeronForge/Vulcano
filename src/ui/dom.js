// Small DOM helpers: an element builder, a table builder, badges. No framework — the whole
// interface re-renders the current section from the session on every change.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  } else children.unshift(attrs);
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const text = (s) => document.createTextNode(String(s ?? ''));
export const badge = (label, kind = '') => h('span', { class: `badge ${kind}` }, label);
export const dot = (kind) => h('span', { class: `dot ${kind}` });
export const muted = (s) => h('span', { class: 'muted' }, s);
export const button = (label, onClick, opts = {}) => h('button', { class: opts.class || '', title: opts.title, disabled: opts.disabled, onclick: onClick }, label);
export const notice = (kind, ...children) => h('div', { class: `notice ${kind}` }, ...children);

/**
 * A table: columns are [key | fn, label, opts] where opts.class marks numeric/code cells and a
 * function column renders the cell from the row. `rowAttrs(row)` decorates rows.
 */
export function table(columns, rows, { rowAttrs = () => ({}), empty = 'Nothing here.', wrap = true, id = '' } = {}) {
  const thead = h('thead', h('tr', columns.map((c) => h('th', { class: (c[2] || {}).class || '' }, c[1]))));
  const tbody = h('tbody');
  if (!rows.length) tbody.appendChild(h('tr', h('td', { colspan: columns.length, class: 'muted' }, empty)));
  for (const row of rows) {
    const tr = h('tr', rowAttrs(row) || {});
    for (const c of columns) {
      const v = typeof c[0] === 'function' ? c[0](row) : row[c[0]];
      tr.appendChild(h('td', { class: (c[2] || {}).class || '' }, v instanceof Node || Array.isArray(v) ? v : v == null ? '' : String(v)));
    }
    tbody.appendChild(tr);
  }
  const t = h('table', { id }, thead, tbody);
  return wrap ? h('div', { class: 'table-wrap' }, t) : t;
}

export const kpi = (value, label) => h('div', { class: 'kpi' }, h('b', String(value)), h('span', label));
export const card = (title, ...children) => h('div', { class: 'card' }, title ? h('h2', title) : null, ...children);
export const field = (label, control) => h('label', { class: 'field' }, h('span', label), control);

export function select(options, value, onChange, opts = {}) {
  const el = h('select', { class: opts.class || '', onchange: (e) => onChange(e.target.value) }, options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
  return el;
}
export function input(value, onChange, opts = {}) {
  return h('input', { type: opts.type || 'text', value: value ?? '', class: opts.class || '', placeholder: opts.placeholder, step: opts.step, min: opts.min, style: opts.style, onchange: (e) => onChange(opts.type === 'number' ? Number(e.target.value) : e.target.value) });
}
export function textarea(value, onChange, opts = {}) {
  return h('textarea', { class: opts.class || '', placeholder: opts.placeholder, rows: opts.rows, onchange: (e) => onChange(e.target.value) }, value ?? '');
}

export const fmt = (n, d = 3) => (n == null || !Number.isFinite(n) ? '—' : Number(n.toPrecision(d)).toString());
export const fmtFixed = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(d));
export const esc = (s) => String(s ?? '');

/** Reads a chosen file as text. */
export function pickFile(accept, onText, { multiple = false } = {}) {
  const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
  inp.addEventListener('change', async () => {
    for (const f of inp.files) {
      const t = await f.text();
      await onText(t, f.name);
    }
    inp.remove();
  });
  document.body.appendChild(inp);
  inp.click();
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * A dialog over the page, outside the app's root so a re-render does not close it. The caller
 * swaps `body` and `actions` as the conversation moves on; Escape and a click outside close it.
 */
export function modal({ title }) {
  const body = h('div', { class: 'modal-body' });
  const actions = h('div', { class: 'modal-actions' });
  const scrim = h('div', { class: 'modal-scrim' }, h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', title), body, actions));
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = () => { document.removeEventListener('keydown', onKey, true); scrim.remove(); };
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(scrim);
  return {
    close,
    show: (...nodes) => { clear(body); append(body, nodes); },
    act: (...nodes) => { clear(actions); append(actions, nodes); },
  };
}

/** Confirms a step in plain words; the browser dialog is enough for a one-file tool. */
export const confirmDialog = (message) => window.confirm(message);
export const promptDialog = (message, value = '') => window.prompt(message, value);
