# VULCANO — interchange formats

Every output another tool may read is a versioned JSON envelope. The first field says which
format the file is written in — `"format": "vulcano-quote/1"` — followed by the build that
wrote it, the date, and the identity of the specification it came from. A file in a newer
version than the build that opens it is refused with the reason; an older one is upgraded on
read and says so. Versions move independently of the build number (`src/version.js`).

| Format | Version | What it holds | Written by |
|---|---|---|---|
| `vulcano-job` | 1 | the project, for interchange (the HTML file itself is the primary job file) | *File › Export the project (JSON)* |
| `vulcano-quote` | 1 | the quote | Quote › *Quote file* (JSON), *Word (.docx)*, *Print / Save as PDF* |
| `vulcano-rfi` | 1 | the open questions | Questions › *RFI file* |
| `vulcano-sequence` | 1 | the sequence skeleton | Advanced › Exports |
| `vulcano-db`, `vulcano-catalogue`, `vulcano-parts`, `vulcano-ratecard`, `vulcano-items` | 1 | the database and its tables | Database page — see `DATA-FILES.md` |

VULCANO reads, beside its own: `tsw-export/1`, `tsw-authoring/1`, `tsw-notes/1` (DEDALO's,
`../heronforge-kb/interchange/dedalo/`), the DEDALO document itself (`.html`) through its
embedded data blocks, and `vulcano-kb/1` extension files (`KB-FORMAT.md`).

## The file itself

The HTML file carries two JSON blocks, rewritten by *Save*:

```html
<!--VLC:DB--><script type="application/json" id="vlc-db">{ …the database… }</script><!--/VLC:DB-->
<!--VLC:JOB--><script type="application/json" id="vlc-job">{ …the project, or null… }</script><!--/VLC:JOB-->
```

`vlc-db` is the database (`DATA-FILES.md`); `vlc-job` the same object the `vulcano-job`
envelope carries under `job`. A `</script` or `<!--` inside the data is escaped so it cannot
end the block.

## Common header

```json
{ "format": "vulcano-quote/1", "application": "VULCANO", "applicationVersion": "0.4.0", "exported": "2026-09-19",
  "spec": { "documentCode": "TS-EVC-0117", "title": "End of line test specification", "product": "…", "company": "…", "revision": "03", "revisionDate": "2026-09-10", "revisionStatus": "draft" } }
```

`spec` is the identity every output records: which specification and which revision.

## `vulcano-quote/1`

```json
{
  "format": "vulcano-quote/1", "…header…": "", "currency": "EUR",
  "company": { "name": "Acme Test Systems Srl", "address": "…", "vat": "IT01234567890", "contact": "…", "email": "…", "phone": "…", "website": "…" },
  "details": { "number": "Q-2026-014", "date": "2026-09-19", "validity": "30 days", "paymentTerms": "…", "deliveryTerms": "…", "notes": "",
    "client": { "name": "Voltaria Energy S.r.l.", "address": "…", "vat": "…", "contact": "…", "email": "…", "phone": "…" } },
  "sections": [
    { "id": "instruments", "label": "Instruments", "subtotal": 1020, "unpriced": 0,
      "lines": [
        { "id": "res:res_…|item", "reqId": "res:res_…", "section": "instruments", "name": "6½-digit bench multimeter", "qty": 1, "unit": "pc", "price": 1500, "total": 1500, "note": "", "source": "assignment", "image": "dmm.png" },
        { "id": "res:res_…|rt:rt_…", "reqId": "res:res_…", "section": "instruments", "name": "Relay channel on the interface board", "qty": 10, "unit": "pc", "price": 22, "total": 220, "note": "routing of 6½-digit bench multimeter", "source": "assignment", "part": "routing", "image": "" },
        { "id": "res:res_…|acc:Test lead set", "reqId": "res:res_…", "section": "instruments", "name": "Test lead set", "qty": 1, "unit": "pc", "price": 60, "total": 60, "note": "accessory of 6½-digit bench multimeter", "source": "assignment", "part": "accessory" }
      ] }
  ],
  "subtotal": 7312, "markup": 0, "contingency": 366, "discount": 0, "total": 7678,
  "parameters": { "markup": 0, "contingency": 5, "discount": 0 },
  "unpriced": 0, "unassigned": [ { "id": "res:res_…", "label": "Oscilloscope, 4 channels", "group": "instruments" } ],
  "openQuestions": [ { "number": 1, "text": "…", "priceImpact": "" } ],
  "hours": 77
}
```

