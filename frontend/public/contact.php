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
 * The recipient address and signing secret are NOT in this file, so a fork gets
 * working code and none of Jamie's configuration. See contact-config.example.php.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// No caching: the GET hands out a single-use token
header('Cache-Control: no-store');

/** Longest we accept for each field, in characters */
const LIMITS = ['name' => 60, 'email' => 254, 'message' => 4000];

/** A form filled faster than this was not filled by a person */
const MIN_SECONDS = 4;

/** Tokens go stale so one cannot be minted and reused for weeks */
const MAX_SECONDS = 3600;

/** Submissions allowed from one address per hour */
const RATE_LIMIT = 5;

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

define('CONTACT_APP', true);

$configPath = __DIR__ . '/contact-config.php';
if (!is_file($configPath)) {
    // A fork with no config should say so plainly rather than half-work
    respond(503, ['ok' => false, 'error' => 'This form is not configured.']);
}

$config = require $configPath;

foreach (['to', 'from', 'secret'] as $key) {
    if (empty($config[$key])) {
        respond(503, ['ok' => false, 'error' => 'This form is not configured.']);
    }
}

/**
 * Tokens are signed with the shared secret, so the issue time cannot be edited
 * to defeat the timing check and a bot cannot mint its own. Being able to POST
 * at all requires having done the GET first.
 */
function makeToken(string $secret): string
{
    $issued = time();
    $nonce = bin2hex(random_bytes(8));
    $payload = $issued . ':' . $nonce;

    return $payload . ':' . hash_hmac('sha256', $payload, $secret);
}

function readToken(string $token, string $secret): ?int
{
    $parts = explode(':', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$issued, $nonce, $signature] = $parts;
    $expected = hash_hmac('sha256', $issued . ':' . $nonce, $secret);

    // hash_equals rather than ===, so a wrong signature cannot be found by
    // timing how long the comparison takes
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    return ctype_digit($issued) ? (int) $issued : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, ['ok' => true, 'token' => makeToken($config['secret'])]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);

if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'Could not read that request.']);
}

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
    respond(400, ['ok' => false, 'error' => 'Your session expired. Please reload and try again.']);
}

$age = time() - $issued;
if ($age < MIN_SECONDS) {
    respond(429, ['ok' => false, 'error' => 'That was a little quick. Try again in a moment.']);
}
if ($age > MAX_SECONDS) {
    respond(400, ['ok' => false, 'error' => 'Your session expired. Please reload and try again.']);
}

if ($name === '' || $email === '' || $message === '') {
    respond(422, ['ok' => false, 'error' => 'Please fill in every field.']);
}

foreach (LIMITS as $key => $limit) {
    if (mb_strlen($field($key)) > $limit) {
        respond(422, ['ok' => false, 'error' => 'That message is too long.']);
    }
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['ok' => false, 'error' => 'That email address does not look right.']);
}

/**
 * Mail headers are newline separated, so a newline smuggled into a header value
 * lets an attacker append headers of their own and use the form as a relay.
 * Name and email go into headers, so both are refused outright if they contain
 * one — stripping silently would send a subtly different message than was typed.
 */
if (preg_match('/[\r\n]/', $name . $email)) {
    respond(422, ['ok' => false, 'error' => 'That email address does not look right.']);
}

/**
 * Per-address rate limit. A flat file rather than a session, because sessions
 * are per browser and a bot simply will not keep the cookie.
 */
$rateDir = $config['rate_dir'] ?? sys_get_temp_dir();
$remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = rtrim($rateDir, '/') . '/contact-' . hash('sha256', $remote . $config['secret']) . '.json';

$window = [];
if (is_file($rateFile)) {
    $window = json_decode((string) file_get_contents($rateFile), true) ?: [];
}

$cutoff = time() - 3600;
$window = array_values(array_filter($window, static fn($at) => is_int($at) && $at > $cutoff));

if (count($window) >= RATE_LIMIT) {
    respond(429, ['ok' => false, 'error' => 'Too many messages sent. Please try again later.']);
}

$window[] = time();
@file_put_contents($rateFile, json_encode($window), LOCK_EX);

/**
 * From is an address on the sending domain, not the visitor's: sending as
 * someone else's domain is what SPF and DMARC exist to reject, and the mail
 * would be dropped. Reply-To carries the visitor, so replying still works.
 */
$headers = [
    'From: ' . $config['from'],
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
];

$body = "From: {$name} <{$email}>\n"
    . 'Sent: ' . gmdate('Y-m-d H:i:s') . " UTC\n"
    . "\n"
    . $message . "\n";

$sent = mail($config['to'], 'Portfolio contact from ' . $name, $body, implode("\r\n", $headers));

if (!$sent) {
    respond(500, ['ok' => false, 'error' => 'The message could not be sent. Please email me directly.']);
}

respond(200, ['ok' => true]);
