import { useEffect, useRef, useState } from "react";

import ContentBox from "../../components/ContentBox/ContentBox";
import { useContext } from "../../context/context";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";

import styles from "./ImageCarousel.module.scss";

/**
 * A still, or a still with something that plays over it on demand.
 *
 * `hover` may be a video (mp4/webm) or an animated image (webp/gif) — video is
 * preferred, being smaller and sharper at the same quality, and it is what
 * Photoshop's Render Video exports. `aspect` overrides the stage's 16:9 for
 * shots of a different shape, such as a phone-width capture.
 *
 * `pan` marks a scroll pan, and changes what `src` means: instead of a still it
 * is the **whole page**, tall, and the stage slides it under a CSS transition —
 * down while the pointer is on it, holding at the foot, and back up when the
 * pointer leaves. Nothing is encoded, so there are no compression artefacts, no
 * autoplay policy to satisfy, and reversal is free: a transition interrupted
 * mid-travel simply runs back from wherever it had reached.
 *
 * `mobile` marks a phone capture, which is shown square; everything else is 16:9.
 * The stage's **height never changes** — only its width, which eases between the
 * two as you step through, so the modal grows and shrinks rather than jumping.
 * `aspect` overrides a slide's shape outright.
 *
 * Animations that are not pans use `hover` and simply loop.
 */
export type Shot = string | {
    src: string;
    hover?: string;
    aspect?: string;
    pan?: boolean;
    mobile?: boolean;
};

type CarouselProps = {
    entry: { name: string; link?: string; screenshots?: Shot[] };
    onClose: () => void;
};

const still = (shot: Shot) => (typeof shot === "string" ? shot : shot.src);
const motion = (shot: Shot) => (typeof shot === "string" ? null : shot.hover ?? null);
const pans = (shot: Shot) => (typeof shot === "string" ? false : shot.pan === true);
const isMobile = (shot: Shot) => (typeof shot === "string" ? false : shot.mobile === true);
const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

/** Square for a phone capture, 16:9 for everything else */
const aspectOf = (shot: Shot) =>
    (typeof shot === "string" ? null : shot.aspect) ?? (isMobile(shot) ? "1 / 0.9" : "16 / 9");

/** "16 / 9" -> 1.778, for sizing the stage's width from its fixed height */
const ratio = (aspect: string) => {
    const [w, h] = aspect.split("/").map((part) => Number(part.trim()));
    return h ? w / h : 16 / 9;
};

/**
 * Travel time for a full pan. The distance is in rendered pixels, which are far
 * fewer than the page's own, so this is paced to read at about 350 of them a
 * second. The ceiling is what long pages actually hit, and it is generous on
 * purpose: a low one makes the longest pages the fastest, which reads as a blur
 * rather than a scroll.
 */
const panMs = (distance: number) => Math.min(10000, Math.max(1200, Math.round(distance / 0.35)));

/** How long the modal is left alone before anything starts moving in it */
const SETTLE_MS = 1500;

/**
 * How long a looping video rests on its last frame before running again. Looping
 * straight back to the first frame gives no beat to read the end on, so the clip
 * is restarted by hand rather than with the `loop` attribute.
 */
const LOOP_HOLD_MS = 1200;

/**
 * The screenshot carousel.
 *
 * Pages taller than the 16:9 stage are captured whole and turned into an
 * animated WebP that pans down them. That plays on hover rather than on open:
 * the still is what loads, and the animation is only fetched when the pointer
 * arrives. Shots that already fit the stage are plain stills.
 */
