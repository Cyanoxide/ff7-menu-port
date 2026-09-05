<?php
/**
 * Guestbook handler.
 *
 * The same shape as contact.php, and sharing all of its machinery through
 * form-lib.php — signed single-use tokens, a honeypot, a minimum fill time,
 * per-address and global rate limits, and a locked read-modify-write store.
 *
 *   GET  /guestbook.php  -> the visible entries, and a signed token
 *   POST /guestbook.php  -> validates, stores, and emails a notification
 *
 * Entries go live immediately once the checks pass. The notification carries a
 * signed link that takes one down again, handled by guestbook-moderate.php, so
 * moderating never means logging in to anything.
 *
 * The two differences from the contact form that matter:
 *
 *  1. **No links at all.** The contact form allows two, because a person
 *     writing to you may well want to show you something. A guestbook entry is
 *     published on the site, which is the only thing link spam wants, and
 *     nothing anyone needs to say in one requires a URL.
 *  2. **The store must be durable and it must be outside the web root.**
 *     rate_dir may point at the system temp directory and lose nothing worse
 *     than a counter; the guestbook losing its file loses the guestbook. And
 *     deploying is a manual upload of dist/, so anything under public/ is
 *     overwritten wholesale on every deploy — a data file there would not
 *     survive one. guestbook_dir is required for that reason and has no
 *     default; without it the handler reports itself unconfigured rather than
 *     writing somewhere that will be wiped.
 */

declare(strict_types=1);

define('FORM_APP', true);
require __DIR__ . '/form-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// No caching: the GET hands out a single-use token alongside the entries
header('Cache-Control: no-store');

useMessages(__DIR__ . '/guestbook-messages.json');

/** Longest we accept for each field, in characters */
const LIMITS = ['name' => 12, 'message' => 255];

/** The window corners a signer may colour, in the order ContentBox names them. */
const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** A form filled faster than this was not filled by a person */
const MIN_SECONDS = 4;

/** Tokens go stale so one cannot be minted and reused for weeks */
const MAX_SECONDS = 3600;

/** How long a consumed token is remembered, so it cannot be replayed */
const NONCE_TTL = MAX_SECONDS;

/**
 * Signatures allowed from one address per hour, and from everyone together.
 *
 * Tighter than the contact form's 5 and 20. A contact message goes to one
 * inbox; a guestbook entry is published on the site the moment it passes, so
 * the cost of a burst getting through is higher and the legitimate rate is
 * lower — nobody signs a guestbook twice.
 */
const RATE_LIMIT = 2;
const GLOBAL_LIMIT = 10;

/**
 * Both can be raised from the config — 'guestbook_rate_limit' and
 * 'guestbook_global_limit'. That exists so a dev config can get out of its own
 * way; see limitFrom() in form-lib.php for why this is not "exempt localhost".
 */

/** Entries kept. The oldest fall off the end rather than the file growing forever. */
const MAX_ENTRIES = 500;

/** Entries returned to the page. The list scrolls, but it does not need all 500. */
const PAGE_SIZE = 100;

/**
 * The entry that is always there.
 *
 * Not stored, so nothing can delete it and a wiped or reset store still opens
 * on something rather than on an empty panel. It is appended as the oldest
 * entry, which puts it at the foot of the list, and it counts towards the total
 * because it is a signature like any other — Jamie's.
 *
 * It has no id, so the moderation link cannot address it. That is the point.
 */
const WELCOME_ENTRY = [
    'name' => 'Jamie Pates',
    'message' => 'Welcome to my Guestbook! Feel free to leave a note, and thanks for stopping by!',
    'at' => 1788552192,
    'colors' => [
        'topLeft' => [168, 0, 0],
        'topRight' => [2, 0, 0],
        'bottomLeft' => [0, 0, 0],
        'bottomRight' => [138, 3, 0],
    ],
];

$config = loadConfig(__DIR__);

/**
 * The off switch, separate from the contact form's. Closing one should not
 * close the other — the likely reason to close the guestbook is a spam run,
 * and that is no reason to stop people writing to you.
 */
