import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toXlsx, zip, fileName } from '../src/io/exports.js';
import { buildQuoteDocx } from '../src/io/docx.js';

test('CSV quotes what needs quoting and starts with a byte-order mark for Excel', () => {
  const csv = toCsv([['a', 'A'], ['b', 'B']], [{ a: 'x;y', b: 'plain' }, { a: 'say "hi"', b: 12 }]);
  assert.ok(csv.startsWith('﻿A;B\r\n'));
  assert.match(csv, /"x;y";plain/);
  assert.match(csv, /"say ""hi""";12/);
});

test('the ZIP writer produces a container whose central directory lists every file', () => {
  const bytes = zip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) }]);
  const dv = new DataView(bytes.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50, 'local header signature');
  const end = bytes.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50, 'end of central directory');
  assert.equal(dv.getUint16(end + 10, true), 2, 'two entries');
  const cdOffset = dv.getUint32(end + 16, true);
  assert.equal(dv.getUint32(cdOffset, true), 0x02014b50, 'central directory starts where the record says');
});

test('the XLSX has the parts a workbook needs and one sheet per table', () => {
  const bytes = toXlsx([{ name: 'Limits', columns: [['a', 'A'], ['n', 'N']], rows: [{ a: 'x<y', n: 1.5 }, { a: 'z', n: null }] }, { name: 'Second/Sheet:Name that is far too long for Excel to accept', columns: [['a', 'A']], rows: [] }]);
  const text = new TextDecoder('latin1').decode(bytes);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('x&lt;y'), 'text is escaped');
  assert.ok(text.includes('<v>1.5</v>'), 'numbers are numbers');
  assert.ok(text.includes('name="Second Sheet Name that is far t"'), 'sheet names are made safe and cut to 31 characters');
});

test('the quote’s Word export is a valid docx with the parties, the references and the line items', () => {
  const q = {
    format: 'vulcano-quote/1', currency: 'EUR', spec: { documentCode: 'TS-EVC-0117', title: 'End of line & <safety>', revision: '03', revisionDate: '2026-09-10' },
    company: { name: 'Acme Test Systems', vat: 'IT01234567890', email: 'sales@acme.test' },
    details: { number: 'Q-2026-014', date: '2026-09-19', validity: '30 days', client: { name: 'Voltaria Energy S.r.l.' }, paymentTerms: '30% at order, balance at FAT', deliveryTerms: '10 weeks ARO' },
    sections: [{ id: 'instruments', label: 'Instruments', subtotal: 1500, unpriced: 0, lines: [{ name: 'Bench DMM', note: '', qty: 1, unit: 'pc', price: 1500, total: 1500 }] }],
    subtotal: 1500, markup: 150, contingency: 0, discount: 0, total: 1650, parameters: { markup: 10, contingency: 0, discount: 0 },
    unassigned: [], unpriced: 0, openQuestions: [{ number: 1, text: 'Is 5 kV hipot confirmed?', priceImpact: '+ safety analyser' }], hours: 0,
  };
  const bytes = buildQuoteDocx(q);
  const dv = new DataView(bytes.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50, 'a real ZIP');
  const text = new TextDecoder('latin1').decode(bytes);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('Acme Test Systems'), 'the issuing company appears');
  assert.ok(text.includes('IT01234567890'), 'the VAT number appears');
  assert.ok(text.includes('Voltaria Energy'), 'the client appears');
  assert.ok(text.includes('Q-2026-014'), 'the offer number appears');
  assert.ok(text.includes('End of line &amp; &lt;safety&gt;'), 'the specification title is escaped');
  assert.ok(text.includes('30%25 at order') || text.includes('30% at order'), 'payment terms appear');
  assert.ok(text.includes('Is 5 kV hipot confirmed?'), 'the open question appears');
  assert.ok(text.includes('1,650 EUR') || text.includes('1650 EUR') || text.includes('1&#160;650'), 'the total appears with its currency');
});

test('file names come from the specification identity', () => {
  assert.equal(fileName({ documentCode: 'TS-EVC-0117', revision: '03' }, 'quote', 'json'), 'TS-EVC-0117_Rev03_quote.json');
  assert.equal(fileName({ title: 'Spécification à/b' }, 'rfi', 'json'), 'Specification-a-b_Rev00_rfi.json');
});
