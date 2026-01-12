import { useState } from "react";
import { useContext } from "../../context/context";
import type { WindowCorner } from "../../context/types";

import styles from "./BGColorPicker.module.scss";
import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { defaultWindowColor } from "../../context/defaults";

const BGColorPicker = () => {
    const { windowColor, isSoundEnabled, isCRTEnabled, dispatch } = useContext();
    const [activeColorPicker, setActiveColorPicker] = useState<WindowCorner | null>(null);

    const currentColor: number[] | null = (activeColorPicker) ? windowColor[activeColorPicker] : null;

    const generateSlider = (name: "red" | "green" | "blue", index: number) => {
        if (!currentColor) return;

        return (<div className={styles[name]}>
            <span className="mr-3">{textToSprite(currentColor[index].toString().padStart(3, '0'), true)}</span>
            <input onChange={(e) => onChangeHandler(e, name)} type="range" min={0} max={255} value={currentColor[index]} className={styles.RGBSlider} data-crt={isCRTEnabled} />
        </div>
        )
    };

    const generateButton = (corner: WindowCorner) => (
        <button onClick={() => onClickHandler(corner)} onMouseEnter={() => playSound("select", isSoundEnabled)} className="w-1/2" data-active={activeColorPicker === corner} />
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

    const onClickHandler = (corner: WindowCorner) => {
        setActiveColorPicker(corner);
        playSound("select", isSoundEnabled);
    }

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

    const isDefaultWindowColor = (activeColorPicker && JSON.stringify(windowColor[activeColorPicker]) === JSON.stringify(defaultWindowColor));

    const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>, color: "red" | "green" | "blue") => {
        const index = (color === "red") ? "0" : (color === "green") ? "1" : (color === "blue") ? "2" : null;
        playSound("select", isSoundEnabled);
        if (!currentColor || !index) return;

        currentColor[index] = parseInt(e.target.value, 10);
        dispatch({ type: "SET_WINDOW_COLOR", payload: windowColor });
        localStorage.setItem("windowColor", JSON.stringify(windowColor));
    }

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
                {currentColor && <div className={styles.RGBReset} data-active={!isDefaultWindowColor} onClick={onResetClickHandler}><ContentBox data-label="reset"><span className="font-glyph" data-sprite="reset-icon"></span></ContentBox></div>}
                {RGBSliders}
            </ContentBox>
        </>
    );
};

export default BGColorPicker;
