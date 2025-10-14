import { useState } from "react";
import { useContext } from "../../context/context";

import ContentBox from "../ContentBox/ContentBox";
import BGColorPicker from "../BGColorPicker/BGColorPicker";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";

import styles from "./ConfigContent.module.scss";

function ConfigContent() {
    const { dispatch, isSoundEnabled } = useContext();
    const [windowDescription, setWindowDescription] = useState("");

    const onClickHandler = (isSoundEnabled: boolean) => {
        playSound("select", isSoundEnabled);

        dispatch({ type: "SET_IS_SOUND_ENABLED", payload: isSoundEnabled });
        localStorage.setItem("isSoundEnabled", JSON.stringify(isSoundEnabled));
    }

    const onMouseEnter = (description: string) => {
        setWindowDescription(description);
    }

    const onMouseLeave = () => {
        setWindowDescription("");
    }

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="configHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite(windowDescription)}</ContentBox>
            </div>
            <ContentBox data-label="configBody" className="h-[45.1rem]">
                <ul>
                    <li className="ml-24 mb-5 flex" onMouseEnter={() => onMouseEnter("Select colours for the window")} onMouseLeave={onMouseLeave}>
                        <div className="w-[24rem]">{textToSprite("Window Color", false, "blue")}</div>
                        <BGColorPicker />
                    </li>
                    <li className={`${styles.soundToggle} ml-24 mb-5 flex`} onMouseEnter={() => onMouseEnter("Enable or disable Sound")} onMouseLeave={onMouseLeave}>
                        <div className="w-[24rem]">{textToSprite("Sound", false, "blue")}</div>
                        <div className="w-[18rem] flex justify-between">
                            <button data-disabled={!isSoundEnabled} onMouseEnter={() => playSound("select", isSoundEnabled)} onClick={() => onClickHandler(true)}>{textToSprite("On")}</button>
                            <button data-disabled={isSoundEnabled} onMouseEnter={() => playSound("select", isSoundEnabled)} onClick={() => onClickHandler(false)}>{textToSprite("Off")}</button>
                        </div>
                    </li>
                </ul>{isSoundEnabled}
            </ContentBox>
        </>
    );
}

export default ConfigContent;