const ImageCarousel: React.FC<CarouselProps> = ({ entry, onClose }) => {
    const { isSoundEnabled } = useContext();
    const shots = entry.screenshots ?? [];
    const [index, setIndex] = useState(0);
    // Whether the pointer is on the stage, and whether the animation is on
    // screen. They come apart while a pan unwinds: the pointer has gone but the
    // video is still playing its way back to the top.
    const [hovered, setHovered] = useState(false);
    const [showing, setShowing] = useState(false);
    // Hovering is noted straight away, but nothing moves until the modal has
    // settled: opening it under the pointer and panning at once reads as the
    // page scrolling by itself. After the wait it starts on its own, with no
    // need to take the pointer away and bring it back.
    const [settled, setSettled] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLImageElement>(null);
    const holdTimer = useRef<number | null>(null);
    // How far a pan has to travel: the page's rendered height less the stage's
    const [travel, setTravel] = useState(0);

    const shot = shots[index];
    const animation = shot ? motion(shot) : null;
    const aspect = shot ? aspectOf(shot) : "16 / 9";
    const isPan = !!shot && pans(shot);

    // The stage's height is fixed in the stylesheet and its width follows from
    // the slide's shape, so stepping between a desktop and a phone capture eases
    // the modal wider or narrower without ever changing how tall it is.
    const stageStyle: React.CSSProperties = { width: `calc(var(--stage-h) * ${ratio(aspect)})` };

    // The panel takes its width from the stage rather than the other way round.
    // That is only safe because the stage's height no longer depends on it — an
    // earlier version had each sizing from the other, and both collapsed.
    const panelStyle: React.CSSProperties = { width: "fit-content" };

    /** How far the page image can slide before its foot reaches the stage's */
    const measure = () => {
        const page = pageRef.current;
        const stage = stageRef.current;
        if (!page || !stage) return;
        setTravel(Math.max(0, page.offsetHeight - stage.clientHeight));
    };

    const step = (delta: number) => {
        if (!shots.length) return;
        setHovered(false);
        setShowing(false);
        // Back to nothing until the incoming page has been measured, so it cannot
        // inherit the outgoing one's travel
        setTravel(0);
        setIndex((current) => (current + delta + shots.length) % shots.length);
    };

    useEffect(() => {
        const timer = setTimeout(() => setSettled(true), SETTLE_MS);
        return () => clearTimeout(timer);
    }, []);

    /**
     * The page is as wide as the stage, so its height — and with it the distance
     * to travel — changes whenever the stage does. The stage's width *animates*
     * between slide shapes, so measuring once on arrival catches it mid-flight
     * and leaves the pan running on a stale, far larger figure, which scrolls
     * clean past the foot of the page. Watching both keeps it honest.
     */
    useEffect(() => {
        if (!isPan) return;
        measure();
        const observer = new ResizeObserver(measure);
        if (stageRef.current) observer.observe(stageRef.current);
        if (pageRef.current) observer.observe(pageRef.current);
        return () => observer.disconnect();
    }, [isPan, index]);

    /**
     * Start a looping animation explicitly rather than trusting `autoPlay`,
     * which a browser may decline. A pan needs none of this.
     */
    useEffect(() => {
        if (showing && hovered && settled) videoRef.current?.play().catch(() => {});
    }, [showing, hovered, settled]);

    // An interrupted pan needs no help turning around: CSS shortens a reversed
    // transition by how far it had already got, so the speed stays even whether
    // it runs the whole page or a tenth of it. Timing the legs by hand here
    // double-applied that and made reversals snap back at twice the speed.
    const enter = () => {
        setHovered(true);
        setShowing(true);
    };

    const leave = () => {
        setHovered(false);
        setShowing(false);
    };

    /** Rest on the last frame, then run again from the top */
    const onEnded = () => {
        holdTimer.current = window.setTimeout(() => {
            const video = videoRef.current;
            if (!video) return;
            video.currentTime = 0;
            video.play().catch(() => {});
        }, LOOP_HOLD_MS);
    };

    // The hold outlives the element it belongs to if the pointer leaves during it
    useEffect(() => () => {
        if (holdTimer.current) clearTimeout(holdTimer.current);
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
        };

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    });

    return (
        <div className={styles.overlay} onClick={onClose}>
            {/* Wrapped rather than putting the handler on ContentBox, which
                forwards unknown props at runtime but does not declare them */}
            <div
                className={styles.panelWrap}
                style={panelStyle}
                onClick={(event) => event.stopPropagation()}
            >
            <ContentBox className={styles.panel}>
                <div className={styles.head}>
                    <span>{textToSprite(entry.name)}</span>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                        {textToSprite("X")}
                    </button>
                </div>

                <div
                    ref={stageRef}
                    className={styles.stage}
                    style={stageStyle}
                    onMouseEnter={enter}
                    onMouseLeave={leave}
                    // Touch has no hover, so a tap stands in for arriving and leaving
                    onPointerDown={(event) => {
                        if (event.pointerType === "mouse") return;
                        if (hovered) leave(); else enter();
                    }}
                >
                    {!shots.length
                        ? <span className={styles.empty}>{textToSprite("No screenshots yet")}</span>
                        : isPan
                            // The page at the stage's full width, sliding under it.
                            // Interrupting the transition either way reverses it
                            // from where it stands.
                            // Keyed so each slide is a fresh element: reusing one
                            // would leave the incoming page mid-transition, sliding
                            // back into frame from wherever the last had reached.
                            ? <img
                                key={still(shot)}
                                ref={pageRef}
                                src={still(shot)}
                                alt=""
                                className={styles.page}
                                onLoad={measure}
                                style={{
                                    transform: `translateY(${hovered && settled ? -travel : 0}px)`,
                                    transitionDuration: `${panMs(travel)}ms`,
                                }}
                            />
                            : showing && settled && animation
                                ? isVideo(animation)
                                    // No `loop`: it runs, rests on its last frame,
                                    // then starts again, which `loop` cannot do
                                    ? <video
                                        key={animation}
                                        ref={videoRef}
                                        src={animation}
                                        className={styles.shot}
                                        autoPlay
                                        muted
                                        playsInline
                                        onEnded={onEnded}
                                    />
                                    // Keyed so the animation restarts from its first
                                    // frame rather than resuming part-way through
                                    : <img key={animation} src={animation} alt="" className={styles.shot} />
                                : <img src={still(shot)} alt="" className={styles.shot} />
                    }
                </div>

                <div className={styles.controls}>
                    <div className={styles.pagination}>
                        <button type="button" onClick={() => step(-1)} disabled={shots.length < 2}>
                            {textToSprite("<")}
                        </button>
                        <span className={styles.count}>
                            {textToSprite(shots.length ? `${index + 1} / ${shots.length}` : "0 / 0")}
                        </span>
                        <button type="button" onClick={() => step(1)} disabled={shots.length < 2}>
                            {textToSprite(">")}
                        </button>
                    </div>

                    {/* The way out to the live page, since the list row now opens
                        this rather than following its link */}
                    {!!entry.link && <a
                        className={styles.viewLink}
                        href={entry.link}
                        target="_blank"
                        rel="noreferrer"
                        data-text-color="yellow"
                        onClick={() => playSound("select", isSoundEnabled)}
                    >
                        {textToSprite("View", false, "yellow")}
                        <span className="font-glyph ml-2" data-sprite="external-link-icon" />
                    </a>}
                </div>
            </ContentBox>
            </div>
        </div>
    );
};

export default ImageCarousel;
