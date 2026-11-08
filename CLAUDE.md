# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

**VULCANO** — "Testbench dev. advisor", a tool for people who develop electronic test
machines. It reads a test specification written in DEDALO, turns it into requirements — one
slot per resource, contact type, physical action, software effort, bench item — and lets the
user assign to each slot what realises it from a database they own (instruments, parts,
rates, standard items), helped by a ranking but never chosen for. The quote is the sum of the
assignments; the questions the rules raise are proposed, not imposed; accuracy, checklists and
exports stay in the background. One self-contained HTML file that, like a DEDALO document,
carries its own data — the database and the project — and saves itself. `docs/SCOPE.md` is
the original catalogue of tools and priorities (still the map of what the tool answers, even
where the interaction changed); `docs/USER-GUIDE.md` is the walkthrough of the tool as built.

## The HeronForge ecosystem

VULCANO is a satellite of DEDALO in a family of tools that share conventions but not code or a
repo. What they share lives in a sibling repo, `../heronforge-kb/` (relative to this repo's
parent directory):

- `../heronforge-kb/KB.md` — conventions stable across the family (git identity, licensing,
  versioning philosophy, writing register). Read it once; it is not something to re-check on
  every task.
- `../heronforge-kb/ALIGNMENT.md` — an append-only, dated, newest-first log of cross-cutting
  checkpoints. **Before non-trivial work on this repo, check it for entries you have not yet
  accounted for** (a project memory can track the last entry seen) and flag anything relevant
  to the user before proceeding.
- `../heronforge-kb/interchange/dedalo/` — a snapshot of DEDALO's compiled output
  (`wallbox.html`, `IMPORT-GUIDE.md`, `VERSION.md`) to test against when reading a specification
  DEDALO produced. Use it instead of depending on DEDALO's source: the reader, the derived
  tables and the rules are all tested against `wallbox.html`, and the DEDALO semantics VULCANO
  mirrors (bench count, cycle time, codes, variants, migrations) were ported from that compiled
  file, not from DEDALO's repo.
- `../heronforge-kb/interchange/vulcano/` — the snapshot of VULCANO's own compiled output for
  whatever satellite reads *its* output: `vulcano.html`, `VERSION.md`, `FORMATS.md` and sample
  envelopes produced from `wallbox.html`. `npm run snapshot` refreshes it. **Update it as part
  of any change to what VULCANO writes** (a format version, a field of an envelope), together
  with an `ALIGNMENT.md` entry — not as a separate follow-up task.

## Commands

```bash
npm install          # once: esbuild is the only dependency
npm run build        # src/ → dist/vulcano.html (add --min to minify); refreshes docs/examples/
npm test             # node --test test/*.test.js (skips the wallbox tests if ../heronforge-kb is missing)
npm run snapshot     # build, then copy the compiled file, VERSION.md, FORMATS.md and sample envelopes to ../heronforge-kb/interchange/vulcano/
```

`dist/` is gitignored; `main` carries only what a build needs (and `update.json`, which the
build writes). **Releasing** follows the pattern's «Releasing» section: bump `APP_VERSION` with
a `CHANGELOG` entry, keep `package.json` **and `package-lock.json`** on the same number, build
(rewrites `update.json`), test, commit and push `main`, publish `dist/vulcano.html` to
`gh-pages` as `vulcano.html` (the build the announcement names) beside `site/index.html` as
`index.html` (the landing page — simple for now) and an empty `.nojekyll`, from a throwaway
worktree so the two branches never mix on disk, then **verify the live site
serves the number `update.json` announces** — the one failure mode of the design is an
announcement whose build is not published.

To try the app on the showcase without a file dialog, serve the parent directory and open
`…/Vulcano/dist/vulcano.html?open=/heronforge-kb/interchange/dedalo/wallbox.html`
(`.claude/launch.json` has a `static` server for this; `?open=` only works when served, never
from `file:`).

## Architecture

Vanilla ES modules, no framework, bundled by esbuild into one HTML file (`build/build.mjs`
inlines `src/styles/*.css` and the bundle into `src/index.html`, which carries the two empty
data blocks `vlc-db` and `vlc-job`). The model layer has no DOM and runs in Node, which is
how it is tested.

