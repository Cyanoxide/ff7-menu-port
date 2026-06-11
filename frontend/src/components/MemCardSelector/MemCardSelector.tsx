
import styles from "./MemCardSelector.module.scss";
import MemCardLoadingBar from "../../components/MemCardLoadingBar/MemCardLoadingBar";
import History from "../../pages/History/History";

import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { useEffect, useState } from "react";
import { useCursorNav } from "../../hooks/useCursorNav";
import educationJSON from "../../data/education.json";
import historyJSON from "../../data/history.json";
import type { HistoryType } from "../../context/types";

const MIN_SAVE_SLOTS = 3;
const OPTIONS = ["work", "education"];

const MemCardSelector = () => {
    const { isSoundEnabled } = useContext();
    const [memoryCardLoaded, setMemoryCardLoaded] = useState(false);
    const [optionSelected, setOptionSelected] = useState(false);
    const [selectedHistoryType, setSelectedHistoryType] = useState("work");
    const [memoryCardProgress, setMemoryCardProgress] = useState(0);

    const isLoading = optionSelected && memoryCardProgress <= 100;
    const isListShown = optionSelected && memoryCardProgress > 100;

    const historyItems = (selectedHistoryType === "education") ? (educationJSON as HistoryType[]) : (historyJSON as HistoryType[]);
    const saveSlotCount = Math.max(MIN_SAVE_SLOTS, historyItems.length);

    const onClickHandler = (historyType: string) => {
        if (!memoryCardLoaded) {
            playSound("error", isSoundEnabled);
            return;
        }
        playSound("select", isSoundEnabled);
        setOptionSelected(true);
        setSelectedHistoryType(historyType)

    }

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "options", size: OPTIONS.length, isDisabled: () => !memoryCardLoaded },
            { id: "saves", size: saveSlotCount },
        ],
        initial: { group: "options", index: 0 },
        enabled: true,
        resolveMove: (current, dir, { wrap }) => {
            if (isLoading || (dir !== "up" && dir !== "down")) return null;
            const delta = (dir === "down") ? 1 : -1;
            if (current.group === "options" && !optionSelected) {
                return { group: "options", index: wrap(current.index, delta, OPTIONS.length) };
            }
            if (current.group === "saves" && isListShown) {
                return { group: "saves", index: wrap(current.index, delta, saveSlotCount) };
            }
            return null;
        },
        resolvePageJump: (current, dir) => {
            if (current.group !== "saves" || !isListShown) return null;
            return { group: "saves", index: (dir === "pageUp") ? 0 : saveSlotCount - 1 };
        },
        onFocus: () => { },
        onConfirm: (current) => {
            if (isLoading) return;
            if (current.group === "options" && !optionSelected) {
                onClickHandler(OPTIONS[current.index]);
                return;
            }
            if (current.group === "saves" && isListShown) {
                const item = historyItems[current.index];
                if (item) {
                    playSound("saveSelect", isSoundEnabled);
                    window.open(item.link, "_blank");
                } else {
                    playSound("error", isSoundEnabled);
                }
            }
        },
        onCancel: () => {
            if (isLoading) return true;
            if (isListShown) {
                playSound("back", isSoundEnabled);
                setOptionSelected(false);
                setMemoryCardProgress(0);
                setPosSilently({ group: "options", index: 0 });
                return true;
            }
            return false;
        },
    });

    useEffect(() => {
        setTimeout(() => {
            setMemoryCardLoaded(true);
        }, 800);
    }, []);

    // Move the cursor onto the save list once the memory card has loaded it
    useEffect(() => {
        if (isListShown && pos?.group !== "saves") {
            setPosSilently({ group: "saves", index: 0 });
        }
    }, [isListShown]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            {!optionSelected && <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="MemCardHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Select a Save Data File.")}</ContentBox>
            </div>}
            {!optionSelected && <ContentBox data-label="memCardSelector" className="absolute z-1 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <ul className={`${styles.historyOptions} flex flex-col items-center gap-1`}>
                    {OPTIONS.map((option, index) => (
                        <li key={option} className="w-full flex justify-center mr-1" data-focused={isFocused("options", index) && memoryCardLoaded} onMouseEnter={() => focus({ group: "options", index })} onClick={() => { onClickHandler(option) }}>
                            <button>{textToSprite(option.charAt(0).toUpperCase() + option.slice(1), undefined, memoryCardLoaded ? "white" : "grey")}</button>
                        </li>
                    ))}
                </ul>
            </ContentBox>}

            {isLoading && <MemCardLoadingBar memoryCardProgress={memoryCardProgress} setMemoryCardProgress={setMemoryCardProgress} />}
            {isListShown && <History historyType={selectedHistoryType} focusedIndex={pos?.group === "saves" ? pos.index : null} onItemEnter={(index) => focus({ group: "saves", index })} onEmptyClick={() => playSound("error", isSoundEnabled)} />}
        </>
    );
};

export default MemCardSelector;
