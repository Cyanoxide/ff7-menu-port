import { LOOK_SHEET, SHEET_FRAMES, lookFrameIndex, type LookDirection } from "../../hooks/useLookDirection";
import styles from "./Portrait.module.scss";

interface StaticPortraitProps {
    /** Fallback if the sheet is missing, so a 404 shows the face */
    src: string;
    /** Which of the sheet's poses to hold */
    look: LookDirection;
    /** Omit to let a class size it -- an inline width would override the class */
    width?: number;
    className?: string;
    alt?: string;
}

/**
 * One frame of the portrait sheet, held.
 *
 * The history list uses this rather than the tracking portrait: it shows three
 * slots at once, and three copies of the same face turning and blinking in step
 * reads as one puppet shown three times rather than three people. Static, they
 * are simply the same portrait on three saves, which is what they are.
 *
 * Not the tracking portrait with its input switched off -- that one carries a
 * pointer subscription, two layers and a cross-fade, none of which a held frame
 * has any use for.
 */
const StaticPortrait: React.FC<StaticPortraitProps> = ({ src, look, width, className, alt = "Portrait" }) => (
    <div
        role="img"
        aria-label={alt}
        data-look={look}
        className={`${styles.look} ${className ?? ""}`}
        style={{
            width: width ? `${width}px` : undefined,
            "--frames": SHEET_FRAMES.length,
        } as React.CSSProperties}
    >
        <img
            src={LOOK_SHEET}
            alt=""
            aria-hidden
            className={styles.sheet}
            style={{ "--frame": lookFrameIndex(look) } as React.CSSProperties}
            onError={event => { event.currentTarget.src = src; }}
        />
    </div>
);

export default StaticPortrait;
