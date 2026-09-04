#!/usr/bin/env bash
#
# The whole app, locally, with the PHP handlers actually working.
#
#   npm run dev          (from frontend/)
#   scripts/dev.sh       (from anywhere)
#
# Two servers. Vite serves the app on 5173 as it always did, and PHP serves the
# handlers on 8123; vite.config.ts proxies /contact.php, /guestbook.php and
# /guestbook-moderate.php across to it. So the app fetches same-origin URLs, the
# handlers run for real, and hot reload still works — there is no build step in
# the loop.
#
# **This is what was missing before.** `vite` alone does not run PHP, so
# /contact.php fell through the SPA rewrite and came back as index.html: the
# form posted to the app and got a web page in reply. The only way to exercise a
# handler was to build, stage a config and a router into dist/, and serve that —
# a full rebuild for every change to a form.
#
# Mail is captured, never sent, and tailed into this terminal. That is how you
# get at a guestbook delete link: it exists in the notification and nowhere else.
set -euo pipefail

# shellcheck source=scripts/php-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/php-env.sh"

PHP_PORT="${PHP_PORT:-8123}"
CONFIG="$PUBLIC_DIR/contact-config.php"
DATA_DIR="$DEV_ROOT/data"
RATE_DIR="$DEV_ROOT/rate"
MAIL_LOG="$DEV_ROOT/mail.log"
SENDMAIL="$DEV_ROOT/sendmail"
PHP_PID=""
TAIL_PID=""

cleanup() {
    # The PHP backend and the tail belong to this script, so they go with it.
    # Vite runs in the foreground and has already stopped by the time we get here.
    [ -n "$TAIL_PID" ] && kill "$TAIL_PID" 2>/dev/null || true
    php_env_stop "$PHP_PID" "$PHP_PORT"
}
trap cleanup EXIT INT TERM

php_env_require_port "$PHP_PORT"

mkdir -p "$DATA_DIR" "$RATE_DIR"
php_env_write_sendmail "$SENDMAIL" "$MAIL_LOG"

# Never overwrite a config that already exists. It is gitignored, so it may be a
# real configuration someone is holding on to, and quietly rewriting it would be
# a bad surprise.
if [ -f "$CONFIG" ]; then
    php_env_check_config "$CONFIG"
else
    echo "no contact-config.php — writing a local dev one"
    php_env_write_config "$CONFIG" "$RATE_DIR" "$DATA_DIR" "http://localhost:5173"
fi

echo "starting the PHP handlers on 127.0.0.1:$PHP_PORT"
php_env_serve "$PHP_PORT" "$PUBLIC_DIR" "$SENDMAIL" "$DEV_ROOT/server.log"

echo
echo "handlers ready, proxied from Vite. Use the app's own URL — the one Vite"
echo "prints below — and go to /contact for the form and the guestbook."
php_env_report "$CONFIG" "$MAIL_LOG"
echo
echo "mail is captured, not sent. Notifications appear below as they are posted,"
echo "delete links included."
echo

# -n0 so a log left from an earlier run does not scroll past on startup.
touch "$MAIL_LOG"
tail -n0 -f "$MAIL_LOG" | sed 's/^/  mail| /' &
TAIL_PID=$!

cd "$ROOT/frontend"
npx vite "$@"
