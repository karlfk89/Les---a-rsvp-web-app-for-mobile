// Norwegian Bokmål interface texts. en.js has the same keys; entries that
// take parameters are functions.

const books = (n) => `${n} ${n === 1 ? 'bok' : 'bøker'}`;
const list = (items) => (items.length < 2
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} og ${items[items.length - 1]}`);

export default {
  'app.title': 'Les – RSVP-leser',

  'common.done': 'Ferdig',
  'common.settings': 'Innstillinger',
  'common.checking': 'Sjekker …',
  percent: ({ value }) => `${value} %`,
  wpm: ({ wpm }) => `${wpm} ord/min`,
  'duration.minutes': ({ minutes }) => `${minutes} min`,
  'duration.underMinute': '< 1 min',
  'duration.hours': ({ hours, minutes }) => (minutes ? `${hours} t ${minutes} min` : `${hours} t`),

  'lang.nb': 'Bokmål',
  'lang.nn': 'Nynorsk',
  'lang.en': 'Engelsk',
  'lang.nb.short': 'BM',
  'lang.nn.short': 'NN',
  'lang.en.short': 'EN',

  // Library
  'library.title': 'Bibliotek',
  'library.addBook': 'Legg til bok',
  'library.importing': ({ name }) => `Importerer «${name}» …`,
  'library.reading': ({ name, percent }) => `Leser «${name}» … ${percent}`,
  'library.exists': ({ title }) => `«${title}» finnes allerede i biblioteket.`,
  'library.added': ({ title, language }) => `La til «${title}» (${language.toLowerCase()}).`,
  'library.addedResumed': ({ title, percent }) => `La til «${title}» og fortsetter på ${percent}.`,
  'library.importFailed': ({ name, message }) => `Kunne ikke importere «${name}»: ${message}`,
  'library.unknownError': 'Ukjent feil under import.',
  'library.emptyTitle': 'Ingen bøker ennå',
  'library.emptyHelp': 'Last ned en gratis bok (EPUB, PDF eller tekstfil) til Filer-appen, og trykk «Legg til bok».',
  'library.sources': [
    ['Bokselskap.no', 'https://www.bokselskap.no', 'norske klassikere som EPUB'],
    ['Project Gutenberg', 'https://www.gutenberg.org/browse/languages/no', 'norske og engelske bøker'],
    ['Project Runeberg', 'https://runeberg.org', 'nordisk litteratur'],
    ['Standard Ebooks', 'https://standardebooks.org', 'engelske klassikere'],
  ],
  'library.lastBackup': ({ date }) => `Sist sikkerhetskopiert ${date}.`,
  'library.noBackup': 'Ingen sikkerhetskopi ennå (Innstillinger → Sikkerhetskopi).',
  'library.installTip': 'Tips: Del → «Legg til på Hjem-skjerm» for å bruke appen uten nett.',

  'book.options': ({ title }) => `Valg for ${title}`,
  'book.finished': 'Ferdig lest',
  'book.left': ({ duration }) => `${duration} igjen`,
  'book.chapters': ({ count }) => `${count} ${count === 1 ? 'kapittel' : 'kapitler'}`,
  'book.ownSpeed': ({ wpm }) => `Egen hastighet: ${wpm} ord/min.`,
  'book.useDefaultSpeed': ({ wpm }) => `Bruk standardhastighet (${wpm} ord/min)`,
  'book.followsDefaultSpeed': ({ wpm }) =>
    `Bruker standardhastigheten (${wpm} ord/min). Endre med − og + mens du leser.`,
  'book.languageHelp': 'Språket styrer forkortelser og stavelser i tempoberegningen.',
  'book.language': ({ language }) => `Språk: ${language}`,
  'book.restart': 'Start fra begynnelsen',
  'book.confirmDelete': ({ title }) => `Slette «${title}» fra denne enheten?`,
  'book.delete': 'Slett boka',
  'book.untitled': 'Uten tittel',

  'pending.title': 'Venter på bokfilen',
  'pending.help': 'Fremdriften for disse bøkene er hentet fra en sikkerhetskopi. Legg til den samme filen igjen, ' +
    'så fortsetter du der du var.',
  'pending.read': ({ percent }) => `${percent} lest`,
  'pending.forget': ({ title }) => `Glem fremdriften for ${title}`,

  // Import errors, by ImportError code
  'importError.invalidEpub': 'Filen er ikke en gyldig EPUB (kunne ikke pakkes ut).',
  'importError.noContainer': 'EPUB-en mangler META-INF/container.xml.',
  'importError.noPackage': 'Fant ikke pakkefilen (OPF) i EPUB-en.',
  'importError.drm': 'Boka er DRM-beskyttet og kan ikke åpnes.',
  'importError.kindle': 'Kindle-formater støttes ikke. Last ned boka som EPUB i stedet.',
  'importError.unknownFormat': 'Ukjent filformat. Bruk EPUB, PDF eller tekstfil.',
  'importError.noText': 'Fant ingen lesbar tekst i filen.',
  'importError.pdfPassword': 'PDF-en er passordbeskyttet.',
  'importError.pdfUnreadable': 'Kunne ikke lese PDF-filen.',
  'importError.pdfNoText': 'PDF-en har ingen tekst som kan leses (er den skannet?).',

  // Reader
  'reader.opening': 'Åpner boka …',
  'reader.empty': 'Boka er tom.',
  'reader.end': 'Du har lest ut boka.',
  'reader.back': 'Til biblioteket',
  'reader.chapters': 'Kapitler',
  'reader.prevChapter': 'Forrige kapittel',
  'reader.rewind': 'Tilbake til starten av setningen',
  'reader.prevWord': 'Forrige ord',
  'reader.play': 'Spill av',
  'reader.nextWord': 'Neste ord',
  'reader.nextChapter': 'Neste kapittel',
  'reader.slower': 'Saktere',
  'reader.faster': 'Raskere',
  'reader.context': 'Avsnittet du leser',
  'reader.position': 'Posisjon i boka',
  'reader.defaultSpeed': 'Standardhastighet',
  'reader.bookSpeed': 'Egen hastighet for denne boka',
  'reader.hintStart': 'Trykk på ordet for å begynne',
  'reader.hintResume': 'Trykk for å fortsette · sveip for å spole',
  'reader.hintHold': 'Hold fingeren på skjermen for å lese · trykk for meny',
  'reader.stageTap': 'Spill av eller pause',
  'reader.stageHold': 'Hold for å lese, trykk for meny',
  'reader.timeLeft': ({ chapter, book }) => `Igjen: ${chapter} i kapittelet · ${book} totalt`,

  // Settings
  'settings.language': 'Språk',
  'settings.appLanguage': 'Språk i appen',
  'settings.appLanguageHelp': 'Språket i hver bok finnes automatisk når den legges til, og kan endres i ' +
    'bokas meny i biblioteket.',
  'settings.reading': 'Lesing',
  'settings.defaultSpeed': 'Standardhastighet',
  'settings.defaultSpeedHelp': 'Gjennomsnittlig lesefart med pauser. Brukes for bøker der du ikke har endret ' +
    'hastigheten; endrer du den med − og + mens du leser, husker boka sin egen.',
  'settings.bookSpeed': ({ title, wpm }) => `«${title}» har egen hastighet: ${wpm} ord/min.`,
  'settings.useDefaultForBook': 'Bruk standardhastighet for denne boka',
  'settings.readingMode': 'Start og stopp',
  'settings.readingModeHelp': 'Trykk: trykk på ordet for å starte og stoppe. Hold inne: lesingen går bare mens ' +
    'du holder fingeren på skjermen, og et kort trykk viser menyen. Sveip til siden for å spole i begge.',
  'readingMode.tap': 'Trykk',
  'readingMode.hold': 'Hold inne',
  'settings.phantomWords': 'Vis ordene før og etter',
  'settings.phantomWordsHelp': 'Forrige og neste ord vises svakt på hver side.',
  'settings.splitLongWords': 'Del lange ord',
  'settings.splitLongWordsHelp': 'Lange sammensatte ord vises i deler, for eksempel «sykehus-» «parkerings-» ' +
    '«plassen». Delene følger orddelingsreglene og ord som finnes i boka.',
  'settings.splitLength': 'Del ord lengre enn',
  'settings.letters': ({ count }) => `${count} bokstaver`,
  'settings.showContext': 'Vis avsnittet ved pause',
  'settings.showContextHelp': 'Trykk på et ord i avsnittet for å hoppe dit.',
  'settings.guides': 'Hjelpelinjer',
  'settings.focusColor': 'Fokusbokstav',
  'focusColor.accent': 'Rød',
  'focusColor.orange': 'Oransje',
  'focusColor.blue': 'Blå',
  'focusColor.green': 'Grønn',
  'focusColor.none': 'Av',
  'settings.anchor': 'Fokusposisjon',
  'settings.anchorHelp': 'Hvor på skjermen fokusbokstaven står, målt fra venstre.',

  'settings.pacing': 'Pauser og rytme',
  'settings.pacingHelp': '100 % er standard. Pausene følger hastigheten, og hastigheten er alltid snittet med ' +
    'pausene medregnet: mer pause ett sted gir litt raskere visning ellers.',
  'settings.punctuation': 'Tegnsetting',
  'settings.punctuationHelp': 'Pause etter komma, tankestrek, punktum, spørsmålstegn og avsnitt.',
  'settings.longWords': 'Lange ord',
  'settings.longWordsHelp': 'Ekstra tid for lange ord, som «arbeidsmiljøloven».',
  'settings.complexWords': 'Vanskelige ord',
  'settings.complexWordsHelp': 'Ekstra tid for ord med mange stavelser, tall, forkortelser og navn.',
  'settings.smoothStart': 'Myk start',
  'settings.smoothStartHelp': 'De første ordene etter at du starter, vises litt saktere, så øynene finner rytmen.',
  'settings.resetPacing': 'Tilbakestill pauser',

  'settings.appearance': 'Utseende',
  'settings.theme': 'Tema',
  'theme.dark': 'Mørk',
  'theme.black': 'Svart',
  'theme.light': 'Lys',
  'theme.sepia': 'Sepia',
  'settings.font': 'Skrift',
  'font.serif': 'Serif',
  'font.sans': 'Sans',
  'font.rounded': 'Rund',
  'font.mono': 'Mono',
  'settings.fontSize': 'Skriftstørrelse',

  'settings.about': 'Om',
  'settings.version': ({ version }) => `Versjon ${version}.`,
  'settings.aboutBefore': 'Les er fri programvare under MIT-lisensen. Tempo- og fokusreglene bygger på ',
  'settings.aboutAfter': ' (MIT). PDF-støtte med pdf.js (Apache 2.0), EPUB-utpakking med fflate (MIT). ' +
    'Orddeling med TeX-mønstrene fra hyph-utf8 av Rune Kleveland og Ole Michael Selberg (norsk) og ' +
    'Gerard D.C. Kuiken (engelsk).',
  'settings.showLicences': 'Vis lisenser',
  'settings.resetAll': 'Tilbakestill alle innstillinger',
  'licences.title': 'Lisenser',
  'licences.loading': 'Laster …',
  'licences.missing': 'Fant ikke lisensfilen.',

  // Offline and updates
  'offline.unsupported': 'Nettleseren støtter ikke lesing uten nett.',
  'offline.needsHttps': 'Lesing uten nett krever HTTPS.',
  'offline.downloading': 'Laster ned appen for bruk uten nett …',
  'offline.ready': '✓ Klar for bruk uten nett.',
  'offline.storage': ({ mb, persistent }) => `${mb} MB brukt${persistent ? ' · varig lagring' : ''}`,
  'update.ready': 'En ny versjon av appen er klar.',
  'update.apply': 'Oppdater',

  // Backup
  'backup.title': 'Sikkerhetskopi',
  'backup.help': 'Bøker og fremdrift ligger bare på denne enheten. Lagre en sikkerhetskopi i Filer eller ' +
    'iCloud Drive, så kan du hente fremdriften og innstillingene tilbake hvis appen slettes.',
  'backup.includeBooks': 'Ta med bøkene',
  'backup.includeBooksHelp': 'Gir en større fil, men du slipper å legge til bøkene på nytt.',
  'backup.save': 'Lag sikkerhetskopi',
  'backup.preparing': 'Forbereder …',
  'backup.saveFailed': 'Kunne ikke lage sikkerhetskopi',
  'backup.restore': 'Gjenopprett fra fil',
  'backup.restoreInLibrary': 'Gå til biblioteket for å gjenopprette en sikkerhetskopi.',
  'backup.fileName': ({ date }) => `les-sikkerhetskopi-${date}.json`,
  'backup.lastSaved': ({ date }) => `Sist lagret ${date}.`,
  'backup.neverSaved': 'Ingen sikkerhetskopi er lagret fra denne enheten ennå.',
  'backup.confirmRestore': ({ date, settings, progress, text }) => {
    const contents = [settings ? 'innstillinger' : null, progress ? `fremdrift for ${books(progress)}` : null,
      text ? `teksten til ${books(text)}` : null].filter(Boolean);
    return `Gjenopprette sikkerhetskopien${date ? ` fra ${date}` : ''}?\n\nDen inneholder ` +
      `${list(contents) || 'ingenting'}. Fremdrift som er nyere på denne enheten, beholdes.`;
  },
  'backup.restored': ({ settings, updated, added, pending, kept }) => {
    const parts = [
      settings ? 'Innstillingene er gjenopprettet' : null,
      updated ? `${books(updated)} fikk fremdriften tilbake` : null,
      added ? `${books(added)} ble lagt til` : null,
      pending ? `${books(pending)} venter på at du legger til filen på nytt` : null,
      kept ? `${books(kept)} hadde nyere fremdrift her og ble beholdt` : null,
    ].filter(Boolean);
    return parts.length ? `${parts.join('. ')}.` : 'Sikkerhetskopien inneholdt ingenting å gjenopprette.';
  },
  'backup.restoreFailed': 'Kunne ikke gjenopprette sikkerhetskopien.',
  'backupError.notBackup': 'Filen er ikke en sikkerhetskopi fra Les.',
  'backupError.newer': 'Sikkerhetskopien er laget av en nyere versjon av appen. Oppdater appen først.',
};
