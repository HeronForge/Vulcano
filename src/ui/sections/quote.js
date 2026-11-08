// The quote: the sum of the assignments, the lines the user adds, and the suggestions the
// user accepts — with the few calculations a quote needs, and nothing added by itself. The
// registry data at the top (who issues it, who receives it, its own number and terms) is what
// the exports — print/PDF, Word, the JSON envelope — carry as the offer's references.
import { h, table, badge, card, notice, button, input, textarea, field, select, promptDialog } from '../dom.js';
import { page, needSpec, kpis, more, money, moneyHeader, makerModel, qty as fq } from './common.js';
import { buildQuote, suggestedLines, addLine, removeLine } from '../../model/project.js';
import { touch } from '../../model/session.js';
import { downloadJson, downloadXlsx, fileName } from '../../io/exports.js';
import { downloadQuoteDocx } from '../../io/docx.js';
import { priceOf } from '../../model/db.js';
import { thumb } from '../images.js';

export const quote = {
  id: 'quote', title: 'Quote',
  render(ctx) {
    const empty = needSpec(ctx);
    if (empty) return empty;
    const s = ctx.session;
    const q = buildQuote({ db: s.db, job: s.job, reqs: s.reqs, meta: ctx.meta() });
    const cur = s.db.currency;
    const id = ctx.meta().identity;
    const d = s.job.quote.details;
    const suggestions = suggestedLines({ db: s.db, job: s.job, reqs: s.reqs, derived: s.derivedBase });
    const params = s.job.quote;
    const setParam = (k, v) => ctx.update(() => { params[k] = Number(v) || 0; s.dirty = true; });
    const setCompany = (key, v) => ctx.update(() => { s.db.company[key] = v; s.dirty = true; });
    const setClient = (key, v) => ctx.update(() => { d.client[key] = v; s.dirty = true; });
    const setDetail = (key, v) => ctx.update(() => { d[key] = v; s.dirty = true; });
    const exportXlsx = () => downloadXlsx([
      { name: 'Quote', columns: [['section', 'Section'], ['name', 'Item'], ['qty', 'Qty'], ['unit', 'Unit'], ['price', 'Unit price'], ['total', 'Total'], ['note', 'Note']], rows: q.sections.flatMap((sec) => sec.lines.map((l) => ({ section: sec.label, name: l.name, qty: l.qty, unit: l.unit, price: l.price, total: l.total, note: l.note }))) },
      { name: 'Totals', columns: [['what', ''], ['value', cur]], rows: [['Subtotal', q.subtotal], [`Markup ${q.parameters.markup} %`, q.markup], [`Contingency ${q.parameters.contingency} %`, q.contingency], [`Discount ${q.parameters.discount} %`, -q.discount], ['Total', q.total]].map(([what, value]) => ({ what, value })) },
    ], fileName(id, 'quote', 'xlsx'));
    const editLine = (l) => ctx.update(() => { const line = s.job.lines.find((x) => x.id === l.id); if (!line) return; const name = promptDialog('Name', line.name); if (name === null) return; const qtyV = promptDialog('Quantity', String(line.qty)); if (qtyV === null) return; const price = promptDialog(`Unit price (${cur})`, line.price == null ? '' : String(line.price)); if (price === null) return; line.name = name; line.qty = Number(qtyV) || 0; line.price = price === '' ? null : Number(price); s.dirty = true; });
    const add = () => ctx.update(() => { const name = promptDialog('Name of the line'); if (!name) return; const qtyV = promptDialog('Quantity', '1'); if (qtyV === null) return; const price = promptDialog(`Unit price (${cur})`, ''); if (price === null) return; addLine(s.job, { name, qty: Number(qtyV) || 1, unit: 'pc', price: price === '' ? null : Number(price), section: 'services' }); s.dirty = true; });
    return h('div',
      page('Quote', `${q.unassigned.length ? `${q.unassigned.length} requirements are still unassigned and priced at nothing. ` : ''}${q.unpriced ? `${q.unpriced} lines have no price.` : ''}`.trim() || 'Every requirement is assigned and every line priced.',
        button('Add a line', add), button('Print / Save as PDF', () => window.print(), { title: 'Opens the browser’s print dialog; choose "Save as PDF" there for a file' }), button('Word (.docx)', () => downloadQuoteDocx(q, fileName(id, 'quote', 'docx')), { title: 'A commercial offer document, ready to send or to adapt' }), button('XLSX', exportXlsx), button('Quote file', () => downloadJson(q, fileName(id, 'quote', 'json')), { title: 'vulcano-quote/1' })),
      detailsCard(s, d, cur, setCompany, setClient, setDetail),
      printHeader(q, id),
      kpis([money(q.subtotal, cur), 'subtotal'], [`${fq(q.hours)} h`, 'engineering hours'], [money(q.total, cur), 'total']),
      q.sections.filter((sec) => sec.lines.length).map((sec) => card(`${sec.label} — ${money(sec.subtotal, cur)}${sec.unpriced ? ` (${sec.unpriced} without a price)` : ''}`,
        table([
          [(l) => h('span', { class: 'with-thumb' }, thumb(l.image, { caption: l.name }), h('span', l.part ? h('span', { class: 'muted' }, l.part === 'routing' ? '↳ routing: ' : '↳ accessory: ') : null, l.name, (l.maker || l.model) ? h('span', { class: 'sub' }, makerModel(l)) : null, l.note ? h('span', { class: 'sub' }, l.note) : null)), 'Item', { class: 'wide' }], [(l) => fq(l.qty), 'Qty', { class: 'num' }], [(l) => l.unit, 'Unit'], [(l) => money(l.price), moneyHeader('Unit price', cur), { class: 'num' }], [(l) => money(l.total), moneyHeader('Total', cur), { class: 'num' }],
          [(l) => l.source === 'assignment' ? h('a', { href: '#project', class: 'no-print', onclick: (e) => { e.preventDefault(); ctx.update((st) => { st.ui.selected.req = l.reqId; }); ctx.go('project'); } }, 'project') : h('span', { class: 'row no-print' }, button('Edit', () => editLine(l), { class: 'small' }), button('×', () => ctx.update(() => { removeLine(s.job, l.id); s.dirty = true; }), { class: 'small' })), ''],
        ], sec.lines, { wrap: false }))),
      q.unassigned.length ? notice('warn', h('b', 'Not yet assigned: '), q.unassigned.map((r) => r.label).join(', '), '. ', h('a', { href: '#project', onclick: (e) => { e.preventDefault(); ctx.go('project'); } }, 'Open the project →')) : null,
      card('Totals',
        h('div', { class: 'totals' },
          h('div', h('span', 'Subtotal'), h('b', money(q.subtotal, cur))),
          h('div', h('span', 'Markup ', input(params.markup, (v) => setParam('markup', v), { type: 'number', step: 1, class: 'inline', style: { width: '60px' } }), ' %'), h('b', money(q.markup, cur))),
          h('div', h('span', 'Contingency ', input(params.contingency, (v) => setParam('contingency', v), { type: 'number', step: 1, class: 'inline', style: { width: '60px' } }), ' %'), h('b', money(q.contingency, cur))),
          h('div', h('span', 'Discount ', input(params.discount, (v) => setParam('discount', v), { type: 'number', step: 1, class: 'inline', style: { width: '60px' } }), ' %'), h('b', money(-q.discount, cur))),
          h('div', { class: 'total' }, h('span', 'Total, excluding VAT'), h('b', money(q.total, cur))))),
      suggestions.length ? more(`Suggested lines (${suggestions.filter((x) => !x.already).length}) — effort the usual patterns imply; add what you agree with`,
        table([[(x) => h('span', x.name, h('span', { class: 'sub' }, x.how)), 'Line', { class: 'wide' }], [(x) => fq(x.qty), 'Qty', { class: 'num' }], [(x) => x.unit, 'Unit'], [(x) => x.rateLabel ? `${x.rateLabel} · ${money(x.price, cur)}` : h('span', { class: 'muted' }, 'no matching rate'), 'Rate'], [(x) => x.already ? badge('added', 'ok') : button('Add', () => ctx.update(() => { addLine(s.job, { name: x.name, qty: x.qty, unit: x.unit, rateId: x.rateId, price: x.price, section: x.section, patternId: x.patternId, source: 'suggested', note: x.how }); s.dirty = true; }), { class: 'small' }), '']], suggestions, { wrap: false })) : null,
      q.openQuestions.length ? more(`${q.openQuestions.length} open questions that may move the price`, h('ul', q.openQuestions.map((x) => h('li', `#${x.number} ${x.text}`, x.priceImpact ? h('span', { class: 'sub' }, x.priceImpact) : null)))) : null,
      h('p', { class: 'muted print-only' }, 'Prices exclude VAT. Quantities follow the specification revision stated above.'),
    );
  },
};

