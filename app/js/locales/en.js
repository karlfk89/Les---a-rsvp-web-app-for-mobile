// English interface texts. nb.js has the same keys; entries that take
// parameters are functions.

const books = (n) => `${n} ${n === 1 ? 'book' : 'books'}`;
const list = (items) => (items.length < 2
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export default {
  'app.title': 'Les – RSVP reader',

  'common.done': 'Done',
  'common.settings': 'Settings',
  'common.checking': 'Checking …',
  percent: ({ value }) => `${value}%`,
  wpm: ({ wpm }) => `${wpm} words/min`,
  'duration.minutes': ({ minutes }) => `${minutes} min`,
  'duration.underMinute': '< 1 min',
  'duration.hours': ({ hours, minutes }) => (minutes ? `${hours} h ${minutes} min` : `${hours} h`),

  'lang.nb': 'Norwegian Bokmål',
  'lang.nn': 'Norwegian Nynorsk',
  'lang.en': 'English',
  'lang.nb.short': 'NB',
  'lang.nn.short': 'NN',
  'lang.en.short': 'EN',

  // Library
  'library.title': 'Library',
  'library.addBook': 'Add book',
  'library.importing': ({ name }) => `Importing “${name}” …`,
  'library.reading': ({ name, percent }) => `Reading “${name}” … ${percent}`,
  'library.exists': ({ title }) => `“${title}” is already in the library.`,
  'library.added': ({ title, language }) => `Added “${title}” (${language}).`,
  'library.addedResumed': ({ title, percent }) => `Added “${title}”, continuing at ${percent}.`,
  'library.importFailed': ({ name, message }) => `Could not import “${name}”: ${message}`,
  'library.unknownError': 'Unknown error during import.',
  'library.emptyTitle': 'No books yet',
  'library.emptyHelp': 'Download a free book (EPUB, PDF or text file) to the Files app and tap “Add book”.',
  'library.sources': [
    ['Project Gutenberg', 'https://www.gutenberg.org', 'free classics in English and many other languages'],
    ['Standard Ebooks', 'https://standardebooks.org', 'carefully formatted English classics'],
    ['Bokselskap.no', 'https://www.bokselskap.no', 'Norwegian classics as EPUB'],
    ['Project Runeberg', 'https://runeberg.org', 'Nordic literature'],
  ],
  'library.lastBackup': ({ date }) => `Last backed up ${date}.`,
  'library.noBackup': 'No backup yet (Settings → Backup).',
  'library.installTip': 'Tip: Share → “Add to Home Screen” to use the app offline.',

  'book.options': ({ title }) => `Options for ${title}`,
  'book.finished': 'Finished',
  'book.left': ({ duration }) => `${duration} left`,
  'book.chapters': ({ count }) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`,
  'book.ownSpeed': ({ wpm }) => `Own speed: ${wpm} words/min.`,
  'book.useDefaultSpeed': ({ wpm }) => `Use the default speed (${wpm} words/min)`,
  'book.followsDefaultSpeed': ({ wpm }) =>
    `Uses the default speed (${wpm} words/min). Change it with − and + while reading.`,
  'book.languageHelp': 'The language decides the abbreviations and syllable rules used for pacing.',
  'book.language': ({ language }) => `Language: ${language}`,
  'book.restart': 'Start from the beginning',
  'book.confirmDelete': ({ title }) => `Delete “${title}” from this device?`,
  'book.delete': 'Delete book',
  'book.untitled': 'Untitled',

  'pending.title': 'Waiting for the book file',
  'pending.help': 'The progress for these books comes from a backup. Add the same file again to continue ' +
    'where you left off.',
  'pending.read': ({ percent }) => `${percent} read`,
  'pending.forget': ({ title }) => `Forget the progress for ${title}`,

  // Import errors, by ImportError code
  'importError.invalidEpub': 'The file is not a valid EPUB (it could not be unpacked).',
  'importError.noContainer': 'The EPUB is missing META-INF/container.xml.',
  'importError.noPackage': 'Could not find the package file (OPF) in the EPUB.',
  'importError.drm': 'The book is DRM protected and cannot be opened.',
  'importError.kindle': 'Kindle formats are not supported. Download the book as EPUB instead.',
  'importError.unknownFormat': 'Unknown file format. Use EPUB, PDF or a text file.',
  'importError.noText': 'Found no readable text in the file.',
  'importError.pdfPassword': 'The PDF is password protected.',
  'importError.pdfUnreadable': 'Could not read the PDF file.',
  'importError.pdfNoText': 'The PDF has no text that can be read (is it scanned?).',

  // Reader
  'reader.opening': 'Opening the book …',
  'reader.empty': 'The book is empty.',
  'reader.end': 'You have finished the book.',
  'reader.back': 'Back to library',
  'reader.chapters': 'Chapters',
  'reader.prevChapter': 'Previous chapter',
  'reader.rewind': 'Back to the start of the sentence',
  'reader.prevWord': 'Previous word',
  'reader.play': 'Play',
  'reader.nextWord': 'Next word',
  'reader.nextChapter': 'Next chapter',
  'reader.slower': 'Slower',
  'reader.faster': 'Faster',
  'reader.context': 'The paragraph you are reading',
  'reader.position': 'Position in the book',
  'reader.defaultSpeed': 'Default speed',
  'reader.bookSpeed': 'Own speed for this book',
  'reader.hintStart': 'Tap the word to start',
  'reader.hintResume': 'Tap to continue · swipe to scrub',
  'reader.hintHold': 'Hold a finger on the screen to read · tap for menu',
  'reader.stageTap': 'Play or pause',
  'reader.stageHold': 'Hold to read, tap for menu',
  'reader.timeLeft': ({ chapter, book }) => `${chapter} left in chapter · ${book} in book`,

  // Settings
  'settings.language': 'Language',
  'settings.appLanguage': 'App language',
  'settings.appLanguageHelp': 'The language of each book is detected when it is added and can be changed ' +
    'from the book’s menu in the library.',
  'settings.reading': 'Reading',
  'settings.defaultSpeed': 'Default speed',
  'settings.defaultSpeedHelp': 'Average reading speed, pauses included. Used for books where you have not ' +
    'changed the speed; change it with − and + while reading and the book keeps its own.',
  'settings.bookSpeed': ({ title, wpm }) => `“${title}” has its own speed: ${wpm} words/min.`,
  'settings.useDefaultForBook': 'Use the default speed for this book',
  'settings.readingMode': 'Start and stop',
  'settings.readingModeHelp': 'Tap: tap the word to start and stop. Hold: reading runs only while you keep a ' +
    'finger on the screen, and a short tap shows the menu. Swipe sideways to scrub in both.',
  'readingMode.tap': 'Tap',
  'readingMode.hold': 'Hold',
  'settings.phantomWords': 'Show the words before and after',
  'settings.phantomWordsHelp': 'The previous and next words are shown faintly on each side.',
  'settings.splitLongWords': 'Split long words',
  'settings.splitLongWordsHelp': 'Long compound words are shown in parts, like the Norwegian “sykehus-” ' +
    '“parkerings-” “plassen”. The parts follow the hyphenation rules and words found in the book.',
  'settings.splitLength': 'Split words longer than',
  'settings.letters': ({ count }) => `${count} letters`,
  'settings.showContext': 'Show the paragraph when paused',
  'settings.showContextHelp': 'Tap a word in the paragraph to jump there.',
  'settings.guides': 'Guide lines',
  'settings.focusColor': 'Focus letter',
  'focusColor.accent': 'Red',
  'focusColor.orange': 'Orange',
  'focusColor.blue': 'Blue',
  'focusColor.green': 'Green',
  'focusColor.none': 'Off',
  'settings.anchor': 'Focus position',
  'settings.anchorHelp': 'Where on the screen the focus letter sits, measured from the left.',

  'settings.pacing': 'Pauses and rhythm',
  'settings.pacingHelp': '100% is the default. Pauses follow the speed, and the speed is always the average ' +
    'with pauses included: more pause in one place means slightly faster words elsewhere.',
  'settings.punctuation': 'Punctuation',
  'settings.punctuationHelp': 'Pause after commas, dashes, full stops, question marks and paragraphs.',
  'settings.longWords': 'Long words',
  'settings.longWordsHelp': 'Extra time for long words, like “responsibilities”.',
  'settings.complexWords': 'Difficult words',
  'settings.complexWordsHelp': 'Extra time for words with many syllables, numbers, abbreviations and names.',
  'settings.smoothStart': 'Smooth start',
  'settings.smoothStartHelp': 'The first words after you start are shown a little slower, so your eyes find ' +
    'the rhythm.',
  'settings.resetPacing': 'Reset pauses',

  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'theme.dark': 'Dark',
  'theme.black': 'Black',
  'theme.light': 'Light',
  'theme.sepia': 'Sepia',
  'settings.font': 'Font',
  'font.serif': 'Serif',
  'font.sans': 'Sans',
  'font.rounded': 'Rounded',
  'font.mono': 'Mono',
  'settings.fontSize': 'Font size',

  'settings.about': 'About',
  'settings.version': ({ version }) => `Version ${version}.`,
  'settings.aboutBefore': 'Les is free software under the MIT License. The pacing and focus rules build on ',
  'settings.aboutAfter': ' (MIT). PDF support by pdf.js (Apache 2.0), EPUB unpacking by fflate (MIT). ' +
    'Hyphenation with the TeX patterns from hyph-utf8 by Rune Kleveland and Ole Michael Selberg (Norwegian) ' +
    'and Gerard D.C. Kuiken (English).',
  'settings.showLicences': 'Show licenses',
  'settings.resetAll': 'Reset all settings',
  'licences.title': 'Licenses',
  'licences.loading': 'Loading …',
  'licences.missing': 'Could not find the license file.',

  // Offline and updates
  'offline.unsupported': 'This browser cannot keep the app for offline reading.',
  'offline.needsHttps': 'Offline reading requires HTTPS.',
  'offline.downloading': 'Downloading the app for offline use …',
  'offline.ready': '✓ Ready for offline use.',
  'offline.storage': ({ mb, persistent }) => `${mb} MB used${persistent ? ' · persistent storage' : ''}`,
  'update.ready': 'A new version of the app is ready.',
  'update.apply': 'Update',

  // Backup
  'backup.title': 'Backup',
  'backup.help': 'Books and progress are stored only on this device. Save a backup to Files or iCloud Drive ' +
    'to get your progress and settings back if the app is deleted.',
  'backup.includeBooks': 'Include the books',
  'backup.includeBooksHelp': 'Makes a larger file, but you will not have to add the books again.',
  'backup.save': 'Save backup',
  'backup.preparing': 'Preparing …',
  'backup.saveFailed': 'Could not create a backup',
  'backup.restore': 'Restore from file',
  'backup.restoreInLibrary': 'Go to the library to restore a backup.',
  'backup.fileName': ({ date }) => `les-backup-${date}.json`,
  'backup.lastSaved': ({ date }) => `Last saved ${date}.`,
  'backup.neverSaved': 'No backup has been saved from this device yet.',
  'backup.confirmRestore': ({ date, settings, progress, text }) => {
    const contents = [settings ? 'settings' : null, progress ? `progress for ${books(progress)}` : null,
      text ? `the text of ${books(text)}` : null].filter(Boolean);
    return `Restore the backup${date ? ` from ${date}` : ''}?\n\nIt contains ${list(contents) || 'nothing'}. ` +
      'Progress that is newer on this device is kept.';
  },
  'backup.restored': ({ settings, updated, added, pending, kept }) => {
    const parts = [
      settings ? 'The settings were restored' : null,
      updated ? `${books(updated)} got ${updated === 1 ? 'its' : 'their'} progress back` : null,
      added ? `${books(added)} ${added === 1 ? 'was' : 'were'} added` : null,
      pending ? `${books(pending)} ${pending === 1 ? 'is waiting for you to add the file' : 'are waiting for ' +
        'you to add the files'} again` : null,
      kept ? `${books(kept)} had newer progress here and ${kept === 1 ? 'was' : 'were'} kept` : null,
    ].filter(Boolean);
    return parts.length ? `${parts.join('. ')}.` : 'The backup had nothing to restore.';
  },
  'backup.restoreFailed': 'Could not restore the backup.',
  'backupError.notBackup': 'The file is not a backup from Les.',
  'backupError.newer': 'The backup was made by a newer version of the app. Update the app first.',
};
