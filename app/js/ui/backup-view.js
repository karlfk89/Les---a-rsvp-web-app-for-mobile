// Backup section of the settings sheet: save progress and settings to a file
// through the share sheet (Files, iCloud Drive, AirDrop) and restore them from
// such a file.

import { intlLocale, t } from '../i18n.js';
import {
  BackupError, createBackupFile, lastBackupAt, markBackedUp, parseBackup, restoreBackup,
} from '../storage/backup.js';
import { toggle } from './controls.js';
import { h, toast } from './dom.js';

const dateTime = (date) => new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' })
  .format(date);

function lastBackupText() {
  const last = lastBackupAt();
  return last ? t('backup.lastSaved', { date: dateTime(last) }) : t('backup.neverSaved');
}

// Opens the share sheet with the file, or downloads it where sharing files is
// not supported. Returns false when the user cancelled.
async function shareOrDownload(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: file.name, class: 'visually-hidden' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

function describe(backup) {
  return t('backup.confirmRestore', {
    date: backup.exportedAt ? dateTime(backup.exportedAt) : null,
    settings: Boolean(backup.settings),
    progress: backup.books.length,
    text: backup.books.filter((entry) => entry.chapters).length,
  });
}

export function backupSection({ canRestore, onRestored }) {
  let includeBooks = false;
  let ready = null;
  const last = h('p', { class: 'setting-help' }, lastBackupText());
  const saveButton = h('button', { class: 'btn primary', type: 'button' }, t('backup.save'));

  // The file is prepared in advance so the share sheet opens directly from the
  // tap; Safari only allows sharing right after a user action.
  const prepare = () => {
    ready = null;
    saveButton.disabled = true;
    saveButton.textContent = t('backup.preparing');
    const options = { includeBooks };
    createBackupFile(options).then((file) => {
      if (options.includeBooks !== includeBooks) return;
      ready = file;
      saveButton.disabled = false;
      saveButton.textContent = t('backup.save');
    }).catch(() => {
      saveButton.textContent = t('backup.saveFailed');
    });
  };

  saveButton.addEventListener('click', async () => {
    if (!ready) return;
    if (await shareOrDownload(ready)) {
      markBackedUp();
      last.textContent = lastBackupText();
    }
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden' });
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(describe(backup))) return;
      const result = await restoreBackup(backup);
      toast(t('backup.restored', result), { duration: 8000 });
      window.dispatchEvent(new Event('library-changed'));
      onRestored?.();
    } catch (error) {
      console.error(error);
      const message = error instanceof BackupError ? t(`backupError.${error.code}`) : t('backup.restoreFailed');
      toast(message, { error: true, duration: 7000 });
    }
  });

  prepare();
  return h('section', null,
    h('h3', null, t('backup.title')),
    h('p', { class: 'setting-help' }, t('backup.help')),
    toggle({
      label: t('backup.includeBooks'),
      checked: includeBooks,
      help: t('backup.includeBooksHelp'),
      onChange: (value) => {
        includeBooks = value;
        prepare();
      },
    }),
    h('div', { class: 'setting backup-actions' },
      saveButton,
      canRestore
        ? h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, t('backup.restore'))
        : null),
    canRestore ? fileInput : h('p', { class: 'setting-help' }, t('backup.restoreInLibrary')),
    last);
}
