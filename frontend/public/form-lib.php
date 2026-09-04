<?php
/**
 * Shared machinery for the form handlers.
 *
 * contact.php had all of this to itself until the guestbook needed the same
 * tokens, the same rate limits and the same mail headers. Copying it would have
 * left two versions of code whose whole job is to be hard to get past, drifting
 * apart the way contact-messages.json already did once — so it lives here and
 * both handlers require it.
 *
 * Every entry point must define FORM_APP before requiring this. It is in
 * public/, so it is a URL as well as a file, and there is no reason for a
 * browser to be able to fetch it.
 *
 * Nothing here echoes anything except respond().
 */

declare(strict_types=1);

if (!defined('FORM_APP')) {
    http_response_code(403);
    exit;
}

/* ---------------------------------------------------------------------------
 * Keeping the response body clean
 *
 * PHP prints warnings into the output by default, and these endpoints answer
 * with JSON — so one warning ahead of the body makes the whole response
 * unparseable. That is not hypothetical: mail() warns whenever the local mailer
 * exits non-zero, and it happened here. The guestbook entry was stored, the
 * notification was attempted, the handler returned a perfectly good
 * {"ok":true} — and the page said "Something went wrong", because json() threw
 * on the "<br /><b>Warning</b>" in front of it.
 *
 * Worse, it was invisible to the test suites, which checked status codes. The
 * status was 200 the whole time.
 *
 * Two layers, because the failure is silent and expensive:
 *
 *  1. display_errors off. Errors still reach error_reporting and the host's
 *     error log, which is where a warning belongs on an endpoint nobody reads
 *     by eye. This is the fix.
 *  2. An output buffer that respond() throws away. Anything that still manages
 *     to print — a stray echo, a notice raised before this file is reached, a
 *     host that overrides display_errors — cannot get in front of the JSON.
 *
 * tests/guestbook.sh and tests/contact.sh both now parse the body rather than
 * trusting the status line, so a regression here fails a test.
 * ------------------------------------------------------------------------- */

ini_set('display_errors', '0');
ob_start();

/* ---------------------------------------------------------------------------
 * Responses
 * ------------------------------------------------------------------------- */

/**
 * The handlers speak JSON, not HTML. Every exit goes through here so a caller
 * can never fall off the end of a script having sent a 200 and no body.
 *
 * Note guestbook-moderate.php renders HTML and does not use this — except by
 * way of loadConfig(), which answers a missing config with JSON. A visitor
 * would see a line of JSON rather than a page, which is untidy but only
 * reachable when the site has no configuration at all, and the text still says
 * what is wrong.
 */
