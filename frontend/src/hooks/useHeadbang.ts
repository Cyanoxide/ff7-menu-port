import { useCallback, useEffect, useRef, useState } from "react";
import type { LookDirection } from "./useLookDirection";

/**
 * Up, down, and the pass through centre on the way between them. Without the
 * middle frame the head teleports between the two extremes and reads as a
 * flicker rather than a nod -- the portrait has a centre frame, so use it.
 */
const SEQUENCE: LookDirection[] = ["up", "center", "down", "center"];

/** Per frame. Four frames to the cycle, so a nod is a little over half a second. */
const BEAT_MS = 140;

/**
 * Drives the portrait through a nodding loop for a set time, then hands it back.
 *
 * Returns the frame to show, or null when it is not running -- null rather than
 * "center" so the caller can tell "no opinion" from "look straight ahead" and
 * fall back to whatever it was doing before.
 */
export default function useHeadbang(): [LookDirection | null, (durationMs: number) => void] {
    const [state, setState] = useState<{ run: number; step: number } | null>(null);
    const endsAt = useRef(0);
    const runs = useRef(0);

    useEffect(() => {
        if (!state) return;
        const id = window.setTimeout(() => {
            // Stops wherever the beat happens to land and lets the pointer take
            // over; the alternative is holding a nodded-forward head until the
            // cycle completes, which looks like a freeze.
            setState(performance.now() >= endsAt.current ? null : { run: state.run, step: state.step + 1 });
        }, BEAT_MS);
        return () => window.clearTimeout(id);
    }, [state]);

    // `run` increments so triggering again mid-nod restarts it: the state object
    // is new even when the step is 0 again, so the effect re-runs.
    const start = useCallback((durationMs: number) => {
        endsAt.current = performance.now() + durationMs;
        runs.current += 1;
        setState({ run: runs.current, step: 0 });
    }, []);

    return [state ? SEQUENCE[state.step % SEQUENCE.length] : null, start];
}
