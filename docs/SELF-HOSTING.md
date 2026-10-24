# Self-hosting

The app is nothing but static files (the `app/` folder). It has no server side and never sends
books over the network; the books stay on the iPhone. The server is only needed to install and
update the app. On a plane, everything runs from the phone.

The setup below uses a Debian container (LXC) on Proxmox, with Caddy as the web server and
Tailscale for HTTPS. Caddy serves the files straight from a clone of the GitHub repository, so an
update is just `git pull`. Any other machine running Debian works the same way; skip step 1. For
Docker, or HTTPS without Tailscale, see the end of this guide.

## Why HTTPS, and how Tailscale provides it

An iPhone only keeps a web app for offline use when it is loaded over **HTTPS** with a certificate
the phone trusts. Over plain `http://192.168.x.x` the app works only while you are online.

You may know Tailscale as a VPN: each device gets a private address (100.x.y.z) and can reach the
others. Tailscale also has two features that together give valid HTTPS without a domain of your
own:

1. **MagicDNS** gives each machine a name, such as `rsvp.tail1234.ts.net`
   (`tail1234` is the name of your tailnet).
2. **HTTPS certificates**: Tailscale fetches a real certificate from Let's Encrypt for this name.
   Since `ts.net` is an ordinary public domain, the iPhone trusts the certificate with no extra
   setup.

`tailscale serve` is a small web proxy built into Tailscale on the server. It accepts HTTPS with
the certificate and passes the traffic on to Caddy in the same container:

```text
iPhone (Tailscale on) ──HTTPS──▶ rsvp.tail1234.ts.net   (tailscale serve)
                                        │ http, inside the container
                                        ▼
                                 Caddy :80 ──▶ /opt/rsvp/app
```

- Only devices in your tailnet can reach the address. It is not open to the internet.
- The iPhone only needs Tailscale switched on when you install the app or fetch updates.
- The machine name and the tailnet name become visible in public certificate transparency logs,
  as with every HTTPS certificate. Choose a neutral machine name, such as `rsvp`.

## 1. Create the container

In Proxmox: **Create CT** with the Debian 12 template, hostname **`rsvp`**, 1 core, 512 MB of
memory and 4 GB of disk. Do not start it yet.