- `sections[].id`: `instruments`, `contacts`, `software`, `bench`, `services`.
- `source`: `assignment` (from a slot of the project, `reqId` names it), `manual`, `suggested`
  (accepted from the cost patterns, `patternId` names the pattern). An assignment line with
  `part` is what goes with an instrument: its `routing` (relays, a multiplexer card — any row
  of the database, in any quantity) or an `accessory` its row defines. `image` is the name of
  the row's picture in the IMG folder beside the file, when it has one.
- `company` is your own registry data (Database page, kept with the database — the same across
  every job); `details` is this quote's own: its number, date, validity, terms and the client's
  registry data. Both are the offer's references, alongside `spec` (the specification's).
  Every field is optional text; a reader shows what is there.
- `price`/`total` are `null` for a line without a price; `unassigned` lists the requirements
  still empty — a reader must treat the total as partial while it is not empty.
- `markup` is applied to the subtotal, `contingency` to subtotal + markup, `discount` to the
  sum; `total = subtotal + markup + contingency − discount`.

## `vulcano-rfi/1`

The open questions, reloadable: a consumer writes answers and statuses back and VULCANO
merges them by `id` (or by `key`).

```json
{ "format": "vulcano-rfi/1", "…header…": "",
  "questions": [
    { "id": "q_…", "number": 1, "key": "R-CON-02|pt_…|", "chapter": "points",
      "source": { "kind": "rule", "ref": "R-CON-02", "label": "Stimulus above the rating of the point it is applied to" },
      "elementId": "pt_…", "elementLabel": "AP-01 Mains L1",
      "text": "AP-01 Mains L1 is rated Max voltage 300 V AC; T-01.02.01 applies 2500 V AC. Is the rating or the stimulus wrong?",
      "finding": "…", "why": "…", "blocks": ["fixture and probe list"], "status": "open", "answer": "", "waiverReason": "", "priceImpact": "", "severity": "error",
      "ai": false, "verified": false, "informational": false, "created": "…", "modified": "…", "history": [] } ] }
```

- `status`: `open`, `asked`, `answered`, `waived`, `resolved`.
- `source.kind`: `rule`, `note`, `ai`, `checklist`, `tool`, `user`.
- On merge, a status the file has and the open list has not wins; otherwise the later
  `modified` wins.

## `vulcano-sequence/1`

Stages as sequences, setup stages as callable subsequences, tests and steps in order, the
switching steps inserted where the assigned instrument is multiplexed, constraints and waits
as annotations, every criterion with its limits (guard-banded where the accuracy check gives a
guard band), and a TestStand-oriented step type on every step.

