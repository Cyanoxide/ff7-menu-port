// Tracks whether the mouse is *actively* moving. Hover-to-focus should only fire
// on real pointer movement — not when a list scrolls (via keyboard or the wheel)
// and slides a new item under an otherwise-stationary cursor, which fires a
// spurious mouseenter and would otherwise hijack the selection.
let movingUntil = 0;

if (typeof window !== "undefined") {
    window.addEventListener(
        "mousemove",
        () => { movingUntil = performance.now() + 100; },
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
