# Les – RSVP-leser served by Caddy. Build from the repository root:
#   docker build -f deploy/Dockerfile -t les .
FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY app/ /srv/
