// Backup files with reading progress and settings, optionally with the books'
// text. A book's id is a hash of its original file, so progress for a book
// that is not on this device is kept as «pending» and applied when the same
// book is added again. On restore, whichever side was read most recently wins.

import { t } from '../i18n.js';
import { LANGUAGES } from '../text/language.js';
import { VERSION } from '../version.js';
import { WPM_MAX, WPM_MIN, loadSettings, normalizeSettings, updateSettings } from '../settings.js';
import * as db from './db.js';

export const BACKUP_APP = 'les-rsvp';
export const BACKUP_FORMAT = 1;
const LAST_BACKUP_KEY = 'rsvp-last-backup';

// `code` names the problem; the interface shows it as backupError.<code>.
export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const RECORD_FIELDS = {
  id: 'string',
  title: 'string',
  author: 'string',
  lang: 'string',
  format: 'string',
  fileName: 'string',
  wordCount: 'number',
  chapterCount: 'number',
  position: 'number',
  finished: 'boolean',
  addedAt: 'number',
  openedAt: 'number',
  wpm: 'number',
  pacingModel: 'number',
};

// Only known fields with the right type; null when the entry is unusable.
function cleanRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const record = {};
  for (const [field, type] of Object.entries(RECORD_FIELDS)) {
    if (typeof raw[field] === type && (type !== 'number' || Number.isFinite(raw[field]))) record[field] = raw[field];
  }
  if (!record.id || !record.title || !(record.wordCount > 0)) return null;
  record.author = record.author || '';
  record.position = Math.min(Math.max(0, Math.round(record.position || 0)), record.wordCount - 1);
  if (!LANGUAGES[record.lang]) delete record.lang;
  if (!(record.wpm >= WPM_MIN && record.wpm <= WPM_MAX)) delete record.wpm;
  return record;
}

function cleanChapters(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw.every((chapter) => chapter && typeof chapter.title === 'string' &&
    Array.isArray(chapter.paragraphs) && chapter.paragraphs.every((p) => typeof p === 'string'));
  return valid ? raw.map((chapter) => ({ title: chapter.title, paragraphs: chapter.paragraphs })) : null;
}

export function buildBackup({ books, contents = null, settings, version = VERSION, now = new Date() }) {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version,
    exportedAt: now.toISOString(),
    settings,
    books: books.map((book) => {
      const record = cleanRecord(book) || {};
      const chapters = contents?.get(book.id);
      return chapters ? { ...record, chapters } : record;
    }),
  };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('notBackup');
  }
  if (!data || data.app !== BACKUP_APP || !Number.isInteger(data.format)) {
    throw new BackupError('notBackup');
  }
  if (data.format > BACKUP_FORMAT) {
    throw new BackupError('newer');
  }
  const books = (Array.isArray(data.books) ? data.books : [])
    .map((raw) => ({ record: cleanRecord(raw), chapters: cleanChapters(raw?.chapters) }))
    .filter((entry) => entry.record);
  const exportedAt = Date.parse(data.exportedAt);
  return {
    exportedAt: Number.isFinite(exportedAt) ? new Date(exportedAt) : null,
    settings: data.settings && typeof data.settings === 'object' ? normalizeSettings(data.settings) : null,
    books,
  };
}

const titleKey = (book) => `${book.title}\u0000${book.author || ''}`.toLowerCase();

// The same file (same id), or else a book with the same title and author,
// for example a newer download of the same Gutenberg book. Among those, the
// same format is preferred, so «Sult» as EPUB and as TXT stay apart.
export function findMatch(book, candidates) {
  const sameFile = candidates.find((candidate) => candidate.id === book.id);
  if (sameFile) return sameFile;
  const sameTitle = candidates.filter((candidate) => titleKey(candidate) === titleKey(book));
  return sameTitle.find((candidate) => candidate.format === book.format) || sameTitle[0] || null;
}

// Moves a position to a book whose word count differs, keeping the fraction read.
function mapPosition(from, to) {
  if (from.wordCount === to.wordCount) return from.position;
  const fraction = from.position / Math.max(1, from.wordCount - 1);
  return Math.min(to.wordCount - 1, Math.max(0, Math.round(fraction * (to.wordCount - 1))));
}

export function progressFor(saved, book) {
  const changes = {
    position: mapPosition(saved, book),
    finished: Boolean(saved.finished),
    openedAt: saved.openedAt || 0,
    remainingMs: null,
  };
  if (saved.lang) changes.lang = saved.lang;
  if (saved.wpm) {
    changes.wpm = saved.wpm;
    // Speeds from before pacing model 2 are converted when read (bookSpeed).
    changes.pacingModel = saved.pacingModel ?? 1;
  }
  return changes;
}

export function planRestore(backup, localBooks) {
  const plan = { updates: [], adds: [], pending: [], kept: 0 };
  const backupIds = new Set(backup.books.map((entry) => entry.record.id));
  for (const { record, chapters } of backup.books) {
    // A local book with its own entry in the backup is not a title match for another entry.
    const candidates = localBooks.filter((book) => book.id === record.id || !backupIds.has(book.id));
    const match = findMatch(record, candidates);
    if (match) {
      if ((record.openedAt || 0) > (match.openedAt || 0)) {
        plan.updates.push({ id: match.id, changes: progressFor(record, match) });
      } else {
        plan.kept++;
      }
    } else if (chapters) {
      plan.adds.push({
        record: { lang: 'nb', format: 'txt', fileName: '', addedAt: Date.now(), openedAt: 0, ...record,
          chapterCount: chapters.length, remainingMs: null },
        chapters,
      });
    } else {
      plan.pending.push(record);
    }
  }
  return plan;
}

// ---------- Storage and settings ----------

export async function createBackupFile({ includeBooks = false } = {}) {
  const books = await db.listBooks();
  let contents = null;
  if (includeBooks) {
    contents = new Map();
    for (const book of books) contents.set(book.id, (await db.getContent(book.id))?.chapters);
  }
  const backup = buildBackup({ books, contents, settings: loadSettings() });
  const date = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(backup)], t('backup.fileName', { date }), { type: 'application/json' });
}

export async function restoreBackup(backup) {
  const plan = planRestore(backup, await db.listBooks());
  // The interface language stays as chosen on this device; older backups do not have one.
  if (backup.settings) updateSettings({ ...backup.settings, uiLanguage: loadSettings().uiLanguage });
  for (const { id, changes } of plan.updates) await db.updateBook(id, changes);
  for (const { record, chapters } of plan.adds) await db.addBook(record, chapters);
  if (plan.pending.length) await db.putPending(plan.pending);
  return {
    settings: Boolean(backup.settings),
    updated: plan.updates.length,
    added: plan.adds.length,
    pending: plan.pending.length,
    kept: plan.kept,
  };
}

// Applies progress saved for a book that has just been added. Returns the
// changes, or null when there was nothing waiting for it.
export async function applyPendingProgress(book) {
  const match = findMatch(book, await db.listPending());
  if (!match) return null;
  const changes = progressFor(match, book);
  await db.updateBook(book.id, changes);
  await db.deletePending(match.id);
  return changes;
}

export function lastBackupAt() {
  try {
    const value = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return value > 0 ? new Date(value) : null;
  } catch {
    return null;
  }
}

export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: the backup itself still succeeded.
  }
}
