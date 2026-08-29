import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useContext } from "../../context/context";
import useLookDirection, { LOOK_DIRECTIONS, BLINK_SRC, BLINK_DIRECTION, lookFrameSrc, type LookDirection } from "../../hooks/useLookDirection";
import styles from "./Portrait.module.scss";
import StaticPortrait from "./StaticPortrait";
import {
    resolvePortrait,
    PORTRAIT_SHEET,
    PORTRAIT_WIDTH,
    PORTRAIT_HEIGHT,
} from "../../data/portraits";

interface PortraitProps {
    /** The default portrait image (used when the name isn't an FF7 character) */
    src: string;
    /**
     * Forces a look frame, overriding the pointer, for as long as it is set.
     * Ignored by the character portraits, which have only the one frame.
     */
    look?: LookDirection | null;
    /**
     * Shuts his eyes while true. Only has a frame for the centre pose, so a
     * blink is invisible while he is glancing anywhere else.
     */
    blink?: boolean;
    /**
     * Whether the portrait follows the mouse. Only the landing page does; the
     * copies on Equip, Skills, Name Entry and the resume are static.
     *
     * Off by default, so a new use of this component is static unless it asks
     * otherwise -- the tracking costs a window pointer listener and nine
     * preloaded frames, which is not something to acquire by accident.
     */
    follow?: boolean;
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
/** How long a glance takes to cross-fade. Short enough to feel like a reaction. */
const FADE_MS = 20;

const LookingPortrait: React.FC<{ src: string; width: number; className?: string; alt: string; look?: LookDirection | null; blink?: boolean }> = ({ src, width, className, alt, look, blink }) => {
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
    const [layers, setLayers] = useState<{ under: LookDirection; over: LookDirection }>(
        { under: "center", over: "center" }
    );

    // Layout effect, not an effect: this runs on the same commit that changed
    // the direction, so the swap is painted once rather than showing the old
    // frame for a beat first.
    useLayoutEffect(() => {
        setLayers(prev => (prev.over === direction ? prev : { under: prev.over, over: direction }));
    }, [direction]);

    // Decode all nine up front. Without this the first glance in each direction
    // fades in an image the browser has not fetched, so the transition plays
    // over nothing and lands as a hard cut.
    useEffect(() => {
        for (const url of [...LOOK_DIRECTIONS.map(lookFrameSrc), BLINK_SRC]) {
            const preload = new Image();
            preload.src = url;
        }
    }, []);

    // `src` is the portrait shipped in the data file, used if a look frame is
    // ever missing, so a 404 shows the face rather than a broken image.
    const onError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        event.currentTarget.src = src;
    };

    return (
        <div
            ref={ref}
            role="img"
            aria-label={alt}
            data-look={direction}
            className={`${styles.look} ${className ?? ""}`}
            style={{ width: `${width}px`, "--portrait-fade": `${FADE_MS}ms` } as React.CSSProperties}
        >
            <img src={lookFrameSrc(layers.under)} alt="" aria-hidden className={styles.frame} onError={onError} />
            {/*
              * The blink swaps the top layer's src without touching its key, so
              * it is a straight cut with no cross-fade: eyes shut and open
              * again, they do not dissolve. It also means a blink cannot
              * interrupt a glance that is mid-fade.
              */}
            {/*
              * Keyed by direction so each glance mounts a fresh element and the
              * CSS animation runs from the start. Restarting an animation on a
              * persistent node means clearing it and forcing a reflow between,
              * which is easy to get subtly wrong; a remount cannot half-apply.
              * The frames are preloaded, so the new node has nothing to fetch.
              */}
            <img
                key={layers.over}
                src={blink && layers.over === BLINK_DIRECTION ? BLINK_SRC : lookFrameSrc(layers.over)}
                alt=""
                aria-hidden
                className={`${styles.frame} ${styles.incoming}`}
                onError={onError}
            />
        </div>
    );
};

// Renders the party member's portrait, swapping to an FF7 character's face from
// the shared spritesheet when the (case-insensitive) name matches one.
const Portrait: React.FC<PortraitProps> = ({ src, width = 145, className, name, alt = "Party Member Portrait", look, blink, follow = false }) => {
    const { userName } = useContext();
    const sprite = resolvePortrait(name ?? userName);

    if (!sprite) {
        if (follow) {
            return <LookingPortrait src={src} width={width} className={className} alt={alt} look={look} blink={blink} />;
        }
        return <StaticPortrait src={src} width={width} className={`object-contain ${className ?? ""}`} alt={alt} />;
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