// ---- the registry data: who issues the offer, who receives it, its own references -----------------

/** Name, address, VAT, contact — the same shape for your company and for the client. */
function partyFields(values, setField, extra = []) {
  return h('div', { class: 'fields' },
    field('Name', input(values.name, (v) => setField('name', v), { class: 'inline' })),
    field('Address', input(values.address, (v) => setField('address', v), { class: 'inline' })),
    field('VAT / tax code', input(values.vat, (v) => setField('vat', v), { class: 'inline' })),
    field('Contact person', input(values.contact, (v) => setField('contact', v), { class: 'inline' })),
    field('Email', input(values.email, (v) => setField('email', v), { class: 'inline' })),
    field('Phone', input(values.phone, (v) => setField('phone', v), { class: 'inline' })),
    extra.map(([key, label]) => field(label, input(values[key], (v) => setField(key, v), { class: 'inline' }))),
  );
}

function detailsCard(s, d, cur, setCompany, setClient, setDetail) {
  return card('Quote details — who issues it, who receives it, its own references',
    h('div', { class: 'grid2' },
      h('div', h('h3', 'From — your company'), partyFields(s.db.company, setCompany, [['website', 'Website']])),
      h('div', h('h3', 'To — the client'), partyFields(d.client, setClient))),
    h('div', { class: 'fields', style: { marginTop: '10px' } },
      field('Offer number', input(d.number, (v) => setDetail('number', v), { class: 'inline' })),
      field('Date', input(d.date, (v) => setDetail('date', v), { class: 'inline', placeholder: 'YYYY-MM-DD' })),
      field(`Validity`, input(d.validity, (v) => setDetail('validity', v), { class: 'inline', placeholder: 'e.g. 30 days' })),
      field('Payment terms', input(d.paymentTerms, (v) => setDetail('paymentTerms', v), { class: 'inline' })),
      field('Delivery terms', input(d.deliveryTerms, (v) => setDetail('deliveryTerms', v), { class: 'inline' }))),
    field('Notes for the offer document', textarea(d.notes, (v) => setDetail('notes', v), { rows: 2 })),
  );
}

/** What Print / Save as PDF and every export show as the offer's own masthead. */
function printHeader(q, id) {
  const c = q.company || {}; const cl = (q.details || {}).client || {}; const d = q.details || {};
  const party = (title, p) => h('div', h('b', title), h('div', p.name || '—'), p.address ? h('div', p.address) : null, p.vat ? h('div', `VAT ${p.vat}`) : null, p.contact ? h('div', p.contact) : null, [p.email, p.phone].filter(Boolean).join(' · ') ? h('div', [p.email, p.phone].filter(Boolean).join(' · ')) : null);
  return h('div', { class: 'print-only' },
    h('div', { class: 'doc-title' }, c.name || 'Quotation'),
    h('p', 'Commercial offer'),
    h('div', { class: 'grid2' }, party('From', c), party('To', cl)),
    h('p', [['Offer number', d.number], ['Date', d.date], ['Validity', d.validity], ['Specification', [id.documentCode, id.title].filter(Boolean).join(' — ')], ['Revision', id.revision], ['Currency', q.currency]].filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join(' · ')),
  );
}
