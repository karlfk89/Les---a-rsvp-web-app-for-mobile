# Oppdrag til Claude for Chrome: sett opp RSVP-leseren på Proxmox

Du skal sette opp web-appen «Les» (en RSVP-leser for iPhone) på brukerens Proxmox-server, ved hjelp
av Proxmox-webgrensesnittet, GitHub og Tailscale-adminpanelet i denne nettleseren.

## Resultatet når du er ferdig

- En ny Debian 12-container med vertsnavn `rsvp` som starter automatisk.
- Repoet `github.com/karlfk89/rsvp` (grenen `main`) er klonet til `/opt/rsvp` med en
  deploy-nøkkel som bare har lesetilgang.
- Caddy serverer `/opt/rsvp/app` på port 80 inne i containeren, og henter oppdateringer fra GitHub
  hver natt.
- Tailscale gir HTTPS på `https://rsvp.<tailnet>.ts.net`, bare tilgjengelig i brukerens tailnet.

## Regler

- Ikke endre, stoppe, slette eller starte på nytt andre virtuelle maskiner eller containere, eller
  selve Proxmox-verten. Du skal bare legge til den nye containeren.
- Ikke åpne porter mot internett, og ikke slå på Tailscale Funnel.
- Deploy-nøkkelen på GitHub skal **ikke** ha skrivetilgang.
- Spør brukeren og vent på svar:
  - før du oppretter containeren (vis innstillingene du har valgt);
  - når et nettsted ber om passord, tofaktorkode eller innlogging;
  - når noe ikke ser ut som beskrevet her, eller en kommando gir en feil du ikke forstår.
- Konsollen i Proxmox er et bilde. Skriv kommandoene nøyaktig som de står her, én om gangen, og
  vent til ledeteksten (`root@rsvp:~#`) er tilbake før neste. Erstatt `<ID>` og `<NØKKEL>` med de
  riktige verdiene; behold alt annet tegn for tegn.
- Ikke lagre passord eller nøkler noe annet sted enn der de skal brukes.

## Steg 1: Se deg om i Proxmox

1. Noter navnet på noden (under **Datacenter** i venstremenyen).
2. Finn lagringen som brukes til containerdisker (ofte `local-lvm` eller `local-zfs`) og
   nettverksbroen andre containere bruker (ofte `vmbr0`).
3. Sjekk at Debian 12-malen finnes: noden → `local` → **CT Templates**. Finnes ingen
   `debian-12-standard`, trykk **Templates**, velg `debian-12-standard` og **Download**.
4. Spør brukeren hvilket root-passord containeren skal få.

## Steg 2: Opprett containeren

Trykk **Create CT** øverst til høyre og fyll inn:

| Fane | Innstilling |
| --- | --- |
| General | Hostname `rsvp`, **Unprivileged container** på, **Nesting** på, passordet fra brukeren. Noter **CT ID**. |
| Template | `debian-12-standard` |
| Disks | 4 GB på containerlagringen fra steg 1 |
| CPU | 1 kjerne |
| Memory | 512 MB minne, 512 MB swap |
| Network | Broen fra steg 1, IPv4 **DHCP** |
| DNS | Bruk vertens innstillinger (la feltene stå tomme) |
| Confirm | **Start after created** skal være **av** |

Vis innstillingene til brukeren, og trykk **Finish** når brukeren har godkjent dem.

## Steg 3: Gi containeren tilgang til Tailscale-nettverket

Åpne noden → **Shell** (skallet på Proxmox-verten) og kjør, med containerens nummer i stedet for
`<ID>`:

```sh
pct set <ID> --onboot 1
printf 'lxc.cgroup2.devices.allow: c 10:200 rwm\nlxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file\n' >> /etc/pve/lxc/<ID>.conf
grep -c dev/net/tun /etc/pve/lxc/<ID>.conf
pct start <ID>
```

`grep` skal skrive `1`. Skriver den `2` eller mer, er linjene lagt inn flere ganger: stopp og si
fra til brukeren.

## Steg 4: Installer programvare i containeren

Åpne containeren (`<ID> (rsvp)`) → **Console**, og logg inn som `root` med passordet. Kjør:

```sh
apt update && apt install -y curl git caddy
curl -fsSL https://tailscale.com/install.sh | sh
```

## Steg 5: Gi serveren lesetilgang til GitHub-repoet

Lag nøkkelen i konsollen:

