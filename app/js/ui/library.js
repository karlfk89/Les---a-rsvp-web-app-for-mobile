// Library: import books, list them with progress, open, change language or delete.

import { ACCEPTED_FILES, ImportError, bookId, parseBook } from '../import/index.js';
import { bookSpeed, loadSettings } from '../settings.js';
import { LANGUAGES } from '../text/language.js';
import { applyPendingProgress, lastBackupAt } from '../storage/backup.js';
import * as db from '../storage/db.js';
import { h, icon, openSheet, setChildren, toast } from './dom.js';
import { formatDuration, formatPercent } from './format.js';
import {
  isStandalone, offlineStatus, onUpdateAvailable, requestPersistentStorage, storageSummary, updateBanner,
} from './offline.js';
import { openSettings } from './settings-view.js';

const FREE_BOOK_SOURCES = [
  ['Bokselskap.no', 'https://www.bokselskap.no', 'norske klassikere som EPUB'],
  ['Project Gutenberg', 'https://www.gutenberg.org/browse/languages/no', 'norske og engelske bøker'],
  ['Project Runeberg', 'https://runeberg.org', 'nordisk litteratur'],
  ['Standard Ebooks', 'https://standardebooks.org', 'engelske klassikere'],
];

async function importFiles(files, refresh) {
  requestPersistentStorage();
  for (const file of files) {
    const note = toast(`Importerer «${file.name}» …`, { duration: 0 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const id = await bookId(bytes);
      const existing = await db.getBook(id);
      if (existing) {
        note.update(`«${existing.title}» finnes allerede i biblioteket.`, { duration: 3500 });
        continue;
      }
      const book = await parseBook(bytes, file.name, {
        onProgress: (fraction) => note.update(`Leser «${file.name}» … ${Math.round(fraction * 100)} %`),
      });
      const { chapters, ...info } = book;
      const record = {
        ...info,
        id,
        fileName: file.name,
        chapterCount: chapters.length,
        addedAt: Date.now(),
        openedAt: 0,
        position: 0,
        remainingMs: null,
      };
      await db.addBook(record, chapters);
      const resumed = await applyPendingProgress(record);
      note.update(resumed
        ? `La til «${book.title}» og fortsetter på ${formatPercent(resumed.position / Math.max(1, book.wordCount - 1))}.`
        : `La til «${book.title}» (${LANGUAGES[book.lang].name.toLowerCase()}).`, { duration: 3500 });
      await refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof ImportError ? error.message : 'Ukjent feil under import.';
      note.update(`Kunne ikke importere «${file.name}»: ${message}`, { error: true, duration: 7000 });
    }
  }
}

function bookActions(book, refresh) {
  const ownSpeed = bookSpeed(book);
  const speed = ownSpeed !== null
    ? [
      h('p', { class: 'setting-help' }, `Egen hastighet: ${ownSpeed} ord/min.`),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          await db.updateBook(book.id, { wpm: null, remainingMs: null });
          close();
          refresh();
        },
      }, `Bruk standardhastighet (${loadSettings().wpm} ord/min)`),
    ]
    : h('p', { class: 'setting-help' },
      `Bruker standardhastigheten (${loadSettings().wpm} ord/min). Endre med − og + mens du leser.`);
  const languageButtons = Object.values(LANGUAGES).map((lang) => h('button', {
    class: `btn${book.lang === lang.code ? ' selected' : ''}`,
    type: 'button',
    onclick: async () => {
      await db.updateBook(book.id, { lang: lang.code, remainingMs: null });
      close();
      refresh();
    },
  }, `Språk: ${lang.name}`));
  const body = h('div', { class: 'action-list' },
    speed,
    h('p', { class: 'setting-help' }, 'Språket styrer forkortelser og stavelser i tempoberegningen.'),
    languageButtons,
    h('button', {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        await db.updateBook(book.id, { position: 0, finished: false });
        close();
        refresh();
      },
    }, 'Start fra begynnelsen'),
    h('button', {
      class: 'btn danger',
      type: 'button',
      onclick: async () => {
        if (!confirm(`Slette «${book.title}» fra denne enheten?`)) return;
        await db.deleteBook(book.id);
        close();
        refresh();
      },
    }, 'Slett boka'));
  const close = openSheet(book.title, body);
}

