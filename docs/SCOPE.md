# VULCANO — scope: the tools it offers

VULCANO starts from a test specification written in DEDALO and helps whoever *receives* it get
from that document to a priced, well-understood, technically settled test bench. This document
defines the tools the system should offer, what each one reads from the specification, what it
produces, and in which order they are worth building. Architecture and tech stack are a
separate decision and are not made here.

Two things are the heart of the system and everything else serves them:

- **the quote** — not a price list filled in, but a guided path from the specification to a
  technical solution and its cost, with the trade-offs made visible;
- **the open questions** — the gaps, contradictions and unstated assumptions of the
  specification, found proactively and put in front of the reader before they become a wrong
  quote or a wrong bench.

## 1. Who receives a specification

In practice the specification travels down a chain: the final customer writes it (or has it
written) and sends it to a contract manufacturer, who subcontracts the test bench to a bench
builder — sometimes only the construction, sometimes design and construction together. Inside
the builder, the hardware, software and mechanical developers each read the same document for
their own part.

VULCANO does not model these as roles: the same person is often two links of the chain, and the
split between the links changes from one job to the next. Instead, each tool answers one
**question asked of the specification**, and the catalogue notes who *typically* asks it. Any
reader may use any tool.

## 2. Principles

- **Reads DEDALO's interchange, never its source.** Input is `tsw-export/1` (preferred: it
  carries images and revision history) or `tsw-authoring/1`, as documented in
  `../heronforge-kb/interchange/dedalo/`. A newer format version is refused with a reason; an
  older one is upgraded on read and says so. `wallbox.html` in that folder is the ground truth
  a reader is tested against.
- **Downstream of DEDALO, not a duplicate of it.** DEDALO already computes the cycle time
  estimate, the bench count (instrument channels needed at once, including held stimuli and
  the points an interface is wired to), the stage graph, the KPI list, validation and the
  difference between revisions. VULCANO takes those as the *starting point* and goes further
  down: the technical solution, its cost, and the questions the specification leaves open.
- **Knowledge lives inside the tool.** Checklists, decision guides, rules of thumb, reference
  calculations and the questions an experienced bench builder asks are part of VULCANO, kept
  as data (see §6) so they grow case by case without touching the code. This is what makes
  the tool an *advisor* rather than a calculator.
- **No AI dependency.** Everything VULCANO decides, checks or computes works offline and
  deterministically. Where a language model would genuinely help — reading between the lines
  of a specification, drafting questions in the customer's tone — VULCANO writes a
  **structured prompt** the user pastes into whatever external AI they use, and reads the
  answer back as text or JSON. No API keys, no network calls.
- **Nothing invented.** Every output states its assumptions and lists what the specification
  did not say — the same rule DEDALO's import follows. A quote with ten declared unknowns is
  useful; one with ten silent guesses is dangerous.
- **VULCANO's own data lives outside the tool.** Price lists, rate cards, an instrument
  catalogue, the builder's own checklists: user-owned files in a versioned format of their
  own, loaded beside the specification, never baked into the tool and never committed to the
  repo. The knowledge base shipped with the tool is the default they extend.
- **Smallest runtime that does the job** (see `../heronforge-kb/KB.md`): a self-contained HTML
  file opened by double click is the bar, unless a tool genuinely needs more.
- **Every output that another tool may read is a versioned JSON envelope**, and gets a snapshot
  in `../heronforge-kb/interchange/vulcano/` as part of any change to it.
- **Every output records the specification revision it was produced from.**

## 3. What the specification provides, and what VULCANO builds on it

The entities VULCANO reads, as `IMPORT-GUIDE.md` defines them:

| Entity | What VULCANO takes from it |
|---|---|
| `header`, `description`, `references`, `glossary` | identity of the job, revision, acceptance rules that apply to everything, documents the spec depends on |
| `variables`, `variants` | values that change per product version; which stages a variant excludes |
| `resources` (+ `characteristics`, `category`, `averageTime`) | the instruments the bench must provide and what each must be able to do |
| `interfaces` (+ `parameters`, `resource`, `points`) | buses, their electrical parameters, the instrument that speaks them |
| `commands`, `protocols` (+ formats, `decoding`, `nominalTime`, `negativeResponse`, `reference`) | what the bench software must send and decode; what is defined only elsewhere |
| `images`, `points` (+ `connector`, `pin`, `signal`, `contactType`, `characteristics`, `markers`) | where the bench touches the unit and how |
| `stages` (test/setup, `prerequisites`, `parallel`, `heldStimuli`), `tests` (`kpi`), `steps` (stimulus / measurement / table / computed / stage call, `wait`, `expected`) | the sequence, its constraints, every acceptance criterion |
| the notes file (`tsw-notes`): `TO CHECK`, `CONDITION`, `left out` | what the author of the specification already knows is open |

