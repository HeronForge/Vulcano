// The three numbers of the family's versioning, each moving on its own (see
// ../heronforge-kb/KB.md): the build, the job-file data shape, and the interchange formats.

export const APP_NAME = 'VULCANO';
export const APP_TAGLINE = 'Testbench dev. advisor';
export const APP_VERSION = '0.5.0';

export const AUTHOR = { name: 'D. Tracchi', assistedBy: 'Claude (Anthropic)' };
export const LICENSE = { id: 'MIT', name: 'MIT License', copyright: 'Copyright (c) 2026 D. Tracchi', file: 'LICENSE' };

/** Shape of the job inside the file (assignments, lines, questions, checklist, quote parameters). */
export const JOB_SCHEMA_VERSION = 1;
/** Shape of the database inside the file. */
export const DB_SCHEMA_VERSION = 1;

/**
 * Formats this build writes and reads. `writes` is the version written; `reads` the versions
 * still opened (an older one is upgraded on read and says so; a newer one is refused).
 * The DEDALO formats are what VULCANO reads from ../heronforge-kb/interchange/dedalo/; the
 * VULCANO formats are what it writes, mirrored in ../heronforge-kb/interchange/vulcano/.
 */
export const FORMATS = {
  // DEDALO's — read only.
  tswExport: { id: 'tsw-export', label: 'DEDALO data export', writes: 0, reads: [1], owner: 'DEDALO' },
  tswAuthoring: { id: 'tsw-authoring', label: 'DEDALO authoring file', writes: 0, reads: [1], owner: 'DEDALO' },
  tswNotes: { id: 'tsw-notes', label: 'DEDALO notes', writes: 0, reads: [1], owner: 'DEDALO' },
  // VULCANO's own.
  job: { id: 'vulcano-job', label: 'job file', writes: 1, reads: [1], reference: 'docs/FORMATS.md' },
  quote: { id: 'vulcano-quote', label: 'quote', writes: 1, reads: [1], reference: 'docs/FORMATS.md' },
  rfi: { id: 'vulcano-rfi', label: 'open questions', writes: 1, reads: [1], reference: 'docs/FORMATS.md' },
  sequence: { id: 'vulcano-sequence', label: 'sequence skeleton', writes: 1, reads: [1], reference: 'docs/FORMATS.md' },
  db: { id: 'vulcano-db', label: 'the whole database', writes: 1, reads: [1], reference: 'docs/DATA-FILES.md' },
  catalogue: { id: 'vulcano-catalogue', label: 'instruments table', writes: 1, reads: [1], reference: 'docs/DATA-FILES.md' },
  parts: { id: 'vulcano-parts', label: 'parts table', writes: 1, reads: [1], reference: 'docs/DATA-FILES.md' },
  ratecard: { id: 'vulcano-ratecard', label: 'rates table', writes: 1, reads: [1], reference: 'docs/DATA-FILES.md' },
  items: { id: 'vulcano-items', label: 'standard items and services table', writes: 1, reads: [1], reference: 'docs/DATA-FILES.md' },
  kb: { id: 'vulcano-kb', label: 'knowledge base extension', writes: 0, reads: [1], reference: 'docs/KB-FORMAT.md' },
};

/** The highest DEDALO document schema this build understands (the `schemaVersion` inside a tsw-export). */
export const DEDALO_SCHEMA_MAX = 2;

export const formatTag = (kind) => `${FORMATS[kind].id}/${FORMATS[kind].writes}`;