function bookItem(book, refresh) {
  const progress = book.wordCount > 1 ? book.position / (book.wordCount - 1) : 0;
  const status = book.finished
    ? 'Ferdig lest'
    : book.position > 0
      ? `${formatPercent(progress)}${book.remainingMs ? ` · ${formatDuration(book.remainingMs)} igjen` : ''}`
      : `${book.chapterCount} kapitler`;
  return h('li', { class: 'book' },
    h('button', { class: 'book-open', type: 'button', onclick: () => { location.hash = `#/bok/${book.id}`; } },
      h('span', { class: 'book-title' }, book.title),
      book.author ? h('span', { class: 'book-author' }, book.author) : null,
      h('span', { class: 'book-meta' },
        h('span', { class: 'badge' }, LANGUAGES[book.lang]?.short || '?'),
        h('span', { class: 'badge' }, book.format.toUpperCase()),
        h('span', null, status)),
      h('span', { class: 'progress', 'aria-hidden': 'true' },
        h('span', { style: `width:${(book.finished ? 1 : progress) * 100}%` }))),
    h('button', {
      class: 'icon-btn book-more',
      type: 'button',
      'aria-label': `Valg for ${book.title}`,
      onclick: () => bookActions(book, refresh),
    }, icon('more')));
}

// Progress restored from a backup for books that are not on this device yet.
function pendingSection(pending, refresh) {
  if (pending.length === 0) return null;
  return h('section', { class: 'pending-books' },
    h('h2', { class: 'section-title' }, 'Venter på bokfilen'),
    h('p', { class: 'setting-help' },
      'Fremdriften for disse bøkene er hentet fra en sikkerhetskopi. Legg til den samme filen igjen, ' +
      'så fortsetter du der du var.'),
    h('ul', { class: 'book-list' }, pending.map((book) => h('li', { class: 'book pending' },
      h('div', { class: 'book-open' },
        h('span', { class: 'book-title' }, book.title),
        book.author ? h('span', { class: 'book-author' }, book.author) : null,
        h('span', { class: 'book-meta' },
          h('span', null, `${formatPercent(book.position / Math.max(1, book.wordCount - 1))} lest`),
          book.fileName ? h('span', null, book.fileName) : null)),
      h('button', {
        class: 'icon-btn book-more',
        type: 'button',
        'aria-label': `Glem fremdriften for ${book.title}`,
        onclick: async () => {
          await db.deletePending(book.id);
          refresh();
        },
      }, icon('close'))))));
}

function emptyState() {
  return h('div', { class: 'empty' },
    h('h2', null, 'Ingen bøker ennå'),
    h('p', null, 'Last ned en gratis bok (EPUB, PDF eller tekstfil) til Filer-appen, og trykk «Legg til bok».'),
    h('ul', null, FREE_BOOK_SOURCES.map(([name, url, what]) =>
      h('li', null, h('a', { href: url, target: '_blank', rel: 'noopener' }, name), ` – ${what}`))));
}

export function openLibrary(root) {
  const fileInput = h('input', { type: 'file', accept: ACCEPTED_FILES, multiple: true, class: 'visually-hidden' });
  const list = h('div');
  const banners = h('div');
  const footer = h('footer', { class: 'library-footer' });

  const refresh = async () => {
    const [books, pending] = await Promise.all([db.listBooks(), db.listPending()]);
    books.sort((a, b) => (b.openedAt || b.addedAt) - (a.openedAt || a.addedAt));
    setChildren(list,
      books.length ? h('ul', { class: 'book-list' }, books.map((book) => bookItem(book, refresh))) : emptyState(),
      pendingSection(pending, refresh));
    const [status, storage] = await Promise.all([offlineStatus(), storageSummary()]);
    const lastBackup = lastBackupAt();
    setChildren(footer,
      h('div', { class: status.startsWith('✓') ? 'status-ok' : '' }, status),
      storage ? h('div', null, storage) : null,
      books.length ? h('div', null, lastBackup
        ? `Sist sikkerhetskopiert ${lastBackup.toLocaleDateString('nb-NO')}.`
        : 'Ingen sikkerhetskopi ennå (Innstillinger → Sikkerhetskopi).') : null,
      isStandalone() ? null : h('div', null, 'Tips: Del → «Legg til på Hjem-skjerm» for å bruke appen uten nett.'));
  };

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    await importFiles(files, refresh);
  });

  const view = h('div', { class: 'library' },
    h('header', { class: 'library-header' },
      h('h1', null, 'Bibliotek'),
      h('div', { class: 'library-actions' },
        h('button', {
          class: 'icon-btn',
          type: 'button',
          'aria-label': 'Innstillinger',
          onclick: () => openSettings({ canRestore: true }),
        }, icon('sliders')))),
    banners,
    h('button', { class: 'btn primary import-btn', type: 'button', onclick: () => fileInput.click() },
      icon('plus'), 'Legg til bok'),
    fileInput,
    list,
    footer);

  root.replaceChildren(view);
  refresh();
  const stopUpdates = onUpdateAvailable(() => banners.replaceChildren(updateBanner()));
  window.addEventListener('library-changed', refresh);
  return () => {
    stopUpdates();
    window.removeEventListener('library-changed', refresh);
  };
}
