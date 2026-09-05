<?php
/**
 * Contact form handler.
 *
 * Lives in public/ so Vite copies it into dist/ verbatim, which is what gets
 * uploaded to the host. The front end talks to it with fetch, so nothing here
 * renders HTML — every response is JSON.
 *
 *   GET  /contact.php  -> issues a signed token
 *   POST /contact.php  -> validates and sends
 *
 * The tokens, rate limits, locked store and mail headers are in form-lib.php,
 * shared with the guestbook. What is left here is this form's own policy: its
 * fields, its limits and its message.
 *
 * The recipient address and signing secret are NOT in this file, so a fork gets
 * working code and none of Jamie's configuration. See contact-config.example.php.
 */

declare(strict_types=1);

define('FORM_APP', true);
require __DIR__ . '/form-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// No caching: the GET hands out a single-use token
header('Cache-Control: no-store');

useMessages(__DIR__ . '/contact-messages.json');

/** Longest we accept for each field, in characters */
const LIMITS = ['name' => 60, 'email' => 254, 'message' => 4000];

/** A form filled faster than this was not filled by a person */
const MIN_SECONDS = 4;

/** Tokens go stale so one cannot be minted and reused for weeks */
const MAX_SECONDS = 3600;

/** Submissions allowed from one address per hour. Raisable from the config with
 *  'contact_rate_limit' — see limitFrom() in form-lib.php. */
const RATE_LIMIT = 5;

/**
 * Submissions allowed in an hour from *everyone*, together.
 *
 * The per-address limit is a filter; this is the guarantee. Five an hour per IP
 * is no protection at all against anything holding a proxy list — a hundred
 * addresses is five hundred messages into a personal inbox. This bounds the
 * worst case whatever the sender does, and it fails closed: if the counter
 * cannot be read or written, submissions are refused rather than waved through.
 *
 * Raise it if a real burst of interest ever hits it. Twenty an hour is far more
 * than this form has ever legitimately seen.
 */
const GLOBAL_LIMIT = 20;

/**
 * Links allowed in a message. Spam is overwhelmingly link delivery; a genuine
 * message rarely needs more than one, and never needs five.
 */
const MAX_LINKS = 2;

/** How long a consumed token is remembered, so it cannot be replayed */
const NONCE_TTL = MAX_SECONDS;

$config = loadConfig(__DIR__);

/**
 * The off switch. Set 'enabled' => false in the config and upload it, and the
 * form stops accepting anything — one edit, no deploy, no code change. There if
 * something ever goes wrong and the fastest fix is to close the door.
 */
if (($config['enabled'] ?? true) !== true) {
    respond(503, ['ok' => false, 'error' => msg('closed')]);
}

[$rateDir, $storeReady] = prepareDir($config['rate_dir'] ?? null);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, ['ok' => true, 'token' => makeToken($config['secret'])]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => msg('methodNotAllowed')]);
}

$input = jsonBody();

$field = static fn(string $key): string => trim((string) ($input[$key] ?? ''));

$name = $field('name');
$email = $field('email');
$message = $field('message');
$token = $field('token');

/**
 * The honeypot. It is a real, empty, visually hidden field in the form that a
 * person never sees and never fills. Anything in it came from a bot filling
 * every input it found.
 *
 * Answered with a 200 on purpose: a bot told it failed will try something else,
 * whereas one told it succeeded goes away.
 */
if ($field('website') !== '') {
    respond(200, ['ok' => true]);
}

$issued = readToken($token, $config['secret']);
if ($issued === null) {
    respond(400, ['ok' => false, 'error' => msg('expired')]);
}

$age = time() - $issued;
if ($age < MIN_SECONDS) {
    respond(429, ['ok' => false, 'error' => msg('tooQuick')]);
}
if ($age > MAX_SECONDS) {
    respond(400, ['ok' => false, 'error' => msg('expired')]);
}

if ($name === '' || $email === '' || $message === '') {
    respond(422, ['ok' => false, 'error' => msg('emptyFields')]);
}

foreach (LIMITS as $key => $limit) {
    if (mb_strlen($field($key)) > $limit) {
        respond(422, ['ok' => false, 'error' => msg('tooLong')]);
    }
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['ok' => false, 'error' => msg('badEmail')]);
}

/**
 * Mail headers are newline separated, so a newline smuggled into a header value
 * lets an attacker append headers of their own and use the form as a relay.
 * Name and email go into headers, so both are refused outright if they contain
 * one — stripping silently would send a subtly different message than was typed.
 */
if (preg_match('/[\r\n]/', $name . $email)) {
    respond(422, ['ok' => false, 'error' => msg('badEmail')]);
}

if (countLinks($message) > MAX_LINKS) {
    respond(422, ['ok' => false, 'error' => msg('tooManyLinks')]);
}

/**
 * From here everything needs the counter store. If it cannot be written the
 * limits below cannot be enforced, so the submission is refused.
 *
 * The old code silenced the write with @ and carried on, which meant a
 * misconfigured directory disabled the rate limit rather than the form. A
 * contact form that is briefly unavailable is a nuisance; one with no working
 * rate limit is an open pipe to a personal inbox.
 */
if (!$storeReady) {
    respond(503, ['ok' => false, 'error' => msg('busy')]);
}

$secret = (string) $config['secret'];

/**
 * The global ceiling, checked before the per-address one because it is the
 * guarantee rather than the filter — no number of addresses gets past it.
 */
if (!claimRateSlot($rateDir, $secret, 'global', limitFrom($config, 'contact_global_limit', GLOBAL_LIMIT))) {
    respond(429, ['ok' => false, 'error' => msg('busy')]);
}

/** Per-address, so one sender cannot use up the global allowance alone. */
$remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!claimRateSlot($rateDir, $secret, 'ip|' . $remote, limitFrom($config, 'contact_rate_limit', RATE_LIMIT))) {
    respond(429, ['ok' => false, 'error' => msg('rateLimited')]);
}

if (!claimNonce($rateDir, $secret, $token, NONCE_TTL)) {
    respond(400, ['ok' => false, 'error' => msg('replay')]);
}

$body = "From: {$name} <{$email}>\n"
    . 'Sent: ' . gmdate('Y-m-d H:i:s') . " UTC\n"
    . "\n"
    . $message . "\n";

$sent = sendFormMail($config, 'Portfolio contact from ' . $name, $body, $name, $email);

logLine($config, sprintf(
    "%s\tto=%s\tenvelope=%s\tfrom=%s",
    $sent ? 'mail-accepted' : 'MAIL-FAILED',
    $config['to'],
    envelopeAddress($config) ?? '(none)',
    $email
));

if (!$sent) {
    respond(500, ['ok' => false, 'error' => msg('sendFailed')]);
}

respond(200, ['ok' => true]);