```sh
mkdir -p /root/.ssh && chmod 700 /root/.ssh
ssh-keygen -t ed25519 -N "" -C proxmox-rsvp -f /root/.ssh/github_rsvp
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts
cat /root/.ssh/github_rsvp.pub
```

Siste kommando skriver én linje som begynner med `ssh-ed25519` og slutter med `proxmox-rsvp`. Den
linjen er den offentlige nøkkelen.

1. Overfør linjen nøyaktig. Prøv først å merke teksten i konsollen og kopiere den. Går ikke det,
   les den svært nøye (pass på `l`/`I`/`1` og `O`/`0`), eller be brukeren kopiere den for deg.
2. Åpne `https://github.com/karlfk89/rsvp/settings/keys/new` i en ny fane.
3. **Title:** `proxmox-rsvp`. **Key:** linjen fra konsollen. **Allow write access:** ikke kryss av.
   Trykk **Add key**.
4. Kontroller i konsollen:

   ```sh
   ssh -i /root/.ssh/github_rsvp -T git@github.com
   ```

   Riktig svar inneholder `You've successfully authenticated`. Står det `Permission denied`, er
   nøkkelen feil overført: slett den på GitHub og prøv igjen. Feiler det to ganger, be brukeren om
   hjelp.

## Steg 6: Hent appen og start webserveren

```sh
git -c core.sshCommand="ssh -i /root/.ssh/github_rsvp" clone git@github.com:karlfk89/rsvp.git /opt/rsvp
git -C /opt/rsvp config core.sshCommand "ssh -i /root/.ssh/github_rsvp"
bash /opt/rsvp/deploy/setup-lxc.sh --auto-update
```

Skriptet skal avslutte med `OK: Caddy serverer appen på http://localhost (port 80).`

## Steg 7: Koble containeren til Tailscale

1. Åpne `https://login.tailscale.com/admin/settings/keys` i en ny fane og trykk
   **Generate auth key**. Beskrivelse `rsvp-proxmox`; **Reusable** av; **Ephemeral** av. Finnes
   valget **Pre-approved**, slå det på. Trykk **Generate key** og kopier nøkkelen
   (begynner med `tskey-auth-`).
2. I konsollen, med nøkkelen i stedet for `<NØKKEL>`:

   ```sh
   tailscale up --auth-key=<NØKKEL> --hostname=rsvp --accept-dns=false
   ```

3. Åpne `https://login.tailscale.com/admin/machines`, finn maskinen `rsvp`, åpne menyen (**⋯**) og
   velg **Disable key expiry**, så serveren ikke faller ut av tailnettet etter noen måneder. Har
   maskinen fått et annet navn (for eksempel `rsvp-1`), noter det.

## Steg 8: Slå på HTTPS

1. Åpne `https://login.tailscale.com/admin/dns`. Slå på **MagicDNS** hvis den er av. Under
   **HTTPS Certificates**, trykk **Enable HTTPS** og bekreft. Noter tailnet-navnet
   (for eksempel `tail1234.ts.net`).
2. I konsollen:

   ```sh
   tailscale serve --bg 80
   tailscale serve status
   ```

   Utdataene viser adressen, for eksempel `https://rsvp.tail1234.ts.net`, med `proxy
   http://127.0.0.1:80` under. Skriver kommandoen i stedet en lenke for å slå på Serve eller HTTPS,
   åpne lenken, godkjenn, og kjør kommandoen på nytt.

## Steg 9: Kontroller

```sh
systemctl is-active caddy tailscaled
```

Begge linjene skal være `active`. Er denne PC-en med i Tailscale, åpne adressen fra steg 8 i en ny
fane. Første gang kan det ta opptil et halvt minutt mens sertifikatet hentes. Siden skal vise
**Bibliotek**. Er PC-en ikke med i Tailscale, hopp over dette; brukeren tester på iPhonen.

## Steg 10: Rapporter til brukeren

Skriv en kort oppsummering:

- Adressen til appen (`https://rsvp.<tailnet>.ts.net`).
- Containerens nummer og IP-adresse.
- At serveren henter oppdateringer fra GitHub hver natt kl. 04.30.
- Hva som eventuelt feilet eller ble hoppet over.
- Hva brukeren gjør på iPhonen: installer Tailscale-appen og slå den på, åpne adressen i Safari,
  trykk **Del** → **Legg til på Hjem-skjerm**, og åpne **Les** fra Hjem-skjermen.
