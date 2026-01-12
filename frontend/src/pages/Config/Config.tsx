import { useState } from "react";
import { useContext } from "../../context/context";
import type { Action } from "../../context/types";

import ContentBox from "../../components/ContentBox/ContentBox";
import BGColorPicker from "../../components/BGColorPicker/BGColorPicker";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import styles from "./Config.module.scss";

function ConfigContent() {
    const { dispatch, isSoundEnabled, isCRTEnabled } = useContext();
    const [windowDescription, setWindowDescription] = useState("");

    const onMouseEnter = (description: string) => {
        setWindowDescription(description);
    };

    const onMouseLeave = () => {
        setWindowDescription("");
    };

    const createToggleOption = (stateValue: boolean, title: string, desc: string, varName: string, action: Action, onText: string = "On", offText: string = "Off") => {
        const callback = (stateValue: boolean) => {
            playSound("select", isSoundEnabled);
            dispatch(action);
            localStorage.setItem(varName, JSON.stringify(stateValue));
        }

        return (
            <li className={`${styles.optionToggle} ml-24 mb-8 flex`} onMouseEnter={() => onMouseEnter(desc)} onMouseLeave={onMouseLeave}>
                <div className="w-[24rem] flex items-end pb-1">{textToSprite(title, false, "blue")}</div>
                <div className="w-[18rem] flex justify-between">
                    <button data-disabled={!stateValue} onMouseEnter={() => playSound("select", isSoundEnabled)} onClick={() => callback(true)}>{textToSprite(onText)}</button>
                    <button data-disabled={stateValue} onMouseEnter={() => playSound("select", isSoundEnabled)} onClick={() => callback(false)}>{textToSprite(offText)}</button>
                </div>
            </li >
        )
    }

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="configHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite(windowDescription)}</ContentBox>
            </div>
            <ContentBox data-label="configBody" className="h-[45.1rem]">
                <ul>
                    <li className="ml-24 mb-8 flex" onMouseEnter={() => onMouseEnter("Select colours for the window")} onMouseLeave={onMouseLeave}>
                        <div className="w-[24rem] flex items-end pb-1">{textToSprite("Window Color", false, "blue")}</div>
                        <BGColorPicker />
                    </li>
                    {createToggleOption(isSoundEnabled, "Sound", "Enable or disable Sound", "isSoundEnabled", { type: "SET_IS_SOUND_ENABLED", payload: !isSoundEnabled })}
                    {createToggleOption(isCRTEnabled, "CRT Effect", "Enable or disable CRT Effects", "isCRTEnabled", { type: "SET_IS_CRT_ENABLED", payload: !isCRTEnabled })}
                </ul>
            </ContentBox>
        </>
    );
}

export default ConfigContent;