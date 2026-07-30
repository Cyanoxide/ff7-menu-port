/**
 * Cross Slash, drawn from `public/limit-spritesheet.png`.
 *
 * Three slashes land one after another and stay on screen, so by the last hit
 * the composite reads as the whole cut. `sheet` is where each slash sits in the
 * sheet; `at` is where it belongs within the composite, taken from the preview
 * the sprites were designed against — they overlap, so neither the sheet order
 * nor a simple left-to-right layout reproduces it.
 *
 * All of it is in the sheet's own pixels. The stage scales them to the portrait.
 */
export const LIMIT_SHEET = "/limit-spritesheet.png";

/** The composite's natural size, i.e. the preview the offsets came from */
export const LIMIT_BOX = { width: 62, height: 55 };

export type LimitSlash = {
    /** Rectangle in the sheet: x, y, width, height */
    sheet: { x: number; y: number; width: number; height: number };
    /** Top-left of that rectangle within the composite */
    at: { x: number; y: number };
};

export const LIMIT_SLASHES: LimitSlash[] = [
    { sheet: { x: 0, y: 0, width: 12, height: 50 }, at: { x: 0, y: 5 } },
    { sheet: { x: 18, y: 2, width: 38, height: 48 }, at: { x: 8, y: 0 } },
    { sheet: { x: 61, y: 0, width: 52, height: 55 }, at: { x: 10, y: 0 } },
];

/** Full sheet size, so a slash can be positioned by background-position */
export const LIMIT_SHEET_SIZE = { width: 113, height: 55 };

/**
 * Timing, in ms. Deliberately unhurried — the slashes should land like blows
 * rather than a flicker, and the finished cut wants a beat before it goes.
 */
export const LIMIT_TIMING = {
    /** Before the first hit — the sound winds up first */
    windUp: 620,
    /** Between hits */
    betweenHits: 520,
    /** After the last hit, so the whole cut is readable before it leaves */
    beforeSpin: 900,
    /** The spin itself; must match the limitSpin animation in PartyMember.module.scss */
    spin: 900,
    /** After the spin, before the bar refills */
    beforeRefill: 250,
};