Tailscale needs the network device `/dev/net/tun`. Add these two lines at the end of
`/etc/pve/lxc/<ID>.conf` on the Proxmox host (`<ID>` is the container's number, for example 105):

```text
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Start the container and open its console. The commands below run as `root` in the container.

## 2. Install Tailscale and Caddy

```sh
apt update && apt install -y curl git caddy
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --hostname=rsvp --accept-dns=false
```

`tailscale up` prints a link. Open it on your computer and approve the machine in your tailnet.
Then go to **Machines** in the Tailscale admin console, open the menu (**⋯**) for `rsvp` and choose
**Disable key expiry**; otherwise the server has to be logged in again after a few months.
(`--accept-dns=false` leaves the container's own DNS settings alone.)

## 3. Get the code

```sh
git clone https://github.com/karlfk89/Les---a-rsvp-web-app-for-mobile.git /opt/rsvp
```

To host your own fork, clone that instead. If the fork is private, the server needs a **deploy
key**, an SSH key with read-only access to that one repository:

```sh
ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_rsvp
ssh-keyscan github.com >> /root/.ssh/known_hosts
cat /root/.ssh/github_rsvp.pub
```

Copy the line it prints. On GitHub, open the repository → **Settings** → **Deploy keys** →
**Add deploy key**, paste the key and leave **Allow write access** unchecked. Then clone over SSH
(replace `<you>` and `<repository>` with your GitHub user name and the name of the fork):

```sh
git -c core.sshCommand="ssh -i /root/.ssh/github_rsvp" clone git@github.com:<you>/<repository>.git /opt/rsvp
git -C /opt/rsvp config core.sshCommand "ssh -i /root/.ssh/github_rsvp"
```

## 4. Set up Caddy

```sh
bash /opt/rsvp/deploy/setup-lxc.sh --auto-update
```

The script points Caddy at `/opt/rsvp/app`, turns on automatic updates from GitHub every night at
04:30 (server time), and checks that the app responds. It should end with
`OK: Caddy serves the app on http://localhost (port 80).` Without `--auto-update` you fetch updates
yourself (see [Updating](#updating)).

## 5. Turn on HTTPS in Tailscale

1. Go to [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns).
2. Turn on **MagicDNS** (it is often on already).
3. Under **HTTPS Certificates**, click **Enable HTTPS**.
4. In the container:

   ```sh
   tailscale serve --bg 80
   ```

   The command prints the address, for example `https://rsvp.tail1234.ts.net/`. The first request
   can take a few seconds while the certificate is fetched. The setting survives restarts, and
   `tailscale serve status` shows it.

## 6. Install on the iPhone

1. Install **Tailscale** from the App Store, sign in with the same account and switch it on.
2. Open the address from step 5 in **Safari**.
3. Tap **Share** → **Add to Home Screen** → **Add**.
4. Open **Les** from the Home Screen and wait until the library shows **✓ Ready for offline use**.
   The app starts in English; for Norwegian, open **Settings** (the slider icon) → **Language** →
   **Norsk**.
5. Add books with **Add book**. Download them to the Files app first.
6. Test it: turn on **airplane mode**, close the app completely and open it again from the Home
   Screen.

Always use the app from the Home Screen, not from a Safari tab. The Home Screen app has its own
storage that iOS does not clear automatically, and books added in Safari do not show up in the
Home Screen app. Keep the same address: a new address becomes a new app with an empty library.

## Updating

On the server:

```sh
git -C /opt/rsvp pull
```

On the iPhone: switch on Tailscale and open the app. When it shows **A new version of the app is
ready**, tap **Update**. Books and progress are kept.

With `--auto-update` in step 4, the server pulls by itself every night at 04:30.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| The app says “Offline reading requires HTTPS” | You opened the `http://` address. Use the `https://…ts.net` address. |
| Safari cannot find the `…ts.net` address | Switch on Tailscale on the iPhone. |
| `tailscale serve` complains about the certificate | HTTPS is not enabled in the Tailscale admin console (step 5). |
| `tailscale up` fails with an error about “tun” | The TUN lines are missing from the container configuration (step 1), or the container has not been restarted. |
| `git pull` asks for a password | The repository is private and the deploy key is missing; see step 3. |

## Other ways to get HTTPS

Without Tailscale, Caddy can handle HTTPS itself. Run `setup-lxc.sh` as above, then change
`SITE_ADDRESS` in `/etc/systemd/system/caddy.service.d/rsvp.conf` and run
`systemctl daemon-reload` and `systemctl restart caddy`.

- **Your own domain, open to the internet:** point a DNS record (such as `les.example.com`) at your
  public IP address, forward ports 80 and 443 to the container, and set
  `SITE_ADDRESS=les.example.com`. Caddy fetches a certificate from Let's Encrypt automatically.
- **Your own reverse proxy** (Nginx Proxy Manager, Traefik): keep `SITE_ADDRESS=:80` and point the
  proxy at `http://<container-ip>:80`. The proxy must not cache `sw.js`.
- **Home network only, no domain:** set `SITE_ADDRESS=https://<container-ip>` and add the line
  `Environment="TLS_DIRECTIVE=tls internal"`. Then send Caddy's root certificate
  (`/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`) to the iPhone, for example
  by AirDrop or email. Install the profile under **Settings → General → VPN & Device Management**,
  then turn on full trust under **Settings → General → About → Certificate Trust Settings**.

## With Docker instead

If you run Docker (in a VM, or in an LXC container with nesting), `deploy/docker-compose.yml` uses
the official Caddy image and reads the files straight from the repository:

```sh
git clone https://github.com/karlfk89/Les---a-rsvp-web-app-for-mobile.git /opt/rsvp
cd /opt/rsvp
cp deploy/.env.example deploy/.env                    # adjust SITE_ADDRESS
docker compose -f deploy/docker-compose.yml up -d
```

Updating is then also just `git -C /opt/rsvp pull`. To use Tailscale for HTTPS here, run
`tailscale serve --bg 80` on the Docker host.
