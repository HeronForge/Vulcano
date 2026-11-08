# VULCANO — user guide

VULCANO is one HTML file, opened by double click in any modern browser. It works entirely
offline: nothing is sent anywhere, no account, no key. Like a DEDALO document, **the file
carries its own data**: your database (instruments, parts, rates, standard items, your
checklist items) and, once you open a specification, the project. *Save* downloads a new copy
of the file with both inside — that copy is the job. A copy saved with no project open is the
tool with your database in it: keep it as your master and start every job from it.

## 1. The idea

The specification says what the bench needs; you say what realises it. Nothing is chosen for
you:

- the specification is read and turned into **requirements** — one slot per resource, per
  contact type, per physical action, per software effort, per bench item;
- every slot starts **empty**; you **assign** to it a row of your database (or a new row you
  add on the spot) and a quantity; an instrument then takes what goes with it — its
  **routing** over the points and its **accessories**;
- the **quote** is the sum of the assignments plus the lines you add or accept from the
  suggested patterns, with markup, contingency and discount;
- the **questions** the rules raise are proposed, not imposed: you take into your list the
  ones that matter and send them back up the chain;
- accuracy, checklists, the specification's own tables, the exports for software and harness,
  and the prompts for an external AI stay on the **Advanced** page until you need them.

The help is a ranking: in every picker, what fits comes first, with the reason; everything
stays available with «show everything».

## 2. The window

The bar at the top is DEDALO's: **☰ Sections** opens the list of pages (pin it with 📌 to
keep it beside the page), **📄** — shown on every page but Project — jumps straight back to
it, the way DEDALO's side rail gets back to the document, the title and revision of the open
specification, **💾 Save** (orange when there is something to save; Ctrl+S works), and
**File ▾** — *Open a specification…*, *Export the project (JSON)*, *Import a project…*,
*Export the database (JSON)*, *Import a database…*, *Check for updates…* (see §6). A band under the bar says when the file
on disk is behind what you see. The crumbs row says where you are; the status row at the
bottom says whether the file is saved, how many slots are assigned, the quote so far, the
open questions and what the database holds — each a link.

## 3. Open a specification

Drop onto the window, or *File ▸ Open a specification…*: the DEDALO document itself
(`….html`, the best choice — it carries the pictures and the history), its data export
(`tsw-export/1`), or an authoring file (`tsw-authoring/1`). A new, empty project opens over
it — the previous one is dropped (you are warned when it is unsaved). DEDALO's notes file
(`tsw-notes`) dropped beside it makes its `TO CHECK`, `CONDITION` and left-out items proposals
on the Questions page. The project follows the base document: a bench is built for every
variant, and handling them is a software slot.

## 4. The five pages

**Project** — three cards recap the specification (revision, stages, steps, criteria, points,
resources, cycle time), where the project stands (assigned slots, per group) and the money so
far (per group, subtotal, quote). Then one table per group — Instruments, Contacts and
fixture, Software, Bench — with a row per requirement: its code, what the specification
demands (characteristics, points at once, points applied on, current), what is assigned, the
**quantity** (a field you can change), the **cost** (its column header states the currency),
and a subtotal at the foot. An unassigned slot is easy to spot: an amber bar and a «not
assigned» badge; a group can be narrowed to *only what is not assigned* when there is a lot
still to place. A resource's row carries *▾ more*: a fuller picture — its characteristics and
its description side by side, its own notes, where it is used and how much (stimulus and
measurement uses, the stages, the points it reaches, the interfaces it speaks), the accuracy
its criteria demand — folded away until it is wanted, and the same fold one click away inside
the picker too, while comparing candidates. From there, **→ Open in the specification** opens a fresh copy of the
document in a new tab, when the specification was opened from the document itself (`.html`):
not scrolled to the resource — DEDALO's document has no link to a place inside it — so look
for its code under *Test resources*; a mouse-over says so. Opened from its data instead (a
`tsw-export` or `tsw-authoring` file), or the document not loaded in this session (a saved
project or an imported job does not carry it, to keep this file light), the button says which
and stays disabled. *Assign…* opens the picker: the database rows ranked by fit (class and
category, what they mention, whether their accuracy covers the tightest criterion, whether
they cover the stated ranges), a search box, a **category or kind filter** and a **sort
field with a direction toggle** (best fit stays the default), «show everything», *New … in
the database…* (a name and a price are enough; the rest is edited on the Database page). An
instrument is assigned once, whatever the points: under it, *+ Routing…* adds what puts it on
its points — relays, a multiplexer card, anything from the database, in any quantity (one
relay per point or one card per the channels it switches is proposed) — and the accessories
its row defines are offered as buttons, ticked one by one with their own quantity; *New
accessory for …* defines one on the spot (a rack mount kit, a communication interface) without
leaving the slot. Both are lines of the quote under the instrument, and change the accuracy
path and the sequence
skeleton (a routed instrument is switched). Contacts are proposed one per point the steps are
applied on — DEDALO's «Applied on» — and the quantity is yours to change. An action can be
*done by the operator*; an item can be *not needed*. Software slots take hours at a rate,
with a suggestion you can *use*. Rows with a picture show it as a thumbnail; click it to
enlarge.