function respond(int $status, array $body): never
{
    // Discard anything already written. See the note above: whatever it was, it
    // is not part of the response, and leaving it in front of the JSON turns a
    // successful request into an apparent failure.
    if (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($status);
    echo json_encode($body);
    exit;
}

/* ---------------------------------------------------------------------------
 * User-facing strings
 * ------------------------------------------------------------------------- */

/**
 * The message file this handler reads, set once at startup.
 *
 * The strings are shared with the front end, which imports the same JSON at
 * build time, so a message is written once rather than once per runtime. They
 * had drifted before this: the empty-field message differed between the two and
 * a send-failure string carried a typo that nothing was in a position to catch.
 *
 * The files sit in public/ because that is what Vite copies into dist/
 * verbatim, and dist/ is what gets uploaded — so the copy read here at runtime
 * is the same one the bundle was built from.
 *
 * Messages have a width budget: they render on one line beside the send link in
 * a font that does not wrap. tests/message-widths.mjs enforces it.
 */
function useMessages(string $path): void
{
    $GLOBALS['form_messages_path'] = $path;
}

function msg(string $key): string
{
    static $messages = null;
    static $loadedFrom = null;

    $path = (string) ($GLOBALS['form_messages_path'] ?? '');

    if ($messages === null || $loadedFrom !== $path) {
        $raw = @file_get_contents($path);
        $decoded = $raw === false ? null : json_decode($raw, true);
        $messages = is_array($decoded) ? $decoded : [];
        $loadedFrom = $path;
    }

    // A missing key is a deploy problem, not a reason to hand the visitor a
    // blank line where the reason should be.
    return is_string($messages[$key] ?? null) ? $messages[$key] : 'Something went wrong.';
}

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

/**
 * Load contact-config.php, or refuse to run.
 *
 * The constant is named CONTACT_APP for historical reasons — it predates the
 * guestbook, and the config file already deployed on the server checks for that
 * exact name. Renaming it here would mean the live config rejecting both
 * handlers until it was re-uploaded, which is a silly thing to risk for a
 * tidier name. Defined here so neither handler has to remember to.
 */
function loadConfig(string $dir): array
{
    if (!defined('CONTACT_APP')) {
        define('CONTACT_APP', true);
    }

    $path = $dir . '/contact-config.php';
    if (!is_file($path)) {
        // A fork with no config should say so plainly rather than half-work
        respond(503, ['ok' => false, 'error' => msg('notConfigured')]);
    }

    $config = require $path;

    if (!is_array($config)) {
        respond(503, ['ok' => false, 'error' => msg('notConfigured')]);
    }

    foreach (['to', 'from', 'secret'] as $key) {
        if (empty($config[$key])) {
            respond(503, ['ok' => false, 'error' => msg('notConfigured')]);
        }
    }

    return $config;
}

/* ---------------------------------------------------------------------------
 * The store
 * ------------------------------------------------------------------------- */

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
 * Where the counters live, and whether they can be written.
 *
 * The directory is *created* if it is missing. It used not to be, and the write
 * was silenced with @ — so pointing rate_dir at a directory that did not exist
 * left the rate limit silently doing nothing, which is the one failure mode a
 * rate limit must not have.
 */
function prepareDir(?string $dir): array
{
    $path = rtrim((string) ($dir ?? sys_get_temp_dir()), '/');
    if (!is_dir($path)) {
        @mkdir($path, 0o700, true);
    }
    return [$path, is_dir($path) && is_writable($path)];
}

/**
 * Counter and replay files, keyed by the secret so the filenames give nothing
 * away if the directory is ever readable.
 */
function storePath(string $dir, string $secret, string $kind): string
{
    return $dir . '/contact-' . hash('sha256', $kind . '|' . $secret) . '.json';
}

/* ---------------------------------------------------------------------------
 * Rate limiting
 * ------------------------------------------------------------------------- */

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

/**
 * Take a slot in one of the rolling hourly windows, or say no.
 *
 * Fails closed: a lock that cannot be taken returns false, so a store that has
 * gone missing refuses submissions rather than waving them through. That is the
 * whole point — a form that is briefly unavailable is a nuisance, one with no
 * working rate limit is an open pipe to a personal inbox.
 */
function claimRateSlot(string $dir, string $secret, string $kind, int $limit): bool
{
    $taken = withLock(storePath($dir, $secret, $kind), static function (array $window) use ($limit) {
        [$ok, $window] = underLimit($window, $limit);
        if (!$ok) {
            return [false, null];
        }
        $window[] = time();
        return [true, $window];
    });

    // null means the lock failed: refuse, do not assume there is room
    return $taken === true;
}

/* ---------------------------------------------------------------------------
 * Tokens
 * ------------------------------------------------------------------------- */

/**
 * Tokens are signed with the shared secret, so the issue time cannot be edited
 * to defeat the timing check and a bot cannot mint its own. Being able to POST
 * at all requires having done the GET first.
 *
 * `kind` keeps the two forms' tokens apart, so one issued by the guestbook
 * cannot be spent on the contact form or the other way about.
 */
function makeToken(string $secret, string $kind = 'contact'): string
{
    $issued = time();
    $nonce = bin2hex(random_bytes(8));
    $payload = $issued . ':' . $nonce;

    return $payload . ':' . hash_hmac('sha256', $kind . '|' . $payload, $secret);
}

function readToken(string $token, string $secret, string $kind = 'contact'): ?int
{
    $parts = explode(':', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$issued, $nonce, $signature] = $parts;
    $expected = hash_hmac('sha256', $kind . '|' . $issued . ':' . $nonce, $secret);

    // hash_equals rather than ===, so a wrong signature cannot be found by
    // timing how long the comparison takes
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    return ctype_digit($issued) ? (int) $issued : null;
}

/**
 * Claim a token's nonce, so it cannot be used twice.
 *
 * Tokens used to be reusable for their whole hour: the nonce was generated and
 * signed but never recorded, so one GET bought sixty minutes of posting. The
 * check and the insert happen inside one lock, or two simultaneous posts with
 * the same token would both find it unused.
 *
 * Called after validation on purpose — a typo in a field should not burn the
 * token and leave the form dead until a reload.
 */
function claimNonce(string $dir, string $secret, string $token, int $ttl): bool
{
    $nonce = explode(':', $token)[1] ?? '';

    $claimed = withLock(storePath($dir, $secret, 'nonces'), static function (array $used) use ($nonce, $ttl) {
        $cutoff = time() - $ttl;
        $used = array_filter($used, static fn($at) => is_int($at) && $at > $cutoff);
        if (isset($used[$nonce])) {
            return [false, null];
        }
        $used[$nonce] = time();
        return [true, $used];
    });

    return $claimed === true;
}

/* ---------------------------------------------------------------------------
 * Mail
 * ------------------------------------------------------------------------- */

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
function envelopeAddress(array $config): ?string
{
    $from = (string) ($config['from'] ?? '');

    if (preg_match('/<([^>]+)>/', $from, $m)) {
        $address = trim($m[1]);
    } elseif (filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $address = $from;
    } else {
        return null;
    }

    return filter_var($address, FILTER_VALIDATE_EMAIL) ? $address : null;
}

/**
 * Send one message from the site.
 *
 * From is an address on the sending domain, not the visitor's: sending as
 * someone else's domain is what SPF and DMARC exist to reject, and the mail
 * would be dropped. Reply-To carries the visitor where there is one, so
 * replying still works.
 *
 * Date and Message-ID are not optional in practice. A message arriving without
 * a Message-ID looks machine-generated to a spam filter, and while most mail
 * servers will add one, "most" is doing a lot of work when the whole point is
 * to stop landing in a spam folder. The domain is taken from the sending
 * address so the id matches the sender.
 */
function sendFormMail(
    array $config,
    string $subject,
    string $body,
    ?string $replyName = null,
    ?string $replyEmail = null
): bool {
    $envelope = envelopeAddress($config);
    $params = $envelope !== null ? '-f' . $envelope : '';

    $idDomain = $envelope !== null && str_contains($envelope, '@')
        ? substr($envelope, strrpos($envelope, '@') + 1)
        : ($_SERVER['SERVER_NAME'] ?? 'localhost');

    $headers = [
        'From: ' . $config['from'],
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $idDomain . '>',
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
    ];

    if ($replyEmail !== null && $replyEmail !== '') {
        /**
         * A display name has to be quoted, or a comma in it ends the address and
         * the rest becomes a second recipient. Callers refuse a newline in either
         * value before getting here, so quoting the quotes is all that is left.
         */
        $quoted = '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], (string) $replyName) . '"';
        array_splice($headers, 1, 0, ['Reply-To: ' . $quoted . ' <' . $replyEmail . '>']);
    }

    return mail((string) $config['to'], $subject, $body, implode("\r\n", $headers), $params);
}

/**
 * An optional record of what happened to each submission.
 *
 * mail() returning true only means the message was handed to the local mailer —
 * not that it left the building, and certainly not that it arrived. Combined
 * with the honeypot answering 200 without sending, a form can report success
 * for several entirely different reasons. Set 'log' in the config and each
 * outcome is written down, so "it said sent but nothing came" becomes a
 * question with an answer.
 */
function logLine(array $config, string $line): void
{
    if (empty($config['log'])) {
        return;
    }
    @file_put_contents($config['log'], gmdate('c') . "\t" . $line . "\n", FILE_APPEND | LOCK_EX);
}

/* ---------------------------------------------------------------------------
 * Input
 * ------------------------------------------------------------------------- */

/** The POSTed JSON body, or a 400. The handlers speak JSON, not form encoding. */
function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $input = json_decode($raw ?: '', true);

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => msg('badRequest')]);
    }

    return $input;
}

/**
 * Count the links in a message.
 *
 * Spam is overwhelmingly link delivery, so a message carrying a handful of URLs
 * is almost never a person. Counted rather than stripped: a message that was
 * quietly edited before sending is worse than one that was refused.
 */
function countLinks(string $text): int
{
    return preg_match_all('~https?://|\bwww\.|<a\s~i', $text);
}
