import { useEffect } from "react";
import { useContext } from "../../context/context";
import type { WindowColor, WindowCorner } from "../../context/types";

import styles from "./BGColorPicker.module.scss";
import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav } from "../../hooks/useCursorNav";

/**
 * The four-corner window colour picker.
 *
 * **Controlled.** It used to read the player's colour straight out of context
 * and write it back to context and localStorage itself, which made it the
 * config screen's picker and nothing else's. The guestbook needs the same
 * control for a colour that is not the player's and is never persisted, so the
 * value and the writing both belong to the caller now. Config passes the
 * context colour and a handler that dispatches and saves; the guestbook passes
 * a piece of its own state.
 */
interface bgColorPickerProps {
    /** The colour being edited */
    color: WindowColor;
    onChange: (next: WindowColor) => void;
    /** What Reset goes back to. The button hides when `color` already equals it. */
    defaultColor: WindowColor;
    activeColorPicker: WindowCorner | null;
    setActiveColorPicker: (corner: WindowCorner | null) => void;
    focusSlidersOnOpen: boolean;
    focusedCorner: WindowCorner | null;
    onCornerEnter: (corner: WindowCorner) => void;
    onCornerClick: (corner: WindowCorner) => void;
    /** Narrower sliders, for a caller with less room than the config screen */
    compact?: boolean;
}

const CHANNELS: ("red" | "green" | "blue")[] = ["red", "green", "blue"];

/** The picker box's label, also used to tell a click inside it from one outside. */
const PICKER_LABEL = "configColorPreview";

