# VULCANO

*Testbench dev. advisor*

A tool for people who develop electronic test machines — the same audience DEDALO writes
specifications for. It reads a test specification written in DEDALO and helps whoever
receives it get from that document to a priced, well-understood, technically settled test
bench:

- the specification is turned into **requirements** — one slot per resource, per contact
  type, per physical action, per software effort, per bench item — and every slot starts
  empty;
- you **assign** to each slot what realises it from a **database you own** — instruments,
  parts, rates, standard items, with their pictures in a folder beside the file — edited in
  the tool, helped by a ranking of what fits but never chosen for you; an instrument takes its
  routing over the points and its accessories the same way;
- the **quote** is the sum of the assignments and of the lines you add or accept from the
  usual cost patterns, with markup, contingency and discount;
- the **questions** the rules and the specification's notes raise are proposed, not imposed:
  you take the ones that matter and send them back up the chain;
- accuracy, hierarchical checklists, the specification's tables, the exports for software and
  harness, and the prompts for an external AI stay in the background.

Like a DEDALO document, the HTML file carries its own data — the database and the project —
and saves itself: one file, opened by double click, no network, no account, no AI dependency.

## Getting started

```bash
npm install
npm run build      # → dist/vulcano.html
npm test
```

Open `dist/vulcano.html` and drop a DEDALO document on it. `docs/USER-GUIDE.md` walks through
the five pages; `docs/SCOPE.md` is the original catalogue of what the tool answers;
`docs/FORMATS.md`, `docs/DATA-FILES.md` and `docs/KB-FORMAT.md` describe what the tool writes
and reads.

Part of the HeronForge family; shared conventions and cross-project checkpoints live in the
sibling repo `heronforge-kb` (see `CLAUDE.md`). Written by D. Tracchi with the assistance of
Claude (Anthropic); MIT licence.

## Status

0.5.0 — the tool as described above, on DEDALO's wallbox showcase: import of the three DEDALO
formats and the document itself, requirements and assignments with routing and accessories,
the database with its five tables and its pictures, the quote — with its own registry data
(your company, the client, its number and terms) and exports to Word, PDF and JSON — the
proposed questions with the rule set, the checklist tree, the accuracy check, the exports
(sequence skeleton, limits table, signal list), the AI prompts, in a window laid out as
DEDALO's, always one click from the project, and a way to move to a newer build when you ask (File ▸ Check for updates…: a new file with your work inside, nothing checked on its own). What SCOPE.md lists as tier 2 (effort and lead
time, delta quote between revisions, throughput, statement of work, traceability, probe map…)
follows in the order the first users ask for it.
