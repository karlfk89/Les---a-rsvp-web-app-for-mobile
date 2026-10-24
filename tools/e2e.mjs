// End-to-end check in Chromium with an iPhone-sized viewport: start in
// English, switch to Norwegian, import EPUB, TXT and PDF, read, pause, jump
// chapters, change settings, then go offline and make sure the app, the
// library, PDF import and switching back to English still work.
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
  await step('library opens in English', async () => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByRole('heading', { name: 'Library' }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await page.getByText('No books yet').waitFor();
    await shot('01-empty-library');
  });

  await step('switches the interface to Norwegian', async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('group', { name: 'App language' }).getByRole('button', { name: 'Norsk' }).click();
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'nb');
    assert.equal(await page.title(), 'Les – RSVP-leser');
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

  const position = async () => Number(await page.locator('.scrubber').inputValue());
  const readingPoint = async () => {
    const box = await page.locator('.stage').boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height * 0.3 };
  };
  const swipe = async (fromX, toX) => {
    const { y } = await readingPoint();
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(fromX + ((toX - fromX) * i) / 20, y);
    await page.mouse.up();
  };

  await step('swipes to step through words', async () => {
    const start = await position();
    await swipe(320, 80);
    const forward = await position();
    assert.ok(forward > start + 3, `${start} -> ${forward}`);
    assert.ok(!(await page.locator('.reader.playing').count()));
    await swipe(80, 320);
    assert.ok(await position() < forward);
    await page.locator('.scrubber').fill(String(start));
    assert.equal(await page.locator('.word').textContent(), 'Boka');
  });

  await step('holds to read and taps for the menu', async () => {
    const chooseMode = async (name) => {
      await page.getByRole('button', { name: 'Innstillinger' }).click();
      await page.getByRole('group', { name: 'Start og stopp' }).getByRole('button', { name }).click();
      await page.getByRole('button', { name: 'Ferdig' }).click();
    };
    await chooseMode('Hold inne');
    const start = await position();
    const { x, y } = await readingPoint();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    assert.ok(await page.locator('.reader.playing').count(), 'reading while held');
    await shot('12-hold-reading');
    await page.mouse.up();
    assert.ok(!(await page.locator('.reader.playing').count()), 'paused on release');
    assert.ok(await page.locator('.reader.panel-closed').count(), 'menu stays hidden');
    assert.match(await page.locator('.reader-hint').textContent(), /Hold fingeren/);
    assert.ok(await position() > start + 2);
    await shot('13-hold-resting');
    await page.mouse.click(x, y);
    assert.ok(!(await page.locator('.reader.panel-closed').count()), 'a tap opens the menu');
    assert.ok(!(await page.locator('.reader.playing').count()));
    await chooseMode('Trykk');
    await page.locator('.scrubber').fill(String(start));
  });

  await step('long Norwegian compound is shown in parts', async () => {
    await page.locator('.context span', { hasText: 'arbeidsmiljøloven,' }).click();
    assert.equal(await page.locator('.word').textContent(), 'arbeids-');
    assert.equal(await page.locator('.phantom.next').textContent(), 'miljøloven,');
    await shot('06-long-word');
    await page.locator('.stage').click();
    await page.waitForFunction(() => document.querySelector('.word').textContent === 'miljøloven,', null, { timeout: 3000 });
    await page.waitForFunction(() => document.querySelector('.word').textContent === 'om', null, { timeout: 3000 });
    await page.locator('.stage').click();
  });

  await step('long Norwegian compound fits on screen when shown whole', async () => {
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('switch', { name: 'Del lange ord' }).uncheck();
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await page.locator('.context span', { hasText: 'arbeidsmiljøloven,' }).click();
    assert.equal(await page.locator('.word').textContent(), 'arbeidsmiljøloven,');
    const box = await page.locator('.word').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('switch', { name: 'Del lange ord' }).check();
    await page.getByRole('button', { name: 'Ferdig' }).click();
    assert.equal(await page.locator('.word').textContent(), 'arbeids-');
  });

  await step('settings change theme and speed', async () => {
    await page.getByRole('button', { name: 'Raskere' }).click();
    assert.equal(await page.locator('.speed output').textContent(), '275 ord/min');
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
    assert.ok(!(await page.locator('#app').textContent()).includes('null'), 'no stray «null» text');
  });

  const epubCard = () => page.locator('.book:not(.pending)', { hasText: 'Testforfatter' });
  const percentOf = async (locator) => /(\d+(?:,\d)?) %/.exec(await locator.textContent())?.[1];
  const openBackupSettings = async () => {
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('heading', { name: 'Sikkerhetskopi' }).waitFor();
  };
  const saveBackup = async (name) => {
    const save = page.getByRole('button', { name: 'Lag sikkerhetskopi' });
    await save.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some((b) => b.textContent === 'Lag sikkerhetskopi' && !b.disabled));
    const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
    const path = join(fixtures, name);
    await download.saveAs(path);
    return path;
  };
  const restore = async (path) => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles(path);
    await page.locator('.toast', { hasText: /gjenopprettet/ }).waitFor();
  };
  const deleteBook = async (card) => {
    await card.getByRole('button', { name: /Valg for/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Slett boka' }).click();
  };

  let progressBackup;
  let readPercent;
  await step('saves a backup of progress and settings', async () => {
    readPercent = await percentOf(epubCard());
    await openBackupSettings();
    progressBackup = await saveBackup('backup-progress.json');
    const backup = JSON.parse(readFileSync(progressBackup, 'utf8'));
    assert.equal(backup.app, 'les-rsvp');
    assert.equal(backup.settings.theme, 'light');
    assert.equal(backup.settings.wpm, 250);
    assert.equal(backup.books.length, 3);
    const epub = backup.books.find((b) => b.format === 'epub');
    assert.ok(epub.position > 0 && !epub.chapters, JSON.stringify(epub));
    assert.equal(epub.wpm, 275);
    assert.match(await page.locator('.settings').textContent(), /Sist lagret/);
    await shot('10-backup-settings');
    await page.getByRole('button', { name: 'Ferdig' }).click();
  });

  await step('restores settings and keeps progress for a deleted book until it is added again', async () => {
    await openBackupSettings();
    await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Mørk' }).click();
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await deleteBook(epubCard());
    await page.waitForFunction(() => document.querySelectorAll('.book').length === 2);
    await openBackupSettings();
    await restore(progressBackup);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    const pending = page.locator('.book.pending', { hasText: 'Flyturen' });
    await pending.waitFor();
    assert.equal(await percentOf(pending), readPercent);
    await shot('11-pending-progress');
    await page.locator('input[type=file][multiple]').setInputFiles(join(fixtures, 'Flyturen.epub'));
    await page.locator('.toast', { hasText: 'fortsetter på' }).waitFor();
    await epubCard().waitFor();
    assert.equal(await page.locator('.book.pending').count(), 0);
    assert.equal(await percentOf(epubCard()), readPercent);
  });

  await step('restores a deleted book with its text from a full backup', async () => {
    await openBackupSettings();
    await page.getByRole('switch', { name: 'Ta med bøkene' }).check();
    const fullBackup = await saveBackup('backup-full.json');
    assert.ok(JSON.parse(readFileSync(fullBackup, 'utf8')).books.every((b) => b.chapters?.length));
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await deleteBook(page.locator('.book', { hasText: 'fjellturen' }));
    await page.waitForFunction(() => document.querySelectorAll('.book').length === 2);
    await openBackupSettings();
    await restore(fullBackup);
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.book:not(.pending)').length === 3);
    await page.locator('.book-open', { hasText: 'fjellturen' }).click();
    assert.equal(await page.locator('.word').textContent(), 'Fjellturen');
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
  });

  await step('remembers the speed per book', async () => {
    const speed = () => page.locator('.speed output').textContent();
    // The EPUB got its own speed (275) in an earlier step and kept it through the backup restore.
    await page.locator('.book-open', { hasText: 'Testforfatter' }).click();
    assert.equal(await speed(), '275 ord/min');
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.locator('.book-open', { hasText: 'fjellturen' }).click();
    assert.equal(await speed(), '250 ord/min');
    await page.getByRole('button', { name: 'Saktere' }).click();
    assert.equal(await speed(), '225 ord/min');
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await epubCard().getByRole('button', { name: /Valg for/ }).click();
    await page.getByText('Egen hastighet: 275 ord/min.').waitFor();
    await page.waitForTimeout(300); // let the sheet finish sliding in
    await shot('15-book-speed');
    await page.getByRole('button', { name: /Bruk standardhastighet/ }).click();
    await page.locator('.book-open', { hasText: 'Testforfatter' }).click();
    assert.equal(await speed(), '250 ord/min');
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    assert.ok(!(await page.getByText('har egen hastighet').count()));
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.locator('.book-open', { hasText: 'fjellturen' }).click();
    assert.equal(await speed(), '225 ord/min');
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByText('«fjellturen» har egen hastighet: 225 ord/min.').waitFor();
    await page.getByRole('button', { name: 'Bruk standardhastighet for denne boka' }).click();
    assert.equal(await speed(), '250 ord/min');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await page.getByRole('button', { name: 'Til biblioteket' }).click();
    await page.getByRole('heading', { name: 'Bibliotek' }).waitFor();
    await page.locator('.library-footer div').first().waitFor();
    assert.ok(!(await page.locator('#app').textContent()).includes('null'), 'no stray «null» text');
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

  await step('shows the licences, also offline', async () => {
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('button', { name: 'Vis lisenser' }).click();
    const licences = page.locator('.licences');
    await page.waitForFunction(() => document.querySelector('.licences')?.textContent.includes('MIT License'));
    const text = await licences.textContent();
    for (const notice of ['RSVP Nano contributors', 'Mozilla Foundation', 'Denis Pushkarev', 'Arjun Barrett', 'Rune Kleveland', 'Gerard D.C. Kuiken']) {
      assert.ok(text.includes(notice), notice);
    }
    await page.getByRole('button', { name: 'Ferdig' }).click();
  });

  await step('switches back to English, also offline', async () => {
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('group', { name: 'Språk i appen' }).getByRole('button', { name: 'English' }).click();
    await page.getByRole('heading', { name: 'Library' }).waitFor();
    await page.locator('.book').nth(2).waitFor();
    const badges = await page.locator('.book .badge').allTextContents();
    assert.ok(badges.includes('NB') && badges.includes('NN'), badges.join());
    await page.locator('.book', { hasText: 'Testforfatter' }).getByRole('button', { name: /Options for/ }).click();
    await page.getByRole('button', { name: 'Language: Norwegian Bokmål' }).waitFor();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('.book-open', { hasText: 'Testforfatter' }).click();
    await page.getByRole('button', { name: 'Back to library' }).waitFor();
    assert.match(await page.locator('.speed output').textContent(), /^\d+ words\/min$/);
    assert.match(await page.locator('.position-row').textContent(), /left in chapter/);
    await shot('16-reader-english');
    const keyLike = /\b(?:library|reader|book|settings|backup|common|pending|offline|update|licences)\.[a-z]+[A-Z]?\w*/;
    assert.ok(!keyLike.test(await page.locator('body').textContent()), 'no untranslated keys');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('heading', { name: 'Appearance' }).waitFor();
    assert.ok(!keyLike.test(await page.locator('body').textContent()), 'no untranslated keys in settings');
    await page.waitForTimeout(300);
    await shot('17-settings-english');
    await page.getByRole('button', { name: 'Done' }).click();
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
