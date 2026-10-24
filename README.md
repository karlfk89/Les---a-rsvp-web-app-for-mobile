# Les – RSVP reader for iPhone

*English · [Norsk](README.nb.md)*

Read books one word at a time (RSVP) on your iPhone, also in airplane mode. *Les* is Norwegian for
“read”, and the app is made for English and Norwegian (Bokmål and Nynorsk). It is a web app (PWA)
that you install from Safari and host yourself, for example on a home server. The pacing and
focus rules build on [RSVP Nano](https://github.com/ionutdecebal/rsvpnano).

The app has no backend and no tracking. Books, reading progress and settings stay on your phone;
the server is only needed to install and update the app.

## Features

- **Import** EPUB, PDF (with a text layer) and text files (TXT, Markdown, HTML) from the Files app.
  Chapters come from the table of contents, the PDF bookmarks or headings such as “Chapter 3”,
  “PART ONE” or «Kapittel 3». Books with DRM are rejected with a clear message.
- **RSVP display** with a fixed focus letter, guide lines, and the previous and next words shown
  faintly on each side.
- **Pacing** that adapts to each word: extra time for long words, numbers and names, slightly less
  for short words, and pauses at punctuation and paragraph ends. Pauses follow the speed, and the
  pacing is calibrated per book so the chosen speed is the real average. Smooth start after a
  pause. Each book remembers its own speed when you change it while reading; otherwise the
  default speed is used.
- **English and Norwegian text**: abbreviations (Mr., e.g., f.eks., bl.a., t.d.), «quotes» and
  “quotes”, dialogue dashes, number groups like “1 500 000” and decimal commas. The language is
  detected per book and can be changed.
- **Long compound words** are shown in parts, such as the Norwegian «sykehus-» «parkerings-»
  «plassen». The split uses TeX hyphenation patterns, words from the book and a list of common
  word parts, and can be turned off or adjusted (words longer than 10–20 letters).
- **Navigation**: chapter list and chapter jumps, back to the start of the sentence, word by
  word, a slider for the whole book, and the current paragraph shown when paused (tap a word to
  jump there).
- **Gestures**: swipe sideways to step through words. Choose between *Tap* (a tap starts and
  stops reading) and *Hold* (reading runs only while your finger is on the screen).
- **Offline**: the whole app is stored on the phone, along with the books and your progress. The
  screen stays on while reading.
- **Backup** of progress and settings, optionally with the books, to Files or iCloud Drive. On
  restore the most recent progress wins, and progress for books that are missing is applied when
  the same book is added again.
- **Interface in English or Norwegian**: English is the default; choose Norwegian under
  Settings → Language. The interface language is independent of the language of the books.
- Dark, black, light and sepia themes; choice of font, size, focus color and pauses.

## Getting started

### Hosting

The app is just the static files in `app/`, so any web server can host it, with three
requirements:

- **HTTPS with a certificate the phone trusts.** iOS only keeps a web app for offline use when it
  is loaded over HTTPS.
- **No caching of `/`, `index.html` and `sw.js`**, so updates reach the phone.
- **`.mjs` files served as JavaScript** and `.webmanifest` as `application/manifest+json`.

[`deploy/Caddyfile`](deploy/Caddyfile) does all of this. Two ready-made setups use it:

**Docker.** Set `SITE_ADDRESS` in `deploy/.env`: `:80` behind an HTTPS proxy, a domain name for
a Let's Encrypt certificate, or `https://<local-ip>` with `TLS_DIRECTIVE=tls internal` for Caddy's
own certificate authority on a home network.

```sh
git clone https://github.com/karlfk89/Les---a-rsvp-web-app-for-mobile.git /opt/rsvp
cd /opt/rsvp
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml up -d
```

**Debian container with Tailscale** (the setup the app was made for, on Proxmox). Tailscale
gives the server a private name like `rsvp.tail1234.ts.net` with a real HTTPS certificate, so the
app is only reachable from your own devices and no domain is needed. Tailscale in a Proxmox LXC
container needs `/dev/net/tun`: add these lines to `/etc/pve/lxc/<ID>.conf` on the host and start
(or restart) the container.

```text
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Then, as root in the container:

```sh
apt update && apt install -y curl git caddy
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --hostname=rsvp --accept-dns=false     # open the link it prints to add the server
git clone https://github.com/karlfk89/Les---a-rsvp-web-app-for-mobile.git /opt/rsvp
bash /opt/rsvp/deploy/setup-lxc.sh --auto-update   # Caddy on port 80, nightly git pull at 04:30
```

Turn on MagicDNS and HTTPS certificates in the
[Tailscale admin console](https://login.tailscale.com/admin/dns), then run `tailscale serve --bg 80`.
It prints the address of the app.

A step-by-step guide with troubleshooting and other ways to get HTTPS is in
[docs/SELF-HOSTING.md](docs/SELF-HOSTING.md).

### Installing on the iPhone

1. Open the HTTPS address in **Safari** (with Tailscale switched on, if you use it).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open **Les** from the Home Screen and wait until the library shows **✓ Ready for offline use**.
4. Add books with **Add book**. Download them to the Files app first.
5. Test it: turn on **airplane mode**, close the app completely and open it again.

Always use the app from the Home Screen, not from a Safari tab: the Home Screen app has its own
storage that iOS does not clear automatically, and books added in Safari do not show up there.
Keep the same address, since a new address becomes a new app with an empty library.

### Updating

Run `git -C /opt/rsvp pull` on the server, or let `--auto-update` do it every night. The next time
the app is opened with a connection to the server, it shows **A new version of the app is ready**;
tap **Update**. Books and progress are kept.

### Free books

[Project Gutenberg](https://www.gutenberg.org), [Standard Ebooks](https://standardebooks.org),
[Bokselskap.no](https://www.bokselskap.no) (Norwegian classics) and
[Project Runeberg](https://runeberg.org) (Nordic literature).

## Development

Requires Node.js 22 or later. The app has no build step; `app/` is served as it is.

```sh
npm install
npm test               # unit tests (text, pacing, hyphenation, import, backup, gestures, translations)
npm run serve          # http://localhost:8080
npm run e2e            # end-to-end in Chromium (requires Playwright)
npm run precache       # after changes in app/: updates the file list and version in sw.js
```

| Folder | Contents |
| --- | --- |
| `app/js/text` | Normalization, splitting into words, languages and abbreviations |
| `app/js/reader` | Pacing (ported from RSVP Nano), focus letter, playback engine |
| `app/js/import` | EPUB, PDF, TXT/Markdown and HTML to chapters and paragraphs |
| `app/js/ui` | Library, reader, settings |
| `app/js/locales` | Interface texts in English (`en.js`) and Norwegian Bokmål (`nb.js`) |
| `app/vendor` | pdf.js and fflate (`npm run vendor`), hyphenation patterns (`tools/build-hyphenation.mjs`) |
| `deploy` | Caddy configuration, setup script for LXC and docker-compose |
| `test` | Tests and test data |

To translate the interface into another language, copy `app/js/locales/en.js` to a file named
after the language code (for example `de.js`), translate the texts, and add the language to
`UI_LANGUAGES` and `DICTIONARIES` in `app/js/i18n.js`. The tests check that every locale file has
the same texts as the English one.

## Licenses

Les is licensed under the [MIT License](LICENSE).

Code and data from others keep their own licenses. The full license texts are in
[app/third-party-notices.txt](app/third-party-notices.txt), which can also be shown in the app
under Settings → About → **Show licenses**:

- The pacing and focus rules are ported from [RSVP Nano](https://github.com/ionutdecebal/rsvpnano)
  (MIT).
- PDF support by [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0), with
  [core-js](https://github.com/zloirock/core-js) (MIT) bundled in its legacy build.
- EPUB unpacking by [fflate](https://github.com/101arrowz/fflate) (MIT).
- The hyphenation patterns in `app/vendor/hyphenation` are generated from
  [hyph-utf8](https://github.com/hyphenation/tex-hyphen) (`tools/build-hyphenation.mjs`) and keep
  their original license notices: Norwegian by Rune Kleveland, Ole Michael Selberg and Karl Ove
  Hufthammer, English by Gerard D.C. Kuiken.

When `app/vendor` is updated, `app/third-party-notices.txt` must be updated to match.
