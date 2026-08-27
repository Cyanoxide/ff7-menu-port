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

/**
 * Every user-facing string, from contact-messages.json.
 *
 * Shared with the front end, which imports the same file at build time, so a
 * message is written once rather than once per runtime. They had drifted: the
 * empty-field message differed between the two, and the send-failure string
 * carried a typo ("Pleae") that nothing was in a position to catch.
 *
 * The file sits in public/ because that is what Vite copies into dist/
 * verbatim, and dist/ is what gets uploaded — so the copy read here at runtime
 * is the same one the bundle was built from.
 *
 * Messages have a width budget: they render on one line beside the Send link
 * in a font that does not wrap. tests/message-widths.mjs enforces it.
 */
function msg(string $key): string
{
    static $messages = null;

    if ($messages === null) {
        $raw = @file_get_contents(__DIR__ . '/contact-messages.json');
        $decoded = $raw === false ? null : json_decode($raw, true);
        $messages = is_array($decoded) ? $decoded : [];
    }

    // A missing key is a deploy problem, not a reason to hand the visitor a
    // blank line where the reason should be.
    return is_string($messages[$key] ?? null) ? $messages[$key] : 'Something went wrong.';
}

/**
 * Read-modify-write a JSON file under an exclusive lock.
 *
 * The lock has to span the *whole* operation, not just the write. Locking only
 * the write loses updates while the numbering stays contiguous, so the damage
 * is invisible in the data afterwards — which is exactly how a rate limit ends
 * up counting wrong under load and nobody notices.
 *
 * Returns null when the file cannot be opened or locked. Every caller treats
 * that as a refusal rather than as permission.
 */
function withLock(string $path, callable $mutate): mixed
{
    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        return null;
    }
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return null;
    }

    $raw = stream_get_contents($handle);
    $data = json_decode($raw ?: '[]', true);
    if (!is_array($data)) {
        $data = [];
    }

    [$result, $next] = $mutate($data);

    if ($next !== null) {
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($next));
        fflush($handle);
    }

    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

/**
 * Drop timestamps older than an hour and say whether one more would exceed the
 * limit. Shared by the per-address and the global counters.
 */
function underLimit(array $window, int $limit): array
{
    $cutoff = time() - 3600;
    $window = array_values(array_filter($window, static fn($at) => is_int($at) && $at > $cutoff));
    return [count($window) < $limit, $window];
}

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
    respond(503, ['ok' => false, 'error' => msg('notConfigured')]);
}

$config = require $configPath;

foreach (['to', 'from', 'secret'] as $key) {
    if (empty($config[$key])) {
        respond(503, ['ok' => false, 'error' => msg('notConfigured')]);
    }
}

/**
 * The off switch. Set 'enabled' => false in the config and upload it, and the
 * form stops accepting anything — one edit, no deploy, no code change. There if
 * something ever goes wrong and the fastest fix is to close the door.
 */
if (($config['enabled'] ?? true) !== true) {
    respond(503, ['ok' => false, 'error' => msg('closed')]);
}

/**
 * Where the counters live, resolved once.
 *
 * The directory is *created* if it is missing. It used not to be, and the write
 * was silenced with @ — so pointing rate_dir at a directory that did not exist
 * left the rate limit silently doing nothing, which is the one failure mode a
 * rate limit must not have. The example config actively suggests setting this,
 * so the broken case was the one being recommended.
 */
$rateDir = rtrim((string) ($config['rate_dir'] ?? sys_get_temp_dir()), '/');
if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0o700, true);
}
$storeReady = is_dir($rateDir) && is_writable($rateDir);

/** Per-address, global, and replay files. All keyed by the secret so the
 *  filenames give nothing away if the directory is ever readable. */
function storePath(string $rateDir, string $secret, string $kind): string
{
    return $rateDir . '/contact-' . hash('sha256', $kind . '|' . $secret) . '.json';
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
    respond(405, ['ok' => false, 'error' => msg('methodNotAllowed')]);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);

if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => msg('badRequest')]);
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

/**
 * Spam is overwhelmingly link delivery, so a message carrying a handful of URLs
 * is almost never a person. Counted rather than stripped: a message that was
 * quietly edited before sending is worse than one that was refused.
 */
$links = preg_match_all('~https?://|\bwww\.|<a\s~i', $message);
if ($links > MAX_LINKS) {
    respond(422, ['ok' => false, 'error' => msg('tooManyLinks')]);
}

/**
 * From here everything needs the counter store. If it cannot be written the
 * limits below cannot be enforced, so the submission is refused.
 *
 * This is the whole point of the rewrite: the old code silenced the write with
 * @ and carried on, which meant a misconfigured directory disabled the rate
 * limit rather than the form. A contact form that is briefly unavailable is a
 * nuisance; one with no working rate limit is an open pipe to a personal inbox.
 */
if (!$storeReady) {
    respond(503, ['ok' => false, 'error' => msg('busy')]);
}

$secret = (string) $config['secret'];

/**
 * The global ceiling, checked before the per-address one because it is the
 * guarantee rather than the filter — no number of addresses gets past it.
 */