if (($config['guestbook_enabled'] ?? true) !== true) {
    respond(503, ['ok' => false, 'error' => msg('closed')]);
}

/**
 * Where the entries live. One directory holding one file, guestbook.json, and
 * that file is the whole guestbook — there is no database behind it.
 *
 * Unset, it is a `guestbook-data` folder beside this handler, created on first
 * use. That name is not arbitrary: htaccess.example already denies a directory
 * called `guestbook-data`, so the default is covered by a rule that exists.
 *
 * `__DIR__` rather than a relative path. A relative value is resolved against
 * the *process's* working directory, which is the script's folder on some hosts
 * and the filesystem root on others — so it appears to work until it does not.
 */
[$dataDir, $dataReady] = prepareDir(guestbookDir($config, __DIR__));
[$rateDir, $rateReady] = prepareDir($config['rate_dir'] ?? null);

$secret = (string) $config['secret'];
$entriesPath = $dataDir . '/guestbook.json';

/**
 * A bare domain, with no scheme and no www in front of it.
 *
 * countLinks() in form-lib.php catches "http://x", "www.x" and an <a> tag,
 * which is the right bar for the contact form: those are what a person pasting
 * a link actually types, and a message going to one inbox can afford to be
 * generous. Published text cannot. "buy-things.example" is a perfectly good
 * advert on a page Google will read, and it sails past all three patterns —
 * that is what this catches.
 *
 * Matched against a TLD list rather than a general "word dot word", which would
 * fire on an ordinary sentence with a missing space after a full stop. Two
 * characters minimum before the dot, so "e.g." and initials are left alone, and
 * a trailing word boundary, so "Come" is not read as the .co of a domain.
 *
 * Not exhaustive and not meant to be — a guestbook is a small target, and the
 * cost of a miss is one entry that has to be deleted from an email. The cost of
 * a false positive is a real person being told their message looks like spam,
 * so the list stays short and obvious.
 */
function looksLikeDomain(string $text): bool
{
    $tlds = 'com|net|org|io|dev|app|xyz|top|shop|site|online|info|biz|link|click'
        . '|store|live|icu|vip|ru|cn|tk|ml|ga|cf|me|co|uk|us|de|fr|nl|pl|in|br';

    return preg_match('~\b[a-z0-9][a-z0-9-]+\.(?:' . $tlds . ')\b~i', $text) === 1;
}

/**
 * The colours a signer picked for their entry's window, or null for "use
 * whatever the reader has configured".
 *
 * Returns false — distinct from null — when the value is present but malformed,
 * which the caller turns into a refusal. Nothing legitimate sends a broken
 * colour: the picker clamps every channel to 0-255 before it leaves the page,
 * so a bad one means the request was not made by the page. Refusing beats
 * quietly dropping it, which would publish an entry in colours the signer did
 * not choose and never say why.
 *
 * Every channel must be a genuine integer. A float would sail through a range
 * check and then land in a CSS rgb() as "2.5", and json_decode only produces
 * one if the sender wrote one.
 */
function readColors(mixed $raw): array|false|null
{
    if ($raw === null) {
        return null;
    }
    if (!is_array($raw)) {
        return false;
    }

    $colors = [];
    foreach (CORNERS as $corner) {
        $channels = $raw[$corner] ?? null;
        if (!is_array($channels) || count($channels) !== 3) {
            return false;
        }

        $rgb = [];
        foreach ($channels as $value) {
            if (!is_int($value) || $value < 0 || $value > 255) {
                return false;
            }
            $rgb[] = $value;
        }
        $colors[$corner] = $rgb;
    }

    return $colors;
}

/**
 * Write down why the store could not be reached.
 *
 * "Busy" on its own could mean four things — no directory, no write permission,
 * a lock that did not come free, or a write that failed — and from outside the
 * server they look identical. This is the line that tells them apart. It is
 * only written while something is actually wrong, so it stops as soon as the
 * path is right.
 */
