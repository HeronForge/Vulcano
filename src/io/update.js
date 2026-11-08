// Moving to a newer build — the family's pattern (../heronforge-kb/patterns/self-update.md),
// first written in DEDALO 1.38.0. No DOM here, so all of it is tested in Node; the dialog is
// src/ui/update.js. Four rules, each with a cost behind it:
//   1. nothing ever asks on its own — the check is a menu entry the reader chooses;
//   2. the only thing kept is the date of the last check;
//   3. the update is a NEW file, the data written into a freshly downloaded empty build; the
//      file in the reader's hands is never touched;
//   4. unsaved work is settled before the download (the dialog's business).
import { APP_VERSION } from '../version.js';
import { composeInto, isBuild, savedAs } from './file.js';

/** Published by the build at the root of `main` (raw.githubusercontent.com answers any origin, file: included). */
export const UPDATE_URL = 'https://raw.githubusercontent.com/HeronForge/Vulcano/main/update.json';
export const RELEASE_PAGE = 'https://github.com/HeronForge/Vulcano';
/** The empty build, on the project's own Pages site. */
export const BUILD_URL = 'https://heronforge.github.io/Vulcano/vulcano.html';
const BUILD_HOST = /^https:\/\/heronforge\.github\.io\/Vulcano\//;

export const LAST_CHECK_KEY = 'vlc.update.checked';
export const CHECK_INTERVAL_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

/** -1, 0 or 1. Numbers compare as numbers (0.4.10 is after 0.4.9); anything else sorts before everything, so junk never looks like an update. */
export function compareVersions(a, b) {
  const clean = (v) => /^\d+(\.\d+)*$/.test(String(v ?? '').trim());
  if (!clean(a) || !clean(b)) return clean(a) === clean(b) ? 0 : clean(a) ? 1 : -1;
  const parts = (v) => String(v).trim().split('.').map(Number);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
export const isNewer = (candidate, current = APP_VERSION) => compareVersions(candidate, current) > 0;

// ---- the one thing remembered: when the reader last asked --------------------------------------------

export function lastChecked(storage) {
  try {
    const raw = storage && storage.getItem(LAST_CHECK_KEY);
    const at = raw ? Number(JSON.parse(raw).at) : 0;
    return at > 0 ? at : null;
  } catch { return null; }
}

export function rememberCheck(storage, { at = Date.now(), version = '' } = {}) {
  try {
    if (!storage) return false;
    storage.setItem(LAST_CHECK_KEY, JSON.stringify({ at, version }));
    return true;
  } catch { return false; }
}

/** A file never checked is not overdue: it is a first use, and the clock starts at the first check. */
export function checkOverdue(storage, now = Date.now()) {
  const at = lastChecked(storage);
  if (!at) return false;
  return now - at >= CHECK_INTERVAL_DAYS * DAY;
}

export function daysSinceCheck(storage, now = Date.now()) {
  const at = lastChecked(storage);
  return at ? Math.floor((now - at) / DAY) : null;
}

// ---- the answer, read with suspicion ----------------------------------------------------------------

/** What the announcement is believed to say, or null. The build address must be on the project's own site: it becomes the program the reader opens next. */
export function readAnnouncement(value) {
  if (!value || typeof value !== 'object') return null;
  const version = String(value.version || '').trim();
  if (!/^\d+(\.\d+)*$/.test(version)) return null;
  const app = String(value.app || '').trim();
  return {
    version,
    date: String(value.date || '').trim(),
    changes: Array.isArray(value.changes) ? value.changes.filter((c) => typeof c === 'string') : [],
    app: BUILD_HOST.test(app) ? app : '',
  };
}

/** Asks the project which build is the latest. A failure is returned, not thrown: no way out is the ordinary case on a bench. */
export async function fetchAnnouncement(fetchImpl = fetch, url = UPDATE_URL) {
  try {
    const res = await fetchImpl(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, announcement: null, error: `the server answered ${res.status}` };
    const announcement = readAnnouncement(await res.json());
    if (!announcement) return { ok: false, announcement: null, error: 'the answer was not an update announcement' };
    return { ok: true, announcement, error: '' };
  } catch (err) {
    return { ok: false, announcement: null, error: err && err.message ? err.message : 'no answer' };
  }
}

/**
 * The newest empty build with the reader's database and project already written into it, and the
 * name to save it under (`…_vulcano_v0.5.0.html`, so the two files are never confused in a folder).
 * `state` is { db, job, identity }. Throws, with the reason, when what came down is not a build.
 */
export async function buildUpdatedFile(state, announcement, fetchImpl = fetch) {
  if (!announcement || !announcement.app) throw new Error('The announcement does not say where the build is.');
  const res = await fetchImpl(announcement.app, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The build could not be downloaded: the server answered ${res.status}.`);
  const shell = await res.text();
  if (!isBuild(shell)) throw new Error('What was downloaded is not a VULCANO build: it has no data block.');
  const { name, title } = savedAs(state);
  return { html: composeInto(shell, { db: state.db, job: state.job, title }), name: name.replace(/\.html$/, `_v${announcement.version}.html`) };
}
