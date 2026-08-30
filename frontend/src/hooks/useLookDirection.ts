import { useEffect, useState } from "react";

/**
 * The nine poses of the look-at-cursor portrait.
 */
export const LOOK_DIRECTIONS = [
    "up-left", "up", "up-right",
    "left", "center", "right",
    "down-left", "down", "down-right",
] as const;

export type LookDirection = typeof LOOK_DIRECTIONS[number];

/** The portrait spritesheet, uploaded by hand -- nothing in the repo builds it. */
export const LOOK_SHEET = "/portrait-look-spritesheet.png";

/**
 * The sheet's frame order, left to right, and the whole specification of its
 * layout. **This list is the contract with the artwork.** The code offsets into
 * the sheet by index and by a fraction of its width, so the sheet must be:
 *
 *   - a single row, no padding, no gaps;
 *   - exactly SHEET_FRAMES.length frames of identical width;
 *   - in this order.
 *
 * A sheet with a frame missing, an extra one, or the poses reordered will still
 * render -- it will simply point every glance the wrong way, which is easy to
 * mistake for a bug in the tracking. Change this list and the artwork together.
 *
 * The last is the eyes-closed frame, drawn over the centre pose. It is the only
 * variant there is, so a blink can only show while he is looking straight
 * ahead; glancing anywhere else has no closed-eye frame to swap to.
 */
export const SHEET_FRAMES = [...LOOK_DIRECTIONS, "blink"] as const;

/** The one direction the blink frame is drawn for. */
export const BLINK_DIRECTION: LookDirection = "center";

/**
 * Which frame of the sheet to show. Blinking only has a frame for
 * BLINK_DIRECTION, so anywhere else it is ignored rather than approximated.
 */
export const lookFrameIndex = (direction: LookDirection, blinking = false) =>
    blinking && direction === BLINK_DIRECTION
        ? SHEET_FRAMES.length - 1
        : LOOK_DIRECTIONS.indexOf(direction);

/**
 * The eight compass sectors, in the order atan2 sweeps them starting from
 * "pointing left" (-PI) and going clockwise on screen, since y grows downward.
 */
const SECTORS: LookDirection[] = [
    "left", "up-left", "up", "up-right",
    "right", "down-right", "down", "down-left",
];

/**
 * How close the pointer has to be before the character stops tracking it and
 * looks straight ahead, as a multiple of the portrait's own half-diagonal.
 *
 * Expressed as a ratio of the element's measured size on purpose. The whole app
 * is scaled by App.tsx, and getBoundingClientRect() returns *scaled* pixels, so
 * a fixed px threshold would mean a different distance on every viewport. A
 * ratio of two scaled measurements is scale-independent.
 */
const DEAD_ZONE = 0.75;

/**
 * One pointer source for every portrait on the page.
 *
 * A page can show several -- the history list has three -- and each used to
 * carry its own window listener and its own rAF, so the work scaled with the
 * number on screen. There is one of each now however many are mounted; the only
 * per-portrait cost left is measuring its own box, which is the part that
 * genuinely differs.
 *
 * Mouse only: a touch would leave the face frozen mid-glance wherever the last
 * tap happened to be, which reads as a bug rather than an effect. The
 * `pointerType` guard matches the one the Projects and Equip lists already use,
 * and it is why a touch device only ever sees the centre frame.
 */
type PointerListener = (at: { x: number; y: number } | null) => void;

const listeners = new Set<PointerListener>();
let pointerAt: { x: number; y: number } | null = null;
let pending = 0;

const flush = () => {
    pending = 0;
    for (const listener of listeners) listener(pointerAt);
};

// Read on the next frame rather than on the event: pointermove fires far more
// often than the screen refreshes, and every listener measures the DOM.
const schedule = () => {
    if (!pending) pending = requestAnimationFrame(flush);
};

const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pointerAt = { x: event.clientX, y: event.clientY };
    schedule();
};

// Mouse gone from the window entirely -- look straight ahead rather than
// holding the last glance indefinitely.
const onLeave = () => {
    pointerAt = null;
    schedule();
};

const subscribePointer = (listener: PointerListener) => {
    if (!listeners.size) {
        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", onLeave);
        window.addEventListener("blur", onLeave);
    }
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
        if (listeners.size) return;

        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("blur", onLeave);
        if (pending) cancelAnimationFrame(pending);
        pending = 0;
    };
};

/**
 * Tracks which of the nine directions the pointer sits in, relative to the
 * centre of `ref`'s element. Returns "center" when the pointer is close by, has
 * left the window, or is not a mouse at all.
 */
export default function useLookDirection(ref: React.RefObject<HTMLElement | null>) {
    const [direction, setDirection] = useState<LookDirection>("center");

    useEffect(() => subscribePointer(at => {
        const element = ref.current;
        if (!element) return;

        if (!at) {
            setDirection("center");
            return;
        }

        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return;

        const dx = at.x - (box.left + box.width / 2);
        const dy = at.y - (box.top + box.height / 2);

        const half = Math.hypot(box.width, box.height) / 2;
        if (Math.hypot(dx, dy) < half * DEAD_ZONE) {
            setDirection("center");
            return;
        }

        // atan2 returns -PI..PI. Shift by half a sector so each sector is
        // centred on its compass point rather than starting at it, then
        // bucket into eighths.
        const turn = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
        const sector = Math.floor(turn * 8 + 0.5) % 8;
        setDirection(SECTORS[sector]);
    }), [ref]);

    return direction;
}
