import { useEffect, useRef } from "react";
import { useContext } from "../../context/context";
import useLookDirection, { LOOK_DIRECTIONS, lookFrameSrc } from "../../hooks/useLookDirection";
import {
    resolvePortrait,
    PORTRAIT_SHEET,
    PORTRAIT_WIDTH,
    PORTRAIT_HEIGHT,
} from "../../data/portraits";

interface PortraitProps {
    /** The default portrait image (used when the name isn't an FF7 character) */
    src: string;
    width?: number;
    className?: string;
    /** Override the name used to resolve the portrait; defaults to the saved user name */
    name?: string;
    alt?: string;
}

/**
 * The default portrait, which follows the mouse: nine frames of the character
 * looking up/down/left/right, the four diagonals, and straight ahead.
 *
 * Only the default gets this. The FF7 character faces come out of a single
 * spritesheet with one frame each, so there is nothing to swap to, and the
 * easter egg is a static likeness anyway.
 *
 * Split out of Portrait rather than branching inside it so the pointer listener
 * only exists while this portrait is the one on screen — a character portrait
 * mounts no tracking at all.
 */
const LookingPortrait: React.FC<{ src: string; width: number; className?: string; alt: string }> = ({ src, width, className, alt }) => {
    const ref = useRef<HTMLImageElement>(null);
    const direction = useLookDirection(ref);

    // Decode all nine up front. Without this the first glance in each direction
    // swaps to an image the browser has not fetched, and the portrait blinks
    // empty for a frame on its way round.
    useEffect(() => {
        for (const frame of LOOK_DIRECTIONS) {
            const preload = new Image();
            preload.src = lookFrameSrc(frame);
        }
    }, []);

    return (
        <img
            ref={ref}
            src={lookFrameSrc(direction)}
            // The nine frames differ only in where the eyes point, so React
            // must not treat a direction change as a new element -- keying it
            // by src would remount and refetch on every glance.
            alt={alt}
            width={width}
            className={`object-contain ${className ?? ""}`}
            data-look={direction}
            // `src` is the portrait shipped in the data file. It is the fallback
            // if a look frame is ever missing, so a 404 shows the face rather
            // than a broken image.
            onError={event => { event.currentTarget.src = src; }}
        />
    );
};

// Renders the party member's portrait, swapping to an FF7 character's face from
// the shared spritesheet when the (case-insensitive) name matches one.
const Portrait: React.FC<PortraitProps> = ({ src, width = 145, className, name, alt = "Party Member Portrait" }) => {
    const { userName } = useContext();
    const sprite = resolvePortrait(name ?? userName);

    if (!sprite) {
        return <LookingPortrait src={src} width={width} className={className} alt={alt} />;
    }

    const scale = width / PORTRAIT_WIDTH;
    return (
        <div
            role="img"
            aria-label={alt}
            className={className}
            style={{
                width: `${width}px`,
                height: `${PORTRAIT_HEIGHT * scale}px`,
                backgroundImage: `url(${PORTRAIT_SHEET})`,
                // scale by the (constant) height so it's independent of the sheet's
                // total width — appending portraits like Cid doesn't affect the others
                backgroundSize: `auto ${PORTRAIT_HEIGHT * scale}px`,
                backgroundPosition: `-${sprite.x * scale}px 0`,
                backgroundRepeat: "no-repeat",
            }}
        />
    );
};

export default Portrait;
