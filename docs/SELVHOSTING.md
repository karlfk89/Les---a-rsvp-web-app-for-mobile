# Selvhosting på Proxmox

Appen er bare statiske filer (mappen `app/`). Den har ingen server-del og sender aldri bøker over
nettet; bøkene ligger kun på iPhonen. Serveren trengs bare når appen installeres og oppdateres. På
flyet kjører alt fra telefonen.

Oppsettet under bruker en Debian-container (LXC) med Caddy som webserver og Tailscale for HTTPS.
Caddy serverer filene rett fra en klon av GitHub-repoet, så en oppdatering er bare `git pull`.

## Hvorfor HTTPS, og hvordan Tailscale løser det

iPhone lagrer en web-app for bruk uten nett bare når den lastes over **HTTPS** med et sertifikat
telefonen stoler på. Over vanlig `http://192.168.x.x` virker appen bare så lenge du har nett.

Du kjenner Tailscale som VPN: hver enhet får en privat adresse (100.x.y.z) og kan nå de andre.
Tailscale har i tillegg to funksjoner som til sammen gir gyldig HTTPS uten eget domene:

1. **MagicDNS** gir hver maskin et navn, for eksempel `rsvp.tail1234.ts.net`
   (`tail1234` er navnet på ditt tailnet).
2. **HTTPS-sertifikater**: Tailscale henter et ekte sertifikat fra Let's Encrypt for dette navnet.
   Fordi `ts.net` er et vanlig, offentlig domene, stoler iPhonen på sertifikatet uten noe ekstra
   oppsett.

`tailscale serve` er en liten webproxy innebygd i Tailscale på serveren. Den tar imot HTTPS med
sertifikatet og sender trafikken videre til Caddy i samme container:

```text
iPhone (Tailscale på) ──HTTPS──▶ rsvp.tail1234.ts.net   (tailscale serve)
                                        │ http, inne i containeren
                                        ▼
                                 Caddy :80 ──▶ /opt/rsvp/app
```

- Bare enheter i ditt tailnet når adressen. Den er ikke åpen på internett.
- iPhonen trenger Tailscale påslått bare når du installerer appen eller henter oppdateringer.
- Maskinnavnet og tailnet-navnet blir synlige i offentlige sertifikatlogger, slik det skjer med
  alle HTTPS-sertifikater. Velg derfor et nøytralt maskinnavn, som `rsvp`.

## 1. Lag containeren

I Proxmox: **Create CT** med Debian 12-malen, vertsnavn (hostname) **`rsvp`**, 1 kjerne,
512 MB minne og 4 GB disk. Ikke start den ennå.

Tailscale trenger nettverksenheten `/dev/net/tun`. Legg til disse to linjene nederst i
`/etc/pve/lxc/<ID>.conf` på Proxmox-verten (`<ID>` er containerens nummer, for eksempel 105):

```text
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Start containeren og åpne konsollen. Kommandoene under kjøres som `root` i containeren.

## 2. Installer Tailscale og Caddy

```sh
apt update && apt install -y curl git caddy
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --hostname=rsvp --accept-dns=false
```

`tailscale up` skriver ut en lenke. Åpne den på PC-en og godkjenn maskinen i tailnettet ditt. Gå
deretter til **Machines** i Tailscale-adminpanelet, åpne menyen (**⋯**) for `rsvp` og velg
**Disable key expiry**. Ellers må serveren logges inn på nytt etter noen måneder.
(`--accept-dns=false` lar containerens egne DNS-innstillinger være i fred.)

## 3. Hent koden fra GitHub

Repoet er privat, så serveren trenger en **deploy-nøkkel**. Det er en SSH-nøkkel med bare
lesetilgang til dette ene repoet.

```sh
ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_rsvp
ssh-keyscan github.com >> /root/.ssh/known_hosts
cat /root/.ssh/github_rsvp.pub
```

Kopier linjen som skrives ut. På GitHub: repoet **rsvp** → **Settings** → **Deploy keys** →
**Add deploy key**. Lim inn nøkkelen, gi den navnet `proxmox`, og la **Allow write access** være
avkrysset av. Deretter:

```sh
git -c core.sshCommand="ssh -i /root/.ssh/github_rsvp" clone git@github.com:karlfk89/rsvp.git /opt/rsvp
git -C /opt/rsvp config core.sshCommand "ssh -i /root/.ssh/github_rsvp"
```

(Gjør du repoet offentlig, trengs ingen nøkkel:
`git clone https://github.com/karlfk89/rsvp.git /opt/rsvp`.)

## 4. Sett opp Caddy

```sh
bash /opt/rsvp/deploy/setup-lxc.sh --auto-update
```

Skriptet kobler Caddy til `/opt/rsvp/app`, slår på automatisk oppdatering fra GitHub hver natt kl.
04.30, og sjekker at appen svarer. Det skal avslutte med
`OK: Caddy serverer appen på http://localhost (port 80).` Uten `--auto-update` må du hente
oppdateringer selv (se «Oppdatere»).

