# Plan: RSVP-leser for iPhone (norsk, offline)

## Mål

- Lese egne bøker (EPUB og TXT) på iPhone, ett ord om gangen (RSVP), med fremhevet fokusbokstav.
- Fungere helt uten nett (flymodus).
- Håndtere norsk riktig: æøå, «sitater», replikkstrek, lange sammensatte ord, norske forkortelser
  og tall som «1 000» og «3,5».

## Hva vi kan lære av rsvpnano

[rsvpnano](https://github.com/ionutdecebal/rsvpnano) er firmware (C++) for ESP32-lesebrett fra
Waveshare. Web-, Android- og iOS-appene der er bare *companions*: de konverterer bøker og overfører
dem til brettet. Selve leseren finnes ikke på iPhone. Koden kan derfor ikke gjenbrukes direkte, men
MIT-lisensen lar oss portere algoritmene (med kreditering).

| Del | Kilde i rsvpnano | Hva vi tar med |
| --- | --- | --- |
| Tempo (pacing) | `src/reader/ReadingLoop.cpp` | Grunntid `60000 / WPM` per ord pluss tillegg for lange ord (over 6, 10 og 14 tegn), kompliserte ord (mange stavelser, tall, VERSALER) og tegnsetting: komma 45 %, tankestrek 60 %, `;` og `:` 80 %, `…` 110 %, `.` 135 %, `!` og `?` 150 % av en justerbar pause (standard 200 ms). Ord med punktum som ser ut som forkortelser får ingen setningspause. |
| Fokusbokstav (ORP) | `src/ui/screens/ReaderScreen.cpp` (`focusOrdinal`) | Ordlengde 1 → bokstav 1, 2–5 → 2, 6–9 → 3, 10–13 → 4, 14+ → 5. Fokusbokstaven står fast på 30–40 % av skjermbredden, med hjelpelinjer over og under. |
| Bokformat | `docs/conversion/spec.md` | Internt format med `@chapter`, `@para` og `@language` etter import. |
| EPUB | `docs/conversion/spec.md` | `container.xml` → OPF → spine; NCX- eller nav-innholdsfortegnelse gir kapitler; bøker med `encryption.xml` (DRM) avvises med tydelig melding. |
| Tekstnormalisering | `src/text/TextNormalizer.cpp`, spesifikasjonen | Slå sammen mellomrom, ligaturer, hardt mellomrom; tegnkoding UTF-8 med fallback til Windows-1252 og Latin-1. |
| Funksjoner | `README.md` | Spøkelsesord (forrige og neste ord svakt), pause ved setningsslutt, spol tilbake til setningsstart, kapittelhopp, sidevisning, innstillinger per bok. |

Det som er engelskspesifikt i rsvpnano og må endres for norsk:

- **Stavelsesestimatet** trekker fra én stavelse for stum e til slutt (engelsk «make»). Det er feil
  på norsk («jente», «gate») og slås av for `nb` og `nn`.
- **Forkortelseslisten** er bare engelsk (`mr.`, `e.g.`, `etc.`). Vi trenger en norsk liste.
- **Replikkstrek og «»** er ikke behandlet særskilt i fokus- og pauseberegningen.

## Plattformvalg (må avklares)

### A. Web-app (PWA), anbefalt

Installeres fra Safari via Del → «Legg til på Hjem-skjerm». En service worker lagrer hele appen
lokalt, og bøkene ligger i IndexedDB på telefonen. Fungerer i flymodus.

- Krever ingen Mac, Xcode eller Apple-utviklerkonto.
- Kan bygges og testes fra dette miljøet; oppdateringer lastes neste gang telefonen er på nett.
- Fungerer også på iPad, Mac og Android.
- Må åpnes én gang med nett for å installeres.
- Bøker importeres med filvelgeren (Filer-appen), ikke via «Åpne i …» fra andre apper.
- iOS kan i sjeldne tilfeller slette lagringen til web-apper. Derfor: be om vedvarende lagring og
  tilby eksport av fremdrift.
- Ingen vibrasjon (Safari støtter ikke Vibration API).

### B. Native SwiftUI-app

- Best integrasjon: «Åpne i RSVP» fra Filer og Mail, delingsutvidelse, haptikk, og
  NaturalLanguage-rammeverket (`NLTokenizer` støtter norsk).
- Krever Mac med Xcode for å bygge og installere. Swift-koden kan skrives her, men ikke kompileres
  eller testes (miljøet er Linux).
- Med gratis Apple-ID må appen installeres på nytt hver 7. dag; TestFlight eller App Store krever
  Apple Developer Program.

### C. Start med A, port til B senere

Kjernen (tokenisering, tempo, norske regler) skrives som rene funksjoner med testdata, slik at
reglene kan oversettes til Swift uten å finne dem opp på nytt.

## Arkitektur (alternativ A)

```text
index.html  manifest.webmanifest  sw.js  icons/
src/
  import/    epub.js (JSZip + DOMParser), txt.js (tegnkoding), html.js
  text/      normalize.js, tokenize.js (Intl.Segmenter 'nb'), norwegian.js
  reader/    pacing.js (port av ReadingLoop), orp.js (focusOrdinal), engine.js
  storage/   db.js (IndexedDB: bøker, fremdrift, innstillinger), backup.js
  ui/        bibliotek, leser, innstillinger, kapitler, kontekstvisning
vendor/      jszip.min.js (lokal kopi, ingen CDN ved kjøring)
test/        node:test-tester med norske eksempeltekster
```

- **Timing:** en enkel `setTimeout`-kjede driver over tid. Motoren planlegger en frist per ord med
  `performance.now()` og tar igjen etterslep (rsvpnano tillater maks fire ord), slik at tempoet
  holder også over 600 WPM.
- **Skjerm:** Screen Wake Lock API hindrer at skjermen låses under lesing. I hjemskjerm-apper
  fungerer det fra iOS 18.4.
- **Offline:** alle filer, også JSZip og fonter, caches av service workeren. Ingen nettkall ved
  lesing.

## Norsk språkstøtte

1. **Tegn og koding.** UTF-8 overalt, fallback til Windows-1252 og ISO-8859-1 for eldre `.txt`,
   reparasjon av typisk feilkoding («Ã¸» → «ø»), og Unicode-normalisering til NFC (å kan ellers
   komme som a + kombinerende ring).
2. **Ordoppdeling.** `Intl.Segmenter('nb')`, men tegnsetting følger ordet den står ved, som i
   rsvpnano. Ikke del tall med hardt mellomrom («1 000 000», «kr 1 500») eller desimalkomma
   («3,5»), og behold bindestrekord («EU-land», «e-post», «TV-programmet»).
3. **Forkortelser** gir ingen setningspause.
   Bokmål: `f.eks.`, `bl.a.`, `osv.`, `dvs.`, `ca.`, `nr.`, `kl.`, `mht.`, `m.m.`, `o.l.`, `evt.`,
   `ev.`, `pga.`, `iht.`, `jf.`, `hhv.`, `inkl.`, `ekskl.`, `tlf.`, `mill.`, `mrd.`, `kr.`, `ref.`,
   `vedr.`, `sml.`, `stk.`, `m.fl.`, `f.Kr.`, `e.Kr.`.
   Nynorsk i tillegg: `t.d.`, `m.a.`, `osb.`.
   Ordenstall og datoer («24. oktober», «2. verdenskrig») fanges av rsvpnano-regelen: kort ord med
   punktum, eller neste ord starter med liten bokstav.
4. **Sitater og replikker.** `«»`, `„“` og `‘’` teller ikke med i ordlengde eller fokusbokstav.
   Replikkstrek (`–` eller `—` først i avsnittet) vises sammen med første ord i replikken og gir
   ingen egen pause.
5. **Sammensatte ord.** Norsk skriver sammensetninger i ett ord («sykehusparkeringsplass»,
   «arbeidsmiljøloven»). Lengdebonusen fra rsvpnano gir mer tid. I tillegg kan ord over en valgfri
   lengde deles i to visninger med norske orddelingsmønstre (TeX `hyph-nb`/`hyph-nn`,
   Liang-algoritmen): «sykehus-» → «parkeringsplass».
6. **Stavelser.** Vokaler `a e i o u y æ ø å` pluss aksenterte (`é è ê ó ò ô`), uten engelsk
   stum-e-regel.
7. **Bokmål og nynorsk.** Språket settes per bok (fra EPUB `dc:language`: `nb`, `nn` eller `no`,
   kan overstyres) og styrer forkortelser og orddeling.
8. **Testkorpus.** Norske eksempelsetninger med forventet oppdeling, fokusbokstav og timing.

## Faser

### Fase 1: MVP, klar for fly

- Import av TXT og EPUB uten DRM fra Filer-appen.
- RSVP-visning med fokusbokstav, start og pause med trykk, WPM fra 100 til 1000.
- Norsk tokenisering og tempo (punkt 1–4 og 6 over).
- Fremdrift lagres automatisk per bok; fortsett der du slapp.
- Mørkt tema som standard (flykabin) og skjermen holdes på.
- Offline med service worker, hosting og installasjonsveiledning.

### Fase 2: Leseopplevelse

- Kapitteloversikt og kapittelhopp, spol tilbake setning eller avsnitt, dra for å spole.
- Kontekstvisning ved pause: avsnittet med gjeldende ord uthevet.
- Spøkelsesord, hjelpelinjer, valg av font, størrelse, tema og ankerposisjon, justerbare pauser.
- Gjenstående lesetid for kapittel og bok.
- Eksport og import av fremdrift og innstillinger.

### Fase 3: Norsk finpuss

- Orddeling av lange sammensatte ord (bokmål og nynorsk).
- Finjustering av timing mot testkorpuset.
- Valgfritt: «chunk»-modus med 2–3 korte ord samtidig.

### Fase 4: Valgfritt

- PDF med tekstlag (pdf.js), Markdown og HTML.
- Norsk ordbok offline (lisens for ordbokdata må avklares).
- Lesestatistikk.
- Native Swift-versjon (alternativ B).

## Begrensninger

- DRM-beskyttede e-bøker (Adobe DRM, bibliotekapper og Bokhylla.no) kan ikke åpnes. Appen avviser
  dem med en tydelig melding, slik rsvpnano gjør. Mange norske e-bøker selges med vannmerke i stedet
  for DRM; de fungerer.
- Appen må installeres og bøkene importeres før avreise.

## Testing

- Enhetstester (`node:test`) for tokenisering, tempo, fokusbokstav og EPUB-import med norske
  testfiler.
- Nettlesertester i Chromium med iPhone-skjermstørrelse (Playwright). WebKit finnes ikke i dette
  miljøet, så sluttesten gjøres på din iPhone i flymodus.

## Hosting

Repoet er privat. GitHub Pages fra et privat repo krever GitHub Pro. Alternativer:

- Gjøre repoet offentlig. Bare koden blir synlig; bøkene ligger kun på telefonen.
- GitHub Pro.
- Cloudflare Pages eller Netlify: gratis, kan publisere fra et privat repo, men krever egen konto.
