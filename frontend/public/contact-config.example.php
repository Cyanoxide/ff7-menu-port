<?php
/**
 * Template for the contact form's and the guestbook's configuration.
 *
 * One file for both. They share a recipient, a signing secret and a rate-limit
 * store, and a second config would mean a second thing to upload by hand and
 * keep in step. The guestbook's own settings are at the bottom.
 *
 * Copy this to contact-config.php, fill it in, and upload it alongside
 * contact.php. contact-config.php is gitignored: the real address and secret
 * must never be committed, so a fork of this repo gets working code and none of
 * the owner's configuration.
 *
 *   cp contact-config.example.php contact-config.php
 *
 * Note this file lives in public/, so Vite copies the *template* into dist/ on
 * every build. That is harmless — it is inert without being renamed — but it
 * does mean the real contact-config.php has to be uploaded once by hand and
 * left in place, rather than coming from dist/.
 */

declare(strict_types=1);

// Guards against the file being fetched directly over HTTP. loadConfig() in
// form-lib.php defines CONTACT_APP before requiring this; a browser hitting the
// URL does not, and gets a blank 403 rather than the secret.
//
// The name is historical — it predates the guestbook, and the copy already
// deployed on the server checks for this exact constant. Renaming it would mean
// the live config rejecting both handlers until it was re-uploaded.
if (!defined('CONTACT_APP')) {
    http_response_code(403);
    exit;
}

return [
    /**
     * The off switch. Set this to false and upload the file, and the form stops
     * accepting anything — one edit, no deploy. There for the day something
     * goes wrong and the fastest fix is to close the door.
     *
     * Leaving the key out entirely is the same as true; the form only closes if
     * this is present and set to something other than true.
     */
    'enabled' => true,

    /**
     * Where submissions are delivered.
     *
     * Worth pointing at a dedicated alias or subaddress — you+phs@example.com —
     * rather than your main inbox. Nothing here can be perfect, and if spam
     * ever does get through, an alias is something you can filter or mute in
     * your mail client without touching this form or waiting on a deploy.
     */
    'to' => 'you@example.com',

    /**
     * The From: header. This must be an address on the domain that is actually
     * sending — the host's own domain — not the visitor's. Sending as somebody
     * else's domain is exactly what SPF and DMARC reject, and the mail is
     * dropped or filed as spam. The visitor's address travels in Reply-To, so
     * replying still reaches them.
     */
    'from' => 'Website Contact <no-reply@example.com>',

    /**
     * IF YOUR MAIL ARRIVES FROM THE HOST'S OWN ADDRESS, OR LANDS IN SPAM, the
     * cause is almost never this file — the handler sets From, Reply-To, Date
     * and Message-ID correctly, and passes the envelope sender with -f. What
     * decides whether a receiving server believes any of it is the domain's
     * DNS and the host's own rules:
     *
     *  1. Make the address above a REAL mailbox or alias on the domain. Hosts
     *     routinely rewrite From when asked to send as an address that does not
     *     exist on the account, which is what produces a sender like
     *     sh-1066879224@eu.hosting-webspace.io.
     *  2. Turn on SPF and DKIM for the domain — cPanel calls the page "Email
     *     Deliverability". Without them Gmail has no reason to trust a message
     *     claiming to be from your domain, and files it accordingly.
     *  3. Add DMARC once those two pass.
     *
     * Some shared hosts force the envelope sender regardless of -f. If yours
     * does, 1 and 2 are the whole fix.
     */

    /**
     * Signing key for the form tokens. Any long random string; it never leaves
     * the server. Generate one with:
     *
     *   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
     *
     * Changing it invalidates tokens already issued, so anyone with the form
     * open has to reload before sending. Otherwise it can be rotated freely.
     */
    'secret' => 'replace-me-with-a-long-random-string',

    /**
     * Where the rate-limit counters and spent tokens are written. Optional —
     * the system temp directory is used when this is left out, which is fine on
     * most hosts. Set it to a private, writable directory if the temp directory
     * is shared with other accounts, or wiped often enough that the limits stop
     * counting. It must not be inside the web root.
     *
     * The directory is created if it does not exist. If it cannot be created or
     * written, the form **refuses submissions** rather than accepting them
     * unlimited — the limits are the only thing bounding how much mail this can
     * put in your inbox, so running without them is not the safer failure.
     */
    /**
     * Optional. A file to append one line to per submission, recording whether
     * the local mailer accepted the message.
     *
     * Worth switching on while setting the form up. mail() returning true only
     * means the message was handed over — not that it was delivered — and a
     * filled honeypot answers with a cheerful success and sends nothing at all.
     * Three different things look identical from the front end; this tells them
     * apart. Put it outside the web root.
     */
    'log' => null,

    'rate_dir' => null,

    /* ---------------------------------------------------------------------
     * The guestbook
     *
     * Everything above is shared with it — the same recipient, the same From,
     * the same secret, the same rate_dir and log. What follows is its own.
     * ------------------------------------------------------------------- */

    /**
     * The guestbook's off switch, separate from the contact form's.
     *
     * Deliberately separate: the likely reason to close the guestbook is a spam
     * run, and that is no reason to stop people writing to you. Leaving the key
     * out is the same as true.
     */
    'guestbook_enabled' => true,

    /**
     * REQUIRED for the guestbook, and it has no default.
     *
     * Where the entries themselves are stored. Unlike rate_dir, which may point
     * at the system temp directory and lose nothing worse than a counter, this
     * file **is** the guestbook — losing it loses every entry.
     *
     * Two rules, and both matter:
     *
     *  1. **Outside the web root**, ideally. Something like
     *     '/home/youraccount/private/guestbook' — a sibling of the public
     *     directory rather than a child of it. Two reasons: the file holds
     *     hashed sender addresses and has no business being fetchable, and
     *     anything under the uploaded directory is in the deploy's path.
     *  2. **Somewhere durable.** Not the system temp directory: shared hosts
     *     clear it, and the guestbook would quietly empty itself.
     *
     * IF YOU PUT IT INSIDE THE UPLOADED DIRECTORY ANYWAY — which does work, and
     * is the easy thing to do on a host that only gives you public_html — then
     * two things have to be true, and neither is automatic:
     *
     *  - **The upload must not mirror-delete.** A plain FTP or file-manager
     *     upload leaves files it does not know about alone, so the data
     *     survives. Anything that syncs the directory to match dist/ exactly
     *     (rsync --delete, some deploy tools, "delete extraneous files" in an
     *     FTP client) will remove the guestbook on the next deploy. There is no
     *     warning; the file is simply gone and so is every entry.
     *  - **It must be denied over HTTP.** htaccess.example carries a rule for a
     *     directory named `guestbook-data`; use that name and it is covered.
     *     Without it, anyone can fetch the JSON.
     *
     * Take a copy before deploying either way. The directory is created if it
     * does not exist; if it cannot be created or written, the guestbook refuses
     * signatures rather than accepting ones it cannot store.
     *
     * Left as null the guestbook reports itself unconfigured and the tab says
     * so, which is the honest failure — better than a form that accepts
     * signatures and drops them.
     */
    'guestbook_dir' => null,

    /**
     * The site's own base URL, used to build the delete link in the guestbook
     * notification email. No trailing slash.
     *
     * Worth setting. Without it the link is built from the Host header, which
     * is supplied by whoever made the request — so a crafted request could put
     * a link to somewhere else in your inbox. The signature is what makes the
     * link work, not the host, so nothing can be deleted that way; it is the
     * link you are about to click that is worth pinning down.
     */
    'site_url' => 'https://www.example.com',
];
