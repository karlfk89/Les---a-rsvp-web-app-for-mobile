# Les – RSVP-leser for iPhone

*[English](README.md) · Norsk*

Les bøker ett ord om gangen (RSVP) på iPhone, også i flymodus. Laget for norsk (bokmål og nynorsk)
og engelsk. Appen er en web-app (PWA) som installeres fra Safari og selvhostes, for eksempel på
Proxmox. Tempo- og fokusreglene bygger på [RSVP Nano](https://github.com/ionutdecebal/rsvpnano).

## Funksjoner

- **Import** av EPUB, PDF (med tekstlag) og tekstfiler (TXT, Markdown, HTML) fra Filer-appen.
  Kapitler hentes fra innholdsfortegnelsen, PDF-ens bokmerker eller overskrifter som
  «Kapittel 3» og «FØRSTE STYKKE». Bøker med DRM avvises med en tydelig melding.
- **RSVP-visning** med fast fokusbokstav, hjelpelinjer og svake ord før og etter.
- **Tempo** som tilpasser seg ordet: ekstra tid for lange ord, tall og navn, litt kortere tid for
  korte ord, og pause ved tegnsetting og avsnittsslutt. Pausene følger hastigheten, og tempoet
  kalibreres per bok slik at valgt hastighet er den faktiske snittfarten. Myk start etter pause.
  Hver bok husker sin egen hastighet når du endrer den mens du leser; ellers brukes
  standardhastigheten.
- **Norsk**: æøå, «sitater», replikkstrek, tallgrupper som «1 500 000», desimalkomma og norske
  forkortelser (f.eks., bl.a., t.d.). Språket finnes automatisk per bok og kan endres.
- **Lange sammensatte ord** vises i deler: «sykehus-» «parkerings-» «plassen». Delingen bruker
  TeX-orddelingsmønstre og ord fra boka og en liste over vanlige ledd, og kan slås av eller
  justeres (ord lengre enn 10–20 bokstaver).
- **Navigasjon**: kapitteloversikt og kapittelhopp, tilbake til starten av setningen, ord for ord,
  glidebryter for hele boka, og avsnittet vist ved pause (trykk på et ord for å hoppe dit).
- **Bevegelser**: sveip til siden for å spole ord for ord. Velg mellom «Trykk» (trykk starter og
  stopper) og «Hold inne» (lesingen går bare mens fingeren ligger på skjermen).
- **Uten nett**: hele appen lagres på telefonen; bøker og fremdrift ligger i telefonens lagring.
  Skjermen holdes på under lesing.
- **Sikkerhetskopi** av fremdrift og innstillinger, eventuelt med bøkene, til Filer eller iCloud
  Drive. Ved gjenoppretting beholdes den nyeste fremdriften, og fremdrift for bøker som mangler,
  brukes automatisk når samme bok legges til igjen.
- **Grensesnitt på engelsk eller norsk**: engelsk er standard, og norsk velges under
  Settings → Language → Norsk. Språket i appen er uavhengig av språket i bøkene.
- Mørkt, svart, lyst og sepia tema; valg av skrift, størrelse, fokusfarge og pauser.

## Kom i gang

Se [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md) (på engelsk) for oppsett på Proxmox med HTTPS og
installasjon på iPhone. Gratis bøker finnes blant annet på [Bokselskap.no](https://www.bokselskap.no),
[Project Gutenberg](https://www.gutenberg.org/browse/languages/no) og
[Project Runeberg](https://runeberg.org).

## Utvikling

Krever Node.js 22 eller nyere. Appen har ingen byggesteg; `app/` serveres som den er.

```sh
npm install
npm test               # enhetstester (tekst, tempo, orddeling, import, sikkerhetskopi, bevegelser)
npm run serve          # http://localhost:8080
npm run e2e            # ende-til-ende i Chromium (krever Playwright)
npm run precache       # etter endringer i app/: oppdaterer filliste og versjon i sw.js
```

| Mappe | Innhold |
| --- | --- |
| `app/js/text` | Normalisering, oppdeling i ord, språk og forkortelser |
| `app/js/reader` | Tempo (port fra RSVP Nano), fokusbokstav, avspillingsmotor |
| `app/js/import` | EPUB, PDF, TXT/Markdown og HTML til kapitler og avsnitt |
| `app/js/ui` | Bibliotek, leser, innstillinger |
| `app/vendor` | pdf.js og fflate (`npm run vendor`), orddelingsmønstre (`tools/build-hyphenation.mjs`) |
| `deploy` | Caddy-konfigurasjon, oppsettskript for LXC og docker-compose |
| `test` | Tester og testdata |

## Lisenser

Les er lisensiert under [MIT-lisensen](LICENSE).

Kode og data fra andre beholder sine egne lisenser. Fullstendige lisenstekster står i
[app/third-party-notices.txt](app/third-party-notices.txt), som også kan vises i appen under
Innstillinger → Om → **Vis lisenser**:

- Tempo- og fokusreglene er portert fra [RSVP Nano](https://github.com/ionutdecebal/rsvpnano) (MIT).
- PDF-støtte med [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0), med
  [core-js](https://github.com/zloirock/core-js) (MIT) innebygd i den eldre utgaven.
- EPUB-utpakking med [fflate](https://github.com/101arrowz/fflate) (MIT).
- Orddelingsmønstrene i `app/vendor/hyphenation` er generert fra
  [hyph-utf8](https://github.com/hyphenation/tex-hyphen) (`tools/build-hyphenation.mjs`) og har sine
  opprinnelige lisensmerknader: norsk av Rune Kleveland, Ole Michael Selberg og Karl Ove Hufthammer,
  engelsk av Gerard D.C. Kuiken.

Når `app/vendor` oppdateres, må `app/third-party-notices.txt` oppdateres tilsvarende.
