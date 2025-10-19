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

    const RGBSliders = activeColorPicker ? (
        <ContentBox className={styles.RGBSliders}>
            <div className={styles.red}>
                <span className="mr-3">{textToSprite(windowColor[activeColorPicker][0].toString().padStart(3, '0'), true)}</span>
                <input onChange={(e) => onChangeHandler(e, "red")} type="range" min={0} max={255} value={windowColor[activeColorPicker][0]} className={styles.RGBSlider} data-crt={isCRTEnabled} />
            </div>
            <div className={styles.green}>
                <span className="mr-3">{textToSprite(windowColor[activeColorPicker][1].toString().padStart(3, '0'), true)}</span>
                <input onChange={(e) => onChangeHandler(e, "green")} type="range" min={0} max={255} value={windowColor[activeColorPicker][1]} className={styles.RGBSlider} data-crt={isCRTEnabled} />
            </div>
            <div className={styles.blue}>
                <span className="mr-3">{textToSprite(windowColor[activeColorPicker][2].toString().padStart(3, '0'), true)}</span>
                <input onChange={(e) => onChangeHandler(e, "blue")} type="range" min={0} max={255} value={windowColor[activeColorPicker][2]} className={styles.RGBSlider} data-crt={isCRTEnabled} />
            </div>
        </ContentBox>
    ) : null;

    const RGBPreview = activeColorPicker ? (
        <ContentBox className={styles.RGBPreview} style={{ backgroundColor: `rgb(${windowColor[activeColorPicker][0]}, ${windowColor[activeColorPicker][1]}, ${windowColor[activeColorPicker][2]})` }} />
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
    };

    const isDefaultWindowColor = (activeColorPicker && JSON.stringify(windowColor[activeColorPicker]) === JSON.stringify(defaultWindowColor[activeColorPicker]));

    const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>, color: "red" | "green" | "blue") => {
        const index = (color === "red") ? "0" : (color === "green") ? "1" : (color === "blue") ? "2" : null;
        playSound("select", isSoundEnabled);
        if (!activeColorPicker || !index) return;

        windowColor[activeColorPicker][index] = parseInt(e.target.value, 10);
        dispatch({ type: "SET_WINDOW_COLOR", payload: windowColor });
        localStorage.setItem("windowColor", JSON.stringify(windowColor));
    }

    return (
        <>
            {activeColorPicker && <div onClick={dismissHandler} className="absolute w-full h-full top-0 left-0 bottom-0 right-0"></div>}
            <ContentBox data-label="configColorPreview" className={`${styles.colorPicker} w-[14rem] h-[5rem] relative`}>
                <div>
                    <div className="flex justify-between absolute left-0 top-0 right-0 h-1/2">
                        <button onClick={() => onClickHandler("topLeft")} onMouseEnter={() => playSound("select", isSoundEnabled)} className="w-1/2" data-active={activeColorPicker === "topLeft"} />
                        <button onClick={() => onClickHandler("topRight")} onMouseEnter={() => playSound("select", isSoundEnabled)} className="w-1/2" data-active={activeColorPicker === "topRight"} />
                    </div>
                    <div className="flex justify-between absolute left-0 bottom-0 right-0 h-1/2">
                        <button onClick={() => onClickHandler("bottomLeft")} onMouseEnter={() => playSound("select", isSoundEnabled)} className="w-1/2" data-active={activeColorPicker === "bottomLeft"} />
                        <button onClick={() => onClickHandler("bottomRight")} onMouseEnter={() => playSound("select", isSoundEnabled)} className="w-1/2" data-active={activeColorPicker === "bottomRight"} />
                    </div>
                </div>
                {activeColorPicker && RGBPreview}
                {activeColorPicker && <div className={styles.RGBReset} data-active={!isDefaultWindowColor} onClick={onResetClickHandler}><ContentBox data-label="reset"><span className="font-glyph" data-sprite="reset-icon"></span></ContentBox></div>}
                {activeColorPicker && RGBSliders}
            </ContentBox>
        </>
    );
};

export default BGColorPicker;
