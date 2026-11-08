// Moving to a newer build: the version order, the announcement read with suspicion, the
// reminder clock and the file written into the new build — everything but the dialog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compareVersions, isNewer, readAnnouncement, fetchAnnouncement, buildUpdatedFile, checkOverdue, daysSinceCheck, rememberCheck, lastChecked, LAST_CHECK_KEY, CHECK_INTERVAL_DAYS, BUILD_URL } from '../src/io/update.js';
import { composeInto, isBuild } from '../src/io/file.js';
import { APP_VERSION, CHANGELOG } from '../src/version.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 8, 12);

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), size: () => m.size, dump: () => [...m.entries()] }; };
const reply = (body, { ok = true, status = 200 } = {}) => async () => ({ ok, status, json: async () => body, text: async () => body });

// A build as the project publishes it: the program, two empty data blocks, a title.
const BUILD = '<!doctype html><html><head><title>VULCANO — Testbench dev. advisor</title></head><body><!--VLC:DB--><script type="application/json" id="vlc-db">null</script><!--/VLC:DB--><!--VLC:JOB--><script type="application/json" id="vlc-job">null</script><!--/VLC:JOB--><script>var APP_VERSION = "9.9.9";</script></body></html>';

test('versions compare as numbers, so 0.4.10 comes after 0.4.9', () => {
  assert.equal(compareVersions('0.4.10', '0.4.9'), 1);
  assert.equal(compareVersions('0.5.0', '0.4.99'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.4.5', '0.4.5'), 0);
  assert.equal(isNewer('0.5.0', '0.4.5'), true);
  assert.equal(isNewer('0.4.5', '0.4.5'), false);
});

test('anything that is not a version sorts before everything, so junk never looks like an update', () => {
  for (const junk of ['', 'latest', '<html>', '1.x', null, undefined]) assert.equal(isNewer(junk, '0.0.1'), false, String(junk));
});

test('an announcement keeps the version, the date, the sentences and a build on the project’s own site', () => {
  const a = readAnnouncement({ version: '0.5.0', date: '2026-11-08', changes: ['One.', 7, 'Two.', null], app: BUILD_URL });
  assert.deepEqual(a, { version: '0.5.0', date: '2026-11-08', changes: ['One.', 'Two.'], app: BUILD_URL });
});

test('an announcement naming a build anywhere else is read without it, and junk is refused', () => {
  assert.equal(readAnnouncement({ version: '0.5.0', app: 'https://evil.example/vulcano.html' }).app, '');
  assert.equal(readAnnouncement({ version: '0.5.0', app: 'http://heronforge.github.io/Vulcano/vulcano.html' }).app, '');
  assert.equal(readAnnouncement({ version: '0.5.0', app: 'https://heronforge.github.io/Dedalo/wallbox.html' }).app, '');
  assert.equal(readAnnouncement({ version: 'latest' }), null);
  assert.equal(readAnnouncement({ version: '1.2.3 && rm' }), null);
  assert.equal(readAnnouncement('<html>login</html>'), null);
  assert.equal(readAnnouncement(null), null);
});

test('asking the project returns the answer, or the reason it could not — it never throws', async () => {
  const fine = await fetchAnnouncement(reply({ version: '0.5.0', app: BUILD_URL }));
  assert.equal(fine.ok, true);
  assert.equal(fine.announcement.version, '0.5.0');
  const missing = await fetchAnnouncement(reply({}, { ok: false, status: 404 }));
  assert.deepEqual([missing.ok, missing.error], [false, 'the server answered 404']);
  const portal = await fetchAnnouncement(reply({ title: 'Sign in to the network' }));
  assert.equal(portal.ok, false);
  const offline = await fetchAnnouncement(async () => { throw new Error('Failed to fetch'); });
  assert.deepEqual([offline.ok, offline.error], [false, 'Failed to fetch']);
});

test('the question is asked without a cache and nothing but the address goes out', async () => {
  const seen = [];
  await fetchAnnouncement(async (...args) => { seen.push(args); return { ok: true, json: async () => ({ version: '0.5.0' }) }; });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0][1], { cache: 'no-store' });
});