function logStoreProblem(array $config, string $dir): void
{
    logLine($config, sprintf(
        "guestbook\tstore-unreachable\tdir=%s\texists=%d\twritable=%d",
        $dir,
        is_dir($dir) ? 1 : 0,
        is_writable($dir) ? 1 : 0
    ));
}

/** Only ever the fields the page draws. The stored entry also carries an id and
 *  a hashed address; neither is anybody's business but the site owner's. */
function publicEntry(array $entry): array
{
    return [
        'name' => (string) ($entry['name'] ?? ''),
        'message' => (string) ($entry['message'] ?? ''),
        'at' => (int) ($entry['at'] ?? 0),
        // null is meaningful: the reader's own window colour is used instead
        'colors' => is_array($entry['colors'] ?? null) ? $entry['colors'] : null,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    /**
     * Reading does not need write access, and it used to demand it — a GET
     * answered "busy" purely because prepareDir() reported the directory as
     * unwritable, which is how a mistyped path looked like an outage.
     *
     * A store that is not there is an *empty* guestbook, not an error: a fresh
     * install has signed nothing yet, and the welcome entry below means the
     * panel still opens on something. Signing is where write access is
     * genuinely required, and that refuses loudly further down.
     */
    if (!$dataReady) {
        logStoreProblem($config, $dataDir);
    }

    $raw = @file_get_contents($entriesPath);
    $stored = $raw === false ? [] : json_decode($raw, true);
    if (!is_array($stored)) {
        $stored = [];
    }

    // Newest first. Stored oldest-first so appending is cheap.
    $visible = array_reverse($stored);

    // The welcome goes last, so it reads as the first entry ever signed. One
    // slot of PAGE_SIZE is kept back for it rather than added on top.
    $page = array_map('publicEntry', array_slice($visible, 0, PAGE_SIZE - 1));
    $page[] = publicEntry(WELCOME_ENTRY);

    respond(200, [
        'ok' => true,
        'token' => makeToken($secret, 'guestbook'),
        'count' => count($stored) + 1,
        'entries' => $page,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => msg('methodNotAllowed')]);
}

$input = jsonBody();

$field = static fn(string $key): string => trim((string) ($input[$key] ?? ''));

$name = $field('name');
$message = $field('message');
$token = $field('token');
$colors = readColors($input['colors'] ?? null);

/**
 * The honeypot, answered with a cheerful 200 and nothing written. A bot told it
 * failed will try something else; one told it succeeded goes away.
 */
if ($field('website') !== '') {
    respond(200, ['ok' => true]);
}

$issued = readToken($token, $secret, 'guestbook');
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

if ($name === '' || $message === '') {
    respond(422, ['ok' => false, 'error' => msg('emptyFields')]);
}

foreach (LIMITS as $key => $limit) {
    if (mb_strlen($field($key)) > $limit) {
        respond(422, ['ok' => false, 'error' => msg('tooLong')]);
    }
}

/**
 * The name travels in the notification's subject line, which is a mail header,
 * so a newline in it would let an attacker append headers of their own. Refused
 * rather than stripped: an entry published under a subtly different name than
 * was typed is worse than one that was turned away.
 */
if (preg_match('/[\r\n]/', $name)) {
    respond(422, ['ok' => false, 'error' => msg('badName')]);
}

if ($colors === false) {
    respond(422, ['ok' => false, 'error' => msg('badColour')]);
}

/**
 * Nothing published on the site carries a URL. See the note at the top.
 *
 * The name is checked as well as the message. It is displayed on the page and
 * it goes in the notification's subject line, so a domain is just as good a
 * delivery vehicle there as it is in the body — 12 characters is enough for
 * "spam.example".
 */
if (countLinks($name . "\n" . $message) > 0 || looksLikeDomain($name . "\n" . $message)) {
    respond(422, ['ok' => false, 'error' => msg('noLinks')]);
}

/**
 * Both stores have to be writable from here. The rate limits are the only thing
 * bounding how fast the guestbook can be filled, and the entry store is the
 * guestbook — accepting a signature we cannot record would tell someone their
 * message was published when it was not.
 */
if (!$dataReady) {
    logStoreProblem($config, $dataDir);
    respond(503, ['ok' => false, 'error' => msg('storeUnreachable')]);
}

if (!$rateReady) {
    respond(503, ['ok' => false, 'error' => msg('busy')]);
}

if (!claimRateSlot($rateDir, $secret, 'gb|global', limitFrom($config, 'guestbook_global_limit', GLOBAL_LIMIT))) {
    respond(429, ['ok' => false, 'error' => msg('busy')]);
}

$remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!claimRateSlot($rateDir, $secret, 'gb|ip|' . $remote, limitFrom($config, 'guestbook_rate_limit', RATE_LIMIT))) {
    respond(429, ['ok' => false, 'error' => msg('rateLimited')]);
}

