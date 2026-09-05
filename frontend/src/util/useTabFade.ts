import { useEffect, useState } from "react";

/**
 * Dips a page's content out to black on a tab change, swaps it while nothing is
 * visible, and brings it back.
 *
 * Deliberately not a cross-fade. Both tabs on both pages draw the same panels in
 * the same places, so overlapping them mid-change reads as the text going blurry
 * rather than as one screen replacing another — and where the two happen to
 * agree (an icon at the same size in the same row) nothing appears to happen at
 * all. Going through black is unambiguous.
 *
 * The hook holds a value one step behind the route: `shown` is whatever the
 * content should still be drawing, which is the *old* tab until the fade-out has
 * finished. The header keeps using the route's own value, so the tab you clicked
 * highlights on the click rather than a fifth of a second later.
 *
 * Nothing unmounts and remounts to make this work — the wrapper stays put and
 * only its opacity moves, so the transition has something continuous to run on.
 */

/**
 * One leg of the dip. Both legs are the same length, so a switch costs twice
 * this plus the black frames between them. Short enough not to feel like
 * waiting; long enough that the eye registers the screen going away rather than
 * just flickering.
 */
export const TAB_FADE_MS = 120;

export function useTabFade<T>(incoming: T) {
    const [shown, setShown] = useState(incoming);

    /**
     * Whether the wrapper is being held at opacity 0. It stays true across the
     * swap, which is the whole point: released in the same commit as the new
     * content, the browser has no frame at black to transition *from* and the
     * screen jumps back to full brightness with the fade-out half finished.
     * That was the first version, and it read as a flicker rather than a dip.
     */
    const [dark, setDark] = useState(false);

    useEffect(() => {
        if (incoming === shown) return;

        setDark(true);
        const id = setTimeout(() => setShown(incoming), TAB_FADE_MS);
        return () => clearTimeout(id);
    }, [incoming, shown]);

    useEffect(() => {
        // Only once the swap has happened — while these differ the fade-out is
        // still running and the old tab is still the one on screen
        if (!dark || incoming !== shown) return;

        /**
         * Two frames, not one. The new tab has to be laid out and painted at
         * opacity 0 before the transition is allowed to start, and a single
         * rAF can land in the same frame as the commit that mounted it — in
         * which case the browser coalesces the two styles and animates nothing.
         */
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => setDark(false));
        });
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
        };
    }, [dark, incoming, shown]);

    return { shown, fading: dark };
}