```json
{ "format": "vulcano-sequence/1", "…header…": "", "sequencer": "TestStand",
  "main": { "name": "MainSequence", "order": [["STG-01"], ["STG-02"], ["STG-03", "STG-08"]], "note": "…" },
  "stages": [ { "code": "STG-02", "name": "…", "kind": "test", "sequence": "STG_02_…", "prerequisites": ["STG-01"], "exclusions": null, "heldStimuli": [],
    "tests": [ { "code": "T-02.02", "name": "…", "kpi": true, "steps": [
      { "code": "T-02.02.01·sw", "type": "switch", "inserted": true, "name": "Route RES-04 to AP-20", "teststand": { "type": "Action", "module": "Switch.Select" }, "annotations": ["settle 10 ms"] },
      { "code": "T-02.02.01", "type": "measurement", "name": "…", "measurement": { "description": "3.3 V rail", "points": ["AP-20"], "resource": "RES-04", "expected": "3.3 V ± 3 %",
        "limits": { "kind": "numeric", "comparison": "EQT", "unit": "V", "low": 3.201, "high": 3.399, "nominal": 3.3, "tolerance": 3, "toleranceType": "percent", "variables": [], "guarded": { "low": 3.2011, "high": 3.3989, "collapsed": false } } },
        "teststand": { "type": "NumericLimitTest", "comparison": "EQT", "kpi": true }, "annotations": [] } ] } ] } ],
  "setups": [ "…kind «setup»…" ], "variants": [ { "code": "V-03", "name": "EVC-7 S", "excludes": ["STG-09"] } ] }
```

Step `type` is DEDALO's or an inserted kind (`switch`, `wait`); `teststand.type` is
`NumericLimitTest`, `StringValueTest`, `PassFailTest`, `MultipleNumericLimitTest`, `Action`,
`SequenceCall` or `Wait`.

## `vulcano-job/1`

```json
{ "format": "vulcano-job/1", "application": "VULCANO", "applicationVersion": "0.4.0", "saved": "…",
  "job": {
    "version": 1, "name": "TS-EVC-0117",
    "spec": { "source": { "kind": "html", "format": "dedalo-html", "version": 2, "fileName": "wallbox.html" }, "doc": { "…the DEDALO document, schema 2…": "" }, "history": { "revisions": [] }, "assets": {}, "assetsOmitted": true, "notes": [], "problems": [] },
    "assignments": { "res:res_…": { "table": "instruments", "itemId": "ins_…", "qty": 1, "hours": 0, "rateId": "", "none": false, "note": "", "at": "…",
                                    "routing": [ { "id": "rt_…", "table": "parts", "itemId": "prt_relay_channel", "qty": 10, "note": "" } ],
                                    "accessories": [ { "name": "Test lead set", "qty": 1 } ] },
                     "sw:steps": { "table": "", "itemId": "", "qty": 1, "hours": 77, "rateId": "rat_software", "none": false, "routing": [], "accessories": [] } },
    "choices": {}, "lines": [ { "id": "ln_…", "section": "services", "name": "…", "qty": 1, "unit": "pc", "price": 650, "rateId": "", "note": "", "source": "manual" } ],
    "questions": [ "…as in vulcano-rfi…" ], "checklist": { "CL-BENCH-ESTOP": { "done": true, "note": "", "at": "…" } },
    "quote": { "markup": 0, "contingency": 5, "discount": 0, "details": { "number": "Q-2026-014", "date": "2026-09-19", "validity": "30 days", "paymentTerms": "…", "deliveryTerms": "…", "notes": "", "client": { "name": "Voltaria Energy S.r.l.", "address": "…", "vat": "…", "contact": "…", "email": "…", "phone": "…" } } }, "settings": { "turTarget": 4, "guardFactor": 1, "spareShare": 10, "language": "English" }, "created": "…" } }
```

Requirement ids are stable across re-reads of the same specification: `res:<resource id>`,
`pts:<contact type, lower case>`, `act:<first step id>`, `itf:<interface id>`, `sw:steps`,
`sw:drivers`, `sw:variants`, `bench:fixture`, `bench:board`, `bench:frame`, `bench:safety`.
`routing` lists what puts an assigned instrument on its points (rows of any table, `qty`
each); `accessories` the ones ticked among those the instrument's row defines, by name. An
instrument with a routing is treated as switched by the sequence skeleton and the accuracy
path. A 0.2.0 file's `topology`, `relayPartId` and `variantId` are dropped on read (the
version stays 1: nothing had shipped). The DEDALO document inside keeps DEDALO's
`schemaVersion` and is migrated by VULCANO's mirror of DEDALO's migrations when an older
export is opened.
