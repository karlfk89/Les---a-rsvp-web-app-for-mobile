# Plan: RSVP-leser for iPhone (norsk, offline)

## Mål

- Lese gratis bøker (EPUB, PDF og tekstfiler) på iPhone, ett ord om gangen (RSVP), med fremhevet
  fokusbokstav.
- Fungere helt uten nett på flyturer.
- Håndtere bokmål, nynorsk og engelsk riktig: æøå, «sitater», replikkstrek, lange sammensatte ord,
  forkortelser og tall som «1 000» og «3,5».

## Beslutninger

| Spørsmål | Svar |
| --- | --- |
| Bruk | Fremtidige flyturer, altså uten nett |
| Plattform | Web-app (PWA) installert fra Safari; ingen Mac eller Xcode |
| Bøker | Gratis bøker i EPUB, PDF og tekstfiler |
| Språk | Bokmål, nynorsk og engelsk |
| Hosting | Selvhostet på Proxmox (LXC med Caddy), med HTTPS; se `docs/SELVHOSTING.md` |
| Ekstra i fase 1 | Ordene før og etter, og kapittelhopp |

## Hva vi tar med fra rsvpnano

[rsvpnano](https://github.com/ionutdecebal/rsvpnano) er firmware (C++) for ESP32-lesebrett. Web-,
Android- og iOS-appene der konverterer og overfører bøker; selve leseren finnes ikke på iPhone.
MIT-lisensen lar oss portere algoritmene med kreditering.

| Del | Kilde i rsvpnano | Port i dette repoet |
| --- | --- | --- |
| Tempo | `src/reader/ReadingLoop.cpp` | `app/js/reader/pacing.js`: grunntid `60000 / WPM`, tillegg for lange ord (over 6, 10 og 14 tegn), kompliserte ord og tegnsetting (komma 45 %, tankestrek 60 %, `;:` 80 %, `…` 110 %, `.` 135 %, `!?` 150 % av en justerbar pause) |
| Fokusbokstav | `src/ui/screens/ReaderScreen.cpp` (`focusOrdinal`) | `app/js/reader/orp.js`: lengde 1 → bokstav 1, 2–5 → 2, 6–9 → 3, 10–13 → 4, 14+ → 5 |
| Klokke | `ReadingLoop::update` | `app/js/reader/engine.js`: frist per ord, tar igjen etterslep |
| EPUB | `docs/conversion/spec.md` | `app/js/import/epub.js`: OPF, spine, NCX/nav, avvisning av DRM |
| Tekst og HTML | `docs/conversion/spec.md` | `app/js/import/txt.js`, `html.js`, `decode.js` |

Endret for norsk:

- Stum-e-regelen i stavelsesestimatet gjelder bare engelsk («jente», «gate» har to stavelser).
- Norske forkortelseslister (bokmål og nynorsk) i tillegg til engelsk.
- Korte setningsord som «Ja.» og «Nå.» får setningspause; rsvpnano behandlet alle ord på to
  bokstaver med punktum som forkortelser.
- Tankestrek (–) gir pause, replikkstrek og «» følger ordet, og avsnittsslutt gir alltid pause.
- Overskrifter som «FØRSTE STYKKE», «Anden Bog» og «Første kapitel» i eldre norske tekster.

## Status

### Fase 1: ferdig

- [x] Import av EPUB (2 og 3), PDF med tekstlag, TXT, Markdown og HTML fra Filer-appen
- [x] Tegnkoding: UTF-8, UTF-16, Windows-1252, reparasjon av «Ã¸»
- [x] PDF: avsnitt fra linjeavstand og innrykk, sammenføyning av orddeling, fjerning av sidetall og
      topptekst, kapitler fra bokmerker
- [x] Project Gutenberg-tekst fjernes fra TXT og EPUB
- [x] Automatisk språkgjenkjenning (bokmål, nynorsk, engelsk), kan endres per bok
- [x] RSVP med fokusbokstav, hjelpelinjer og ordene før og etter
- [x] Kapitteloversikt, kapittelhopp, tilbake til setningsstart, ord for ord, glidebryter
- [x] Avsnittet vises ved pause; trykk på et ord for å hoppe dit
- [x] Fremdrift og gjenstående tid lagres per bok
- [x] Innstillinger: hastighet, pauser, tema, skrift, størrelse, fokusfarge og -posisjon
- [x] Uten nett med service worker; skjermen holdes på under lesing
- [x] Selvhosting: Caddy-konfigurasjon, Docker og veiledning for Proxmox
- [x] Tester: enhetstester og ende-til-ende-test i Chromium (iPhone-størrelse, også i flymodus)

### Fase 2: ferdig

- [x] Selvhostet på Proxmox med Tailscale-HTTPS, installert og testet på iPhone i flymodus
- [x] Sikkerhetskopi av fremdrift og innstillinger, eventuelt med bøkene, via delingsarket;
      gjenoppretting der nyeste fremdrift vinner, og ventende fremdrift for bøker som legges til senere
- [x] Sveip for å spole (raskere sveip går lenger), og lesemodusen «Hold inne» der lesingen bare går
      mens fingeren ligger på skjermen
- [x] Hastighet per bok: − og + i leseren gir boka egen hastighet; andre bøker bruker
      standardhastigheten, og egen hastighet kan tilbakestilles fra bokvalgene eller innstillingene

### Fase 3: norsk finpuss

- [x] Lange sammensatte ord vises i deler («sykehus-» «parkerings-» «plassen»): ordet deles i kjente
      ledd (bokas ord og en liste over vanlige ledd, med bindebokstav og bøyning) der grensene er
      orddelingspunkter fra TeX-mønstrene (`hyph-no`, `hyph-en-us`) eller ligger mellom kjente ord;
      hver del får egen visningstid. Tankestrek uten mellomrom deler også ord («dialogue—perhaps»)
- [ ] Finjustering av tempo med lengre norske tekster
- [ ] Valgfritt: 2–3 korte ord samtidig («chunk»)

### Fase 4: valgfritt

- [ ] Norsk ordbok uten nett (lisens for ordbokdata må avklares)
- [ ] Lesestatistikk
- [ ] Skannede PDF-er (krever OCR, stort)

## Begrensninger

- Bøker med DRM (Adobe DRM, bibliotekapper, Bokhylla.no) kan ikke åpnes.
- PDF uten tekstlag (skannede sider) kan ikke leses; PDF med flere spalter kan få feil rekkefølge.
- Appen må installeres og bøkene legges til før avreise.
- Testene her kjører i Chromium, ikke Safari/WebKit; nye funksjoner må prøves på iPhone.
