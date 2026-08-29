import { useEffect, useRef, useState } from "react";

/**
 * The nine frames of the look-at-cursor portrait, as they appear on disk:
 * `/portrait--look-<direction>.png`.
 */
export const LOOK_DIRECTIONS = [
    "up-left", "up", "up-right",
    "left", "center", "right",
    "down-left", "down", "down-right",
] as const;

export type LookDirection = typeof LOOK_DIRECTIONS[number];

export const lookFrameSrc = (direction: LookDirection) =>
    `/portrait--look-${direction}.png`;

/**
 * Eyes closed. The only variant frame there is, and it is drawn over the centre
 * pose, so a blink can only show while he is looking straight ahead -- glancing
 * anywhere else has no closed-eye frame to swap to.
 */
export const BLINK_SRC = "/portrait--look-center--blink.png";

/** The one direction BLINK_SRC is drawn for. */
export const BLINK_DIRECTION: LookDirection = "center";

/**
 * The frame every static portrait uses. The nine exist for the landing page's
 * mouse tracking; everywhere else holds this one.
 *
 * It has to stay a direction that has a blink frame -- the static portraits
 * blink on the idle timer, and only this pose is drawn with the eyes shut.
 */
export const STATIC_LOOK: LookDirection = BLINK_DIRECTION;

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
 * Tracks which of the nine directions the pointer sits in, relative to the
 * centre of `ref`'s element. Returns "center" when the pointer is close by,
 * has left the window, or is not a mouse at all.
 *
 * Mouse only: a touch would leave the portrait frozen mid-glance wherever the
 * last tap happened to be, which reads as a bug rather than an effect. The
 * `pointerType` guard matches the one the Projects and Equip lists already use.
 */
export default function useLookDirection(ref: React.RefObject<HTMLElement | null>) {
    const [direction, setDirection] = useState<LookDirection>("center");

    // Latest pointer position, read on the next frame rather than on the event:
    // pointermove fires far more often than the screen refreshes, and the work
    // below measures the DOM.
    const pointer = useRef<{ x: number; y: number } | null>(null);
    const frame = useRef(0);

    useEffect(() => {
        const resolve = () => {
            frame.current = 0;

            const element = ref.current;
            const at = pointer.current;
            if (!element || !at) return;

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
        };

        const onMove = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            pointer.current = { x: event.clientX, y: event.clientY };
            if (!frame.current) frame.current = requestAnimationFrame(resolve);
        };

        // Mouse gone from the window entirely — look straight ahead rather than
        // holding the last glance indefinitely.
        const onLeave = () => {
            pointer.current = null;
            setDirection("center");
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", onLeave);
        window.addEventListener("blur", onLeave);

        return () => {
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerleave", onLeave);
            window.removeEventListener("blur", onLeave);
            if (frame.current) cancelAnimationFrame(frame.current);
        };
    }, [ref]);

    return direction;
}
