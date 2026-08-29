import { useEffect } from "react";
import useBlink from "../../hooks/useBlink";
import { BLINK_SRC, STATIC_LOOK, lookFrameSrc } from "../../hooks/useLookDirection";

interface StaticPortraitProps {
    /** Fallback if a look frame is missing, so a 404 shows the face */
    src: string;
    width?: number;
    className?: string;
    alt?: string;
}

/**
 * The portrait everywhere but the landing page: one pose, no mouse tracking,
 * but still blinking on the idle timer so he is not a photograph.
 *
 * Deliberately not the tracking portrait with the pointer switched off. That
 * one carries a window listener, ten preloaded frames and two cross-fading
 * layers, none of which a portrait with a single pose has any use for.
 */
const StaticPortrait: React.FC<StaticPortraitProps> = ({ src, width, className, alt = "Portrait" }) => {
    const [blinking] = useBlink();

    // Just the two this component can show. The first blink would otherwise be
    // a gap while the browser fetched the closed-eye frame.
    useEffect(() => {
        for (const url of [lookFrameSrc(STATIC_LOOK), BLINK_SRC]) {
            const preload = new Image();
            preload.src = url;
        }
    }, []);

    return (
        <img
            src={blinking ? BLINK_SRC : lookFrameSrc(STATIC_LOOK)}
            alt={alt}
            width={width}
            className={className}
            onError={event => { event.currentTarget.src = src; }}
        />
    );
};

export default StaticPortrait;
