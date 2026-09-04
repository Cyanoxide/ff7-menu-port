#!/usr/bin/env bash
#
# The guestbook handler, exercised over HTTP. No browser needed.
#
#   cd frontend && npm run build
#   cp public/contact-config.php dist/            # a dev config with a secret
#   PHP_CLI_SERVER_WORKERS=8 \
#       php -d sendmail_path="$PWD/../tests/stub-sendmail.sh" \
#       -S 127.0.0.1:8120 -t dist &
#   tests/guestbook.sh http://127.0.0.1:8120 [rate-dir] [guestbook-dir]
#
# PHP_CLI_SERVER_WORKERS is not optional: php -S is serial by default, and the
# concurrency the rate limits are meant to survive never happens without it.
#
# sendmail_path matters here more than it does for the contact form. The
# notification is the only place the delete link exists — nothing in the JSON
# response carries it — so pointing sendmail at /usr/bin/true would leave the
# single most important thing about moderation completely untested.
#
# The handler speaks JSON, not form encoding.
set -u

BASE="${1:-http://127.0.0.1:8120}"
RATE_DIR="${2:-$(php -r 'echo sys_get_temp_dir();')}"
GB_DIR="${3:-$(php -r 'echo sys_get_temp_dir();')/ff7-guestbook-dev}"
MAIL_LOG="${FORM_MAIL_LOG:-${TMPDIR:-/tmp}/ff7-form-mail.log}"

pass=0; fail=0
chk() { if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ok   %s\n' "$1"
        else fail=$((fail+1)); printf '  FAIL %s: want %s got %s\n' "$1" "$2" "$3"; fi; }

get()  { curl -s "$BASE/guestbook.php"; }
tok()  { get | python3 -c 'import json,sys;print(json.load(sys.stdin).get("token",""))'; }
post() { curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$1" "$BASE/guestbook.php"; }
# The body, not the status. A PHP warning printed in front of the JSON leaves
# the status line saying 200 while the response is unparseable — which is how a
# stored entry once came back to the page looking like a failure. See the note
# at the top of form-lib.php.
postbody() { curl -s -X POST -H 'Content-Type: application/json' -d "$1" "$BASE/guestbook.php"; }
parses()  { python3 -c 'import json,sys;json.load(sys.stdin);print(1)' 2>/dev/null || echo 0; }
okflag()  { python3 -c 'import json,sys;print(str(json.load(sys.stdin).get("ok")).lower())' 2>/dev/null || echo unparseable; }
j()    { python3 -c 'import json,sys;print(json.dumps(dict(a.split("=",1) for a in sys.argv[1:])))' "$@"; }
# j() splits on "=", so it cannot carry a space. This one takes the three fields
# positionally, which matters for the spam checks: real spam is written in
# sentences, and "see_www.example.com" is not the string a filter has to catch.
body() { python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"name":sys.argv[2],"message":sys.argv[3]}))' "$@"; }

# How many entries the endpoint is showing, and the newest name.
count()  { get | python3 -c 'import json,sys;print(json.load(sys.stdin).get("count",-1))'; }
newest() { get | python3 -c 'import json,sys;e=json.load(sys.stdin).get("entries") or [{}];print(e[0].get("name",""))'; }

reset() {
    find "$RATE_DIR" -maxdepth 1 -name 'contact-*.json' -delete 2>/dev/null
    rm -f "$GB_DIR/guestbook.json" "$MAIL_LOG" 2>/dev/null
}

# A fresh token, aged past the minimum fill time
fresh(){ local t; t=$(tok); sleep 5; printf '%s' "$t"; }

reset
echo "guestbook.php at $BASE"
echo "  counters in $RATE_DIR"
echo "  entries  in $GB_DIR"
echo "  mail log    $MAIL_LOG"
echo

# --- the shape of the endpoint ---------------------------------------------
chk "GET issues a token" 1 "$([ -n "$(tok)" ] && echo 1 || echo 0)"
chk "the GET body is JSON and nothing else" 1 "$(get | parses)"
chk "GET starts with no entries" 0 "$(count)"
chk "the shared library is not fetchable" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/form-lib.php")"
chk "the config is not fetchable" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/contact-config.php")"
chk "PUT is refused" 405 "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/guestbook.php")"
chk "a non-json body is refused" 400 "$(post 'name=A&message=hi')"

