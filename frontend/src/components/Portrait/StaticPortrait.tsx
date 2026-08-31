import { LOOK_SHEET, SHEET_FRAMES, DEFAULT_LOOK, lookFrameIndex, type LookDirection } from "../../hooks/useLookDirection";
import styles from "./Portrait.module.scss";

interface StaticPortraitProps {
    /** Fallback if the sheet is missing, so a 404 shows the face */
    src: string;
    /** Which pose to hold. Ignored when `frame` is given. */
    look?: LookDirection;
    /**
     * A different sheet to take the frame from -- the history list has its own,
     * one face per employer. Needs `frame`, `frames` and usually `aspect` with
     * it, since none of those can be inferred from the image.
     */
    sheet?: string;
    /** Index into `sheet`, left to right */
    frame?: number;
    /** How many frames `sheet` holds; the offset is a fraction of its width */
    frames?: number;
    /** CSS aspect-ratio of one frame, e.g. "53 / 61". Defaults to the look sheet's. */
    aspect?: string;
    /** Omit to let a class size it -- an inline width would override the class */
    width?: number;
    className?: string;
    alt?: string;
}

/**
 * One frame of a portrait sheet, held.
 *
 * The history list uses this rather than the tracking portrait: it shows three
 * slots at once, and three copies of the same face turning and blinking in step
 * reads as one puppet shown three times rather than three people.
 *
 * Not the tracking portrait with its input switched off -- that one carries a
 * pointer subscription, two layers and a cross-fade, none of which a held frame
 * has any use for.
 */
const StaticPortrait: React.FC<StaticPortraitProps> = ({
    src, look = DEFAULT_LOOK, sheet, frame, frames, aspect, width, className, alt = "Portrait",
}) => (
    <div
        role="img"
        aria-label={alt}
        data-look={sheet ? undefined : look}
        className={`${styles.look} ${className ?? ""}`}
        style={{
            width: width ? `${width}px` : undefined,
            "--frames": sheet ? frames : SHEET_FRAMES.length,
            "--portrait-aspect": aspect,
        } as React.CSSProperties}
    >
        <img
            src={sheet ?? LOOK_SHEET}
            alt=""
            aria-hidden
            className={styles.sheet}
            style={{ "--frame": sheet ? frame : lookFrameIndex(look) } as React.CSSProperties}
            onError={event => { event.currentTarget.src = src; }}
        />
    </div>
);

export default StaticPortrait;
