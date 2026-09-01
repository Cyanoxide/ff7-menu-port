import { useLayoutEffect, useRef, useState } from "react";
import useLookDirection, { LOOK_SHEET, SHEET_COLUMNS, SHEET_ROWS, DEFAULT_LOOK, lookFrame, sheetCellStyle, type LookDirection } from "../../hooks/useLookDirection";
import styles from "./Portrait.module.scss";

/** How long a glance takes to cross-fade. Short enough to feel like a reaction. */
const FADE_MS = 60;

interface LookingPortraitProps {
    /** Fallback if a look frame is missing, so a 404 shows the face */
    src: string;
    /** Omit to let a class size it -- an inline width would override the class */
    width?: number;
    className?: string;
    alt?: string;
    /** Forces a frame, overriding the pointer, for as long as it is set */
    look?: LookDirection | null;
    /** Shuts his eyes. Only the centre pose has a closed-eye frame */
    blink?: boolean;
}

/**
 * The default portrait, which follows the mouse: nine frames of the character
 * looking up/down/left/right, the four diagonals and straight ahead, plus a
 * closed-eye frame for the centre pose.
 *
 * Only the default gets this. The FF7 character faces come out of a single
 * spritesheet with one frame each, so there is nothing to swap to, and the
 * easter egg is a static likeness anyway.
 *
 * Blinking is not built in: the caller owns it, so the landing page can blink
 * him on a hit and hold his eyes shut while he is dead, rather than fighting a
 * timer inside here. A caller that only wants the idle rhythm passes useBlink
 * straight through.
 */
const LookingPortrait: React.FC<LookingPortraitProps> = ({ src, width, className, alt = "Portrait", look, blink }) => {
    const ref = useRef<HTMLDivElement>(null);
    const pointing = useLookDirection(ref);

    // An override takes the portrait off the pointer for as long as it lasts.
    // The hook keeps tracking underneath, so the glance is already correct for
    // wherever the mouse ended up by the time it hands back.
    const direction = look ?? pointing;

    /**
     * The two layers. `under` is whatever was last shown and stays fully
     * opaque; `over` is the frame fading in on top of it. Advancing both in a
     * single state update matters: `under` has to take the outgoing frame in
     * the same commit that `over` takes the incoming one, or the pair repaint
     * out of step and the portrait flicks back to an older frame for a frame.
     */
    const [layers, setLayers] = useState<{ under: LookDirection; over: LookDirection; turn: number }>(
        { under: DEFAULT_LOOK, over: DEFAULT_LOOK, turn: 0 }
    );

    // Layout effect, not an effect: this runs on the same commit that changed
    // the direction, so the swap is painted once rather than showing the old
    // frame for a beat first.
    useLayoutEffect(() => {
        setLayers(prev => (prev.over === direction
            ? prev
            : { under: prev.over, over: direction, turn: prev.turn + 1 }));
    }, [direction]);

    // One sheet, so there is nothing to preload: the first paint fetches every
    // frame, and a glance is a transform rather than a request. Both layers
    // point at the same file, so it is still one fetch.
    const [failed, setFailed] = useState(false);
    if (failed) {
        // The sheet did not load. Better the plain portrait than an empty box.
        return <img src={src} width={width} className={className} alt={alt} />;
    }

    const under = lookFrame(layers.under);
    const over = lookFrame(layers.over, blink);

    return (
        <div
            ref={ref}
            role="img"
            aria-label={alt}
            data-look={direction}
            className={`${styles.look} ${className ?? ""}`}
            style={{
                width: width ? `${width}px` : undefined,
                "--portrait-fade": `${FADE_MS}ms`,
            } as React.CSSProperties}
        >
            <img
                src={LOOK_SHEET}
                alt=""
                aria-hidden
                className={styles.sheet}
                style={sheetCellStyle(SHEET_COLUMNS, SHEET_ROWS, under.column, under.row)}
                onError={() => setFailed(true)}
            />
            {/*
              * Alternating two identical animations restarts the fade on each
              * glance. The element stays put -- see the note in the stylesheet.
              *
              * A blink changes only this layer's row, and does not advance the
              * turn, so it is a straight cut: eyes shut and open again, they do
              * not dissolve, and a blink cannot interrupt a glance mid-fade.
              */}
            <img
                src={LOOK_SHEET}
                alt=""
                aria-hidden
                className={`${styles.sheet} ${layers.turn % 2 ? styles.incomingA : styles.incomingB}`}
                style={sheetCellStyle(SHEET_COLUMNS, SHEET_ROWS, over.column, over.row)}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

export default LookingPortrait;