**Quote** — at the top, **Quote details**: who issues the offer (your company — name,
address, VAT, contact, email, phone, website; the same fields as the Database page, edited
here for convenience while filling in an offer) and who receives it (the client, prefilled
from the specification's own company where it names one), the offer's own number, date,
validity, payment and delivery terms, notes. Every export states them, alongside the
specification's own references (document code, title, revision). Then one section per group,
every line with quantity, unit price and total; the assignment lines link back to their slot,
the routing and accessory lines sit under their instrument; *Add a line* for anything else.
Under the sections: subtotal, markup, contingency, discount, total. *Print / Save as PDF*
opens the browser's print dialog on a document that carries the same registry data; *Word
(.docx)* writes the same as an editable commercial offer, ready to send or adapt — built the
way the XLSX is, with no library. Folded below: the **suggested lines** the usual cost patterns
imply from what you assigned — design hours per channel, debug as a share of build,
documentation per stage, FAT days — each with how it was computed and an *Add* button; and
the open questions that may move the price. Also XLSX and the JSON envelope (`vulcano-quote/1`).

**Questions** — left, what is proposed: every finding of the rules (severity, the element, the
question to ask, the finding behind it) and the notes that travelled with the specification;
*Take* one, or *Take all* of a severity. Right, your list: numbered, by chapter, with
*Asked / Answered / Waive*, wording and price impact editable, *Add your own*. Print, XLSX,
RFI file (`vulcano-rfi/1`) that comes back with the answers and merges onto the list. Folded:
the rules that ran and how many findings each raised.

**Database** — five tables, edited in place: *Instruments* (picture, name, **maker and model
right beside it, and shown wherever the instrument appears** — a slot, a picker, the quote —
so the two travel together, category, channels, interfaces, accuracy in % of reading,
characteristics as «name value unit; …», **accessories — a rack mount kit, a communication
interface, a multiplexer card — added and removed one at a time, its price editable in
place**, price, lead time), *Parts and contacts* (probes,
clips, connectors, cables, actuators, relays and switching cards — with the words that match
a contact type, current, resistance, cycle life, the channels a card switches, price),
*Rates* (hourly and daily), *Standard items and services* (cabinet, safety set, fixture,
board, licences, documentation, FAT, training, spares), *Your checklist items* (discipline,
situation, item, why, and the words of the specification that trigger it — or blank for
always). A table with a natural category shows as a **collapsible tree** — one section per
category or kind, with a count, *Expand all* / *Collapse all* — and a **filter** narrows it to
one branch; every table can be **sorted** by any column, direction reversible, on top of the
search box. Each table imports and exports its own JSON; the whole database too. Folded at
the top, **Your company** — name, address, VAT, contact, email, phone, website — your own
registry data, used as the «From» of every quote (the same fields are also on the Quote
page). The tool ships with a starter set — generic instrument classes and the usual parts
with **indicative prices, clearly marked** — to be replaced by what you buy and charge.

*Pictures.* A picture is never embedded: it is a file in a folder named **IMG** beside this
HTML file, and the row holds its name. *Pick…* asks once for the folder (create it beside the
file first) and copies the chosen picture into it — in Chrome and Edge; a browser that cannot
write into a folder only fills in the name, and the tool says so: copy the file by hand. Keep
the folder next to the file when you move or send it; a copy that cannot find its `IMG` shows
a placeholder in place of every thumbnail.

**Advanced** — *Checklists*: a tree, discipline › situation › item, of what an experienced
builder asks for this job; tick, note, or make a question. *Accuracy*: per resource, the
accuracy its criteria demand (known before any choice); per criterion, what the assigned
instrument and contacts resolve, the test uncertainty ratio, the guard-banded limits, a
verdict — *Details* shows the contributions and the calculations. *The specification*: the
tables VULCANO derived (resources and channels as DEDALO counts them and as they get wired,
points, criteria, cycle time) and the text chapter by chapter. *Exports*: the sequence
skeleton (`vulcano-sequence/1`), the limits table and the signal list as CSV/XLSX. *Ask an
AI*: a prompt to paste into whatever AI you use, and an importer for its answer. *About*:
version, formats, changelog.

## 5. Save

*Save* (💾, Ctrl+S) downloads a new copy of this file. With a project open it is named after
the specification and carries the project and the database; the browser warns before you
leave with unsaved changes. The downloaded copy replaces the one on disk — move it beside its
`IMG` folder if the rows have pictures. *File ▸ Export the project (JSON)* writes the project
alone (`vulcano-job/1`), for archiving or for another copy of the tool; *Import a project…*
reads it back over the current database; *Export the database* and *Import a database…* move
every table between copies. Every exported document records the specification revision it
came from.

## 6. Moving to a newer build

*File ▸ Check for updates…* asks the project's page on GitHub which build is the latest one.
It is the only time the tool ever reaches out, and it does so only when you choose this entry:
nothing is checked at startup or in the background, there is no setting that could turn that on,
and nothing is sent — the question is which version exists, the answer a version number. The one
thing the file remembers is **the date of the last check**, in this browser, so that once it is
90 days old a quiet *Updates unchecked* appears in the status row (and one notice when the tool
opens). A file never checked is not reminded.

If a newer build exists, the dialog lists what changed and offers **Download VULCANO x.y.z with
my work**: a **new file**, named for its version (`…_vulcano_v0.5.0.html`), made of the new
empty build with your database and your project written into it. **The file you are using is not
touched, replaced or deleted.** Open the new one, check that the tables, the assignments and the
quote are all there, and only then replace the old one — until then it is your way back. Move
the `IMG` folder beside the new file too if rows have pictures. With unsaved changes the dialog
offers **Save first** in place of the download, so the two files never disagree.

A machine with no way out to the internet — the usual case on a test bench — gets a plain line
saying the project could not be reached and the address to fetch the build by hand from
(`https://github.com/HeronForge/Vulcano`); to carry your work across by hand, *Export the project (JSON)* and *Export the database (JSON)*
here, open the new build, and bring both in with *Import a project…* and *Import a database…*.
