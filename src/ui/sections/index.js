// The five pages: the project and its quote, the questions, the database, and what stays in
// the background — grouped as the sections panel lists them.
import { project } from './project.js';
import { quote } from './quote.js';
import { questions } from './questions.js';
import { database } from './database.js';
import { advanced } from './advanced.js';

export const SECTIONS = [project, quote, questions, database, advanced];
export const GROUPS = [
  { id: 'job', title: 'Job', items: ['project', 'quote', 'questions'] },
  { id: 'tool', title: 'Tool', items: ['database', 'advanced'] },
];
export const PLACES = new Map(GROUPS.flatMap((g) => g.items.map((id) => [id, { group: g.title, groupId: g.id, label: SECTIONS.find((s) => s.id === id).title }])));
