// Generates test/fixtures/flyturen.pdf from the Bokmål sample with Chromium,
// including a PDF outline for chapter detection. Run: node tools/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright.mjs';

import { BOKMAL_CHAPTERS } from '../test/fixtures/samples.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Narrow columns force line wraps (and a hyphenated word break) inside paragraphs.
const html = `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Flyturen</title>
<style>
  body { font: 14px/1.5 serif; width: 300px; margin: 40px; }
  h1 { font-size: 20px; break-before: page; }
  h1:first-of-type { break-before: auto; }
  p { margin: 0; text-indent: 1.5em; }
  .hyphen { hyphens: manual; }
</style></head><body>
${BOKMAL_CHAPTERS.map((chapter) => `<h1>${escape(chapter.title)}</h1>
${chapter.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`).join('\n')}
<p class="hyphen">Til slutt landet flyet, og passasjerene klappet for kap&shy;teinen som hadde fløyet dem trygt hjem igjen gjennom stormen.</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const pdf = await page.pdf({ format: 'A5', outline: true, tagged: true, displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:8px;width:100%;text-align:center">Flyturen</div>',
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center"><span class="pageNumber"></span></div>',
  margin: { top: '40px', bottom: '40px' } });
await browser.close();
writeFileSync(join(root, 'test/fixtures/flyturen.pdf'), pdf);
console.log(`wrote test/fixtures/flyturen.pdf (${pdf.length} bytes)`);