# --- bot checks -------------------------------------------------------------
T=$(tok)
chk "a form filled instantly is refused" 429 "$(post "$(j token=$T name=A message=hi)")"
chk "the honeypot answers 200, not an error" 200 "$(post "$(j token=$T website=bot name=A message=hi)")"
chk "the honeypot stored nothing" 0 "$(count)"
chk "a made-up token is refused" 400 "$(post "$(j token=nonsense name=A message=hi)")"
chk "a forged signature is refused" 400 \
  "$(post "$(j token=$(date +%s):deadbeefdeadbeef:$(printf 'f%.0s' {1..64}) name=A message=hi)")"

# The two forms sign their tokens with different payloads, so one issued by the
# contact form is worthless here. Without that, the contact form's looser rate
# limit would be a way to mint tokens for the tighter one.
CT=$(curl -s "$BASE/contact.php" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
sleep 5
chk "a contact token cannot sign the guestbook" 400 "$(post "$(j token=$CT name=A message=hi)")"

# --- validation -------------------------------------------------------------
chk "empty fields are refused" 422 "$(post "$(j token=$T name= message=)")"
chk "a missing message is refused" 422 "$(post "$(j token=$T name=A message=)")"
chk "an over-long message is refused" 422 \
  "$(post "$(j token=$T name=A message=$(printf 'x%.0s' {1..600}))")"
chk "an over-long name is refused" 422 \
  "$(post "$(j token=$T name=$(printf 'x%.0s' {1..40}) message=hi)")"
CRLF=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"name":"A\r\nBcc: evil@x.com","message":"hi"}))' "$T")
chk "CRLF header injection is refused" 422 "$(post "$CRLF")"

# The contact form allows two links; the guestbook allows none, because what it
# accepts is published on the site rather than sent to one inbox.
chk "a message with a link is refused" 422 "$(post "$(body "$T" A 'see http://example.com')")"
chk "a bare www link is refused too" 422 "$(post "$(body "$T" A 'see www.example.com')")"
# The one the contact form's patterns miss entirely: no scheme, no www, and a
# perfectly good advert on a page a search engine will read.
chk "a bare domain is refused" 422 "$(post "$(body "$T" A 'try buy-things.com today')")"
# The name is published and goes in the mail subject, so it gets the same check.
chk "a domain in the name is refused" 422 "$(post "$(body "$T" 'www.spam.net' 'hello')")"
chk "nothing refused was stored" 0 "$(count)"

# --- signing ----------------------------------------------------------------
reset
T2=$(fresh)
# Deliberately full of full stops. The bare-domain check is the one likely to
# misfire on ordinary prose, and a real person being told their message looks
# like spam is a worse failure than a spam entry that has to be deleted.
GOOD='Nice sandbox. Mt. Nibel is my favourite bit. e.g. the CRT effect.'
SIGNED=$(postbody "$(body "$T2" Cloud "$GOOD")")
chk "the response is JSON and nothing else" 1 "$(printf '%s' "$SIGNED" | parses)"
chk "a good entry is accepted" true "$(printf '%s' "$SIGNED" | okflag)"
chk "it is visible immediately" 1 "$(count)"
chk "it is the newest entry" Cloud "$(newest)"
chk "the same token cannot be used twice" 400 "$(post "$(body "$T2" Cloud 'again')")"

