#!/usr/bin/env bash
#
# A stand-in for sendmail, so a test can see what the handlers actually posted.
#
# PHP's mail() hands the whole message — headers and body — to the program named
# by sendmail_path on stdin. The suites used to point that at /usr/bin/true,
# which proves mail() returned true and nothing else: a handler that built a
# malformed header, addressed the wrong recipient or left the delete link out of
# a guestbook notification would pass every check.
#
# This appends each message to a log instead, so the assertions can read it.
#
#   php -d sendmail_path="$PWD/tests/stub-sendmail.sh" -S 127.0.0.1:8120 -t dist
#
# The log path comes from FORM_MAIL_LOG when it is set. php -S does not pass the
# environment through to sendmail_path reliably, so the default matters more
# than it looks — the suites read the same default.
set -u

LOG="${FORM_MAIL_LOG:-${TMPDIR:-/tmp}/ff7-form-mail.log}"

{
    echo "----- message $(date -u +%Y-%m-%dT%H:%M:%SZ) -----"
    cat
    echo
} >> "$LOG"
