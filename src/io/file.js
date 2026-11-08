// The file that saves itself, as DEDALO does: the HTML carries the database and the project in
// two JSON blocks; «Save» rebuilds the same file with the current blocks and downloads it. The
// shell is captured once at start, before the interface draws anything into it.
import { APP_NAME, APP_VERSION, FORMATS } from '../version.js';
import { download } from './exports.js';
import { checkFormat } from './dedalo.js';

let SHELL = '';

export function captureShell() {
  SHELL = '<!doctype html>\n' + document.documentElement.outerHTML;
  return SHELL;
}

function readBlock(root, id) {
  const el = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
  if (!el) return { present: false, valid: false, value: null };
  try { return { present: true, valid: true, value: JSON.parse(el.textContent || 'null') }; } catch { return { present: true, valid: false, value: null }; }
}

/** What this copy of the file carries: the database and, when it is a saved job, the project. */
export function readEmbedded(root = document) {
  return { db: readBlock(root, 'vlc-db').value, job: readBlock(root, 'vlc-job').value };
}

const protectJson = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1').replace(/<!--/g, '\\u003c!--');
function replaceBlock(html, name, json) {
  const re = new RegExp(`<!--VLC:${name}-->[\\s\\S]*?<!--/VLC:${name}-->`);
  const body = `<script type="application/json" id="vlc-${name.toLowerCase()}">${protectJson(json)}</script>`;
  return html.replace(re, () => `<!--VLC:${name}-->${body}<!--/VLC:${name}-->`);
}
const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** The two markers that make a page a VULCANO build: where the database and the project are written. */
// (Built from parts: the marker spelled out whole would also sit in the program text, and a build would then carry it twice.)
export const isBuild = (html) => ['DB', 'JOB'].every((name) => String(html).includes(`<!--VLC:${name}-->`));

/** Writes the database and the project into any build's shell — the one in hand, or a newer one just downloaded. */
export function composeInto(shell, { db, job, title }) {
  let html = shell;
  html = replaceBlock(html, 'DB', JSON.stringify(db));
  html = replaceBlock(html, 'JOB', JSON.stringify(job || null));
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title || `${APP_NAME} — Testbench dev. advisor`)}</title>`);
  return html;
}

export function composeFile(state) {
  if (!SHELL) throw new Error('The file cannot be rebuilt: its shell was not captured at start.');
  return composeInto(SHELL, state);
}

const safeName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

/** What a saved copy is called, and its page title: after the specification when a project is open. */
export function savedAs({ job, identity }) {
  const named = job && identity;
  return {
    name: named ? `${safeName(identity.documentCode || identity.title || 'job')}_Rev${identity.revision || '00'}_vulcano.html` : 'vulcano.html',
    title: named ? `${[identity.documentCode, identity.title].filter(Boolean).join(' — ')} — VULCANO` : '',
  };
}

/** Saves the job (or, with no job, the tool with its database) as a new copy of this HTML file. */
export function saveFile({ db, job, identity }) {
  const { name, title } = savedAs({ job, identity });
  return download(composeFile({ db, job, title }), name, 'text/html;charset=utf-8');
}

// ---- the job as a JSON envelope, for interchange ---------------------------------------------------

export const jobEnvelope = (job, { includeAssets = true } = {}) => ({
  format: `${FORMATS.job.id}/${FORMATS.job.writes}`, application: APP_NAME, applicationVersion: APP_VERSION, saved: new Date().toISOString(),
  job: { ...job, spec: job.spec ? { ...job.spec, assets: includeAssets ? job.spec.assets : {}, assetsOmitted: !includeAssets } : null },
});

export function readJobEnvelope(text) {
  let data;
  try { data = JSON.parse(String(text || '')); } catch { throw new Error('This file is not JSON.'); }
  const declared = (() => { const t = String(data.format || ''); if (!t) return null; const [id, v] = t.split('/'); return { id, version: Number(v) || 1 }; })();
  const check = checkFormat(declared, FORMATS.job);
  if (!check.ok) throw new Error(check.reason);
  if (!data.job || !data.job.spec || !data.job.spec.doc) throw new Error('This job holds no specification.');
  return { job: data.job, notes: check.notes };
}

/** Opens a saved copy of the tool: the job block, when there is one. */
export const hasJobBlock = (root = document) => readBlock(root, 'vlc-job').present;
