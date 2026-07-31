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
 * Breaks text to a character budget, keeping each line's offset in the original
 * string so the caret can be placed on the right line. The sprite font sets
 * every glyph nowrap, so wrapping has to happen here rather than in CSS.
 */
export const wrapWithOffsets = (text: string, max: number): { text: string; start: number }[] => {
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

            if (candidate.length <= max) {
                line = candidate;
                continue;
            }

            if (line) {
                lines.push({ text: line, start });
                start += line.length + 1;
            }

            // A single word longer than the budget still has to go somewhere
            let rest = word;
            while (rest.length > max) {
                lines.push({ text: rest.slice(0, max), start });
                start += max;
                rest = rest.slice(max);
            }
            line = rest;
        }

        lines.push({ text: line, start });
    }

    return lines;
};
