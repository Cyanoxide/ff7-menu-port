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
 * Both message files, measured against the same budget. The guestbook's Sign
 * link and the contact form's Send link sit in the same place in panels of the
 * same width, so a string that fits one fits the other.
 */
const FILES = ['public/contact-messages.json', 'public/guestbook-messages.json'];

/**
 * The space the status line actually has, in design pixels: the send row is
 * 761 wide, Send itself is 85, and the flex gap between them is 24. Measured in
 * the browser rather than derived, so re-measure if the panel widths change.
 */
const BUDGET = 761 - 85 - 24;

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
console.log(`budget ${BUDGET}px  (${widths.size} glyph widths from font.css)`);

for (const file of FILES) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  console.log(`\n${file}`);

  for (const [key, value] of Object.entries(messages)) {
    if (key.startsWith('_')) continue;
    if (typeof value !== 'string') { console.log(`  FAIL ${key}: not a string`); failed++; continue; }
    const w = Math.round(measure(value));
    const ok = w <= BUDGET;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${String(w).padStart(4)}px  ${key.padEnd(17)} ${JSON.stringify(value)}`);
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
