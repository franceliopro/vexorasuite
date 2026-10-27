#!/bin/sh
set -eu
cp /opt/vexora/settings.yml /etc/searxng/settings.yml
# Private, stateless search: never reuse the application's JWT or credentials.
export SEARXNG_SECRET="${SEARXNG_SECRET:-$(head -c 32 /dev/urandom | base64)}"
exec /usr/local/searxng/entrypoint.sh