### 3.1 The derived tables

Three tables are computed from the specification once and shared by every tool:

- **resource / channel table** — each resource, the steps and points that use it, the channels
  needed at once (from DEDALO's count), the stages that share it;
- **point / resource table** — each application point, its characteristics, every resource and
  interface that touches it;
- **criteria table** — every measurement with its expected value, unit, comparison and
  variable reference, one column set per variant.

### 3.2 The realisation model

The specification says what the bench must *do*; it never says how. Between the derived
tables and the quote sits the **realisation model**: VULCANO's own description of the bench
being designed, which starts as a copy of what the specification implies and is refined by the
user until it describes the real machine.

It holds, per discipline, the elements the specification does not know about:

- **instrumentation** — the chosen instrument (or class) for each resource, its real channel
  count and accuracy, what is shared and what is dedicated, spare channels;
- **signal path** — switching (relays, matrices, multiplexers), signal conditioning, loads,
  protection, isolation, cable runs, the interface board; each element with what it adds to
  the measurement (contact resistance, leakage, bandwidth, settling time);
- **fixture and mechanics** — probe types and counts, receptacles, connectors, actuators,
  presence and safety devices, the fixture frame, the handling concept;
- **software** — the sequencer and framework, drivers to write or buy, the report format, the
  MES/traceability link, calibration and self-test routines;
- **bench** — enclosure, power distribution, safety (interlocks, emergency stop, categories),
  environment, the operator station;
- **services** — design, build, debug, FAT/SAT, documentation, training, spares.

Every element carries a *quantity*, a *driver* (the specification entity or the user's
decision that made it necessary), a *cost basis* (rate card entry or manual), and any
*open question* attached. The channel counts of the specification are the seed; the model is
where they are refined into what will actually be built. The quote (A1) is a view over this
model; the HW/SW/mechanics tools (C, D, E) are the places where it is filled in.

## 4. The catalogue

Each tool: the question it answers · who typically asks · what it reads · what it produces ·
what it needs beyond the specification · tier. Tiers: **1** first release, **2** next,
**3** to be evaluated.

### A. "What is the right solution, what does it cost, and how long does it take?"

**A1 · Quote (preventivo)** — tier 1, the centre of the system
- *Asks*: the bench builder answering the contract manufacturer; the contract manufacturer
  pricing the job for the customer.
- *Reads*: the derived tables, DEDALO's bench count and cycle time, the realisation model,
  the rate card.
- *Produces*: a structured quote, one section per discipline, built over the realisation
  model: each line carries its driver in the specification (or the decision that created it),
  the assumption made, and a confidence. A closing section lists the open questions (B) that
  affect the price and what each does to it. Exported as print/PDF, XLSX and a
  `vulcano-quote/1` envelope.
- *Needs*: the rate card (F2). Without one, the quote still lists every line with its driver
  and quantity, price blank — a bill of quantities is already useful.

**A2 · Guided solution finding** — tier 1
- *Asks*: whoever has to decide *how* to build before saying how much.
- *Reads*: the derived tables and the knowledge base (G).
- *Produces*: for each decision the specification forces — which instrument class for a
  resource, whether to switch or dedicate channels, which contact type a point really needs,
  whether a stage is worth running in parallel, whether a table step needs a matrix — a short
  guided path: the question, the options the knowledge base knows, the criteria that
  discriminate (accuracy, speed, cost, risk, availability), and the choice recorded in the
  realisation model with its reason. Not a wizard to be walked once: any decision can be
  reopened, and the quote recomputes.

**A3 · Trade-off evaluation** — tier 1
- *Asks*: the same people as A2, when two solutions are both plausible.
- *Reads*: the realisation model with two or more alternatives for the same decision.
- *Produces*: the alternatives side by side — cost, cycle time impact, accuracy margin,
  development effort, risk, what each one leaves open — with the simplified calculations
  behind each number shown, so the reader can argue with them. The chosen alternative is
  written back to the model; the others stay recorded as considered.

**A4 · Accuracy and precision requirements** — tier 1
- *Asks*: whoever has to choose an instrument, and whoever has to defend a tolerance.
- *Reads*: the criteria table (tolerances, limits, units), the realisation model (instrument
  accuracy, signal path contributions).
- *Produces*: for each criterion, the simplified calculation from tolerance to required
  measurement uncertainty: test uncertainty ratio, guard band if the reader wants one, the
  contributions of the chosen instrument and of the signal path, and a verdict — adequate,
  marginal, inadequate — with the margin. Aggregated per instrument, it says which
  accuracy class a resource really needs, which is often the single most expensive
  decision in the quote. Criteria the specification gives with no tolerance become open
  questions (B1).

**A5 · Effort and lead time** — tier 2
- *Asks*: whoever has to commit to a delivery date.
- *Reads*: the realisation model, the rate card's effort parameters.
- *Produces*: hours per discipline and a rough timeline — design, build, software, debug,
  FAT/SAT — with the assumptions stated.

**A6 · Delta quote between revisions** — tier 2, depends on F4
- *Asks*: whoever receives revision *n+1* after quoting revision *n*.
- *Reads*: two revisions of the specification (or DEDALO's own diff), the earlier realisation
  model and quote.
- *Produces*: which model elements and quote lines move, by how much and why, line by line;
  decisions made in A2 that the new revision invalidates are flagged for reopening.

**A7 · Throughput and number of stations** — tier 2
- *Asks*: the contract manufacturer sizing the line.
- *Reads*: DEDALO's cycle time estimate, the realisation model's own additions to it
  (handling, switching, settling), the required volume or takt entered by the user.
- *Produces*: stations needed, shifts, whether parallel benches or parallel stages pay off;
  feeds the quantities of A1 and a trade-off in A3.

### B. "What is the specification not telling us?"

**B1 · Open questions (RFI list)** — tier 1, the second centre of the system
- *Asks*: everyone, before quoting and before building — and again at every revision.
- *Reads*: the notes file (`TO CHECK`, `CONDITION`, `left out`); the derived tables; the
  realisation model; the findings of B2 and B3.
- *Produces*: one numbered, living list of questions, each with where it comes from (the
  specification element, the rule that raised it, or the person who wrote it), why it
  matters (what it blocks: a price line, an instrument choice, a fixture decision), its
  status (open, asked, answered, waived) and the answer once it comes. Grouped by chapter of
  the specification for sending back up the chain; exportable as a document and as a
  `vulcano-rfi/1` envelope, reloadable so the answers travel with the job.
- *Needs*: nothing beyond the specification for the first pass.

**B2 · Gap and consistency analysis (rule-based, no AI)** — tier 1
- *Asks*: everyone; runs by itself on import and on every change.
- *Reads*: the whole specification and the derived tables.
- *Produces*: findings, each becoming an open question in B1 unless waived. The rules are
  data in the knowledge base (G) and grow case by case; the first set covers at least:
  - *incompleteness* — measurements with no criterion or no unit; resources with no
    characteristics; variables with no value; points on no image or with no contact type;
    interfaces with no instrument; commands defined only by reference; images declared but
    not uploaded;
  - *inconsistency* — a resource whose characteristics do not cover the values the steps ask
    of it (a 32 V supply asked for 48 V); a point whose max current is below what a stimulus
    applies; a criterion tighter than the unit of the value allows; a variable used in a
    range its type forbids; a variant that excludes a stage another stage depends on;
    a held stimulus never released; a setup stage never called; a stage nothing depends on
    and nothing can run alongside;
  - *unstated assumptions* — no temperature or environment; no statement on what happens
    on failure; no serial-number or traceability requirement; no calibration requirement;
    no statement of who supplies the DUT harness or the golden sample; no stated production
    volume; safety of high-voltage or high-current stimuli not addressed;
  - *cost drivers hidden in plain sight* — a single very tight tolerance that forces an
    instrument class; a stage that alone doubles the channel count; a table step with many
    rows on a slow command; a physical action (press, mate, rotate) that needs an actuator
    the resources do not list.
  Every finding says which rule raised it and what element it points at; the reader can waive
  it with a reason, and the waiver is kept.

**B3 · Structured prompts for an external AI (no API)** — tier 1
- *Asks*: whoever wants a second reading of the specification, or help drafting.
- *Reads*: the specification (or a chapter of it), the current open questions, a prompt
  template from the knowledge base.
- *Produces*: a prompt to copy into any external AI, with the relevant part of the
  specification inlined and a required answer format (a JSON list of findings, or plain
  text), plus an importer for the answer that turns each finding into a B1 question marked
  as *AI-suggested* and unverified. Templates at least for: *find what this chapter leaves
  unsaid*; *find contradictions between these two chapters*; *draft these questions for the
  customer in their language and tone*; *given this resource's characteristics and these
  steps, which instrument classes fit and why*. The specification never leaves the machine
  unless the user pastes it somewhere; the tool only prepares the text.

**B4 · Statement of work (capitolato di fornitura)** — tier 2
- *Asks*: the contract manufacturer handing the job to a builder; the builder attaching it to an
  offer.
- *Reads*: header, description, stages and variants, KPI tests, references, the realisation
  model, the answered questions of B1.
- *Produces*: the skeleton of a supply specification — scope (which stages and variants),
  the solution as decided, deliverables, acceptance of the bench (FAT/SAT drawn from the KPI
  tests and the general acceptance rules), documentation, what stays with the customer —
  with the places the user has to fill in marked as such.

**B5 · Scope split** — tier 3
- *Asks*: anyone in a partial subcontracting.
- *Produces*: a marking of which stages, resources, disciplines and model elements each party
  owns; the other tools then filter by it.

**B6 · Offer comparison** — tier 3
- *Asks*: the contract manufacturer with several offers for the same specification.
- *Produces*: a matrix of offers against the specification's drivers, from several
  `vulcano-quote/1` envelopes.

### C. "What hardware do we have to buy or build?"

Tools C, D and E are the places where the realisation model (§3.2) is filled in for each
discipline. Each starts from what the specification implies, lets the reader add every element
the real design needs, and hands the result to the quote.

**C1 · Instrument requirements and selection** — tier 1
- *Asks*: the hardware developer; purchasing.
- *Reads*: resources with characteristics, DEDALO's channel count, the interfaces each resource
  must speak, A4's accuracy verdicts, the instrument catalogue.
- *Produces*: one row per resource: what it must do, how many channels at once, which
  accuracy class A4 demands, which interfaces; the candidate instruments from the catalogue
  checked characteristic by characteristic; the choice recorded in the realisation model with
  its reason (through A2 when the choice is not obvious).

**C2 · Channel and signal-path refinement** — tier 1
- *Asks*: the hardware developer designing the interface board, the switching and the harness.
- *Reads*: the point / resource table, DEDALO's channel count, stages that may run in
  parallel, held stimuli.
- *Produces*: the refined channel count — the specification's seed plus what the realisation
  needs: switching where a point is reached by more than one resource or a resource by more
  than one point, dedicated versus shared channels, spare channels, sense lines, guard and
  shield, conditioning, loads, protection, isolation — each element with its electrical
  constraints (current, voltage, impedance, bandwidth) taken from the point characteristics and
  the stimuli, and with what it adds to the measurement (fed back to A4). The result is the
  I/O budget of the bench and the input of the interface board design.

**C3 · Signal list and pin map** — tier 1
- *Asks*: the hardware developer; the harness maker.
- *Reads*: the refined channel table of C2, points, interfaces.
- *Produces*: the wiring table — point, connector, pin, signal, contact type, characteristics,
  every instrument channel, switch path and interface that reaches it. Exported as CSV/XLSX.

**C4 · Interface and protocol summary** — tier 2
- *Asks*: the hardware developer choosing transceivers; the software developer choosing
  drivers.
- *Reads*: interfaces with parameters, protocols.
- *Produces*: one sheet per interface — bit rate, termination, levels, protocol grammar,
  the instrument that speaks it — and the transceivers or adapters implied, added to the
  realisation model.

**C5 · Bench-level checklist** — tier 2
- *Asks*: the hardware developer; whoever signs the safety file.
- *Reads*: the realisation model, the knowledge base checklists (G).
- *Produces*: the case-specific checklist for the bench itself — power distribution, safety
  (interlocks, emergency stop, high-voltage or high-current stimuli present in the steps),
  earthing, environment, calibration access — each item answered, deferred or made an open
  question, and the elements it implies added to the model.

### D. "What software do we have to write?"

**D1 · Sequence skeleton** — tier 1
- *Asks*: the software developer.
- *Reads*: stages, tests, steps; prerequisites and parallel constraints; setup stages and stage
  calls; held stimuli; waits; the switching of C2 (which becomes steps of its own).
- *Produces*: the sequence structure — stages as sequences, setup stages as callable
  subsequences, tests and steps in order, switching and settling as inserted steps,
  constraints and waits as annotations — as a neutral JSON and as a TestStand-oriented
  structure (DEDALO's comparison set is already the TestStand set).

**D2 · Limits table** — tier 1
- *Asks*: the software developer.
- *Reads*: the criteria table, A4's guard bands if adopted.
- *Produces*: one row per criterion — stage, test, step, quantity, unit, comparison, low, high,
  nominal, tolerance, the variable it follows, the guard-banded limits beside the nominal ones
  — and one column set per variant. CSV/XLSX: the limits file the sequence loads.

**D3 · Command and driver table** — tier 2
- *Asks*: the software developer writing the instrument and DUT drivers.
- *Reads*: commands, protocols, interfaces, the instruments chosen in C1.
- *Produces*: a machine-readable command table (interface, protocol, address, request and
  response formats, encoding, decoding formula and unit, nominal time, negative response) and a
  driver to-do list — DUT commands defined only by reference marked as such, instrument
  drivers to write or buy per chosen instrument — added to the realisation model as effort.

**D4 · Software scope checklist** — tier 2
- *Asks*: the software developer; whoever quotes the software.
- *Reads*: the knowledge base checklists (G), the specification's `description.testing`.
- *Produces*: the case-specific list of what the bench software must also do beyond the
  steps — operator interface, report format, serial-number handling, MES or database link,
  calibration and self-test, failure handling, multi-variant handling, logging — each item
  decided or made an open question, and its effort added to the model.

**D5 · Traceability checklist** — tier 2, depends on F4
- *Asks*: the software developer, and whoever signs off the bench.
- *Reads*: every step; a previously saved checklist.
- *Produces*: specification step against implemented step, with a status per row, keyed on
  DEDALO's identifiers so progress survives a new revision and the rows that changed are marked.

**D6 · Results and report schema** — tier 3
- *Asks*: the software developer; the customer who will read the bench reports.
- *Reads*: steps, KPI flags, computed measurements, the decisions of D4.
- *Produces*: what the bench report must record for each step and what the summary must show.

### E. "What do we have to build physically?"

**E1 · Fixture and probe list** — tier 1
- *Asks*: the mechanical developer; purchasing.
- *Reads*: points with contact type and characteristics; images and markers; actuator-type
  resources; the physical stimuli of the steps (press, mate, rotate, hold).
- *Produces*: points grouped by contact type with force, current and impedance requirements;
  connectors to mate and their cycle life; buttons and areas to press; actuators the steps
  imply even where the resources do not list them; counts per type as the input to a
  mechanical bill of materials, added to the realisation model.

**E2 · Fixture concept checklist** — tier 2
- *Asks*: the mechanical developer drafting the fixture.
- *Reads*: the knowledge base checklists (G), E1, the images.
- *Produces*: the case-specific decisions of the fixture — DUT loading and hold-down, probe
  plate and stroke, connector mating (manual, guided, actuated), presence and orientation
  detection, operator safety, ESD, cable exit, maintenance access — each decided (through A2
  when it is a real choice) or made an open question, with the elements added to the model.

**E3 · Annotated probe map** — tier 2
- *Asks*: the mechanical developer; the fixture supplier.
- *Reads*: images with their markers, points, E1.
- *Produces*: each picture printed with its markers and the point table beside it, as
  print/PDF.

**E4 · Handling and actuation summary** — tier 3
- *Asks*: the mechanical developer; whoever sizes the operator's work.
- *Reads*: stimuli of physical kind, held stimuli, waits, setup stages, E2.
- *Produces*: what the bench must physically do to the unit and in which order, and what the
  operator does by hand.

### F. Cross-cutting

**F1 · Import** — tier 1, prerequisite of everything
- Reads `tsw-export/1` and `tsw-authoring/1`; refuses a newer format with a reason; reports
  what it could not resolve, nothing silently dropped; tested against `wallbox.html`. Runs B2
  on completion.

**F2 · VULCANO data files** — tier 1
- The rate card, the instrument catalogue, and the user's own extensions to the knowledge
  base (G): user-owned, in versioned formats of their own, loaded beside the specification.
  How they are edited (in the tool, or as spreadsheets the tool reads) is an open point (§7).

**F3 · The job file** — tier 1
- One specification, its realisation model, its decisions, its open questions with their
  answers, and its quote: saved together as one job, versioned, reopened as a whole. This is
  what a builder keeps for a job and what A6 compares against.

**F4 · Exports** — tier 1 for the first-release tools
- Tables as CSV/XLSX, documents as print/PDF, and for every output another tool may read a
  versioned JSON envelope (`vulcano-quote/1`, `vulcano-rfi/1`, …) mirrored in
  `../heronforge-kb/interchange/vulcano/`.

**F5 · Revision awareness** — tier 2
- Every output carries the specification revision it came from; opening a job on a newer
  revision reports what changed in the specification, which decisions and questions it
  touches, and what moves in the quote. The basis of A6 and D5.

### G. The knowledge base

Not a tool the user opens, but what makes A2, A3, A4, B2, B3, C5, D4 and E2 more than empty
forms. Kept as data inside the tool, in a format the user can extend from F2, and grown
case by case as jobs are done:

- **checklists** — per discipline and per situation (a high-voltage stimulus is present; a
  CAN interface is present; a table step with many rows; a variant excludes a stage; a
  connector must be mated by the operator…), each item with why it matters and what element
  or question it produces;
- **decision guides** — the options for a recurring choice, the criteria that discriminate
  between them, and the rules of thumb for each (instrument classes per resource category and
  accuracy band; switching topologies; contact types per signal kind; when parallel stages
  pay off);
- **rules** — the gap and consistency checks of B2, each with its rationale and severity;
- **reference calculations** — the simplified formulas of A3 and A4 (uncertainty budget,
  test uncertainty ratio, guard band, settling time from RC, cycle time contribution of
  switching, cost per channel), each shown with its inputs when used, never hidden;
- **prompt templates** — the B3 prompts and the answer formats they require;
- **cost patterns** — the default lines a discipline always carries (design hours per
  channel, debug as a share of build, documentation per stage), as the rate card's default
  structure.

Every item names its source (a standard, the builder's experience, a past job) and the date it
was added; nothing in it is applied without being shown.

## 5. Priority and first release

The first release is **F1, F2, F3**, then the two centres with what they stand on:

- **A1 quote** over the realisation model (§3.2), with **A2 guided solution finding**,
  **A3 trade-offs** and **A4 accuracy requirements**, and the discipline tools that fill the
  model — **C1, C2, C3, D1, D2, E1**;
- **B1 open questions** fed by **B2 rule-based gap analysis** and **B3 structured prompts**;
- **F4 exports** for all of the above, and the first cut of the knowledge base (**G**) with
  enough checklists, rules and calculations to be visibly useful on `wallbox.html`.

The knowledge base is the part that is never finished: the first release ships a base set and
the format to extend it; every job done afterwards is expected to add to it.

Tier 2 follows in the order the first users ask for it; A6 and D5 wait for F5. Tier 3 is
listed so the shape of the system is visible, not as a commitment.

## 6. How the pieces fit

```
DEDALO specification ──F1──▶ derived tables ──▶ realisation model ◀── C, D, E (refine)
        │                        │                     │  ▲
        │                        ▼                     │  │ A2 decisions, A3 trade-offs,
        ├──▶ B2 rules ──▶ B1 open questions ◀──────────┘  │ A4 accuracy
        │                   ▲        │                    │
        └──▶ B3 prompts ────┘        └────────────▶ A1 quote ──▶ F4 exports
                                                       ▲
                     G knowledge base ─────────────────┘ (feeds every guided step)
```

## 7. Open points

- Tech stack and packaging: one self-contained HTML with every tool, or one file per tool
  family. KB.md's bar is the single file; the deciding factors are the size of the knowledge
  base and whether the rate card and instrument catalogue stay comfortable inside it.
- How the rate card, the instrument catalogue and the user's knowledge-base extensions are
  authored: in the tool, or as spreadsheets and JSON the tool reads. The second is closer to
  how a builder already keeps them.
- The format of the knowledge base itself: how a checklist item, a rule, a decision guide and
  a reference calculation are expressed so that they are data, testable, and readable by the
  person who extends them. This is the first design decision after the tech stack.
- Whether the quote's price classes are VULCANO's own vocabulary or follow the categories the
  specification already gives resources.
- What the first satellite reading VULCANO's output will be, which decides which envelope
  (`vulcano-quote/1` and `vulcano-rfi/1` first, most likely) gets designed with care before the
  others.
- Versioning: the family's default (build number, data-shape version, interchange format
  versions, moving independently) is assumed; where the constants live is decided with the
  tech stack.
