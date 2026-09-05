/**
 * Checks every string the forms can show will fit on their status line.
 *
 * The messages render beside the Send link in a sprite font that does not wrap,
 * so one that is too long runs under Send and out of the panel. The font is
 * proportional — glyphs run 7px to 60px — so a character count is not a usable
 * proxy; this measures with the real widths out of src/font.css.
 *
 * It exists because the same mistake was made twice by hand: a "check" that
 * measured a list typed from memory rather than the strings actually shipping,
 * and so passed while a 33-character message with a typo in it sat in the file.
 *
 *   node tests/message-widths.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
const css = fs.readFileSync(path.join(root, 'src/font.css'), 'utf8');
/**
 * The message files, each with the width it actually has.
 *
 * They used to share one budget, on the reasoning that both rendered beside a
 * Send/Sign link in panels of the same width. The guestbook's no longer does:
 * its alerts moved into a box of their own above the form, which is only as
 * wide as that column. Measuring both against the looser figure would have let
 * a 500px string through into a 418px box.
 */
const FILES = [
  { path: 'public/contact-messages.json', budget: 761 - 85 - 24 },
  {
    path: 'public/guestbook-messages.json',
    /**
     * The guestbook's alerts render in the description strip under the header,
     * which is the full width of the stage — 1048px inside its border and
     * padding. They were held to 410 while they had a panel of their own beside
     * the form, which is why several of them read so tersely.
     */
    budget: 1000,
    /**
     * Except these two, which are not alerts. They are drawn in the entries
     * panel when the list has nothing to show, and that is 503px wide.
     */
    tighter: { loadFailed: 480, empty: 480 },
  },
];

// .font-glyph's own width, used by any glyph without an override
const DEFAULT = Number(/\.font-glyph\s*\{[^}]*?width:\s*([\d.]+)px/s.exec(css)?.[1] ?? 20);

const widths = new Map();
const rule = /\.font-glyph\[data-sprite="((?:[^"\\]|\\.)*)"\]\s*\{([^}]*)\}/gs;
for (const [, raw, body] of css.matchAll(rule)) {
  // [\d.]+ not \d+: the space is 6.5px, and an integer-only pattern skipped it
  // entirely — every space then fell back to the 20px default, overstating
  // each message by 13.5px per space.
  const w = /width:\s*([\d.]+)px/.exec(body);
  if (!w) continue;
  const ch = raw.replace(/\\(.)/g, '$1');
  widths.set(ch, Number(w[1]));
}

const missing = new Set();
const measure = (text) => [...text].reduce((sum, ch) => {
  if (!widths.has(ch) && ch !== ' ') missing.add(ch);
  return sum + (widths.get(ch) ?? DEFAULT);
}, 0);

let failed = 0;
console.log(`${widths.size} glyph widths from font.css`);

for (const { path: file, budget: BUDGET, tighter = {} } of FILES) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  console.log(`\n${file}  (budget ${BUDGET}px)`);

  for (const [key, value] of Object.entries(messages)) {
    if (key.startsWith('_')) continue;
    if (typeof value !== 'string') { console.log(`  FAIL ${key}: not a string`); failed++; continue; }
    const budget = tighter[key] ?? BUDGET;
    const w = Math.round(measure(value));
    const ok = w <= budget;
    if (!ok) failed++;
    const note = tighter[key] ? ` (${budget}px: shown in the entries panel)` : '';
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${String(w).padStart(4)}px  ${key.padEnd(17)} ${JSON.stringify(value)}${note}`);
  }
}

if (missing.size) {
  // A glyph the sheet does not have renders as nothing at all — no box, no
  // error, just a gap. Worth failing on rather than discovering in production.
  console.log(`\n  FAIL characters with no glyph in the sprite sheet: ${[...missing].map(c => JSON.stringify(c)).join(', ')}`);
  failed++;
}

console.log(`\n${failed === 0 ? 'all messages fit' : failed + ' problem(s)'}`);
process.exit(failed === 0 ? 0 : 1);
