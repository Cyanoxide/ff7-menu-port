#!/usr/bin/env bash
#
# Both PHP suites, against a server this script starts and stops.
#
#   npm run test:php     (from frontend/)
#   scripts/php-test.sh  (from anywhere)
#
# The suites take a base URL and assume something is already listening, which
# meant remembering the php -S invocation — the workers flag, the sendmail stub,
# the right document root — every time. Getting any of it wrong does not fail
# loudly: without PHP_CLI_SERVER_WORKERS the concurrency checks pass whatever
# the code does, and with sendmail pointed at /usr/bin/true the guestbook's
# whole moderation path goes untested.
#
# It runs in a web root of its own, built by copying the handler files next to a
# config that points at throwaway directories. That isolation is the point: a
# suite must not count a dev session's entries against a rate limit, empty its
# guestbook, or read its mail — and "the guestbook starts empty" has to be true
# every run, not only the first.
#
# Port 8121, so it cannot collide with scripts/dev.sh on 8123.
set -euo pipefail

# shellcheck source=scripts/php-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/php-env.sh"

PORT="${PORT:-8121}"
TEST_ROOT="$DEV_ROOT/test"
WEB_DIR="$TEST_ROOT/web"
DATA_DIR="$TEST_ROOT/data"
RATE_DIR="$TEST_ROOT/rate"
MAIL_LOG="$TEST_ROOT/mail.log"
SENDMAIL="$TEST_ROOT/sendmail"
CONFIG="$WEB_DIR/contact-config.php"
PHP_PID=""

cleanup() {
    php_env_stop "$PHP_PID" "$PORT"
}
trap cleanup EXIT INT TERM

php_env_require_port "$PORT"

# Fresh every run. The suites assert on an empty guestbook and on rate limits
# from a standing start, so anything left over is a false failure.
rm -rf "$TEST_ROOT"
mkdir -p "$WEB_DIR" "$DATA_DIR" "$RATE_DIR"

for file in "${PHP_FILES[@]}"; do
    cp "$PUBLIC_DIR/$file" "$WEB_DIR/$file"
done

php_env_write_sendmail "$SENDMAIL" "$MAIL_LOG"
php_env_write_config "$CONFIG" "$RATE_DIR" "$DATA_DIR" "http://127.0.0.1:$PORT"

# The suites read both of these. A mail log they cannot find is reported as "no
# notification was sent", and the wrong config sends the global-cap seeding to
# a counter file the handler is not using — which reads as the cap not working.
export FORM_MAIL_LOG="$MAIL_LOG"
export CONTACT_CONFIG="$CONFIG"

echo "starting PHP on 127.0.0.1:$PORT  (web root $WEB_DIR)"
php_env_serve "$PORT" "$WEB_DIR" "$SENDMAIL" "$TEST_ROOT/server.log"
echo

failed=0

echo "=== contact.php"
bash "$ROOT/tests/contact.sh" "http://127.0.0.1:$PORT" "$RATE_DIR" || failed=1
echo

echo "=== guestbook.php"
bash "$ROOT/tests/guestbook.sh" "http://127.0.0.1:$PORT" "$RATE_DIR" "$DATA_DIR" || failed=1
echo

if [ "$failed" -eq 0 ]; then
    echo "both PHP suites passed"
else
    echo "a PHP suite failed" >&2
fi

exit "$failed"
