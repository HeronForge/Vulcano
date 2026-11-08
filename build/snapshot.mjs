// Snapshot: refreshes ../heronforge-kb/interchange/vulcano/ with this build's compiled output,
// the format references, a VERSION.md, and sample envelopes produced from DEDALO's wallbox
// showcase — what a satellite that reads VULCANO's output tests against. Run after `build`
// as part of any change to what VULCANO writes (see CLAUDE.md).
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => join(root, ...s);
const kb = join(root, '..', 'heronforge-kb');
const out = join(kb, 'interchange', 'vulcano');
const wallbox = join(kb, 'interchange', 'dedalo', 'wallbox.html');

async function main() {
  try { await access(kb); } catch { throw new Error(`../heronforge-kb not found beside this repo (${kb}).`); }
  const { APP_VERSION, JOB_SCHEMA_VERSION, DB_SCHEMA_VERSION, FORMATS, DEDALO_SCHEMA_MAX } = await import(pathToFileURL(p('src', 'version.js')));
  const { createSession, openSpecification, meta, touch } = await import(pathToFileURL(p('src', 'model', 'session.js')));
  const { assign, buildQuote, defaultQty, addRouting, switchingOf } = await import(pathToFileURL(p('src', 'model', 'project.js')));
  const { suggestInstruments, suggestParts, suggestRouting, itemsOfKind, exportDb } = await import(pathToFileURL(p('src', 'model', 'db.js')));
  const { rfiEnvelope, fromFinding } = await import(pathToFileURL(p('src', 'model', 'questions.js')));
  const { sequenceSkeleton } = await import(pathToFileURL(p('src', 'model', 'software.js')));
  const { jobEnvelope } = await import(pathToFileURL(p('src', 'io', 'file.js')));

  await mkdir(out, { recursive: true });
  await copyFile(p('dist', 'vulcano.html'), join(out, 'vulcano.html'));
  for (const f of ['FORMATS.md', 'DATA-FILES.md', 'KB-FORMAT.md']) await copyFile(p('docs', f), join(out, f));

  // Sample envelopes from the wallbox showcase: every slot assigned to the top-ranked row of
  // the starter database (a choice a user would make by hand, made here so the samples show
  // real lines), a multi-point instrument routed with the top-ranked relay part, the errors
  // taken as questions.
  const s = createSession();
  openSpecification(s, await readFile(wallbox, 'utf8'), 'wallbox.html');
  for (const req of s.reqs) {
    if (req.kind === 'instrument') { const top = suggestInstruments(s.db, req.resource, { classIds: req.classIds, requiredPercent: req.requiredPercent, channels: req.channels })[0]; assign(s.job, req, { table: 'instruments', itemId: top.row.id, qty: defaultQty(req) }); if (req.channels > 1) { const r = suggestRouting(s.db, { channels: req.channels })[0]; if (r) addRouting(s.job, req.id, { table: r.table, itemId: r.row.id, qty: r.suggestedQty }); } }
    else if (req.kind === 'part') { const top = suggestParts(s.db, { kind: req.partKind === 'other' ? null : req.partKind, contactType: req.contactType || req.label, current: req.current || null })[0]; if (top) assign(s.job, req, { table: 'parts', itemId: top.row.id, qty: defaultQty(req) }); }
    else if (req.kind === 'effort') assign(s.job, req, { hours: req.suggestedHours || 8, rateId: 'rat_software' });
    else if (req.kind === 'item') { const item = itemsOfKind(s.db, req.itemKind)[0]; if (item) assign(s.job, req, { table: 'items', itemId: item.id, qty: 1 }); }
  }
  for (const f of s.findings.filter((x) => x.severity === 'error')) fromFinding(s.job.questions, f);
  touch(s);
  const m = meta(s);
  const write = (name, obj) => writeFile(join(out, name), JSON.stringify(obj, null, 2) + '\n', 'utf8');
  await write('wallbox-quote.json', buildQuote({ db: s.db, job: s.job, reqs: s.reqs, meta: m }));
  await write('wallbox-rfi.json', rfiEnvelope(s.job.questions, m.identity, m));
  await write('wallbox-sequence.json', sequenceSkeleton({ derived: s.derivedBase, switchingFor: (rid) => { const r = s.reqs.find((x) => x.subjectId === rid && x.kind === 'instrument'); return switchingOf(r ? s.job.assignments[r.id] : null); }, accuracy: s.accuracy, meta: m }));
  await write('wallbox-job.json', jobEnvelope(s.job, { includeAssets: false }));
  await write('starter-db.json', exportDb(s.db, m));

  const own = Object.entries(FORMATS).filter(([, f]) => !f.owner);
  const theirs = Object.entries(FORMATS).filter(([, f]) => f.owner);
  const version = `# VULCANO — interchange snapshot

Reflects what was in \`src/version.js\` when this snapshot was taken (\`npm run snapshot\` in the
VULCANO repo). Update this folder and \`ALIGNMENT.md\` together whenever a change to VULCANO
affects what a satellite project reads or writes.

- **APP_VERSION**: ${APP_VERSION}
- **JOB_SCHEMA_VERSION**: ${JOB_SCHEMA_VERSION}; **DB_SCHEMA_VERSION**: ${DB_SCHEMA_VERSION} (the shapes inside the HTML file's \`vlc-job\` and \`vlc-db\` blocks)
- **Reads from DEDALO**: up to document schema ${DEDALO_SCHEMA_MAX}; ${theirs.map(([, f]) => `\`${f.id}\` reads [${f.reads.join(', ')}]`).join('; ')}; and the DEDALO document itself (.html) through its embedded data blocks.
- **FORMATS** (VULCANO's own):
${own.map(([, f]) => `  - \`${f.id}\` — ${f.writes ? `writes ${f.writes}, ` : ''}reads [${f.reads.join(', ')}]. ${f.label}. Reference: \`${(f.reference || 'docs/FORMATS.md').replace(/^docs\//, '')}\`.`).join('\n')}

## Files in this folder

- \`vulcano.html\` — the compiled tool with its starter database and no project. Open it and drop
  \`../dedalo/wallbox.html\` on it.
- \`FORMATS.md\`, \`DATA-FILES.md\`, \`KB-FORMAT.md\` — the references of what VULCANO writes and reads.
- \`wallbox-quote.json\`, \`wallbox-rfi.json\`, \`wallbox-sequence.json\` — sample envelopes from the
  wallbox showcase, with every slot assigned to the top-ranked row of the starter database
  (indicative prices), every multi-point instrument routed with the top-ranked relay part, and
  the rule errors taken as questions: ground truth for a satellite reading VULCANO's output.
- \`wallbox-job.json\` — the job of the same, without the pictures; \`starter-db.json\` — the
  starter database as a \`vulcano-db/1\` file.
`;
  await writeFile(join(out, 'VERSION.md'), version, 'utf8');
  console.log(`${out} refreshed: vulcano.html, VERSION.md, 3 references, 5 sample files.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
