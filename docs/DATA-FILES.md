# VULCANO — the database and its files

The database is what the builder owns and picks from. It lives inside the HTML file (the
`vlc-db` block, see `FORMATS.md`), is edited on the Database page, and is imported and
exported table by table or as a whole. The tool ships with a starter set drawn from its
knowledge base — generic instrument classes and the usual parts, rates and items, with
**indicative prices, marked as such** — to be replaced by what you buy and charge. Example
files are in `docs/examples/` and downloadable from each table.

## The whole database — `vulcano-db/1`

```json
{ "format": "vulcano-db/1", "application": "VULCANO", "applicationVersion": "0.4.0", "exported": "2026-09-19",
  "db": { "version": 1, "name": "My database", "currency": "EUR",
    "company": { "name": "Acme Test Systems Srl", "address": "…", "vat": "IT01234567890", "contact": "…", "email": "…", "phone": "…", "website": "…" },
    "instruments": [], "parts": [], "rates": [], "items": [], "checklists": [] } }
```

Importing it replaces the whole database. Rows keep their ids, so a job saved against one copy
of the database still finds its assignments in another that came from the same export.
`company` is your own registry data — who issues a quote — edited on the Database page (also,
for convenience, on the Quote page): it travels with the database, not with any one job, so it
is filled in once and reused on every quote. Every field is optional text.

## Instruments — `vulcano-catalogue/1`

```json
{ "format": "vulcano-catalogue/1", "name": "…", "currency": "EUR",
  "instruments": [
    { "id": "ins_dmm_a", "name": "Bench DMM 6½ digits", "maker": "Acme", "model": "DM-6500", "category": "Electrical measurement", "classId": "dmm-6.5",
      "channels": 1, "interfaces": "USB, LAN", "accuracy": 0.0035,
      "characteristics": "DC voltage 0 … 1000 V; AC voltage 0 … 750 V; Resistance 0 … 100 MΩ; Accuracy ±0.0035 %",
      "accessories": "Test lead set 60; Rack mount kit 110; Multiplexer card, 20 channels 950", "image": "dm-6500.jpg",
      "price": 1650, "leadTimeWeeks": 3, "notes": "driver in the house library" } ] }
```

- `category` and `characteristics` are what the picker ranks against a resource: same
  category, words of the resource's name, and a range that covers the resource's stated range
  (compared by name, else by unit family). `classId`, the id of a knowledge-base instrument
  class (`src/kb/reference.js`; the starter rows carry it), adds the class's fit to the
  ranking and its per-quantity accuracy to the advanced check.
- `accuracy` is the percent of reading on the main quantity; the accuracy check uses it when
  the instrument is assigned.
- `characteristics` is one text field, `name value unit` pairs separated by `;`. The export
  writes it as a list of `{ name, value, unit }` and the import reads either; the import also
  reads the 0.1.0 shape (a list, `accuracy` as a list per quantity, `interfaces` as a list).
- `accessories` is what can be ticked when the instrument is assigned — a rack mount kit, a
  communication interface, a multiplexer card, a lead set — stored as `name price` pairs
  separated by `;` (a trailing number is the price). The export writes it as a list of
  `{ name, price }` and the import reads either. The Instruments table edits it one accessory
  at a time — a chip per accessory with its price and a way to remove it, a small form to add
  another — never as raw text.
- `image` is the file name of the row's picture — see *Pictures* below. Optional, as
  `accessories` is: a file without them still reads.

## Parts and contacts — `vulcano-parts/1`

```json
{ "format": "vulcano-parts/1", "name": "…", "currency": "EUR",
  "parts": [ { "id": "prt_probe_13", "name": "Spring probe Ø 1.3 mm, wired", "kind": "probe", "matches": "Ø 1.3, 1.3 mm, spring probe", "current": 3, "resistance": 0.03, "life": 1000000, "channels": null, "image": "", "price": 12, "notes": "" },
             { "id": "prt_relay_card_16", "name": "Relay multiplexer card, 16 channels, 2-wire", "kind": "relay", "matches": "", "current": 2, "resistance": 0.1, "life": 10000000, "channels": 16, "image": "", "price": 680, "notes": "" } ] }
```

- `kind`: `probe`, `clip`, `connector`, `cable`, `actuator`, `relay`, `sensor`, `other`.
- `matches`: comma-separated words looked for in the contact type of a point («Ø 1.3 mm
  spring probe») or in the verbs of an action; the more words match, the higher the rank.
- `current` (A) against the current the points carry; `resistance` (Ω) feeds the accuracy
  check; `life` is the cycle life. Parts of kind `relay` come first when a routing is added
  to an assigned instrument; `channels` is what one of them switches, so the quantity
  suggested follows the points (one relay per point, one 16-channel card for up to 16).

## Rates — `vulcano-ratecard/1`

```json
{ "format": "vulcano-ratecard/1", "name": "…", "currency": "EUR",
  "rates": [ { "id": "rat_software", "label": "Software engineering", "unit": "h", "price": 80 } ] }
```

The software slots and the suggested effort lines are priced with them. The suggested lines
look for `rat_hardware`, `rat_software`, `rat_mechanical`, `rat_test`, `rat_management`,
`rat_onsite`; a rate with another id is used wherever you pick it.

## Standard items and services — `vulcano-items/1`

```json
{ "format": "vulcano-items/1", "name": "…", "currency": "EUR",
  "items": [ { "id": "itm_safety", "name": "Safety circuit: interlocked guard, safety relay, e-stop", "kind": "safety", "unit": "set", "price": 1400, "image": "", "notes": "" } ] }
```

`kind`: `bench`, `safety`, `fixture`, `software`, `service`, `other`. The bench slots of the
project offer the items of their kind first.

## Pictures — the `IMG` folder

A row of the Instruments, Parts and Items tables can carry a picture. It is **not embedded**:
`image` is the name of a file in a folder named `IMG` beside the HTML file (`IMG/dm-6500.jpg`),
and the picture shows as a thumbnail wherever the row appears — the Database table, the
pickers, the Project slots, the quote — and enlarges on click. The folder travels with the
file: keep it next to the HTML when you move or send it (a freshly downloaded copy in
*Downloads* shows placeholders until it sits beside its `IMG`). *Pick…* on the Database page
asks once for the folder and copies the chosen picture into it where the browser can write
into a folder (Chrome, Edge); elsewhere it fills in the name and tells you to copy the file by
hand. Exports and imports carry the name only.

## Your checklist items

Rows of the `checklists` table of the database: `discipline` (`bench`, `hardware`, `software`,
`fixture`, `services`), `situation`, `title`, `why`, and `when` — comma-separated words; the
item applies to a job when the specification mentions one of them, or always when blank.
They join the built-in tree on *Advanced › Checklists*. The table imports a `vulcano-kb/1`
file's `checklists` list too (the declarative trigger is reduced to its words).

## Notes that travel with the specification — `tsw-notes/1`

DEDALO writes the notes of a specification (TO CHECK, CONDITION, left out) to a file beside
it. Dropped on VULCANO with the specification open, they are proposed on the Questions page.
The file must belong to the open specification (same document code, or same title).