## 5. Slå på HTTPS i Tailscale

1. Gå til [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns).
2. Slå på **MagicDNS** (er ofte på fra før).
3. Under **HTTPS Certificates**: trykk **Enable HTTPS**.
4. I containeren:

   ```sh
   tailscale serve --bg 80
   ```

   Kommandoen skriver ut adressen, for eksempel `https://rsvp.tail1234.ts.net/`. Den første
   forespørselen kan ta noen sekunder mens sertifikatet hentes. Innstillingen huskes etter
   omstart. `tailscale serve status` viser oppsettet.

## 6. Installer på iPhonen

1. Installer **Tailscale** fra App Store, logg inn med samme konto og slå den på.
2. Åpne adressen fra steg 5 i **Safari**.
3. Trykk **Del** → **Legg til på Hjem-skjerm** → **Legg til**.
4. Åpne **Les** fra Hjem-skjermen. Appen er på engelsk til å begynne med; velg norsk under
   **Settings** (glidebryter-ikonet) → **Language** → **Norsk**. Vent til biblioteket viser
   **✓ Klar for bruk uten nett** (**✓ Ready for offline use** på engelsk).
5. Legg til bøker med **Legg til bok** (**Add book**). Last dem gjerne ned til Filer-appen først.
6. Test: slå på **flymodus**, lukk appen helt og åpne den igjen fra Hjem-skjermen.

Bruk alltid appen fra Hjem-skjermen, ikke fra en fane i Safari. Hjem-skjerm-appen har egen lagring
som iOS ikke rydder bort automatisk. Bøker som er lagt til i Safari, vises ikke i Hjem-skjerm-appen.
Behold samme adresse: en ny adresse blir en ny app med tomt bibliotek.

## Oppdatere

På serveren:

```sh
git -C /opt/rsvp pull
```

På iPhonen: slå på Tailscale og åpne appen. Når den viser **«En ny versjon av appen er klar»**,
trykk **Oppdater**. Bøker og fremdrift beholdes.

Med `--auto-update` i steg 4 skjer dette av seg selv hver natt kl. 04.30.

## Feilsøking

| Problem | Løsning |
| --- | --- |
| Appen sier «Lesing uten nett krever HTTPS» | Du har åpnet `http://`-adressen. Bruk `https://…ts.net`-adressen. |
| Safari finner ikke `…ts.net`-adressen | Slå på Tailscale på iPhonen. |
| `tailscale serve` klager på sertifikat | HTTPS er ikke slått på i Tailscale-adminpanelet (steg 5). |
| `tailscale up` feiler med «tun» | TUN-linjene mangler i containerkonfigurasjonen (steg 1), eller containeren er ikke startet på nytt. |
| `git pull` ber om passord | Deploy-nøkkelen mangler; se steg 3. |

## Andre måter å få HTTPS på

Bruker du ikke Tailscale, kan Caddy ta seg av HTTPS selv. Kjør `setup-lxc.sh` som over, og endre
deretter `SITE_ADDRESS` i
`/etc/systemd/system/caddy.service.d/rsvp.conf` og kjør `systemctl daemon-reload` og
`systemctl restart caddy`.

- **Eget domene, åpent på internett:** pek en DNS-post (for eksempel `les.dittdomene.no`) til den
  offentlige IP-en din, videresend port 80 og 443 til containeren, og sett
  `SITE_ADDRESS=les.dittdomene.no`. Caddy henter sertifikat fra Let's Encrypt automatisk.
- **Egen omvendt proxy** (Nginx Proxy Manager, Traefik): behold `SITE_ADDRESS=:80` og pek proxyen
  til `http://<container-ip>:80`. Proxyen må ikke hurtigbufre `sw.js`.
- **Bare hjemmenett, uten domene:** sett `SITE_ADDRESS=https://<container-ip>` og legg til linjen
  `Environment="TLS_DIRECTIVE=tls internal"`. Send så Caddy sitt rotsertifikat
  (`/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`) til iPhonen og installer
  det. Slå på full tillit under **Innstillinger → Generelt → Om → Sertifikatinnstillinger**.

## Med Docker i stedet

Kjører du Docker (i en VM eller i en LXC med nesting), bruker `deploy/docker-compose.yml` det
offisielle Caddy-imaget og leser filene rett fra repoet:

```sh
git clone git@github.com:karlfk89/rsvp.git /opt/rsvp   # med deploy-nøkkel som i steg 3
cd /opt/rsvp
cp deploy/.env.example deploy/.env                    # tilpass SITE_ADDRESS
docker compose -f deploy/docker-compose.yml up -d
```

Oppdatering er da også bare `git -C /opt/rsvp pull`.
