// End-to-end check in Chromium with an iPhone-sized viewport: import EPUB,
// TXT and PDF, read, pause, jump chapters, change settings, then go offline
// and make sure the app, the library and PDF import still work.
// Run: npm run e2e [-- screenshot-dir]
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildEpub } from '../test/fixtures/build-epub.mjs';
import { BOKMAL_CHAPTERS, NYNORSK_TEXT } from '../test/fixtures/samples.mjs';
import { chromium } from './playwright.mjs';
import { startServer } from './serve.mjs';

const shots = process.argv[2] || join(tmpdir(), 'les-e2e');
mkdirSync(shots, { recursive: true });
const fixtures = join(shots, 'fixtures');
mkdirSync(fixtures, { recursive: true });
writeFileSync(join(fixtures, 'Flyturen.epub'), buildEpub({
  title: 'Flyturen', author: 'Testforfatter', lang: 'nb', chapters: BOKMAL_CHAPTERS,
}));
writeFileSync(join(fixtures, 'fjellturen.txt'), NYNORSK_TEXT);
const pdf = new URL('../test/fixtures/flyturen.pdf', import.meta.url);
writeFileSync(join(fixtures, 'flyturen-pdf.pdf'), readFileSync(pdf));

const PORT = 4173;
const server = await startServer(PORT);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'nb-NO',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

const step = async (name, action) => {
  process.stdout.write(`- ${name} … `);
  await action();
  console.log('ok');
};
const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) });

try {
  await step('library opens', async () => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await shot('01-empty-library');
  });

  await step('imports EPUB, TXT and PDF', async () => {
    await page.locator('input[type=file]').setInputFiles([join(fixtures, 'Flyturen.epub'), join(fixtures, 'fjellturen.txt')]);
    await page.locator('.book').nth(1).waitFor();
    await page.locator('input[type=file]').setInputFiles(join(fixtures, 'flyturen-pdf.pdf'));
    await page.locator('.book').nth(2).waitFor({ timeout: 20000 });
    const badges = await page.locator('.book .badge').allTextContents();
    assert.ok(badges.includes('NN') && badges.includes('BM') && badges.includes('PDF') && badges.includes('EPUB'), badges.join());
    await shot('02-library');
  });

  await step('opens the EPUB with the focus letter on the anchor', async () => {
    await page.locator('.book-open', { hasText: 'Testforfatter' }).click();
    await page.locator('.word-line').waitFor();
    await page.waitForTimeout(300);
    const geometry = await page.evaluate(() => {
      const focus = document.querySelector('.word .focus').getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();
      return { focusCenter: focus.left + focus.width / 2, anchor: stage.width * 0.35, word: document.querySelector('.word').textContent };
    });
    assert.equal(geometry.word, 'Kapittel');
    assert.ok(Math.abs(geometry.focusCenter - geometry.anchor) < 2, JSON.stringify(geometry));
    await shot('03-reader-paused');
  });

  await step('plays and pauses', async () => {
    await page.locator('.stage').click();
    await page.waitForTimeout(1500);
    assert.ok(await page.locator('.reader.playing').count());
    await shot('04-reader-playing');
    await page.locator('.stage').click();
    const word = await page.locator('.word').textContent();
    assert.notEqual(word, 'Kapittel');
    assert.ok(!(await page.locator('.reader.playing').count()));
  });

  await step('shows previous and next word', async () => {
    const [prev, next] = await Promise.all([page.locator('.phantom.prev').textContent(), page.locator('.phantom.next').textContent()]);
    assert.ok(prev.length > 0 || next.length > 0, `${prev} / ${next}`);
  });

  await step('jumps to chapter 2 from the chapter list', async () => {
    await page.getByRole('button', { name: 'Kapitler' }).first().click();
    await shot('05-chapters');
    await page.locator('.chapter-list button', { hasText: 'Kapittel 2' }).click();
    assert.match(await page.locator('.reader-titles span').textContent(), /Kapittel 2 · 2\/2/);
    assert.equal(await page.locator('.word').textContent(), 'Kapittel');
  });

  await step('rewinds to the start of a sentence', async () => {
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Neste ord' }).click();
    await page.getByRole('button', { name: 'Tilbake til starten av setningen' }).click();
    assert.equal(await page.locator('.word').textContent(), 'Boka');
  });

  await step('long Norwegian compound fits on screen', async () => {
    await page.locator('.context span', { hasText: 'arbeidsmiljøloven,' }).click();
    const box = await page.locator('.word').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
    await shot('06-long-word');
  });

  await step('settings change theme and speed', async () => {
    await page.getByRole('button', { name: 'Raskere' }).click();
    assert.equal(await page.locator('.speed output').textContent(), '325 ord/min');
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Lys' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await shot('07-settings');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await shot('08-reader-light');
    await page.getByRole('group', { name: 'Tema' }).count();
  });

  await step('progress is saved in the library', async () => {
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
    const text = await page.locator('.book', { hasText: 'Testforfatter' }).textContent();
    assert.match(text, /%/);
  });

  await step('works offline after installation', async () => {
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
    assert.equal(await page.locator('.book').count(), 3);
    await page.locator('.book-open', { hasText: 'fjellturen' }).click();
    await page.locator('.word-line').waitFor();
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.locator('.book').first().waitFor();
    // Delete the PDF and import it again while offline: pdf.js must come from the cache.
    await page.locator('.book', { hasText: 'PDF' }).getByRole('button', { name: /Valg for/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Slett boka' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.book').length === 2);
    await page.locator('input[type=file]').setInputFiles(join(fixtures, 'flyturen-pdf.pdf'));
    await page.locator('.book').nth(2).waitFor({ timeout: 20000 });
    await shot('09-offline-library');
  });

  assert.deepEqual(errors, [], 'console errors');
  console.log(`\nAll steps passed. Screenshots in ${shots}`);
} catch (error) {
  console.log('FAILED');
  await shot('failure').catch(() => {});
  console.error(error);
  if (errors.length) console.error('Console errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
