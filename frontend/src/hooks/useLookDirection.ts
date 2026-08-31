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
 * The resting pose: what a portrait shows before the mouse has said anything,
 * and what it returns to when the pointer leaves the window. It is also what a
 * touch device sees for the whole visit, since there is no pointer to track.
 *
 * Not the same as the dead zone, which stays "center" -- that is the pointer
 * resting *on* the portrait, and looking away from a cursor that is on your
 * face reads as avoiding it rather than as a neutral pose.
 */
export const DEFAULT_LOOK: LookDirection = "up-right";

/**
 * Which frame of the sheet to show. Blinking only has a frame for
 * BLINK_DIRECTION, so anywhere else it is ignored rather than approximated.
 */
export const lookFrameIndex = (direction: LookDirection, blinking = false) =>
    blinking && direction === BLINK_DIRECTION
        ? SHEET_FRAMES.length - 1
        : LOOK_DIRECTIONS.indexOf(direction);

/**
 * The eight directions in eighths clockwise from "right", since y grows
 * downward on screen.
 */
const COMPASS: LookDirection[] = [
    "right", "down-right", "down", "down-left",
    "left", "up-left", "up", "up-right",
];

/**
 * How far a cardinal sector reaches either side of dead-on, in degrees. The
 * diagonals take whatever is left.
 *
 * Not 22.5 each, which is what even eighths would give. The menu sits about
 * 845px to the right of the landing portrait but spans only ~490px vertically,
 * so its whole column subtends a narrow band around the horizontal and every
 * item read as a flat "right".
 *
 * And not symmetrical either. Measured against the menu, the boundary that
 * looks right above the horizontal is tighter than the one below it: 7 degrees
 * up puts the top item in "up-right", while the same 7 below started
 * "down-right" as high as the Resume row. 11.5 moves that down to Github.
 *
 * CCW and CW are the two sides going clockwise on screen, so on the right-hand
 * cardinal CCW is upward and CW is downward. The same skew applies to all four,
 * which keeps one rule rather than special-casing the horizontal.
 *
 * Both are derived from the menu's layout, so if the menu or the portrait
 * moves, hover the top and bottom rows and check they still read as diagonals.
 */
const CARDINAL_ARC_CCW = 7;
const CARDINAL_ARC_CW = 11.5;

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
 * centre of `ref`'s element. Returns "center" when the pointer is resting on
 * the portrait, and DEFAULT_LOOK when there is no pointer to read -- it has
 * left the window, or was never a mouse.
 */
export default function useLookDirection(ref: React.RefObject<HTMLElement | null>) {
    const [direction, setDirection] = useState<LookDirection>(DEFAULT_LOOK);

    useEffect(() => subscribePointer(at => {
        const element = ref.current;
        if (!element) return;

        if (!at) {
            setDirection(DEFAULT_LOOK);
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

        // Degrees clockwise from "right". Round to the nearest cardinal, then
        // keep it only if the pointer is inside that cardinal's arc -- otherwise
        // take the diagonal on whichever side it fell.
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cardinal = Math.round(angle / 90);
        const offset = angle - cardinal * 90;
        const eighth = offset < -CARDINAL_ARC_CCW ? -1 : offset > CARDINAL_ARC_CW ? 1 : 0;
        setDirection(COMPASS[(cardinal * 2 + eighth + 8) % 8]);
    }), [ref]);

    return direction;
}
