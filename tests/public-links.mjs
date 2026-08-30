/**
 * Checks that every root-absolute asset the app links to actually exists in
 * public/.
 *
 * It exists because the failure it catches is silent. Deploying is a manual
 * upload of dist/, and the server rewrites anything that is not a real file to
 * index.html — so a link to a missing PDF does not 404. It returns 200 with the
 * app's HTML, and the browser downloads a file called Resume.pdf containing a
 * web page. Nothing in the build, the server logs or a smoke test complains.
 *
 * That is not hypothetical: the resume link pointed at a file that had been
 * renamed, and the only reason it was noticed was someone reading the PDF.
 *
 * Wired into `npm run build`, so it runs on the way to every deploy rather than
 * being a check somebody has to remember.
 *
 *   node tests/public-links.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
const publicDir = path.join(root, 'public');
const srcDir = path.join(root, 'src');

// Extensions worth checking. Anything else in a string is likely a route, not a
// file — routes are meant not to exist on disk, that is the point of the SPA.
const ASSET = /"(\/[A-Za-z0-9._\-/]+\.(?:pdf|png|jpe?g|gif|svg|webp|mp4|webm|mp3|json|php))"/g;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
});

const missing = [];
const seen = new Set();

for (const file of walk(srcDir).filter((f) => /\.(tsx?|css|scss)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [, url] of text.matchAll(ASSET)) {
        const key = `${file}::${url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!fs.existsSync(path.join(publicDir, url))) {
            missing.push({ file: path.relative(root, file), url });
        }
    }
}

if (missing.length) {
    console.error(`\n${missing.length} link(s) point at files that are not in public/:\n`);
    for (const { file, url } of missing) console.error(`  ${url}\n    referenced by ${file}`);
    console.error('\nOn the server these do not 404 — the SPA rewrite serves index.html instead.\n');
    process.exit(1);
}

console.log(`public-links: ${seen.size} asset link(s) all resolve`);
