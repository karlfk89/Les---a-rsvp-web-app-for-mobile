# Selvhosting på Proxmox

Appen er bare statiske filer (mappen `app/`). Den har ingen server-del og sender aldri bøker over
nettet: bøkene ligger kun på iPhonen. Serveren trengs bare når appen installeres og oppdateres. På
flyet kjører alt fra telefonen.

## Det viktigste: HTTPS

iPhone lagrer appen for bruk uten nett bare når den lastes fra **HTTPS** med et sertifikat telefonen
stoler på. Over vanlig `http://` (for eksempel `http://192.168.1.50`) virker appen bare så lenge
du er på nett. Velg derfor én av disse:

| Variant | Passer når | iPhone må |
| --- | --- | --- |
| **A. Tailscale** (anbefalt) | Du bruker eller kan bruke Tailscale | ha Tailscale-appen påslått når du installerer eller oppdaterer |
| **B. Eget domene** | Du har et domene og kan åpne port 80/443, eller har en omvendt proxy med sertifikat | ingenting spesielt |
| **C. Lokal CA** | Du vil holde alt på hjemmenettet uten domene | installere og stole på Caddy sitt rotsertifikat én gang |

## 1. Lag en LXC-container

I Proxmox: **Create CT** med en Debian 12-mal. 1 kjerne, 256–512 MB minne og 2 GB disk er nok.
Gi den fast IP-adresse (eller DHCP-reservasjon), og start den.

## 2. Hent appen

Repoet er privat, så velg én av måtene:

- **Git med deploy-nøkkel** (enklest å oppdatere): lag en SSH-nøkkel i containeren
  (`ssh-keygen -t ed25519`), legg den offentlige nøkkelen til under
  GitHub → repoet → Settings → Deploy keys (bare lesetilgang), og klon:

  ```sh
  apt update && apt install -y git
  git clone git@github.com:karlfk89/rsvp.git /opt/rsvp
  ```

- **Kopier filene**: last ned repoet som ZIP fra GitHub og kopier mappen `app/` til containeren,
  for eksempel med `scp -r app root@<ip>:/opt/rsvp/app`.

## 3. Server filene med Caddy

### Uten Docker (anbefalt i LXC)

```sh
apt install -y caddy rsync
mkdir -p /srv/les
rsync -a --delete /opt/rsvp/app/ /srv/les/
cp /opt/rsvp/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl edit caddy
```

Lim inn i redigeringsvinduet (tilpass `SITE_ADDRESS`, se variantene under):

```ini
[Service]
Environment=APP_ROOT=/srv/les
Environment=SITE_ADDRESS=:80
```

```sh
systemctl restart caddy
```

### Med Docker

Hvis du heller kjører Docker (i en VM eller en LXC med nesting slått på):

```sh
cd /opt/rsvp
cp deploy/.env.example deploy/.env   # tilpass SITE_ADDRESS
docker compose -f deploy/docker-compose.yml up -d --build
```

## 4. Sett opp HTTPS

### A. Tailscale

1. På Proxmox-verten: gi containeren tilgang til TUN-enheten. Legg til i
   `/etc/pve/lxc/<ID>.conf` og start containeren på nytt:

   ```text
   lxc.cgroup2.devices.allow: c 10:200 rwm
   lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
   ```

2. I containeren:

   ```sh
   curl -fsSL https://tailscale.com/install.sh | sh
   tailscale up
   ```

3. I Tailscale-adminpanelet under **DNS**: slå på **MagicDNS** og **HTTPS Certificates**.
4. Behold `SITE_ADDRESS=:80` i Caddy og la Tailscale ta seg av HTTPS:

   ```sh
   tailscale serve --bg 80
   ```

   Adressen blir `https://<maskinnavn>.<tailnet>.ts.net`, med gyldig sertifikat.
5. Installer Tailscale-appen på iPhonen og logg inn med samme konto.

### B. Eget domene

- **Åpen på internett:** pek en DNS-post (for eksempel `les.dittdomene.no`) til den offentlige
  IP-en din, videresend port 80 og 443 til containeren, og sett `SITE_ADDRESS=les.dittdomene.no`.
  Caddy henter sertifikat fra Let's Encrypt automatisk.
- **Har du allerede en omvendt proxy** (Nginx Proxy Manager, Traefik, Caddy): behold
  `SITE_ADDRESS=:80` og pek proxyen til `http://<container-ip>:80`. Sørg for at proxyen ikke
  hurtigbufrer `sw.js`.

### C. Lokal sertifikatutsteder (bare hjemmenett)

1. Sett i Caddy-konfigurasjonen:

   ```ini
   Environment=SITE_ADDRESS=https://192.168.1.50
   Environment="TLS_DIRECTIVE=tls internal"
   ```

   (bytt til containerens IP-adresse) og start Caddy på nytt.
2. Hent rotsertifikatet fra containeren:
   `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`
   (med Docker ligger det i volumet `caddy_data`, under `caddy/pki/authorities/local/`).
3. Send filen til iPhonen (AirDrop eller e-post), åpne den og installer profilen under
   **Innstillinger → Generelt → VPN og enhetsadministrasjon**.
4. Slå på full tillit under **Innstillinger → Generelt → Om → Sertifikatinnstillinger**.

## 5. Installer på iPhonen

1. Åpne adressen i **Safari**.
2. Trykk **Del** → **Legg til på Hjem-skjerm** → **Legg til**.
3. Åpne **Les** fra Hjem-skjermen. Vent til biblioteket viser **✓ Klar for bruk uten nett**.
4. Legg til bøker med **Legg til bok**. Last dem gjerne ned til Filer-appen først.
5. Test: slå på **flymodus**, lukk appen helt og åpne den igjen fra Hjem-skjermen.

Bruk alltid appen fra Hjem-skjermen, ikke fra en fane i Safari. Hjem-skjerm-appen har egen lagring
som iOS ikke rydder bort automatisk. Bøker som er lagt til i Safari, vises ikke i Hjem-skjerm-appen.
Behold samme adresse: en ny adresse blir en ny app med tomt bibliotek.

## Oppdatere

```sh
cd /opt/rsvp && git pull --ff-only && rsync -a --delete app/ /srv/les/
```

(Med Docker: `docker compose -f deploy/docker-compose.yml up -d --build`.)

Neste gang appen åpnes med nett, vises **«En ny versjon av appen er klar»**. Trykk **Oppdater**.
Bøker og fremdrift beholdes.
