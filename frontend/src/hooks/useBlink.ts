import { useCallback, useEffect, useRef, useState } from "react";

/** Idle gap between blinks. */
const IDLE_MS = 15000;

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
            idle.current = window.setTimeout(blink, IDLE_MS);
        };

        blinkRef.current = blink;
        idle.current = window.setTimeout(blink, IDLE_MS);

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
