// Easter egg: naming the profile after an FF7 character swaps the portrait
// everywhere for that character's face, sliced from portraits-spritesheet.png.

export const PORTRAIT_SHEET = "/portraits-spritesheet.png";

// Native size of a single portrait and the full sheet (9 portraits, ~107px
// wide each with thin separators — see the measured x offsets below).
export const PORTRAIT_WIDTH = 107;
export const PORTRAIT_HEIGHT = 122;

// Left x offset of each portrait in the sheet, keyed by its index.
// (index 9 / Cid takes effect once the extended spritesheet is in place.)
const PORTRAIT_OFFSETS = [0, 109, 218, 327, 437, 546, 655, 765, 873, 982];

// Accepted names (compared case-insensitively, trimmed) → portrait index.
const NAME_TO_INDEX: Record<string, number> = {
    "sephiroth": 0,
    "cloud": 1,
    "barret": 2,
    "tifa": 3,
    "aeris": 4,
    "aerith": 4,
    "red xiii": 5,
    "nanaki": 5,
    "yuffie": 6,
    "cait sith": 7,
    "vincent": 8,
    "cid": 9,
};

export interface PortraitSprite {
    index: number;
    /** left x offset of this portrait within the sheet, in native pixels */
    x: number;
}

// Returns the matching character portrait for a name, or null for no match.
export function resolvePortrait(name: string | null | undefined): PortraitSprite | null {
    if (!name) return null;
    const index = NAME_TO_INDEX[name.trim().toLowerCase()];
    if (index === undefined) return null;
    return { index, x: PORTRAIT_OFFSETS[index] };
}
