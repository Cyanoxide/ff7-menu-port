import { useEffect } from "react";
import { useContext } from "../../context/context";
import type { WindowCorner } from "../../context/types";

import styles from "./BGColorPicker.module.scss";
import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav } from "../../hooks/useCursorNav";
import { defaultWindowColor } from "../../context/defaults";

interface bgColorPickerProps {
    activeColorPicker: WindowCorner | null;
    setActiveColorPicker: (corner: WindowCorner | null) => void;
    focusedCorner: WindowCorner | null;
    onCornerEnter: (corner: WindowCorner) => void;
    onCornerClick: (corner: WindowCorner) => void;
}

const CHANNELS: ("red" | "green" | "blue")[] = ["red", "green", "blue"];

const BGColorPicker: React.FC<bgColorPickerProps> = ({ activeColorPicker, setActiveColorPicker, focusedCorner, onCornerEnter, onCornerClick }) => {
    const { windowColor, isSoundEnabled, isCRTEnabled, dispatch } = useContext();

    const currentColor: number[] | null = (activeColorPicker) ? windowColor[activeColorPicker] : null;

    const isDefaultWindowColor = !!(activeColorPicker && JSON.stringify(windowColor[activeColorPicker]) === JSON.stringify(defaultWindowColor[activeColorPicker]));

    const setChannel = (channelIndex: number, value: number) => {
        if (!activeColorPicker) return;
        const next = Math.max(0, Math.min(255, value));
        if (next === windowColor[activeColorPicker][channelIndex]) return;

        playSound("select", isSoundEnabled);
        const updatedWindowColor = structuredClone(windowColor);
        updatedWindowColor[activeColorPicker][channelIndex] = next as never;
        dispatch({ type: "SET_WINDOW_COLOR", payload: updatedWindowColor });
        localStorage.setItem("windowColor", JSON.stringify(updatedWindowColor));
    };

    const dismissHandler = () => {
        setActiveColorPicker(null);
        playSound("back", isSoundEnabled);
    }

    const onResetClickHandler = () => {
        playSound("select", isSoundEnabled);
        if (!activeColorPicker) return;

        const updatedWindowColor = structuredClone(windowColor);
        updatedWindowColor[activeColorPicker] = structuredClone(defaultWindowColor)[activeColorPicker];

        dispatch({ type: "SET_WINDOW_COLOR", payload: updatedWindowColor });
        localStorage.setItem("windowColor", JSON.stringify(updatedWindowColor));
    };

    const { focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "sliders", size: CHANNELS.length },
            { id: "reset", size: 1, isDisabled: () => isDefaultWindowColor },
        ],
        initial: { group: "sliders", index: 0 },
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

    // Reset the picker cursor to the red slider each time the picker opens
    useEffect(() => {
        if (activeColorPicker) setPosSilently({ group: "sliders", index: 0 });
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
        <ContentBox className={styles.RGBSliders}>
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
            {activeColorPicker && <div onClick={dismissHandler} className="absolute w-full h-full top-0 left-0 bottom-0 right-0"></div>}
            <ContentBox data-label="configColorPreview" className={`${styles.colorPicker} w-[14rem] h-[5rem] relative`}>
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
                {currentColor && <div className={styles.RGBReset} data-active={!isDefaultWindowColor} data-focused={isFocused("reset", 0)} onMouseEnter={() => { if (!isDefaultWindowColor) focus({ group: "reset", index: 0 }); }} onClick={onResetClickHandler}><ContentBox data-label="reset"><span className="font-glyph" data-sprite="reset-icon"></span></ContentBox></div>}
                {RGBSliders}
            </ContentBox>
        </>
    );
};

export default BGColorPicker;
