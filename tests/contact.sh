#!/usr/bin/env bash
#
# The contact handler, exercised over HTTP. No browser needed.
#
#   cd frontend && npm run build
#   cp public/contact-config.php dist/            # a dev config with a secret
#   PHP_CLI_SERVER_WORKERS=8 php -d sendmail_path=/usr/bin/true \
#       -S 127.0.0.1:8120 -t dist &
#   tests/contact.sh http://127.0.0.1:8120 [rate-dir]
#
# PHP_CLI_SERVER_WORKERS is not optional: php -S is serial by default, and the
# concurrency checks below pass either way without it.
#
# The handler speaks JSON, not form encoding.
set -u

BASE="${1:-http://127.0.0.1:8120}"
# Where the handler keeps its counters, so the suite can reset between phases.
RATE_DIR="${2:-$(php -r 'echo sys_get_temp_dir();')}"

pass=0; fail=0
chk() { if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ok   %s\n' "$1"
        else fail=$((fail+1)); printf '  FAIL %s: want %s got %s\n' "$1" "$2" "$3"; fi; }
tok()  { curl -s "$BASE/contact.php" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
post() { curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$1" "$BASE/contact.php"; }
# The body, not the status. A PHP warning printed in front of the JSON leaves
# the status line saying 200 while the response is unparseable, so the page
# reports a failure for a message that was actually sent. mail() warns whenever
# the local mailer exits non-zero, so this is a real case, not a theoretical
# one. See the note at the top of form-lib.php.
postbody() { curl -s -X POST -H 'Content-Type: application/json' -d "$1" "$BASE/contact.php"; }
parses()  { python3 -c 'import json,sys;json.load(sys.stdin);print(1)' 2>/dev/null || echo 0; }
okflag()  { python3 -c 'import json,sys;print(str(json.load(sys.stdin).get("ok")).lower())' 2>/dev/null || echo unparseable; }
j()    { python3 -c 'import json,sys;print(json.dumps(dict(a.split("=",1) for a in sys.argv[1:])))' "$@"; }
reset(){ find "$RATE_DIR" -maxdepth 1 -name 'contact-*.json' -delete 2>/dev/null; }
# A fresh token, aged past the minimum fill time
fresh(){ local t; t=$(tok); sleep 5; printf '%s' "$t"; }

# The messages have to fit the status line before anything else matters — and
# this half needs no server, so it runs first.
if command -v node >/dev/null 2>&1; then
  if node "$(dirname "$0")/message-widths.mjs" >/dev/null 2>&1; then
    pass=$((pass+1)); printf '  ok   every message fits the status line\n'
  else
    fail=$((fail+1)); printf '  FAIL a message will not fit — run tests/message-widths.mjs\n'
  fi
fi

reset
echo "contact.php at $BASE  (counters in $RATE_DIR)"

# --- the shape of the endpoint ---------------------------------------------
chk "GET issues a token" 1 "$([ -n "$(tok)" ] && echo 1 || echo 0)"
chk "the GET body is JSON and nothing else" 1 "$(curl -s "$BASE/contact.php" | parses)"
chk "the config is not fetchable" 403 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/contact-config.php")"
chk "PUT is refused" 405 "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/contact.php")"
chk "a non-json body is refused" 400 "$(post 'name=A&email=a@b.co')"

# --- bot checks -------------------------------------------------------------
T=$(tok)
chk "a form filled instantly is refused" 429 "$(post "$(j token=$T name=A email=a@b.co message=hi)")"
chk "the honeypot answers 200, not an error" 200 "$(post "$(j token=$T website=bot name=A email=a@b.co message=hi)")"
chk "a made-up token is refused" 400 "$(post "$(j token=nonsense name=A email=a@b.co message=hi)")"
chk "a forged signature is refused" 400 \
  "$(post "$(j token=$(date +%s):deadbeefdeadbeef:$(printf 'f%.0s' {1..64}) name=A email=a@b.co message=hi)")"

# --- validation -------------------------------------------------------------
sleep 5
chk "empty fields are refused" 422 "$(post "$(j token=$T name= email= message=)")"
chk "a bad email is refused" 422 "$(post "$(j token=$T name=A email=notanemail message=hi)")"
chk "an over-long message is refused" 422 \
  "$(post "$(j token=$T name=A email=a@b.co message=$(printf 'x%.0s' {1..5000}))")"
CRLF=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"name":"A\r\nBcc: evil@x.com","email":"a@b.co","message":"hi"}))' "$T")
chk "CRLF header injection is refused" 422 "$(post "$CRLF")"
chk "a link-stuffed message is refused" 422 \
  "$(post "$(j token=$T name=A email=a@b.co message=see_http://a.com_http://b.com_http://c.com)")"
chk "one link is still allowed" 200 "$(post "$(j token=$(fresh) name=A email=a@b.co message=see_http://example.com)")"

# --- tokens are single use --------------------------------------------------
reset
T2=$(fresh)
SENT=$(postbody "$(j token=$T2 name=Jamie email=j@example.com message=hello)")
chk "the response is JSON and nothing else" 1 "$(printf '%s' "$SENT" | parses)"
chk "a good submission is accepted" true "$(printf '%s' "$SENT" | okflag)"
chk "the same token cannot be used twice" 400 "$(post "$(j token=$T2 name=Jamie email=j@example.com message=again)")"

# --- the per-address ceiling ------------------------------------------------
reset
over=0
for i in 1 2 3 4 5 6 7; do
  [ "$(post "$(j token=$(fresh) name=R$i email=r@b.co message=rate_$i)")" = 429 ] && { over=$i; break; }
done
chk "one address is cut off after 5 an hour" 6 "$over"

# --- the global ceiling -----------------------------------------------------
# Seeded directly rather than by sending 20 messages, which would take minutes:
# the file is the handler's own format, an array of timestamps.
reset
NOW=$(date +%s)
# CONTACT_APP has to be defined or the config guards against direct inclusion
# and exits — which is exactly what it is there to do.
GLOBAL_FILE=$(php -r '
  define("CONTACT_APP", true);
  $c = require $argv[1];
  $dir = rtrim($c["rate_dir"] ?? sys_get_temp_dir(), "/");
  echo $dir . "/contact-" . hash("sha256", "global|" . $c["secret"]) . ".json";
' "${CONTACT_CONFIG:-frontend/public/contact-config.php}" 2>/dev/null)
if [ -n "$GLOBAL_FILE" ]; then
  python3 -c "import json,sys;json.dump([int(sys.argv[1])]*20, open(sys.argv[2],'w'))" "$NOW" "$GLOBAL_FILE"
  chk "everyone together is cut off at the global cap" 429 \
    "$(post "$(j token=$(fresh) name=A email=a@b.co message=over_the_global_cap)")"
  reset
else
  printf '  SKIP global cap — could not locate the counter file\n'
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
