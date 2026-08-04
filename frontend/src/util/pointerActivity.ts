// Tracks whether the mouse is *actively* moving. Hover-to-focus should only fire
// on real pointer movement — not when a list scrolls (via keyboard or the wheel)
// and slides a new item under an otherwise-stationary cursor, which fires a
// spurious mouseenter and would otherwise hijack the selection.
let movingUntil = 0;
// Where the pointer last was, so a surface appearing underneath a stationary
// pointer can work out what it opened under. No mouseenter fires in that case —
// the content moved, not the mouse — so there is nothing else to go on.
let lastX: number | null = null;
let lastY: number | null = null;

if (typeof window !== "undefined") {
    window.addEventListener(
        "mousemove",
        (event) => {
            movingUntil = performance.now() + 100;
            lastX = event.clientX;
            lastY = event.clientY;
        },
        { passive: true },
    );
    // Any scroll means items moved under the pointer, not the pointer over items.
    window.addEventListener(
        "scroll",
        () => { movingUntil = 0; },
        { passive: true, capture: true },
    );
}

export const isPointerMoving = () => performance.now() < movingUntil;

/**
 * The element currently under the pointer, or null if the mouse has not moved
 * yet this session. elementFromPoint takes viewport coordinates, so it copes
 * with #root's transform on its own.
 */
export const elementUnderPointer = (): Element | null =>
    (lastX === null || lastY === null) ? null : document.elementFromPoint(lastX, lastY);
