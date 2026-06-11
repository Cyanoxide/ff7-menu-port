import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";
import type { WindowCorner } from "../../context/types";

import ContentBox from "../../components/ContentBox/ContentBox";
import BGColorPicker from "../../components/BGColorPicker/BGColorPicker";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";
import styles from "./Config.module.scss";

const CORNERS: WindowCorner[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];

const ROW_DESCRIPTIONS: Record<string, string> = {
    corners: "Select colours for the window",
    sound: "Enable or disable Sound",
    crt: "Enable or disable CRT Effects",
};

function ConfigContent() {
    const { dispatch, isSoundEnabled, isCRTEnabled } = useContext();
    const navigate = useNavigate();
    const [windowDescription, setWindowDescription] = useState("");
    const [activeColorPicker, setActiveColorPicker] = useState<WindowCorner | null>(null);
    const [pickerOpenedByKeyboard, setPickerOpenedByKeyboard] = useState(false);

    const openColorPicker = (corner: WindowCorner, viaKeyboard: boolean = false) => {
        playSound("select", isSoundEnabled);
        setPickerOpenedByKeyboard(viaKeyboard);
        setActiveColorPicker(corner);
    };

    const setSoundEnabled = (value: boolean) => {
        playSound("select", isSoundEnabled || value);
        dispatch({ type: "SET_IS_SOUND_ENABLED", payload: value });
        localStorage.setItem("isSoundEnabled", JSON.stringify(value));
    };

    const setCRTEnabled = (value: boolean) => {
        playSound("select", isSoundEnabled);
        dispatch({ type: "SET_IS_CRT_ENABLED", payload: value });
        localStorage.setItem("isCRTEnabled", JSON.stringify(value));
    };

    const { focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "corners", size: CORNERS.length },
            { id: "sound", size: 2 },
            { id: "crt", size: 2 },
            { id: "close", size: 1 },
        ],
        initial: null,
        fallback: { group: "corners", index: 0 },
        enabled: !activeColorPicker,
        resolveMove: (current, dir, { wrap }) => {
            if (current.group === "close") {
                if (dir === "down") return { group: "corners", index: 0 };
                if (dir === "up") return { group: "crt", index: 0 };
                return null;
            }

            const column = current.index % 2;

            if (dir === "left" || dir === "right") {
                if (current.group === "corners") {
                    const rowStart = current.index - column;
                    return { group: "corners", index: rowStart + (1 - column) };
                }
                return { group: current.group, index: wrap(current.index, dir === "right" ? 1 : -1, 2) };
            }

            if (dir === "down") {
                if (current.group === "corners" && current.index < 2) return { group: "corners", index: current.index + 2 };
                if (current.group === "corners") return { group: "sound", index: column };
                if (current.group === "sound") return { group: "crt", index: column };
                return { group: "close", index: 0 };
            }

            // up
            if (current.group === "corners" && current.index >= 2) return { group: "corners", index: current.index - 2 };
            if (current.group === "corners") return { group: "close", index: 0 };
            if (current.group === "sound") return { group: "corners", index: column + 2 };
            return { group: "sound", index: column };
        },
        onFocus: (current) => {
            closeNav.setFocus(current.group === "close");
            setWindowDescription(ROW_DESCRIPTIONS[current.group] ?? "");
        },
        onConfirm: (current) => {
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                setPosSilently(null);
                navigate("/");
                return;
            }
            if (current.group === "corners") {
                openColorPicker(CORNERS[current.index], true);
            } else if (current.group === "sound") {
                setSoundEnabled(current.index === 0);
            } else {
                setCRTEnabled(current.index === 0);
            }
        },
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    const toggleOption = (groupId: "sound" | "crt", stateValue: boolean, title: string, activate: (value: boolean) => void, onText: string = "On", offText: string = "Off") => (
        <li className={`${styles.optionToggle} ml-24 mb-8 flex`} onMouseEnter={() => setWindowDescription(ROW_DESCRIPTIONS[groupId])}>
            <div className="w-[24rem] flex items-end pb-1">{textToSprite(title, false, "blue")}</div>
            <div className="w-[18rem] flex justify-between">
                <button data-disabled={!stateValue} data-focused={isFocused(groupId, 0)} onMouseEnter={() => focus({ group: groupId, index: 0 })} onClick={() => activate(true)}>{textToSprite(onText)}</button>
                <button data-disabled={stateValue} data-focused={isFocused(groupId, 1)} onMouseEnter={() => focus({ group: groupId, index: 1 })} onClick={() => activate(false)}>{textToSprite(offText)}</button>
            </div>
        </li >
    );

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="configHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite(windowDescription)}</ContentBox>
            </div>
            <ContentBox data-label="configBody" className="h-[45.1rem]">
                <ul>
                    <li className="ml-24 mb-8 flex" onMouseEnter={() => setWindowDescription(ROW_DESCRIPTIONS.corners)}>
                        <div className="w-[24rem] flex items-end pb-1">{textToSprite("Window Color", false, "blue")}</div>
                        <BGColorPicker
                            activeColorPicker={activeColorPicker}
                            setActiveColorPicker={setActiveColorPicker}
                            focusSlidersOnOpen={pickerOpenedByKeyboard}
                            focusedCorner={!activeColorPicker ? CORNERS.find((_, index) => isFocused("corners", index)) ?? null : null}
                            onCornerEnter={(corner) => focus({ group: "corners", index: CORNERS.indexOf(corner) })}
                            onCornerClick={(corner) => openColorPicker(corner, false)}
                        />
                    </li>
                    {toggleOption("sound", isSoundEnabled, "Sound", setSoundEnabled)}
                    {toggleOption("crt", isCRTEnabled, "CRT Effect", setCRTEnabled)}
                </ul>
            </ContentBox>
        </>
    );
}

export default ConfigContent;
