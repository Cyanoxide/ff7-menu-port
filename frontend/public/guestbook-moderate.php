<?php
/**
 * Takes one guestbook entry down, from the link in its notification email.
 *
 * The only page in the project that renders HTML rather than JSON. It is not
 * part of the app — it is reached from an email, on a phone, by one person, and
 * loading the whole React bundle to draw two sentences and a button would be
 * absurd.
 *
 *   GET  ?id=&sig=  -> shows the entry and a confirm button
 *   POST ?id=&sig=  -> deletes it
 *
 * **The deletion is on the POST, and that is the point of the page existing.**
 * A link in an email gets fetched by things that are not the recipient — mail
 * clients prefetch, scanners follow every URL in a message to see where it goes,
 * and some corporate filters do it twice. If the GET deleted, an entry could be
 * gone before Jamie had read the mail, with nothing to say what happened. A GET
 * that only ever shows a page is safe to prefetch as many times as anyone likes.
 *
 * There is no login. The signature in the link is an HMAC of the entry id under
 * the site secret, so it authorises exactly one action on exactly one entry and
 * cannot be edited into a link that removes a different one.
 */

declare(strict_types=1);

define('FORM_APP', true);
require __DIR__ . '/form-lib.php';

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
// The link carries a signature; keep it out of shared caches
header('Cache-Control: no-store');
// Nothing here is legitimately framed, and it has a destructive button on it
header('X-Frame-Options: DENY');

useMessages(__DIR__ . '/guestbook-messages.json');

/**
 * Everything this page says, in one place.
 *
 * Not in guestbook-messages.json: those strings are shared with the front end
 * and measured against the sprite font's status-line width budget by
 * tests/message-widths.mjs. These render in an ordinary browser font on a page
 * of their own, so they are under no such budget and would only distort it.
 */
const PAGE_MESSAGES = [
    'title' => 'Guestbook',
    'badLink' => 'This link is not valid.',
    'badLinkDetail' => 'It may have been altered, or the entry may already have been removed.',
    'confirm' => 'Remove this entry?',
    'confirmDetail' => 'It will disappear from the guestbook immediately. This cannot be undone.',
    'remove' => 'Remove entry',
    'removed' => 'Entry removed.',
    'removedDetail' => 'It is no longer shown on the site.',
    'failed' => 'Could not remove the entry.',
    'failedDetail' => 'The guestbook file could not be written. Try again in a moment.',
];

function page(string $heading, string $detail, ?string $entry = null, ?string $form = null): never
{
    $h = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
    $d = htmlspecialchars($detail, ENT_QUOTES, 'UTF-8');
    $title = htmlspecialchars(PAGE_MESSAGES['title'], ENT_QUOTES, 'UTF-8');

    echo <<<HTML
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{$title}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0; min-height: 100vh; display: flex; align-items: center;
        justify-content: center; background: #000; color: #fff; padding: 24px;
        font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      main { max-width: 34rem; width: 100%; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { margin: 0 0 1rem; color: #b9c0d4; }
      blockquote {
        margin: 0 0 1.5rem; padding: 1rem 1.25rem; border-radius: 5px;
        border: 2px solid #78797a;
        background: linear-gradient(135deg, rgb(2,34,186) 0%, transparent 50%, rgb(0,3,50) 100%),
                    linear-gradient(45deg, rgb(0,15,105) 0%, rgb(2,24,145) 100%);
        color: #fff; white-space: pre-wrap; overflow-wrap: anywhere;
      }
      blockquote cite { display: block; margin-bottom: 0.5rem; font-style: normal; color: #c6cded; }
      button {
        font: inherit; color: #fff; background: #500a12; border: 2px solid #78797a;
        border-radius: 5px; padding: 0.6rem 1.2rem; cursor: pointer;
      }
      button:hover { background: #6d1019; }
    </style>
    </head>
    <body><main>
    <h1>{$h}</h1>
    <p>{$d}</p>
    {$entry}
    {$form}
    </main></body>
    </html>
    HTML;
    exit;
}

$config = loadConfig(__DIR__);
$secret = (string) $config['secret'];

if (empty($config['guestbook_dir'])) {
    page(PAGE_MESSAGES['badLink'], PAGE_MESSAGES['badLinkDetail']);
}

[$dataDir, $dataReady] = prepareDir((string) $config['guestbook_dir']);
$entriesPath = $dataDir . '/guestbook.json';

$id = (string) ($_GET['id'] ?? '');
$sig = (string) ($_GET['sig'] ?? '');

/**
 * hash_equals rather than ===, so a valid signature cannot be found by timing
 * how long the comparison takes. The id is checked for shape first: it is used
 * to build a filename-free lookup, but it also goes into the signed payload,
 * and there is no reason to hash arbitrary input.
 */
$expected = hash_hmac('sha256', 'delete|' . $id, $secret);
if ($id === '' || !ctype_xdigit($id) || !hash_equals($expected, $sig)) {
    page(PAGE_MESSAGES['badLink'], PAGE_MESSAGES['badLinkDetail']);
}

if (!$dataReady) {
    page(PAGE_MESSAGES['failed'], PAGE_MESSAGES['failedDetail']);
}

/** The entry as it stands, for the confirmation page to show. */
function findEntry(string $path, string $id): ?array
{
    $raw = @file_get_contents($path);
    $entries = $raw === false ? [] : json_decode($raw, true);
    if (!is_array($entries)) {
        return null;
    }
    foreach ($entries as $entry) {
        if (is_array($entry) && ($entry['id'] ?? null) === $id) {
            return $entry;
        }
    }
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $removed = withLock($entriesPath, static function (array $entries) use ($id) {
        $kept = array_values(array_filter(
            $entries,
            static fn($entry) => !is_array($entry) || ($entry['id'] ?? null) !== $id
        ));
        // Nothing to write if nothing matched — the entry was already gone,
        // which is the same outcome the caller wanted either way.
        return [count($kept) !== count($entries), count($kept) === count($entries) ? null : $kept];
    });

    if ($removed === null) {
        page(PAGE_MESSAGES['failed'], PAGE_MESSAGES['failedDetail']);
    }

    // false means nothing matched — already removed, or the button was pressed
    // twice. Same outcome for the reader, but not a deletion to record.
    if ($removed === true) {
        logLine($config, sprintf("guestbook\tdeleted\tid=%s", $id));
    }

    page(PAGE_MESSAGES['removed'], PAGE_MESSAGES['removedDetail']);
}

$entry = findEntry($entriesPath, $id);

if ($entry === null) {
    // Already removed, or never existed. The signature was good, so saying so
    // plainly gives nothing away.
    page(PAGE_MESSAGES['removed'], PAGE_MESSAGES['removedDetail']);
}

$quoted = '<blockquote><cite>'
    . htmlspecialchars((string) ($entry['name'] ?? ''), ENT_QUOTES, 'UTF-8')
    . ' — ' . gmdate('Y-m-d', (int) ($entry['at'] ?? 0)) . '</cite>'
    . htmlspecialchars((string) ($entry['message'] ?? ''), ENT_QUOTES, 'UTF-8')
    . '</blockquote>';

$action = htmlspecialchars(
    '?id=' . urlencode($id) . '&sig=' . urlencode($sig),
    ENT_QUOTES,
    'UTF-8'
);

page(
    PAGE_MESSAGES['confirm'],
    PAGE_MESSAGES['confirmDetail'],
    $quoted,
    '<form method="post" action="' . $action . '"><button type="submit">'
        . htmlspecialchars(PAGE_MESSAGES['remove'], ENT_QUOTES, 'UTF-8')
        . '</button></form>'
);