- `src/version.js` — `APP_VERSION` (build, with `CHANGELOG`), `JOB_SCHEMA_VERSION` and
  `DB_SCHEMA_VERSION` (the shapes inside the file), `FORMATS` (interchange versions written and
  read; DEDALO's read-only), `DEDALO_SCHEMA_MAX`.
- `src/io/` — `dedalo.js` reads the DEDALO document (`.html`), `tsw-export/1`,
  `tsw-authoring/1` (via `authoring.js`, a port of DEDALO's importer) and `tsw-notes/1`;
  `file.js` is the self-saving file (shell captured at boot, the two blocks rewritten on save)
  and the `vulcano-job` envelope; `exports.js` CSV, XLSX (own ZIP writer), JSON, file names;
  `docx.js` the quote as a Word document (its own small OOXML writer over `exports.js`'s ZIP,
  ported from DEDALO's — see its compiled `src/export/docx.js` — trimmed to what an offer
  needs: no cover page, no header/footer, no images); `update.js` moving to a newer build
  (File ▸ Check for updates…) — the family's pattern, `../heronforge-kb/patterns/self-update.md`,
  DEDALO 1.38.0 being the reference: the logic is here with no DOM and tested
  (`test/update.test.js`), the dialog is `src/ui/update.js`, `composeInto` in `file.js` writes
  the data into any build. Its four rules are not preferences: nothing ever checks on its own
  (no startup check, no setting that could enable one), the only thing stored is the date of
  the last check (`vlc.update.checked`), the update is a new file and the one in hand is never
  touched, unsaved work is settled first. `build/build.mjs` writes `update.json` at the root
  from `version.js` on every build; it is tracked on `main`, never edited by hand.
- `src/model/` — DEDALO semantics (`schema.js`, `spec.js`, `stages.js`), the derived tables
  (`derived.js`), records and the condition language (`entities.js`, `conditions.js`), the
  rule engine (`rules.js`), **`db.js`** (the database: tables, starter set, import/export per
  table, the rankings that help a choice — an instrument, a part, a routing — and `company`,
  your own registry data, kept with the database because it is yours across every job),
  **`project.js`** (requirements from the derived tables, assignments with the routing and
  accessories of an instrument, quote lines and the offer's own registry data — `quote.details`,
  the client and the terms, per job — the few calculations, the recap of the Project page,
  suggested lines from the cost patterns), `accuracy.js` (per resource what the criteria demand, per criterion what the
  assignment resolves), `checklists.js` (the tree), `questions.js` (proposals taken into the
  list, RFI envelope), `software.js` and `signals.js` (exports), `text.js` and `prompts.js`,
  and `session.js` — the tool in memory: `db`, `job`, `recompute()` after the specification
  changes, `touch()` after the project changes, `specText` (the raw text of the specification
  when it was the DEDALO document itself — session-only, never in the file or a JSON export,
  so a resource's «Open in the specification» has something to open without doubling this
  file's size).
- `src/kb/` — the knowledge base as data (`docs/KB-FORMAT.md`): rules (with code),
  checklists, calculations, cost patterns, prompts, reference data (instrument classes,
  contact types — what the starter database is built from), examples.
- `src/ui/` — `app.js` (the shell, laid out as DEDALO's: command bar with Save and the File
  menu, sections panel that slides in or stays pinned, crumbs, status row; the file actions),
  `dom.js`, `images.js` (pictures: thumbnails, the lightbox, the IMG folder beside the file),
  `sections/common.js`, and five pages: `project.js` (the recap, the slot tables, the pickers,
  the routing and accessories of an instrument), `quote.js`, `questions.js` (proposed / my
  list), `database.js` (the editable tables), `advanced.js` (checklists, accuracy,
  specification tables, exports, AI prompts, about). Every action goes through `ctx.update()`
  and re-renders; a file dialog's callback re-renders when the file arrives, not when the
  dialog opens.
- `test/` — `node --test`; `helpers.js` locates `wallbox.html`; the fixture is DEDALO's
  worked authoring example.
- `docs/` — `SCOPE.md`, `USER-GUIDE.md`, `FORMATS.md`, `DATA-FILES.md`, `KB-FORMAT.md`,
  `examples/` (generated by the build from `src/kb/examples.js`).

## Conventions specific to this repo

- The DEDALO semantics mirrored here (`schema.js`, `stages.js`, `derived.js` resource summary
  and cycle time, `authoring.js`) must match DEDALO's compiled output to the letter; when
  DEDALO's `interchange/dedalo/VERSION.md` moves, re-read the compiled file and re-port before
  raising `DEDALO_SCHEMA_MAX` or the `tsw-*` read versions.
- VULCANO's own numbers — the refined channel count, the seeded instruments, the accuracy
  verdicts — are downstream of DEDALO's and say so in their assumptions; DEDALO's count is
  always shown beside the refined one.
- Knowledge lives in `src/kb/` as data with `source` and `added` on every item. A new rule,
  checklist item or guide goes there, not into a tool's code; if it can be declarative
  (`when`/`trigger` + templates), write it so, because that is the format users extend.
- Nothing is assigned, added or listed by itself: requirements are slots, findings are
  proposals, cost patterns are suggestions with an *Add* button. Help is a ranking with its
  reasons, everything stays available. Every output records the specification revision (`spec`
  in the envelope header); what the specification did not say becomes a proposed question,
  never a silent guess.
- The interface rule: the chrome looks and behaves like DEDALO's (dark bar, 💾 Save that turns
  orange when unsaved, File ▾ menu, ☰ Sections drawer with a pin, status row, 📄 back to the
  project from anywhere — DEDALO's side rail back to the document) — port from the compiled
  `wallbox.html`, do not invent; five pages; on each, what answers its question first, the rest
  behind «Details» and «more»; accuracy and checklists stay on the Advanced page; no variant
  selector (a bench is built for every variant). Quantities the tool proposes are fields the
  user edits: contacts one per point applied on, instruments one each with the routing added by
  hand. The quote exports the way DEDALO's document does — Word (.docx, its own OOXML writer)
  and Print / Save as PDF, DEDALO's own wording — carrying the offer's registry data
  (`db.company`, `job.quote.details`) alongside the specification's. What unfolds from a slot
  (a picker, a fuller picture, a routing/accessory line) reads as one graphic language: the
  rail and tint colour say the *kind* of panel (rust `--accent` = a picker, blue `--info` = a
  read-only fuller picture, green `--ok` = already part of the assignment), indentation and a
  stronger tint (`--accent-deep`, `--info-deep`) say how *deep* it is nested — keep new
  expandable panels inside that same language rather than another shade of grey.
- Pictures are never embedded: a row's `image` is a file name in the `IMG` folder beside the
  HTML file (`src/ui/images.js`); the file stays one file, the folder travels with it.
- Prose reaching the user (rule messages, questions, assumptions, in-app copy) is written for
  the bench builder, in plain sentences; code comments say why.
- Commit as `HeronForge <329209718+HeronForge@users.noreply.github.com>` (set locally in
  `.git/config`, see `../heronforge-kb/KB.md`).
