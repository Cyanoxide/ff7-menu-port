<?php
/**
 * Template for the contact form's configuration.
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

// Guards against the file being fetched directly over HTTP. contact.php defines
// CONTACT_APP before requiring it; a browser hitting the URL does not, and gets
// a blank 403 rather than the secret.
if (!defined('CONTACT_APP')) {
    http_response_code(403);
    exit;
}

return [
    // Where submissions are delivered.
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
     * Where the per-IP rate limit counters are written. Optional — the system
     * temp directory is used when this is left out, which is fine on most hosts.
     * Set it to a private, writable directory if the temp directory is shared
     * with other accounts, or wiped often enough that the limit stops counting.
     * It must not be inside the web root.
     */
    'rate_dir' => null,
];
