// Text helpers for SpriteInput. They live beside the component rather than in
// it so the file exporting the component exports nothing else — mixing the two
// switches Fast Refresh off for the whole module.

/**
 * The sprite sheet's own characters, from font.css. Anything else has no glyph
 * and would render as a gap, so it is dropped on the way in rather than typed
 * into a hole. Note there is no double quote in the sheet.
 */
// eslint-disable-next-line no-useless-escape
const ALLOWED = /[^A-Za-z0-9 £_\-,;:!?.()\[\]{}@*\/\\'&#%`^+<=>|~$\n]/g;

export const stripUnsupported = (text: string) => text.replace(ALLOWED, "");

/**
 * Every character the sheet has, derived from ALLOWED rather than written out
 * again, so the two cannot drift apart.
 */
const SUPPORTED = [
    ...Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)),
    "\u00a3",
].filter(ch => stripUnsupported(ch) === ch);

/**
 * How wide each glyph is, measured from the DOM once and cached.
 *
 * The sheet is proportional — "I" is 7px and some glyphs are 60px, against a
 * 20px default — and the widths live in font.css. Measuring rather than keeping
 * a copy of that table here means the two cannot disagree, and a change to the
 * stylesheet is picked up for free.
 */
let widthCache: Map<string, number> | null = null;

const measureGlyphs = (): Map<string, number> => {
    const map = new Map<string, number>();
    if (typeof document === "undefined") return map;

    // A real element in the document, because the widths come from CSS rules
    // that only apply to one. Hidden rather than detached: a detached node has
    // no layout and every offsetWidth would be 0.
    const probe = document.createElement("span");
    probe.className = "font";
    probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;";
    for (const ch of SUPPORTED) {
        const glyph = document.createElement("span");
        glyph.className = "font-glyph";
        glyph.dataset.sprite = ch;
        glyph.textContent = ch;
        probe.appendChild(glyph);
    }
    document.body.appendChild(probe);
    /*
     * getBoundingClientRect, not offsetWidth: offsetWidth rounds to whole
     * pixels, and several glyphs are fractional — the space is 6.52px, reported
     * as 7. Rounding each one accumulates, so by the middle of a line the
     * computed position had drifted 1.5px from where the glyph was actually
     * painted, which is half the width of a space.
     *
     * The probe sits on document.body rather than inside #root, which is
     * transform-scaled, so the rect is already in design pixels.
     */
    SUPPORTED.forEach((ch, i) => map.set(ch, probe.children[i].getBoundingClientRect().width));
    probe.remove();
    return map;
};

/** font.css's own .font-glyph width, the fallback for anything unmeasured. */
const DEFAULT_GLYPH_WIDTH = 20;

/** Width of one glyph in design pixels. Unknown characters take the default. */
export const glyphWidth = (ch: string): number => {
    if (!widthCache || widthCache.size === 0) widthCache = measureGlyphs();
    return widthCache.get(ch) ?? DEFAULT_GLYPH_WIDTH;
};

export const textWidth = (text: string): number => {
    let total = 0;
    for (const ch of text) total += glyphWidth(ch);
    return total;
};

/**
 * Breaks text to a **pixel** budget, keeping each line's offset in the original
 * string so the caret can be placed on the right line. The sprite font sets
 * every glyph nowrap, so wrapping has to happen here rather than in CSS.
 *
 * This used to take a character count. That cannot fit a proportional sheet:
 * a budget safe for the widest glyph leaves ordinary lowercase filling barely
 * two thirds of the box, which is what it did — measured at 53-71% across three
 * lines — and the real textarea underneath, which does wrap by width, reached
 * the edge well before the painted text did.
 */
export const wrapWithOffsets = (text: string, maxPx: number): { text: string; start: number }[] => {
    const lines: { text: string; start: number }[] = [];

    for (const paragraph of text.split("\n")) {
        // Offset of this paragraph within the whole string
        const base = lines.length
            ? text.indexOf(paragraph, lines[lines.length - 1].start + lines[lines.length - 1].text.length)
            : 0;

        let line = "";
        let start = base;

        for (const word of paragraph.split(" ")) {
            const candidate = line ? `${line} ${word}` : word;

            if (textWidth(candidate) <= maxPx) {
                line = candidate;
                continue;
            }

            if (line) {
                lines.push({ text: line, start });
                start += line.length + 1;
            }

            // A single word wider than the budget still has to go somewhere,
            // broken at the last glyph that fits rather than at a fixed count.
            let rest = word;
            for (;;) {
                if (textWidth(rest) <= maxPx) break;
                let take = 0;
                let used = 0;
                while (take < rest.length && used + glyphWidth(rest[take]) <= maxPx) {
                    used += glyphWidth(rest[take]);
                    take += 1;
                }
                // A budget too small for even one glyph would loop forever
                if (take === 0) take = 1;
                lines.push({ text: rest.slice(0, take), start });
                start += take;
                rest = rest.slice(take);
            }
            line = rest;
        }

        lines.push({ text: line, start });
    }

    return lines;
};