if (!claimNonce($rateDir, $secret, $token, NONCE_TTL)) {
    respond(400, ['ok' => false, 'error' => msg('replay')]);
}

$id = bin2hex(random_bytes(9));

/**
 * The address is stored hashed, not in the clear.
 *
 * It is worth keeping something: if a run of entries turns out to be from one
 * sender, the only way to see that after the fact is a stable per-sender value.
 * A hash keyed by the secret gives that and nothing else — it cannot be turned
 * back into an address, so a file that leaks does not leak where anyone lives.
 */
$entry = [
    'id' => $id,
    'name' => $name,
    'message' => $message,
    'at' => time(),
    'colors' => $colors,
    'ip' => hash_hmac('sha256', $remote, $secret),
];

$stored = withLock($entriesPath, static function (array $entries) use ($entry) {
    $entries[] = $entry;
    // Oldest off the front. The cap is on the file, not on what anyone can read.
    if (count($entries) > MAX_ENTRIES) {
        $entries = array_slice($entries, -MAX_ENTRIES);
    }
    return [true, $entries];
});

if ($stored !== true) {
    // The lock or the write failed, so nothing was stored. Saying "signed" here
    // would be a lie, and the log line says which of the two it was.
    logStoreProblem($config, $dataDir);
    respond(503, ['ok' => false, 'error' => msg('storeUnreachable')]);
}

/**
 * Where the delete link points.
 *
 * site_url from the config when it is set, because the Host header is supplied
 * by whoever made the request and this URL goes into an email. Falling back to
 * it is still better than sending no link at all — the signature is what makes
 * the link work, not the host — but a configured value cannot be steered.
 */
$base = rtrim((string) ($config['site_url'] ?? ''), '/');
if ($base === '') {
    $scheme = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $base = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

$deleteUrl = $base . '/guestbook-moderate.php?id=' . urlencode($id)
    . '&sig=' . urlencode(hash_hmac('sha256', 'delete|' . $id, $secret));

$body = "New guestbook entry from {$name}\n"
    . 'Signed: ' . gmdate('Y-m-d H:i:s') . " UTC\n"
    . "\n"
    . $message . "\n"
    . "\n"
    . "This is already live on the site.\n"
    . "To take it down:\n"
    . $deleteUrl . "\n";

/**
 * No Reply-To: the guestbook does not collect an address, so there is nobody to
 * reply to. Passing the signer's name with no address would produce a malformed
 * header, which is exactly the kind of thing that gets mail filed as spam.
 */
$sent = sendFormMail($config, 'Guestbook signed by ' . $name, $body);

logLine($config, sprintf(
    "guestbook\t%s\tid=%s\tname=%s",
    $sent ? 'mail-accepted' : 'MAIL-FAILED',
    $id,
    $name
));

/**
 * The entry is already stored and already visible, so a notification that did
 * not send is not a failed signature — telling the visitor their message was
 * refused would be wrong, and asking them to sign again would double it. The
 * log is where that failure is recorded.
 */
respond(200, ['ok' => true, 'entry' => publicEntry($entry)]);
