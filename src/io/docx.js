// F4 · Word export for the quote: a minimal .docx writer with no library, the same way the
// XLSX in exports.js has none — a ZIP of a handful of OOXML parts. The paragraph/table
// primitives below are a small port of DEDALO's own docx writer (see
// ../../heronforge-kb/interchange/dedalo/wallbox.html, src/export/docx.js in its bundle):
// a quote is one or two pages of text and tables, not a technical document with a cover,
// a header/footer or images, so this keeps only what that needs.
import { zip, download } from './exports.js';

const PAGE = { w: 11906, h: 16838, top: 1134, bottom: 1134, side: 1134 };
const CONTENT_WIDTH = PAGE.w - PAGE.side * 2;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n, cur) => (n == null || !Number.isFinite(n) ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n))}${cur ? ' ' + cur : ''}`);

// ---- paragraph / table primitives (OOXML fragments, as strings) --------------------------------

function run(text, props = {}) {
  const rPr = [props.bold ? '<w:b/>' : '', props.italic ? '<w:i/>' : '', props.caps ? '<w:smallCaps/>' : '', props.color ? `<w:color w:val="${props.color}"/>` : '', props.size ? `<w:sz w:val="${props.size}"/>` : ''].join('');
  const body = String(text ?? '').split('\n').map((line, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${esc(line)}</w:t>`).join('');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${body}</w:r>`;
}
function para(content, props = {}) {
  const runs = Array.isArray(content) ? content.join('') : typeof content === 'string' ? run(content, props) : content;
  const pPr = [
    props.style ? `<w:pStyle w:val="${props.style}"/>` : '',
    props.align ? `<w:jc w:val="${props.align}"/>` : '',
    (props.spacingBefore || props.spacingAfter != null) ? `<w:spacing${props.spacingBefore ? ` w:before="${props.spacingBefore}"` : ''}${props.spacingAfter != null ? ` w:after="${props.spacingAfter}"` : ''}/>` : '',
  ].join('');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
}
const heading = (level, text, props = {}) => para(text, { style: `Heading${level}`, ...props });
const empty = () => '<w:p/>';
const emptyLine = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
function cell(content, { width, shading, align } = {}) {
  const body = Array.isArray(content) ? content.join('') : (content || empty());
  const tcPr = [width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '', shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${shading}"/>` : '', align ? `<w:vAlign w:val="${align}"/>` : ''].join('');
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${body}</w:tc>`;
}
const row = (cells, { header = false } = {}) => `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;
const BORDER = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="9AA5B1"/>`).join('') + '</w:tblBorders>';
function table(rows, { widths } = {}) {
  const total = (widths || []).reduce((a, b) => a + b, 0) || CONTENT_WIDTH;
  const grid = (widths || []).map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${BORDER}<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>${grid ? `<w:tblGrid>${grid}</w:tblGrid>` : ''}${rows.join('')}</w:tbl>`;
}
const textCell = (text, width, props = {}) => cell(para(text, { spacingAfter: 0, ...props }), { width });
function dataTable(headers, rows, widths) {
  const head = row(headers.map((t, i) => cell(para(t, { bold: true, spacingAfter: 0 }), { width: widths[i], shading: 'E7ECF2' })), { header: true });
  return table([head, ...rows], { widths });
}

// ---- the package: content types, relationships, styles, properties -----------------------------

const DOCUMENT_OPEN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
const DOCUMENT_CLOSE = '</w:body></w:document>';
const sectionProperties = () => `<w:sectPr><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/><w:pgMar w:top="${PAGE.top}" w:right="${PAGE.side}" w:bottom="${PAGE.bottom}" w:left="${PAGE.side}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
const styleDefinition = (id, name, { size, bold, color, before, after }) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before || 0}" w:after="${after || 0}"/></w:pPr><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/>${color ? `<w:color w:val="${color}"/>` : ''}</w:rPr></w:style>`;
const stylesXml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
  + styleDefinition('Title', 'Title', { size: 44, bold: true, after: 160 })
  + styleDefinition('Heading1', 'heading 1', { size: 26, bold: true, color: '14181D', before: 240, after: 100 })
  + styleDefinition('Heading2', 'heading 2', { size: 22, bold: true, color: '24303C', before: 200, after: 80 })
  + '</w:styles>';