$globalOk = withLock(storePath($rateDir, $secret, 'global'), static function (array $window) {
    [$ok, $window] = underLimit($window, GLOBAL_LIMIT);
    if (!$ok) {
        return [false, null];
    }
    $window[] = time();
    return [true, $window];
});
if ($globalOk !== true) {
    // null means the lock failed: refuse, do not assume there is room
    respond(429, ['ok' => false, 'error' => msg('busy')]);
}

/** Per-address, so one sender cannot use up the global allowance alone. */
$remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$addressOk = withLock(storePath($rateDir, $secret, 'ip|' . $remote), static function (array $window) {
    [$ok, $window] = underLimit($window, RATE_LIMIT);
    if (!$ok) {
        return [false, null];
    }
    $window[] = time();
    return [true, $window];
});
if ($addressOk !== true) {
    respond(429, ['ok' => false, 'error' => msg('rateLimited')]);
}

/**
 * Claim the token, so it cannot be used twice.
 *
 * It used to be reusable for its whole hour: the nonce was generated and
 * signed but never recorded, so one GET bought sixty minutes of posting. The
 * check and the insert happen inside one lock, or two simultaneous posts with
 * the same token would both find it unused.
 *
 * Claimed here rather than at validation time on purpose — a typo in the email
 * field should not burn the token and leave the form dead until a reload.
 */
$nonce = explode(':', $token)[1] ?? '';
$claimed = withLock(storePath($rateDir, $secret, 'nonces'), static function (array $used) use ($nonce) {
    $cutoff = time() - NONCE_TTL;
    $used = array_filter($used, static fn($at) => is_int($at) && $at > $cutoff);
    if (isset($used[$nonce])) {
        return [false, null];
    }
    $used[$nonce] = time();
    return [true, $used];
});
if ($claimed !== true) {
    respond(400, ['ok' => false, 'error' => msg('replay')]);
}

/**
 * From is an address on the sending domain, not the visitor's: sending as
 * someone else's domain is what SPF and DMARC exist to reject, and the mail
 * would be dropped. Reply-To carries the visitor, so replying still works.
 */
/**
 * The envelope sender, which is a different thing from the From: header.
 *
 * Without it PHP hands the message to sendmail with whatever the web server
 * user is — something like apache@srv123.host.net — and that is the address the
 * receiving side checks SPF against. It does not match the sending domain, so
 * the mail is rejected or filed as spam while mail() still returns true and the
 * form still says it sent. Passing -f sets it to the configured From address,
 * which the domain's SPF record can actually authorise.
 *
 * Validated before use: it reaches a shell, so a malformed value in the config
 * must not travel with it. Hosts that forbid the parameter ignore it.
 */
$envelope = null;
if (preg_match('/<([^>]+)>/', (string) $config['from'], $m)) {
    $envelope = trim($m[1]);
} elseif (filter_var($config['from'], FILTER_VALIDATE_EMAIL)) {
    $envelope = (string) $config['from'];
}
$params = ($envelope !== null && filter_var($envelope, FILTER_VALIDATE_EMAIL))
    ? '-f' . $envelope
    : '';

/**
 * A display name has to be quoted, or a comma in it ends the address and the
 * rest becomes a second recipient. Both are already refused if they contain a
 * newline, so quoting the quotes is all that is left.
 */
$replyName = '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $name) . '"';

/**
 * Date and Message-ID are not optional in practice. A message arriving without
 * a Message-ID looks machine-generated to a spam filter, and while most mail
 * servers will add one, "most" is doing a lot of work when the whole point is
 * to stop landing in a spam folder. The domain is taken from the sending
 * address so the id matches the sender.
 */
$idDomain = $envelope !== null && str_contains($envelope, '@')
    ? substr($envelope, strrpos($envelope, '@') + 1)
    : ($_SERVER['SERVER_NAME'] ?? 'localhost');

$headers = [
    'From: ' . $config['from'],
    'Reply-To: ' . $replyName . ' <' . $email . '>',
    'Date: ' . date(DATE_RFC2822),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $idDomain . '>',
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
];

$body = "From: {$name} <{$email}>\n"
    . 'Sent: ' . gmdate('Y-m-d H:i:s') . " UTC\n"
    . "\n"
    . $message . "\n";

$sent = mail($config['to'], 'Portfolio contact from ' . $name, $body, implode("\r\n", $headers), $params);

/**
 * An optional record of what happened to each submission.
 *
 * mail() returning true only means the message was handed to the local mailer —
 * not that it left the building, and certainly not that it arrived. Combined
 * with the honeypot answering 200 without sending, a form can report success
 * for three entirely different reasons. Set 'log' in the config and each
 * outcome is written down, so "it said sent but nothing came" becomes a
 * question with an answer.
 */
if (!empty($config['log'])) {
    @file_put_contents(
        $config['log'],
        sprintf("%s\t%s\tto=%s\tenvelope=%s\tfrom=%s\n",
            gmdate('c'), $sent ? 'mail-accepted' : 'MAIL-FAILED',
            $config['to'], $envelope ?? '(none)', $email),
        FILE_APPEND | LOCK_EX
    );
}

if (!$sent) {
    respond(500, ['ok' => false, 'error' => msg('sendFailed')]);
}

respond(200, ['ok' => true]);
