#!/usr/bin/env bash
# Sets up Caddy in a Debian 12 container to serve the app from this git
# checkout on port 80 (HTTPS comes from `tailscale serve`, see
# docs/SELF-HOSTING.md). Safe to run again.
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
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run the script as root." >&2
  exit 1
fi
if [[ ! -f "$repo/app/index.html" ]]; then
  echo "Could not find $repo/app/index.html. Clone the repository before running the script." >&2
  exit 1
fi

echo "==> Installing Caddy, git and curl"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy git curl >/dev/null

echo "==> Pointing Caddy at $repo/app"
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
  echo "==> Turning on automatic updates every night at 04:30"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cron >/dev/null
  echo "30 4 * * * root git -C $repo pull --ff-only -q" > /etc/cron.d/rsvp-update
fi

echo "==> Checking that the app responds"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://localhost/ && curl -fsS -o /dev/null http://localhost/sw.js; then
    echo "OK: Caddy serves the app on http://localhost (port 80)."
    echo "Next step: tailscale serve --bg 80"
    exit 0
  fi
  sleep 1
done
echo "ERROR: Caddy does not respond on port 80. Last log lines:" >&2
journalctl -u caddy -n 20 --no-pager >&2 || true
exit 1
