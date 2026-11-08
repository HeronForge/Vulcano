// The knowledge base assembled: rules, checklists, calculations, prompt templates, cost
// patterns and reference data that ship with the tool. The user's own additions live in the
// database (their checklist items) or come from a `vulcano-kb/1` extension file (declarative
// rules and checklist items, see docs/KB-FORMAT.md); an item with a built-in id replaces it.
import { RULES, RULE_CATEGORIES } from './rules.js';
import { CHECKLISTS, DISCIPLINES, disciplineLabel } from './checklists.js';
import { CALCULATIONS } from './calculations.js';
import { PROMPTS, FINDINGS_FORMAT } from './prompts.js';
import { COST_PATTERNS } from './costs.js';
import { INSTRUMENT_CLASSES, CONTACT_TYPES, SWITCHING } from './reference.js';

export function builtInKnowledgeBase() {
  return { rules: [...RULES], checklists: [...CHECKLISTS], calculations: [...CALCULATIONS], prompts: [...PROMPTS], costPatterns: [...COST_PATTERNS], instrumentClasses: [...INSTRUMENT_CLASSES], contactTypes: [...CONTACT_TYPES], switching: [...SWITCHING], extensions: [] };
}

const LISTS = ['rules', 'checklists', 'prompts', 'costPatterns'];

/** Merges one extension file into the knowledge base; returns what it added and replaced. */
export function mergeExtension(kb, extension) {
  const report = { name: extension.name || '(unnamed)', added: 0, replaced: 0, skipped: [] };
  for (const list of LISTS) {
    for (const item of extension[list] || []) {
      if (!item || typeof item !== 'object' || !item.id) { report.skipped.push(`${list}: an item without an id`); continue; }
      const entry = { ...item, source: item.source || { kind: 'extension', ref: report.name, added: item.added || '' }, extension: report.name };
      if (list === 'rules' && !entry.when) { report.skipped.push(`rules: ${item.id} has no «when» condition`); continue; }
      if (list === 'checklists' && !entry.trigger) { report.skipped.push(`checklists: ${item.id} has no «trigger»`); continue; }
      const i = kb[list].findIndex((x) => x.id === entry.id);
      if (i >= 0) { kb[list][i] = entry; report.replaced++; } else { kb[list].push(entry); report.added++; }
    }
  }
  for (const list of ['guides', 'calculations', 'contactTypes', 'instrumentClasses']) if ((extension[list] || []).length) report.skipped.push(`${list}: not read from an extension in this version — instruments and parts belong in the database`);
  kb.extensions.push(report);
  return report;
}

export { RULE_CATEGORIES, DISCIPLINES, disciplineLabel, FINDINGS_FORMAT };
