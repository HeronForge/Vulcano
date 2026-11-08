# VULCANO — the knowledge base format

The knowledge base is what the tool knows on its own: the rules that find what a
specification leaves out or contradicts, the built-in checklists, the reference calculations
of the accuracy check, the cost patterns behind the suggested lines, the prompt templates,
and the reference data (instrument classes, contact types). It is data inside the tool
(`src/kb/`). Every item names its source and the date it was added; nothing is applied
without being shown.

What the user owns — instruments, parts, rates, items, their own checklist items — is not
knowledge base but **database** (`DATA-FILES.md`). A `vulcano-kb/1` extension file adds
declarative rules and checklist items to the built-in ones; an item with a built-in id
replaces it.

## The condition language

Rules and built-in checklist items say when they apply with a condition over the
specification, flattened into records — one per resource, application point, interface,
command, variable, variant, stage, step, stimulus, criterion, and one for the specification:

```json
{ "entity": "resource", "field": "category", "op": "contains", "value": ["Safety"] }
{ "entity": "stimulus", "field": "parameter:Voltage", "op": "gte", "value": 50, "unit": "V" }
{ "entity": "spec", "field": "testing", "op": "missing", "value": ["temperature", "ambient"] }
{ "all": [ { "entity": "point", "field": "contactType", "op": "contains", "value": ["probe"] }, { "not": { "field": "markers", "op": "gte", "value": 1 } } ] }
```

- `entity`: `spec`, `resource`, `point`, `interface`, `command`, `variable`, `variant`,
  `stage`, `step`, `stimulus`, `criterion`. No `field` matches every entity of that type.
- `field`: a plain field of the record, or `characteristic:<name>` (resources, points,
  interfaces) and `parameter:<name>` (stimuli), a quantity by its name as the specification
  writes it.
- `op`: `contains`, `matches` (regular expression), `equals`, `in`, `exists`, `missing`,
  `gte`, `lte`, `gt`, `lt` (numbers in the `unit` given; a range compares by its top end, a
  tolerance by its size; a voltage never compares with a current).
- Templates in messages and questions: `{{field}}`, `{{code}}`, `{{label}}`, `{{name}}`.

| entity | fields |
|---|---|
| `spec` | `title`, `product`, `testing`, `company`, `text`, `resources.count`, `points.count`, `variants.count`, `stages.count`, `images.count`, `interfaces.count`, `commands.count`, `kpi.count`, `steps.count`, `criteria.count` |
| `resource` | `name`, `category`, `notes`, `text`, `characteristic:<name>`, `channels` (wired), `dedaloChannels`, `uses`, `stages`, `interfaces`, `stimulusUses`, `measurementUses` |
| `point` | `name`, `connector`, `pin`, `signal`, `contactType`, `notes`, `text`, `characteristic:<name>`, `markers`, `resources`, `interfaces`, `uses` |
| `interface` | `name`, `type`, `notes`, `text`, `characteristic:<parameter>`, `resource`, `points`, `commands` |
| `command` | `name`, `address`, `requestFormat`, `responseFormat`, `encoding`, `text`, `interface`, `protocol`, `reference`, `nominalTime`, `decodingUnit`, `uses` |
| `variable` | `name`, `type`, `unit`, `value`, `min`, `max`, `description` |
| `variant` | `name`, `description`, `operations` |
| `stage` | `name`, `description`, `kind`, `prerequisites`, `exclusions`, `held`, `tests`, `steps` |
| `step` | `description`, `note`, `type`, `text`, `verbs`, `stage`, `test`, `kpi`, `setup`, `wait`, `rows` |
| `stimulus` | `description`, `text`, `verbs`, `parameter:<name>`, `resource`, `resourceCategory`, `points`, `command`, `table` |
| `criterion` | `quantity`, `text`, `unit`, `code`, `judged`, `twoSided`, `span`, `kpi`, `computed`, `resource`, `command` |

## Rules

Built-in rules carry code (`src/kb/rules.js`); an extension rule is declarative:

```json
{ "id": "X-RULE-01", "title": "Stage with no description", "category": "incompleteness", "severity": "info",
  "rationale": "…", "blocks": ["statement of work"],
  "when": { "entity": "stage", "field": "description", "op": "missing" },
  "message": "{{label}} has no description.", "question": "What is the purpose of {{label}}?",
  "source": { "kind": "experience", "ref": "our benches", "added": "2026-09-19" } }
```

`category`: `incompleteness`, `inconsistency`, `assumption`, `costDriver`; `severity`:
`error`, `warning`, `info`. Every record `when` selects is one finding, proposed on the
Questions page and keyed on rule and element so that taking it twice is once.

## Checklist items

```json
{ "id": "X-CL-01", "discipline": "bench", "situation": "A temperature-related variable exists",
  "title": "Temperature chamber or ambient monitoring for {{name}}", "why": "…",
  "trigger": { "entity": "variable", "field": "unit", "op": "contains", "value": ["°C"] }, "once": false,
  "source": { "…": "" } }
```

One item per matching record (or one for the job when `once` is true or the entity is
`spec`), placed in the tree under `discipline › situation`. The simpler form — words the
specification must mention, or nothing for always — is a row of the database's checklist
table, editable in the tool.

## Reference calculations, cost patterns, prompts, reference data

- Calculations (`src/kb/calculations.js`): each with `formula`, `inputs`, `source` and a
  `compute` that returns the value and its steps; shown wherever a number comes from them.
- Cost patterns (`src/kb/costs.js`): the lines the suggested-lines fold offers, with the
  quantity each follows (`perChannel`, `perStep`, `perStage`, `shareOfBuild`, `fixed`, …).
- Prompt templates (`src/kb/prompts.js`): `{{identity}}`, `{{chapter}}`, `{{chapterTitle}}`,
  `{{chapter2}}`, `{{questions}}`, `{{resource}}`, `{{uses}}`, `{{language}}`,
  `{{answerFormat}}`.
- Instrument classes and contact types (`src/kb/reference.js`): what the starter database is
  built from, what the picker's ranking and the accuracy check refer to.

An extension file cannot add calculations, prompts, classes or contact types in this version;
instruments and parts belong in the database.

## The extension file

```json
{ "format": "vulcano-kb/1", "name": "Our practice", "rules": [ … ], "checklists": [ … ] }
```

Dropped on the window, it is merged over the built-in set for the session; it is not saved
in the file (its checklist items can be imported into the database's checklist table, which
is). The example is `docs/examples/kb-extension-example.json`.