const contentTypesXml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
const packageRelsXml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rIdApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
const documentRelsXml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
const coreXml = ({ title, subject, creator }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:subject>${esc(subject)}</dc:subject><dc:creator>${esc(creator)}</dc:creator></cp:coreProperties>`;
const appXml = (company) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>${esc(company)}</Company><Application>VULCANO</Application></Properties>`;

/** The registry block of one party (your company, or the client): name, address, VAT, contact — whatever it has. */
function partyCell(title, party, width) {
  const lines = [para(title, { bold: true, size: 15, color: '55606B', spacingAfter: 40 }), para(party.name || '—', { bold: true, spacingAfter: 0 })];
  for (const [key, prefix] of [['address', ''], ['vat', 'VAT '], ['contact', ''], ['email', ''], ['phone', '']]) if (party[key]) lines.push(para(`${prefix}${party[key]}`, { spacingAfter: 0 }));
  return cell(lines, { width, shading: 'F7F9FC' });
}

/**
 * The quote as a .docx: `q` is a `vulcano-quote/1` object (from `buildQuote`, carrying
 * `company` and `details`) — everything a commercial offer needs to state: who issues it, to
 * whom, its own number and date, the specification it prices, the line items by section, the
 * totals, the terms, the open questions that may still move the price.
 */
export function buildQuoteDocx(q) {
  const cur = q.currency;
  const id = q.spec || {};
  const company = q.company || {};
  const d = q.details || {};
  const client = d.client || {};
  const half = Math.floor(CONTENT_WIDTH / 2);
  const body = [];
  body.push(para(company.name || 'Quotation', { style: 'Title' }));
  body.push(para('Commercial offer', { size: 22, color: '55606B', spacingAfter: 200 }));
  body.push(table([row([partyCell('From', company, half), partyCell('To', client, CONTENT_WIDTH - half)])], { widths: [half, CONTENT_WIDTH - half] }));
  body.push(empty());
  const refWidth = 2600;
  const refRow = (label, value) => row([textCell(label, refWidth, { bold: true }), textCell(value || '—', CONTENT_WIDTH - refWidth)]);
  body.push(table([
    refRow('Offer number', d.number),
    refRow('Date', d.date),
    refRow('Validity', d.validity),
    refRow('Specification', [id.documentCode, id.title].filter(Boolean).join(' — ') || '—'),
    refRow('Revision', id.revision ? `Rev. ${id.revision}${id.revisionDate ? ' · ' + id.revisionDate : ''}` : '—'),
    refRow('Currency', cur || '—'),
  ], { widths: [refWidth, CONTENT_WIDTH - refWidth] }));
  body.push(empty());
  if (q.unassigned.length) body.push(para(`${q.unassigned.length} requirement${q.unassigned.length > 1 ? 's are' : ' is'} still unassigned and priced at nothing: the total below is partial.`, { italic: true, color: 'A76C12', spacingAfter: 160 }));
  const w = [Math.round(CONTENT_WIDTH * 0.4), 900, 1000, 1400, 1400];
  w.push(CONTENT_WIDTH - w.reduce((a, b) => a + b, 0));
  for (const sec of q.sections.filter((s) => s.lines.length)) {
    body.push(heading(2, `${sec.label} — ${money(sec.subtotal, cur)}`));
    body.push(dataTable(['Item', 'Qty', 'Unit', `Unit price (${cur})`, `Total (${cur})`], sec.lines.map((l) => row([
      textCell([l.name, l.note ? `\n${l.note}` : ''].join(''), w[0]),
      textCell(String(l.qty), w[1], { align: 'right' }),
      textCell(l.unit, w[2]),
      textCell(l.price != null ? money(l.price) : '—', w[3], { align: 'right' }),
      textCell(l.total != null ? money(l.total) : '—', w[4], { align: 'right' }),
    ])), w.slice(0, 5)));
    body.push(empty());
  }
  const totalsWidth = CONTENT_WIDTH - 2200;
  const totalsRows = [['Subtotal', q.subtotal]];
  if (q.markup) totalsRows.push([`Markup ${q.parameters.markup} %`, q.markup]);
  if (q.contingency) totalsRows.push([`Contingency ${q.parameters.contingency} %`, q.contingency]);
  if (q.discount) totalsRows.push([`Discount ${q.parameters.discount} %`, -q.discount]);
  body.push(table([
    ...totalsRows.map(([l, v]) => row([textCell(l, totalsWidth), textCell(money(v, cur), 2200, { align: 'right' })])),
    row([textCell('Total, excluding VAT', totalsWidth, { bold: true }), textCell(money(q.total, cur), 2200, { bold: true, align: 'right' })]),
  ], { widths: [totalsWidth, 2200] }));
  if (d.paymentTerms || d.deliveryTerms) {
    body.push(empty(), heading(2, 'Terms'));
    if (d.paymentTerms) body.push(para(`Payment: ${d.paymentTerms}`));
    if (d.deliveryTerms) body.push(para(`Delivery: ${d.deliveryTerms}`));
  }
  if (d.notes) { body.push(empty(), heading(2, 'Notes')); body.push(...String(d.notes).split(/\n{2,}/).filter(Boolean).map((p) => para(p))); }
  if (q.openQuestions.length) {
    body.push(empty(), heading(2, 'Open questions that may move the price'));
    body.push(...q.openQuestions.map((x) => para(`#${x.number} ${x.text}${x.priceImpact ? ` (${x.priceImpact})` : ''}`, { spacingAfter: 40 })));
  }
  const documentXml = DOCUMENT_OPEN + body.join('') + emptyLine + sectionProperties() + DOCUMENT_CLOSE;
  return zip([
    { name: '[Content_Types].xml', data: contentTypesXml() },
    { name: '_rels/.rels', data: packageRelsXml() },
    { name: 'docProps/core.xml', data: coreXml({ title: `Quotation ${d.number || ''}`.trim(), subject: id.title || '', creator: company.name || '' }) },
    { name: 'docProps/app.xml', data: appXml(company.name || '') },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/_rels/document.xml.rels', data: documentRelsXml() },
  ]);
}

export const downloadQuoteDocx = (q, name) => download(buildQuoteDocx(q), name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
