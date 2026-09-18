# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

**VULCANO** — a tool for people who develop electronic test machines. It starts from a test
specification (the kind DEDALO produces) and generates preventivi (quotes), and other outputs
still to be scoped. Everything below the "Status" line is a placeholder to fill in as the
project takes shape — architecture, tech stack, module layout and commands are not decided yet.

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
  DEDALO produced. Use it instead of depending on DEDALO's source. VULCANO's own compiled
  output, once it has one, should get a matching `../heronforge-kb/interchange/vulcano/` folder
  for whatever satellite reads *its* output — update it as part of any change to what VULCANO
  writes, not as a separate follow-up task.

## Status

Scaffolding only, created 2026-09-18. Nothing below this line exists yet:

- Architecture / tech stack
- Build and test commands
- Module layout
- Versioning scheme (see `../heronforge-kb/KB.md` for the family's default: build number +
  data-shape version + interchange format version, moving independently)
