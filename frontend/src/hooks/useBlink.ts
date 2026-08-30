import { useCallback, useEffect, useRef, useState } from "react";

/** Average idle gap between blinks. */
const IDLE_MS = 15000;

/**
 * Fraction of IDLE_MS the gap is allowed to wander by, and how much of the
 * first gap is random.
 *
 * A page can show several portraits -- the history list has three of the same
 * face -- and they mount together. On a fixed interval they blink in perfect
 * unison, which reads as one mechanism driving three puppets rather than three
 * people. The jitter is what separates them, and it keeps the single portrait
 * on the landing page from being metronomic too.
 */
const JITTER = 0.35;

const nextGap = () => IDLE_MS * (1 + (Math.random() * 2 - 1) * JITTER);

/** How long the eyes stay shut. A real blink is about this. */
const BLINK_MS = 110;

/**
 * Blinks the portrait on a timer, and on demand.
 *
 * Returns the current state and a trigger, so the caller can blink him at the
 * moments that warrant one -- a hit landing -- on top of the idle rhythm.
 */
export default function useBlink(): [boolean, () => void] {
    const [blinking, setBlinking] = useState(false);
    const idle = useRef(0);
    const close = useRef(0);
    const blinkRef = useRef<() => void>(() => { });

    useEffect(() => {
        const blink = () => {
            window.clearTimeout(close.current);
            setBlinking(true);
            close.current = window.setTimeout(() => setBlinking(false), BLINK_MS);

            // Every blink restarts the idle countdown, so a hit that has just
            // made him blink is not followed by an idle one a moment later.
            window.clearTimeout(idle.current);
            idle.current = window.setTimeout(blink, nextGap());
        };

        blinkRef.current = blink;
        // The first gap is fully random rather than jittered around the mean, so
        // portraits mounting together are spread out immediately instead of
        // drifting apart over the first few minutes.
        idle.current = window.setTimeout(blink, IDLE_MS * Math.random());

        return () => {
            window.clearTimeout(idle.current);
            window.clearTimeout(close.current);
        };
    }, []);

    // Stable identity: this ends up in a dependency array where a new function
    // each render would re-register the effect that holds it.
    const blinkNow = useCallback(() => blinkRef.current(), []);

    return [blinking, blinkNow];
}
