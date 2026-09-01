import { LOOK_SHEET, SHEET_COLUMNS, SHEET_ROWS, DEFAULT_LOOK, lookFrame, type LookDirection } from "../../hooks/useLookDirection";
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
    /** How many columns `sheet` holds; the offset is a fraction of its width */
    frames?: number;
    /** How many rows `sheet` holds. One unless it carries blinks as well. */
    rows?: number;
    /** Which row of `sheet` to take the frame from */
    row?: number;
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
    src, look = DEFAULT_LOOK, sheet, frame, frames, rows = 1, row = 0, aspect, width, className, alt = "Portrait",
}) => (
    <div
        role="img"
        aria-label={alt}
        data-look={sheet ? undefined : look}
        className={`${styles.look} ${className ?? ""}`}
        style={{
            width: width ? `${width}px` : undefined,
            "--columns": sheet ? frames : SHEET_COLUMNS,
            "--rows": sheet ? rows : SHEET_ROWS,
            "--portrait-aspect": aspect,
        } as React.CSSProperties}
    >
        <img
            src={sheet ?? LOOK_SHEET}
            alt=""
            aria-hidden
            className={styles.sheet}
            style={{
                "--column": sheet ? frame : lookFrame(look).column,
                "--row": sheet ? row : lookFrame(look).row,
            } as React.CSSProperties}
            onError={event => { event.currentTarget.src = src; }}
        />
    </div>
);

export default StaticPortrait;
