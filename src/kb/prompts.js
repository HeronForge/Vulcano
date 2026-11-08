// B3 · Prompt templates for an external AI. VULCANO prepares the text; the user pastes it
// wherever they like and pastes the answer back. Nothing leaves the machine by itself. Each
// template says what part of the specification it inlines, what the answer must look like, and
// how the importer reads it back (a JSON list of findings becomes AI-suggested questions).
const ADDED = '2026-09-19';
const EXP = { kind: 'experience', ref: 'prompting practice', added: ADDED };

export const FINDINGS_FORMAT = `Answer with one JSON array and nothing else — no prose before or after, no markdown fence. Each element:
{ "element": "<the code of the element concerned, e.g. STG-03, T-03.02.01, RES-04, AP-12, or \\"general\\">",
  "finding": "<what is missing, contradictory or assumed — one sentence>",
  "question": "<the question to ask the author of the specification, in their language, one sentence>",
  "why": "<what a wrong guess would cost: a wrong instrument, a wrong fixture, a wrong price>",
  "confidence": "high" | "medium" | "low" }
Do not invent facts about the product. If the text is enough to answer, say so in "finding" and leave "question" empty.`;

export const PROMPTS = [
  {
    id: 'P-UNSAID', title: 'What this chapter leaves unsaid', scope: 'chapter', answerFormat: 'json',
    purpose: 'A second reading of one chapter for what a bench builder would need and cannot find.',
    template: `You are an experienced builder of electronic test benches reading a test specification you have been asked to quote. Below is one chapter of it, «{{chapterTitle}}», from the specification {{identity}}.

Read it as the person who has to buy the instruments, design the fixture and write the sequence. List what the chapter does not say and you would need to know before quoting: values without tolerances, instruments without ranges, points without contacts, actions nobody performs, conditions that are assumed. Do not repeat what is already listed as an open question below.

Already open:
{{questions}}

Chapter:
{{chapter}}

{{answerFormat}}`,
    source: EXP,
  },
  {
    id: 'P-CONTRADICT', title: 'Contradictions between two chapters', scope: 'twoChapters', answerFormat: 'json',
    purpose: 'Two chapters that should agree — the resources and the steps, the points and the images, a stage and its variants.',
    template: `You are an experienced builder of electronic test benches. Below are two chapters of the same test specification, {{identity}}: «{{chapterTitle}}» and «{{chapterTitle2}}».

Find every place where the two disagree or where one assumes something the other does not provide: a step that asks an instrument for more than its characteristics, a point used but not listed, a stage a variant excludes while another depends on it, a unit that changes between them.

First chapter:
{{chapter}}

Second chapter:
{{chapter2}}

{{answerFormat}}`,
    source: EXP,
  },
  {
    id: 'P-DRAFT', title: 'Draft these questions for the customer', scope: 'questions', answerFormat: 'text',
    purpose: 'The open questions rewritten in the customer’s language and tone, grouped, ready to send.',
    template: `Below are open questions a test bench builder has about the specification {{identity}}, each with the element it concerns and why it matters. Rewrite them as a numbered list to send to the author of the specification, in {{language}}, in a courteous and precise professional tone. Group them by chapter, keep the element codes, keep every question (merge only exact duplicates), and do not add questions of your own. Answer with the list only.

Questions:
{{questions}}`,
    source: EXP,
  },
  {
    id: 'P-INSTRUMENT', title: 'Which instrument classes fit this resource', scope: 'resource', answerFormat: 'json',
    purpose: 'For one resource: the classes that fit its characteristics and the steps that use it, and why.',
    template: `You are an experienced test engineer choosing instruments for a production test bench. The specification {{identity}} needs this resource:

{{resource}}

It is used by these steps (stimulus parameters and acceptance criteria included):
{{uses}}

Which instrument classes (not brands) fit, and why? For each class say what it gives — accuracy, speed, channels, interface — against what the steps need, what it costs as an order of magnitude, and what would rule it out. Then say which criterion of the steps is the one that decides the class.

Answer with one JSON array and nothing else:
[ { "class": "<instrument class>", "fits": true | false, "why": "<one or two sentences>", "decidingCriterion": "<step code and criterion>", "costBand": "<order of magnitude in EUR>", "confidence": "high" | "medium" | "low" } ]`,
    source: EXP,
  },
];

export const prompt = (id) => PROMPTS.find((p) => p.id === id);
