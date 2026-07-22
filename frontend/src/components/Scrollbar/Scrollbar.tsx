import { useEffect, useRef, useState } from "react";
import { useContext } from "../../context/context";
import playSound from "../../util/sounds";

import styles from "./Scrollbar.module.scss";

interface ScrollbarProps {
    // The scrollable element to track. It should hide its native bar (add the
    // global `hide-scrollbar` class) and its offset parent should be positioned.
    targetRef: React.RefObject<HTMLElement | null>;
    // Fires when the bar shows/hides, so the list can reclaim the reserved gutter
    // space when nothing overflows.
    onVisibleChange?: (visible: boolean) => void;
}

// The handle is a small fixed-size position indicator (like FF7's), not a
// proportional thumb — a fraction of the track height, floored to a minimum.
const THUMB_FRACTION = 0.24;
const MIN_THUMB = 34;

// FF7-style scrollbar: a recessed track with a raised grey thumb. Drop it in as
// a sibling of a scrollable element inside a positioned (relative/absolute)
// container. It measures the target and auto-hides when there's nothing to
// scroll, so it stays out of the way until a list outgrows its box.
const Scrollbar: React.FC<ScrollbarProps> = ({ targetRef, onVisibleChange }) => {
    const { isSoundEnabled } = useContext();
    const trackRef = useRef<HTMLDivElement>(null);
    const [thumb, setThumb] = useState({ visible: false, height: 0, top: 0 });
    const drag = useRef<{ startY: number; startScroll: number } | null>(null);
    // The thumb position last time a drag "tick" sound played, so the scrollbar
    // clicks as it steps — matching the colour picker's RGB sliders.
    const lastSoundTop = useRef(0);

    useEffect(() => { onVisibleChange?.(thumb.visible); }, [thumb.visible, onVisibleChange]);

    useEffect(() => {
        const target = targetRef.current;
        const track = trackRef.current;
        if (!target || !track) return;

        const update = () => {
            const { scrollHeight, clientHeight, scrollTop } = target;
            const trackH = track.clientHeight;
            const scrollable = scrollHeight - clientHeight;
            if (scrollable <= 1 || trackH === 0) {
                setThumb((prev) => (prev.visible ? { ...prev, visible: false } : prev));
                return;
            }
            const height = Math.max(MIN_THUMB, Math.round(trackH * THUMB_FRACTION));
            const top = Math.round((trackH - height) * (scrollTop / scrollable));
            setThumb({ visible: true, height, top });
        };

        update();
        target.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(target);
        // The content wrapper's size changes when items are added/removed
        if (target.firstElementChild) observer.observe(target.firstElementChild);
        window.addEventListener("resize", update);

        return () => {
            target.removeEventListener("scroll", update);
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [targetRef]);

    useEffect(() => {
        const onMove = (event: MouseEvent) => {
            const target = targetRef.current;
            const track = trackRef.current;
            if (!drag.current || !target || !track) return;
            const scrollable = target.scrollHeight - target.clientHeight;
            const range = track.clientHeight - thumb.height;
            if (range <= 0) return;
            // getBoundingClientRect is in on-screen px, so this stays correct even
            // though #root is transform-scaled to fit the viewport
            const scale = track.getBoundingClientRect().height / track.clientHeight || 1;
            const deltaLayout = (event.clientY - drag.current.startY) / scale;
            target.scrollTop = drag.current.startScroll + (deltaLayout / range) * scrollable;

            // Click as the thumb steps to a new pixel position, like the sliders
            const newTop = Math.round(range * (target.scrollTop / scrollable));
            if (newTop !== lastSoundTop.current) {
                lastSoundTop.current = newTop;
                playSound("select", isSoundEnabled);
            }
        };
        const onUp = () => {
            drag.current = null;
            document.body.style.userSelect = "";
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [targetRef, thumb.height, isSoundEnabled]);

    const startDrag = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const target = targetRef.current;
        if (!target) return;
        drag.current = { startY: event.clientY, startScroll: target.scrollTop };
        lastSoundTop.current = thumb.top;
        document.body.style.userSelect = "none";
    };

    const pageScroll = (event: React.MouseEvent) => {
        const target = targetRef.current;
        const track = trackRef.current;
        if (!target || !track) return;
        const clickY = event.clientY - track.getBoundingClientRect().top;
        const scale = track.getBoundingClientRect().height / track.clientHeight || 1;
        const direction = clickY / scale < thumb.top ? -1 : 1;
        target.scrollTop += direction * target.clientHeight * 0.9;
    };

    return (
        <div ref={trackRef} className={styles.track} data-visible={thumb.visible} onMouseDown={pageScroll} aria-hidden>
            <div
                className={styles.thumb}
                style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
                onMouseDown={startDrag}
            />
        </div>
    );
};

export default Scrollbar;
