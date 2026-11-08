// The wallbox document from ../heronforge-kb/interchange/dedalo/ is the ground truth every
// reader is tested against. When the sibling repo is not there, the tests that need it skip.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readSpecification } from '../src/io/dedalo.js';

const here = dirname(fileURLToPath(import.meta.url));
export const WALLBOX = join(here, '..', '..', 'heronforge-kb', 'interchange', 'dedalo', 'wallbox.html');
export const hasWallbox = () => existsSync(WALLBOX);

let cached = null;
export function wallbox() {
  if (!cached) cached = readSpecification(readFileSync(WALLBOX, 'utf8'), 'wallbox.html');
  return cached;
}

export const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8');
