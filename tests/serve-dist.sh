#!/usr/bin/env bash
#
# Build the site and serve it the way the host does, so the PHP handler runs.
#
#   tests/serve-dist.sh [port]
#
# `vite build` empties dist/ every time, so the two files the handler needs that
# are not part of the bundle — the local config and the SPA router — have to be
# staged again after every build. Doing that by hand is how the suite ends up
# reporting fifteen failures that are really one missing file.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${1:-8100}"
FRONTEND="frontend"
SCRATCH="$(mktemp -d)"

cat > "$SCRATCH/router.php" <<'PHPEOF'
<?php
// Real files win (including .php, which the built-in server executes);
// everything else falls back to index.html so SPA routes resolve.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;
if ($path !== '/' && file_exists($file) && !is_dir($file)) {
    return false;
}
require __DIR__ . '/index.html';
PHPEOF

# A mailer that captures instead of sending, so a test run cannot post real mail
MAILDIR="$SCRATCH/mail"; mkdir -p "$MAILDIR"
cat > "$SCRATCH/sendmail" <<EOF
#!/bin/sh
cat > "$MAILDIR/\$(date +%s%N).eml"
EOF
chmod +x "$SCRATCH/sendmail"

(cd "$FRONTEND" && npm run build >/dev/null)
cp "$FRONTEND/public/contact-config.php" "$FRONTEND/dist/" 2>/dev/null \
  || { echo "no frontend/public/contact-config.php — copy the example and set a secret"; exit 1; }
cp "$SCRATCH/router.php" "$FRONTEND/dist/router.php"

# Refuse rather than mislead. php -S prints "Address already in use" and exits,
# but this script has already announced a port and a mail directory by then —
# so requests quietly go to whatever was already listening, with the previous
# build and the previous maildir, and the output points at neither.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is already in use — stop that server first:" >&2
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
  exit 1
fi

echo "serving $FRONTEND/dist on http://127.0.0.1:$PORT"
echo "mail captured in $MAILDIR"
exec env PHP_CLI_SERVER_WORKERS=8 php -d sendmail_path="$SCRATCH/sendmail" \
  -S "127.0.0.1:$PORT" -t "$FRONTEND/dist" "$FRONTEND/dist/router.php"