test('a file never checked is not overdue; the clock starts at the first check', () => {
  const store = memory();
  assert.equal(lastChecked(store), null);
  assert.equal(checkOverdue(store, NOW), false);
  assert.equal(daysSinceCheck(store, NOW), null);
});

test('a check is overdue after 90 days, not before', () => {
  const store = memory();
  rememberCheck(store, { at: NOW - 89 * DAY, version: '0.4.5' });
  assert.equal(checkOverdue(store, NOW), false);
  rememberCheck(store, { at: NOW - CHECK_INTERVAL_DAYS * DAY, version: '0.4.5' });
  assert.equal(checkOverdue(store, NOW), true);
  assert.equal(daysSinceCheck(store, NOW), 90);
});

test('the only thing kept is the date of the last check, and a storage that refuses is not an error', () => {
  const store = memory();
  rememberCheck(store, { at: NOW, version: '0.5.0' });
  assert.equal(store.size(), 1);
  assert.equal(store.dump()[0][0], LAST_CHECK_KEY);
  assert.deepEqual(Object.keys(JSON.parse(store.dump()[0][1])).sort(), ['at', 'version']);
  assert.equal(rememberCheck(null), false);
  assert.equal(rememberCheck({ setItem() { throw new Error('quota'); } }), false);
  assert.equal(lastChecked({ getItem() { return '{not json'; } }), null);
  assert.equal(checkOverdue(null, NOW), false);
});

const state = { db: { name: 'My bench', currency: 'EUR', instruments: [{ id: 'ins_1', name: 'DMM </script> 6500' }] }, job: { spec: { doc: { title: 'x' } } }, identity: { documentCode: 'TS-EVC-0117', title: 'Wallbox', revision: '03' } };
const announcement = { version: '9.9.9', app: BUILD_URL, changes: [], date: '' };

test('the new build is written with the current database and project, and is named for its version', async () => {
  const { html, name } = await buildUpdatedFile(state, announcement, reply(BUILD));
  assert.match(html, /var APP_VERSION = "9\.9\.9"/, 'the program is the new one');
  assert.equal(isBuild(html), true);
  const block = (id) => html.match(new RegExp(`id="${id}">([\\s\\S]*?)</script>`))[1];
  assert.equal(JSON.parse(block('vlc-db').replace(/<\\\//g, '</')).name, 'My bench');
  assert.deepEqual(JSON.parse(block('vlc-job').replace(/<\\\//g, '</')), state.job);
  assert.equal(name, 'TS-EVC-0117_Rev03_vulcano_v9.9.9.html');
  assert.match(html, /<title>TS-EVC-0117 — Wallbox — VULCANO<\/title>/);
});

test('with no project open the update is the tool with the database, named after the tool', async () => {
  const { html, name } = await buildUpdatedFile({ db: state.db, job: null, identity: null }, announcement, reply(BUILD));
  assert.equal(name, 'vulcano_v9.9.9.html');
  assert.match(html, /id="vlc-job">null<\/script>/);
});

test('a database that mentions a closing script tag cannot end the block that carries it', () => {
  const html = composeInto(BUILD, { db: state.db, job: null, title: '' });
  assert.equal((html.match(/<\/script>/g) || []).length, 3, 'two blocks and the program, no more');
});

test('a page that is not a build is refused, and nothing is written', async () => {
  await assert.rejects(buildUpdatedFile(state, announcement, reply('<html><body>Sign in to the network</body></html>')), /not a VULCANO build/);
  await assert.rejects(buildUpdatedFile(state, announcement, reply('', { ok: false, status: 500 })), /answered 500/);
  await assert.rejects(buildUpdatedFile(state, { ...announcement, app: '' }, reply(BUILD)), /does not say where the build is/);
});

test('the file in hand is not touched: the shell handed in is the same string afterwards', async () => {
  const shell = BUILD;
  await buildUpdatedFile(state, announcement, reply(shell));
  assert.equal(shell, BUILD);
});

test('update.json, written by the build, announces the version this source is', () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'update.json');
  if (!existsSync(file)) return; // a fresh clone before the first build
  const written = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(written.version, APP_VERSION, 'run `npm run build` after bumping the version');
  assert.deepEqual(written.changes, CHANGELOG[0].changes);
  assert.equal(readAnnouncement(written).app, BUILD_URL);
});