export const CHANGELOG = [
  {
    version: '0.5.0',
    date: '2026-11-08',
    changes: [
      'File ▸ Check for updates… asks the project’s page which build is the latest and, if there is a newer one, hands you a new file with your database and project already written into it. It asks only when you choose it — nothing is ever checked on its own — and the only thing kept is the date of the last check.',
      'The file you are using is never touched: the update is a new file, named for its version, so the old one stays in the folder until you have opened the new one and seen your work in it. Unsaved changes are settled first (Save first), and a quiet «Updates unchecked» appears in the status row once the last check is 90 days old.',
    ],
  },
  {
    version: '0.4.5',
    date: '2026-09-20',
    changes: [
      'In the picker, ▾ more / ▴ less now sits in the toolbar itself, by Close, instead of on a line of its own under the search box: the fuller picture it opens now drops right under that toolbar, where the button that opened it is.',
    ],
  },
  {
    version: '0.4.4',
    date: '2026-09-20',
    changes: [
      'Fixed: the fuller picture said the channels and the accuracy target twice while assigning — once in the picker’s own hint, once in the fuller picture itself; the hint now steps aside once the fuller picture is open. The picker also carries the fuller picture on its own now, so opening it no longer leaves the slot’s copy showing underneath at the same time.',
    ],
  },
  {
    version: '0.4.3',
    date: '2026-09-20',
    changes: [
      'What unfolds from a slot now reads as one graphic language: a rail and a tint say what KIND of panel it is — rust for a picker (you are choosing), blue for the fuller picture (read-only), green for what a routing or an accessory already adds — and a nested panel (the fuller picture opened from inside a picker, a routing picker opened from inside an assigned instrument) steps in further, with a heavier rail and a stronger tint, so it never looks like just another top-level panel.',
    ],
  },
  {
    version: '0.4.2',
    date: '2026-09-20',
    changes: [
      'A resource’s fuller picture (▾ more) is one click away from inside the picker too, not only from the slot row above it — the same fold, in step with whichever place opened it.',
      'The characteristics table and the descriptive text sit side by side instead of stacked, so the fuller picture takes less height to read.',
      'Checked again whether → Open in the specification could land on the resource itself: DEDALO’s compiled document has no URL, hash or stored-state hook to open on a given section, so it still cannot — nothing changed here, as asked.',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-09-20',
    changes: [
      'A resource’s slot on the Project page can fold open a fuller picture — every characteristic (not only what fits on one line), its own notes, where it is used and how much, the points it reaches, the accuracy its criteria demand — instead of only the short summary.',
      'From there, → Open in the specification opens a fresh copy of the specification document in a new tab, when it was opened from the document itself (not scrolled to the resource — DEDALO’s document has no link to a place inside it, so the tooltip names the resource’s code to look for). When only its data (a tsw-export or tsw-authoring file) was opened, or the document is not loaded in this session, the button says so instead of pretending.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-09-19',
    changes: [
      'A way back to the project from anywhere, one click — 📄 in the command bar, next to Save — the way DEDALO’s side rail gets back to the document.',
      'The quote can export to Word (.docx), built the same way the XLSX already is — no library, one self-contained file — with the parties, the offer’s own references, the line items and the totals; Print is now labelled «Print / Save as PDF», DEDALO’s own wording for the same route to a PDF.',
      'A «Quote details» card on the Quote page holds the offer’s own registry data: your company (name, address, VAT, contact, email, phone, website — the same fields are also on the Database page, since they are yours across every job) and the client’s, the offer number, date, validity, payment and delivery terms, notes. Every export — print/PDF, Word, the JSON envelope — carries them as the offer’s references, alongside the specification’s own (document code, title, revision).',
    ],
  },
  {
    version: '0.3.2',
    date: '2026-09-19',
    changes: [
      'An instrument’s accessories are added and removed one at a time on the Database page — a chip per accessory with its price editable in place, a small form to add another (a rack mount kit, a communication interface, a multiplexer card…) — instead of one text field; the stored shape is unchanged. The same «New accessory for …» form is available right on the Project page, under the slot, so one can be defined without leaving the assignment.',
      'Maker and model travel with the instrument’s name wherever it appears — the picker, the assigned slot, its routing, the quote — not only in the Database table.',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-09-19',
    changes: [
      'Every price states its currency: a table column carries it once in the header (Price (EUR)…), a standalone figure carries it inline.',
      'An unassigned slot is harder to miss: an amber bar and a «not assigned» badge instead of grey text; a group can be narrowed to «only what is not assigned».',
      'The Database page groups a table by its natural category (instrument category, part or item kind, checklist discipline) as a collapsible tree, one section each, with «Expand all» / «Collapse all»; a filter narrows to one category, a sort field with a direction toggle orders the rows within. The Instruments, Parts and Items pickers on the Project page gained the same category filter and sort control, on top of the existing search.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-19',
    changes: [
      'The chrome is DEDALO’s: a dark command bar with the sections toggle, the title and revision, Save (orange when there is something to save, Ctrl+S) and a File menu — open a specification, export or import the project as JSON, export or import the database; a sections panel that slides in or stays pinned; a crumbs row; a status row with the saved state, the progress, the quote so far and the open questions. «Close the project» and «Open a saved job» are gone: a specification opens over the current project, a project comes back through File ▸ Import.',
      'Opening a specification from the file dialog draws the page as soon as the file is read.',
      'No variant selector: a bench is built for every variant, the project follows the base document; handling the variants stays a software slot.',
      'The Project page recaps the specification, the progress per group and the money per group with the quote so far, and its tables carry a quantity you can edit, a cost column and a subtotal per group.',
      'An assigned instrument can carry a routing — relays, a multiplexer card, anything from the database, in any quantity — and the accessories its row defines (a «name price; …» field of the Instruments table), ticked one by one; both are lines of the quote under the instrument. The multiplexer / dedicated / matrix choice is gone: the routing is what you add.',
      'Contacts are proposed one per point the steps are applied on (DEDALO’s «Applied on»), never multiplied for the current; the quantity is a field.',
      'A row of the Instruments, Parts and Items tables can carry a picture: a file in a folder named IMG beside this HTML file, never embedded. It shows as a thumbnail wherever the row appears and enlarges on click; «Pick…» copies it into the folder where the browser allows it, and tells you how to do it by hand elsewhere.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-19',
    changes: [
      'The file saves itself, as DEDALO does: the database and the project travel inside this HTML, and «Save» downloads a new copy with both. A copy with no project is the tool with your database.',
      'The database — instruments, parts and contacts, rates, standard items and services, your own checklist items — is edited in the tool, table by table, and imported or exported as JSON. A starter set with indicative prices ships with the tool, to be replaced.',
      'The project starts empty: the specification says what the bench needs — one slot per resource, per contact type, per physical action, per software effort, per bench item — and you assign to each what realises it, from the database or as a new row. The help is a ranking of what fits; nothing is chosen for you.',
      'The quote is the sum of the assignments and of the lines you add or accept from the suggested patterns, with markup, contingency and discount.',
      'The questions the rules and the specification’s notes raise are proposed, not imposed: you take into your list the ones that matter.',
      'Accuracy, checklists (now a tree: discipline › situation › item), the specification’s tables, the exports for software and harness, and the AI prompts sit on the Advanced page.',
      'Replaces 0.1.0 before either was committed: the job and quote envelopes changed shape and keep version 1.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-19',
    changes: ['First build: import, derived tables, rules, a realisation model seeded from the specification, decisions and trade-offs, accuracy, the discipline tools and the quote over the model. Superseded by 0.2.0 the same day.'],
  },
];