const BGColorPicker: React.FC<bgColorPickerProps> = ({ color, onChange, defaultColor, activeColorPicker, setActiveColorPicker, focusSlidersOnOpen, focusedCorner, onCornerEnter, onCornerClick, compact }) => {
    const { isSoundEnabled, isCRTEnabled } = useContext();

    const currentColor: number[] | null = (activeColorPicker) ? color[activeColorPicker] : null;

    const isDefaultWindowColor = !!(activeColorPicker && JSON.stringify(color[activeColorPicker]) === JSON.stringify(defaultColor[activeColorPicker]));

    const setChannel = (channelIndex: number, value: number) => {
        if (!activeColorPicker) return;
        const next = Math.max(0, Math.min(255, value));
        if (next === color[activeColorPicker][channelIndex]) return;

        playSound("select", isSoundEnabled);
        const updatedWindowColor = structuredClone(color);
        updatedWindowColor[activeColorPicker][channelIndex] = next as never;
        onChange(updatedWindowColor);
    };

    const dismissHandler = () => {
        setActiveColorPicker(null);
        playSound("back", isSoundEnabled);
    }

    /**
     * Anything outside the picker closes it.
     *
     * There was a backdrop element doing this, but it was `absolute` with
     * `w-full h-full`, which is its *parent's* size and not the page's — so it
     * only covered the row the picker sits on, and a click anywhere else left
     * the sliders up. On the guestbook that row is a fraction of the screen.
     *
     * pointerdown rather than click, so the panel is gone before whatever was
     * clicked reacts, and capture so a handler that stops propagation cannot
     * strand it open.
     *
     * Containment is tested with closest() on the box's own data-label rather
     * than a ref, because ContentBox does not forward one — and teaching a
     * component every page uses to forward refs is a lot of blast radius for
     * one listener. Everything the picker draws, sliders included, is inside
     * that box.
     */
    useEffect(() => {
        if (!activeColorPicker) return;

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest(`[data-label="${PICKER_LABEL}"]`)) return;
            setActiveColorPicker(null);
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [activeColorPicker, setActiveColorPicker]);

    const onResetClickHandler = () => {
        playSound("select", isSoundEnabled);
        if (!activeColorPicker) return;

        const updatedWindowColor = structuredClone(color);
        updatedWindowColor[activeColorPicker] = structuredClone(defaultColor)[activeColorPicker];

        onChange(updatedWindowColor);
    };

    const { focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "sliders", size: CHANNELS.length },
            // The compact picker has no Reset button, so the cursor must not
            // be able to land on one.
            { id: "reset", size: 1, isDisabled: () => compact || isDefaultWindowColor },
        ],
        initial: null,
        fallback: { group: "sliders", index: 0 },
        enabled: !!activeColorPicker,
        resolveMove: (current, dir) => {
            if (dir === "left" || dir === "right") {
                if (current.group === "sliders" && currentColor) {
                    setChannel(current.index, currentColor[current.index] + ((dir === "right") ? 1 : -1));
                }
                return null;
            }

            const order = [
                ...CHANNELS.map((_, index) => ({ group: "sliders", index })),
                ...(!isDefaultWindowColor ? [{ group: "reset", index: 0 }] : []),
            ];
            const currentOrderIndex = order.findIndex(p => p.group === current.group && p.index === current.index);
            if (currentOrderIndex === -1) return order[0];
            return order[(currentOrderIndex + ((dir === "down") ? 1 : -1) + order.length) % order.length];
        },
        resolvePageJump: (current, dir) => {
            if (current.group === "sliders" && currentColor) {
                setChannel(current.index, currentColor[current.index] + ((dir === "pageUp") ? 16 : -16));
            }
            return null;
        },
        onFocus: () => { },
        onConfirm: (current) => {
            if (current.group === "reset") onResetClickHandler();
        },
        onCancel: () => {
            dismissHandler();
            return true;
        },
    });

    // Each time the picker opens: keyboard flows land on the red slider,
    // mouse flows start with no cursor
    useEffect(() => {
        if (activeColorPicker) setPosSilently(focusSlidersOnOpen ? { group: "sliders", index: 0 } : null);
    }, [activeColorPicker]); // eslint-disable-line react-hooks/exhaustive-deps

    const generateSlider = (name: "red" | "green" | "blue", index: number) => {
        if (!currentColor) return;

        return (<div className={styles[name]} data-focused={isFocused("sliders", index)} onMouseEnter={() => focus({ group: "sliders", index })}>
            <span className="mr-3">{textToSprite(currentColor[index].toString().padStart(3, '0'), true)}</span>
            <input onChange={(e) => setChannel(index, parseInt(e.target.value, 10))} type="range" min={0} max={255} value={currentColor[index]} className={styles.RGBSlider} data-crt={isCRTEnabled} />
        </div>
        )
    };

    const generateButton = (corner: WindowCorner) => (
        <button onClick={() => onCornerClick(corner)} onMouseEnter={() => corner && onCornerEnter(corner)} className="w-1/2" data-active={activeColorPicker === corner} data-focused={focusedCorner === corner} />
    );

    const RGBSliders = currentColor ? (
        <ContentBox className={`${styles.RGBSliders} ${compact ? styles.compactSliders : ""}`}>
            {generateSlider("red", 0)}
            {generateSlider("green", 1)}
            {generateSlider("blue", 2)}
        </ContentBox>
    ) : null;

    const RGBPreview = currentColor ? (
        <ContentBox className={styles.RGBPreview} style={{ backgroundColor: `rgb(${currentColor[0]}, ${currentColor[1]}, ${currentColor[2]})` }} />
    ) : null;

    return (
        <>
            {/*
              * The box *is* the preview: its four-corner gradient is the colour
              * being edited. It has to be told which, now the picker is
              * controlled — ContentBox otherwise falls back to the reader's own
              * window colour, which is right on the config screen only because
              * that is the very colour being edited there.
              */}
            <ContentBox data-label={PICKER_LABEL} windowColor={color} className={`${styles.colorPicker} ${compact ? styles.compactPicker : "w-[14rem] h-[5rem]"} relative`}>
                <div>
                    <div className="flex justify-between absolute left-0 top-0 right-0 h-1/2">
                        {generateButton("topLeft")}
                        {generateButton("topRight")}
                    </div>
                    <div className="flex justify-between absolute left-0 bottom-0 right-0 h-1/2">
                        {generateButton("bottomLeft")}
                        {generateButton("bottomRight")}
                    </div>
                </div>
                {RGBPreview}
                {!compact && currentColor && <div className={styles.RGBReset} data-active={!isDefaultWindowColor} data-focused={isFocused("reset", 0)} onMouseEnter={() => { if (!isDefaultWindowColor) focus({ group: "reset", index: 0 }); }} onClick={onResetClickHandler}><ContentBox data-label="reset"><span className="font-glyph" data-sprite="reset-icon"></span></ContentBox></div>}
                {RGBSliders}
            </ContentBox>
        </>
    );
};

export default BGColorPicker;
