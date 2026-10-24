#!/usr/bin/env bash
# Sets up Caddy in a Debian 12 container to serve the app from this git
# checkout on port 80 (HTTPS comes from `tailscale serve`, see
# docs/SELVHOSTING.md). Safe to run again.
#
#   bash /opt/rsvp/deploy/setup-lxc.sh [--auto-update]
#
# --auto-update  also pull new versions from GitHub every night at 04:30.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
auto_update=false
for arg in "$@"; do
  case "$arg" in
    --auto-update) auto_update=true ;;
    *) echo "Ukjent valg: $arg" >&2; exit 2 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Kjør skriptet som root." >&2
  exit 1
fi
if [[ ! -f "$repo/app/index.html" ]]; then
  echo "Fant ikke $repo/app/index.html. Klon repoet før du kjører skriptet." >&2
  exit 1
fi

echo "==> Installerer Caddy, git og curl"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy git curl >/dev/null

echo "==> Kobler Caddy til $repo/app"
ln -sf "$repo/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/rsvp.conf <<EOF
[Service]
Environment=APP_ROOT=$repo/app
Environment=SITE_ADDRESS=:80
EOF
systemctl daemon-reload
systemctl enable --quiet caddy
systemctl restart caddy

if $auto_update; then
  echo "==> Slår på automatisk oppdatering hver natt kl. 04.30"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cron >/dev/null
  echo "30 4 * * * root git -C $repo pull --ff-only -q" > /etc/cron.d/rsvp-update
fi

echo "==> Sjekker at appen svarer"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://localhost/ && curl -fsS -o /dev/null http://localhost/sw.js; then
    echo "OK: Caddy serverer appen på http://localhost (port 80)."
    echo "Neste steg: tailscale serve --bg 80"
    exit 0
  fi
  sleep 1
done
echo "FEIL: Caddy svarer ikke på port 80. Siste logglinjer:" >&2
journalctl -u caddy -n 20 --no-pager >&2 || true
exit 1