# --- the notification -------------------------------------------------------
# The delete link exists nowhere else, so this is the check that moderation is
# reachable at all.
if [ -f "$MAIL_LOG" ]; then
  chk "a notification was sent" 1 "$(grep -c 'Guestbook signed by Cloud' "$MAIL_LOG" | tr -d ' ')"
  chk "it carries the entry" 1 "$(grep -c 'Nice sandbox' "$MAIL_LOG" | tr -d ' ')"
  chk "it has a From header on the sending domain" 1 \
    "$(grep -c '^From: .*no-reply@' "$MAIL_LOG" | tr -d ' ')"
  chk "it has a Message-ID" 1 "$(grep -c '^Message-ID: <' "$MAIL_LOG" | tr -d ' ')"
  # The guestbook collects no address, so there is nobody to reply to. A
  # Reply-To with a name and no address would be malformed.
  chk "it has no Reply-To" 0 "$(grep -c '^Reply-To:' "$MAIL_LOG" | tr -d ' ')"
  chk "it carries a delete link" 1 \
    "$(grep -c 'guestbook-moderate\.php?id=' "$MAIL_LOG" | tr -d ' ')"
else
  fail=$((fail+1))
  printf '  FAIL no mail log at %s — start php with -d sendmail_path=tests/stub-sendmail.sh\n' "$MAIL_LOG"
fi

# --- moderation -------------------------------------------------------------
LINK=$(grep -o 'http[^ ]*guestbook-moderate\.php?id=[^ ]*' "$MAIL_LOG" 2>/dev/null | head -1)

if [ -n "$LINK" ]; then
  # The GET must not delete. Mail clients prefetch links, scanners follow them;
  # if fetching were enough, an entry could vanish before it was read about.
  chk "the link shows a confirmation, not a deletion" 1 \
    "$(curl -s "$LINK" | grep -c 'Remove entry' | tr -d ' ')"
  chk "fetching the link left the entry alone" 1 "$(count)"

  BAD=$(printf '%s' "$LINK" | sed 's/sig=./sig=0/')
  chk "a tampered signature is refused" 1 \
    "$(curl -s "$BAD" | grep -c 'not valid' | tr -d ' ')"
  chk "the tampered link deleted nothing" 1 "$(count)"

  chk "the POST removes it" 1 \
    "$(curl -s -X POST "$LINK" | grep -c 'Entry removed' | tr -d ' ')"
  chk "the entry is gone" 0 "$(count)"
  chk "removing it twice is not an error" 1 \
    "$(curl -s -X POST "$LINK" | grep -c 'Entry removed' | tr -d ' ')"
else
  fail=$((fail+1)); printf '  FAIL no delete link found in the notification\n'
fi

# --- the per-address ceiling ------------------------------------------------
# Two an hour, against the contact form's five: nobody signs a guestbook twice.
reset
over=0
for i in 1 2 3 4; do
  [ "$(post "$(body "$(fresh)" "R$i" "rate $i")")" = 429 ] && { over=$i; break; }
done
chk "one address is cut off after 2 an hour" 3 "$over"

# --- the global ceiling -----------------------------------------------------
# The per-address limit is a filter; this is the guarantee — it is what bounds
# the damage when the sender has a proxy list and every request is a new address.
#
# Seeded directly rather than by signing ten times from ten addresses, which
# php -S cannot fake anyway (REMOTE_ADDR is always the loopback, and trusting a
# header instead is exactly how a rate limit gets bypassed in production). The
# file is the handler's own format: an array of timestamps.
reset
NOW=$(date +%s)
# CONTACT_APP has to be defined or the config guards against direct inclusion
# and exits — which is exactly what it is there to do.
GLOBAL_FILE=$(php -r '
  define("CONTACT_APP", true);
  $c = require $argv[1];
  $dir = rtrim($c["rate_dir"] ?? sys_get_temp_dir(), "/");
  echo $dir . "/contact-" . hash("sha256", "gb|global|" . $c["secret"]) . ".json";
' "${CONTACT_CONFIG:-frontend/public/contact-config.php}" 2>/dev/null)
if [ -n "$GLOBAL_FILE" ]; then
  python3 -c "import json,sys;json.dump([int(sys.argv[1])]*10, open(sys.argv[2],'w'))" "$NOW" "$GLOBAL_FILE"
  chk "everyone together is cut off at the global cap" 429 \
    "$(post "$(body "$(fresh)" Over 'over the global cap')")"
  chk "nothing was stored past the cap" 0 "$(count)"
else
  printf '  SKIP global cap — could not locate the counter file\n'
fi

reset
echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
