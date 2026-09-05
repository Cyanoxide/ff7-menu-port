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
     * WHERE THE GUESTBOOK IS KEPT. Optional — see the default below.
     *
     * This is the only setting that stores anything. The handler keeps one file
     * in this directory, guestbook.json, and that file *is* the guestbook:
     * every entry anyone has ever signed. There is no database behind it.
     * rate_dir above looks similar and is not — that holds throwaway counters,
     * and losing it costs nothing but a reset rate limit. Losing this loses the
     * lot.
     *
     * LEAVE IT UNSET and it becomes a folder called `guestbook-data` sitting
     * beside guestbook.php, created the first time someone signs. That keeps
     * the site self-contained, which is usually what you want, and it is what
     * the rest of this comment assumes.
     *
     * Two things follow from the data living inside the uploaded directory, and
     * neither is automatic:
     *
     *  1. **It is a URL as well as a file.** guestbook.json is plain JSON and
     *     carries a hashed sender address per entry. The `guestbook-data` deny
     *     rule in htaccess.example covers the default name — but that file is a
     *     *reference copy* and is never uploaded, so the rule has to be in the
     *     server's own .htaccess. Check it by asking for
     *     yoursite.com/guestbook-data/guestbook.json in a browser: you should
     *     be refused.
     *  2. **A mirroring upload will delete it.** The folder exists only on the
     *     server — it is never in dist/ — so a plain FTP or file-manager upload
     *     leaves it alone. Anything that syncs the directory to *match* dist/
     *     (rsync --delete, some deploy tools, "remove extraneous files" in an
     *     FTP client) removes it, silently and completely. Take a copy before
     *     deploying if you are not sure which yours does.
     *
     * A private directory outside the web root — '/home/you/private/guestbook'
     * — sidesteps both, at the cost of somewhere else to remember.
     *
     * WRITE IT ABSOLUTE, either way. A relative path like 'guestbook-data' is
     * resolved against the *process's* working directory, which is the script's
     * folder on some hosts and the filesystem root on others, so it appears to
     * work until it does not. A leading slash is not the fix — '/guestbook-data'
     * is the filesystem root, which no shared host lets you write to. Use
     * __DIR__ . '/name', or leave it unset and take the default.
     *
     * If it cannot be created or written, signing is refused rather than
     * accepted and dropped, and the reason goes to the `log` file above: the
     * resolved path, whether it exists, and whether it is writable. Reading
     * still works, so a bad path shows an empty guestbook rather than an error.
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

    /**
     * Rate limits, if the defaults do not suit. Leave them out and the handlers
     * use their own: 5 an hour per address and 20 overall for the contact form,
     * 2 and 10 for the guestbook — a guestbook entry is published rather than
     * sent to one inbox, so it is held tighter.
     *
     *   'contact_rate_limit'     'contact_global_limit'
     *   'guestbook_rate_limit'   'guestbook_global_limit'
     *
     * These exist mainly so a *local* config can get out of its own way: two an
     * hour is two test messages, and there is nothing to do after that but
     * wait. scripts/php-env.sh writes the dev config with them raised.
     *
     * **Do not raise them on the server to make testing easier**, and do not be
     * tempted to exempt localhost in the code instead — behind a reverse proxy,
     * which is most shared hosting, REMOTE_ADDR is 127.0.0.1 for every request,
     * so that exemption would switch the limit off in production and nothing
     * would look wrong. Anything that is not a positive integer is ignored, so
     * a typo here leaves the default in place rather than the cap off.
     */
];
