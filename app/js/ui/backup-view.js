// «Sikkerhetskopi» section of the settings sheet: save progress and settings
// to a file through the share sheet (Filer, iCloud Drive, AirDrop) and restore
// them from such a file.

import {
  BackupError, createBackupFile, lastBackupAt, markBackedUp, parseBackup, restoreBackup,
} from '../storage/backup.js';
import { toggle } from './controls.js';
import { h, toast } from './dom.js';

const dateTime = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' });
const books = (n) => `${n} ${n === 1 ? 'bok' : 'bøker'}`;

function lastBackupText() {
  const last = lastBackupAt();
  return last ? `Sist lagret ${dateTime.format(last)}.` : 'Ingen sikkerhetskopi er lagret fra denne enheten ennå.';
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
  const withText = backup.books.filter((entry) => entry.chapters).length;
  const when = backup.exportedAt ? ` fra ${dateTime.format(backup.exportedAt)}` : '';
  const contents = [backup.settings ? 'innstillinger' : null,
    backup.books.length ? `fremdrift for ${books(backup.books.length)}` : null,
    withText ? `teksten til ${books(withText)}` : null].filter(Boolean).join(', ');
  return `Gjenopprette sikkerhetskopien${when}?\n\nDen inneholder ${contents || 'ingenting'}. ` +
    'Fremdrift som er nyere på denne enheten, beholdes.';
}

function summary(result) {
  const parts = [
    result.settings ? 'Innstillingene er gjenopprettet' : null,
    result.updated ? `${books(result.updated)} fikk fremdriften tilbake` : null,
    result.added ? `${books(result.added)} ble lagt til` : null,
    result.pending ? `${books(result.pending)} venter på at du legger til filen på nytt` : null,
    result.kept ? `${books(result.kept)} hadde nyere fremdrift her og ble beholdt` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join('. ')}.` : 'Sikkerhetskopien inneholdt ingenting å gjenopprette.';
}

export function backupSection({ canRestore, onRestored }) {
  let includeBooks = false;
  let ready = null;
  const last = h('p', { class: 'setting-help' }, lastBackupText());
  const saveButton = h('button', { class: 'btn primary', type: 'button' }, 'Lag sikkerhetskopi');

  // The file is prepared in advance so the share sheet opens directly from the
  // tap; Safari only allows sharing right after a user action.
  const prepare = () => {
    ready = null;
    saveButton.disabled = true;
    saveButton.textContent = 'Forbereder …';
    const options = { includeBooks };
    createBackupFile(options).then((file) => {
      if (options.includeBooks !== includeBooks) return;
      ready = file;
      saveButton.disabled = false;
      saveButton.textContent = 'Lag sikkerhetskopi';
    }).catch(() => {
      saveButton.textContent = 'Kunne ikke lage sikkerhetskopi';
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
      toast(summary(result), { duration: 8000 });
      window.dispatchEvent(new Event('library-changed'));
      onRestored?.();
    } catch (error) {
      console.error(error);
      const message = error instanceof BackupError ? error.message : 'Kunne ikke gjenopprette sikkerhetskopien.';
      toast(message, { error: true, duration: 7000 });
    }
  });

  prepare();
  return h('section', null,
    h('h3', null, 'Sikkerhetskopi'),
    h('p', { class: 'setting-help' },
      'Bøker og fremdrift ligger bare på denne enheten. Lagre en sikkerhetskopi i Filer eller iCloud Drive, ' +
      'så kan du hente fremdriften og innstillingene tilbake hvis appen slettes.'),
    toggle({
      label: 'Ta med bøkene',
      checked: includeBooks,
      help: 'Gir en større fil, men du slipper å legge til bøkene på nytt.',
      onChange: (value) => {
        includeBooks = value;
        prepare();
      },
    }),
    h('div', { class: 'setting backup-actions' },
      saveButton,
      canRestore
        ? h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Gjenopprett fra fil')
        : null),
    canRestore ? fileInput : h('p', { class: 'setting-help' }, 'Gå til biblioteket for å gjenopprette en sikkerhetskopi.'),
    last);
}
