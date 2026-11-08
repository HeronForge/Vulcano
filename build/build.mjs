// Build: turns the modular sources into the single self-contained HTML file, dist/vulcano.html,
// and writes the example data files to docs/examples/ so the documentation and the tool agree.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => join(root, ...s);
const MINIFY = process.argv.includes('--min');

// A `</script` inside the bundle would end the element that carries it; the same for a style.
const safeInline = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

async function bundleApp() {
  const res = await build({ entryPoints: [p('src', 'main.js')], bundle: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'], minify: MINIFY, write: false, legalComments: 'none', charset: 'utf8' });
  return res.outputFiles[0].text;
}

async function main() {
  const [shell, app, appCss, printCss] = await Promise.all([
    readFile(p('src', 'index.html'), 'utf8'), bundleApp(), readFile(p('src', 'styles', 'app.css'), 'utf8'), readFile(p('src', 'styles', 'print.css'), 'utf8'),
  ]);
  const html = shell.replace('/*VLC:CSS*/', () => safeInline(appCss + '\n' + printCss)).replace('/*VLC:APP*/', () => safeInline(app));
  await mkdir(p('dist'), { recursive: true });
  await writeFile(p('dist', 'vulcano.html'), html, 'utf8');
  // The example data files: the same objects the tool downloads, kept beside the docs.
  const { EXAMPLE_RATE_CARD, EXAMPLE_CATALOGUE, EXAMPLE_PARTS, EXAMPLE_ITEMS, EXAMPLE_EXTENSION } = await import(p('src', 'kb', 'examples.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
  await mkdir(p('docs', 'examples'), { recursive: true });
  for (const [name, data] of [['instruments-example.json', EXAMPLE_CATALOGUE], ['parts-example.json', EXAMPLE_PARTS], ['rates-example.json', EXAMPLE_RATE_CARD], ['items-example.json', EXAMPLE_ITEMS], ['kb-extension-example.json', EXAMPLE_EXTENSION]]) {
    await writeFile(p('docs', 'examples', name), JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  // The announcement «Check for updates» reads: written here from version.js on every build so the
  // number announced and the number built cannot tell two different stories (the family's pattern,
  // ../heronforge-kb/patterns/self-update.md). Tracked on main, never edited by hand.
  const { APP_VERSION, CHANGELOG } = await import(p('src', 'version.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
  const latest = CHANGELOG[0];
  if (latest.version !== APP_VERSION) throw new Error(`CHANGELOG[0] is ${latest.version} but APP_VERSION is ${APP_VERSION}: write the entry for this version.`);
  const announcement = { version: APP_VERSION, date: latest.date, changes: latest.changes, app: 'https://heronforge.github.io/Vulcano/vulcano.html', page: 'https://github.com/HeronForge/Vulcano' };
  await writeFile(p('update.json'), JSON.stringify(announcement, null, 2) + '\n', 'utf8');
  const kb = (html.length / 1024).toFixed(0);
  console.log(`dist/vulcano.html — ${kb} KB${MINIFY ? ' (minified)' : ''}; docs/examples/ and update.json refreshed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
