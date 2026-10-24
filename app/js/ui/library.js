// Library: import books, list them with progress, open, change language or delete.

import { intlLocale, t } from '../i18n.js';
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

async function importFiles(files, refresh) {
  requestPersistentStorage();
  for (const file of files) {
    const note = toast(t('library.importing', { name: file.name }), { duration: 0 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const id = await bookId(bytes);
      const existing = await db.getBook(id);
      if (existing) {
        note.update(t('library.exists', { title: existing.title }), { duration: 3500 });
        continue;
      }
      const book = await parseBook(bytes, file.name, {
        onProgress: (fraction) => note.update(t('library.reading', {
          name: file.name, percent: t('percent', { value: Math.round(fraction * 100) }),
        })),
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
        ? t('library.addedResumed', {
          title: book.title, percent: formatPercent(resumed.position / Math.max(1, book.wordCount - 1)),
        })
        : t('library.added', { title: book.title, language: t(`lang.${book.lang}`) }), { duration: 3500 });
      await refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof ImportError ? t(`importError.${error.code}`) : t('library.unknownError');
      note.update(t('library.importFailed', { name: file.name, message }), { error: true, duration: 7000 });
    }
  }
}

function bookActions(book, refresh) {
  const ownSpeed = bookSpeed(book);
  const speed = ownSpeed !== null
    ? [
      h('p', { class: 'setting-help' }, t('book.ownSpeed', { wpm: ownSpeed })),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          await db.updateBook(book.id, { wpm: null, remainingMs: null });
          close();
          refresh();
        },
      }, t('book.useDefaultSpeed', { wpm: loadSettings().wpm })),
    ]
    : h('p', { class: 'setting-help' }, t('book.followsDefaultSpeed', { wpm: loadSettings().wpm }));
  const languageButtons = Object.values(LANGUAGES).map((lang) => h('button', {
    class: `btn${book.lang === lang.code ? ' selected' : ''}`,
    type: 'button',
    onclick: async () => {
      await db.updateBook(book.id, { lang: lang.code, remainingMs: null });
      close();
      refresh();
    },
  }, t('book.language', { language: t(`lang.${lang.code}`) })));
  const body = h('div', { class: 'action-list' },
    speed,
    h('p', { class: 'setting-help' }, t('book.languageHelp')),
    languageButtons,
    h('button', {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        await db.updateBook(book.id, { position: 0, finished: false });
        close();
        refresh();
      },
    }, t('book.restart')),
    h('button', {
      class: 'btn danger',
      type: 'button',
      onclick: async () => {
        if (!confirm(t('book.confirmDelete', { title: book.title }))) return;
        await db.deleteBook(book.id);
        close();
        refresh();
      },
    }, t('book.delete')));
  const close = openSheet(book.title, body);
}

function bookItem(book, refresh) {
  const progress = book.wordCount > 1 ? book.position / (book.wordCount - 1) : 0;
  const left = book.remainingMs ? ` · ${t('book.left', { duration: formatDuration(book.remainingMs) })}` : '';
  const status = book.finished
    ? t('book.finished')
    : book.position > 0 ? `${formatPercent(progress)}${left}` : t('book.chapters', { count: book.chapterCount });
  return h('li', { class: 'book' },
    h('button', { class: 'book-open', type: 'button', onclick: () => { location.hash = `#/bok/${book.id}`; } },
      h('span', { class: 'book-title' }, book.title),
      book.author ? h('span', { class: 'book-author' }, book.author) : null,
      h('span', { class: 'book-meta' },
        h('span', { class: 'badge' }, LANGUAGES[book.lang] ? t(`lang.${book.lang}.short`) : '?'),
        h('span', { class: 'badge' }, book.format.toUpperCase()),
        h('span', null, status)),
      h('span', { class: 'progress', 'aria-hidden': 'true' },
        h('span', { style: `width:${(book.finished ? 1 : progress) * 100}%` }))),
    h('button', {
      class: 'icon-btn book-more',
      type: 'button',
      'aria-label': t('book.options', { title: book.title }),
      onclick: () => bookActions(book, refresh),
    }, icon('more')));
}

// Progress restored from a backup for books that are not on this device yet.
function pendingSection(pending, refresh) {
  if (pending.length === 0) return null;
  return h('section', { class: 'pending-books' },
    h('h2', { class: 'section-title' }, t('pending.title')),
    h('p', { class: 'setting-help' }, t('pending.help')),
    h('ul', { class: 'book-list' }, pending.map((book) => h('li', { class: 'book pending' },
      h('div', { class: 'book-open' },
        h('span', { class: 'book-title' }, book.title),
        book.author ? h('span', { class: 'book-author' }, book.author) : null,
        h('span', { class: 'book-meta' },
          h('span', null,
            t('pending.read', { percent: formatPercent(book.position / Math.max(1, book.wordCount - 1)) })),
          book.fileName ? h('span', null, book.fileName) : null)),
      h('button', {
        class: 'icon-btn book-more',
        type: 'button',
        'aria-label': t('pending.forget', { title: book.title }),
        onclick: async () => {
          await db.deletePending(book.id);
          refresh();
        },
      }, icon('close'))))));
}

function emptyState() {
  return h('div', { class: 'empty' },
    h('h2', null, t('library.emptyTitle')),
    h('p', null, t('library.emptyHelp')),
    h('ul', null, t('library.sources').map(([name, url, what]) =>
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
        ? t('library.lastBackup', { date: lastBackup.toLocaleDateString(intlLocale()) })
        : t('library.noBackup')) : null,
      isStandalone() ? null : h('div', null, t('library.installTip')));
  };

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    await importFiles(files, refresh);
  });

  const view = h('div', { class: 'library' },
    h('header', { class: 'library-header' },
      h('h1', null, t('library.title')),
      h('div', { class: 'library-actions' },
        h('button', {
          class: 'icon-btn',
          type: 'button',
          'aria-label': t('common.settings'),
          onclick: () => openSettings({ canRestore: true }),
        }, icon('sliders')))),
    banners,
    h('button', { class: 'btn primary import-btn', type: 'button', onclick: () => fileInput.click() },
      icon('plus'), t('library.addBook')),
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
