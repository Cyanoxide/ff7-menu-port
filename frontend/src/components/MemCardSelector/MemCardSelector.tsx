
import styles from "./MemCardSelector.module.scss";
import MemCardLoadingBar from "../../components/MemCardLoadingBar/MemCardLoadingBar";
import History from "../../pages/History/History";

import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";
import { elementUnderPointer } from "../../util/pointerActivity";
import educationJSON from "../../data/education.json";
import historyJSON from "../../data/history.json";
import type { HistoryType } from "../../context/types";

const MIN_SAVE_SLOTS = 3;
const OPTIONS = ["work", "education"];

/**
 * How long a ContentBox takes to fade in — 0.25s, after a 0.2s delay. The save
 * rows' cursor is a ::before on the row rather than on the box, so it does not
 * fade with it and would otherwise sit over an empty panel for that beat.
 */
const CONTENT_FADE_MS = 450;

const MemCardSelector = () => {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();
    const [memoryCardLoaded, setMemoryCardLoaded] = useState(false);
    const [optionSelected, setOptionSelected] = useState(false);
    const [selectedHistoryType, setSelectedHistoryType] = useState("work");
    const [memoryCardProgress, setMemoryCardProgress] = useState(0);
    const [savesRevealed, setSavesRevealed] = useState(false);

    const isLoading = optionSelected && memoryCardProgress <= 100;
    const isListShown = optionSelected && memoryCardProgress > 100;

    const historyItems = (selectedHistoryType === "education") ? (educationJSON as HistoryType[]) : (historyJSON as HistoryType[]);
    const saveSlotCount = Math.max(MIN_SAVE_SLOTS, historyItems.length);

    // Whether the option was picked with the mouse. A keyboard pick should land
    // on the first save whatever the mouse happens to be resting over.
    const pickedByMouse = useRef(false);

    const onClickHandler = (historyType: string, viaMouse = false) => {
        if (!memoryCardLoaded) {
            playSound("error", isSoundEnabled);
            return;
        }
        pickedByMouse.current = viaMouse;
        playSound("select", isSoundEnabled);
        setOptionSelected(true);
        setSelectedHistoryType(historyType)

    }

    /**
     * Which save row the pointer is already sitting on, if any.
     *
     * The list opens centred on where the options were, so the pointer is very
     * often inside a row the moment it appears — usually the second. No
     * mouseenter fires for that, because the content moved rather than the
     * mouse, so the cursor sat on the first row while a click would have opened
     * the second. Reading the pointer's position directly is the only way to
     * reconcile the two without making the user jiggle the mouse.
     */
    const slotUnderPointer = (): number | null => {
        if (!pickedByMouse.current) return null;
        const slot = elementUnderPointer()?.closest("[data-slot]");
        const index = slot ? Number(slot.getAttribute("data-slot")) : NaN;
        return Number.isInteger(index) ? index : null;
    };

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "options", size: OPTIONS.length, isDisabled: () => !memoryCardLoaded },
            { id: "saves", size: saveSlotCount },
            { id: "close", size: 1 },
        ],
        // Work starts under the cursor, as the first option. The row only draws
        // the cursor once the card has finished loading, so it appears with the
        // options rather than before them.
        initial: { group: "options", index: 0 },
        fallback: isLoading ? undefined : (isListShown ? { group: "saves", index: 0 } : { group: "options", index: 0 }),
        enabled: true,
        resolveMove: (current, dir) => {
            if (isLoading || (dir !== "up" && dir !== "down")) return null;
            if (current.group === "close") {
                const group = isListShown ? "saves" : "options";
                const size = isListShown ? saveSlotCount : OPTIONS.length;
                return { group, index: (dir === "down") ? 0 : size - 1 };
            }
            if (current.group === "options" && !optionSelected) {
                if (dir === "up" && current.index === 0) return { group: "close", index: 0 };
                if (dir === "down" && current.index === OPTIONS.length - 1) return { group: "close", index: 0 };
                return { group: "options", index: current.index + ((dir === "down") ? 1 : -1) };
            }
            if (current.group === "saves" && isListShown) {
                if (dir === "up" && current.index === 0) return { group: "close", index: 0 };
                if (dir === "down" && current.index === saveSlotCount - 1) return { group: "close", index: 0 };
                return { group: "saves", index: current.index + ((dir === "down") ? 1 : -1) };
            }
            return null;
        },
        resolvePageJump: (current, dir) => {
            if (current.group !== "saves" || !isListShown) return null;
            return { group: "saves", index: (dir === "pageUp") ? 0 : saveSlotCount - 1 };
        },
        onFocus: (current) => {
            closeNav.setFocus(current.group === "close");
        },
        onConfirm: (current) => {
            if (isLoading) return;
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                markKeyboardNavigation();
                navigate("/");
                return;
            }
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
                setPosSilently(pos ? { group: "options", index: 0 } : null);
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

    useEffect(() => () => closeNav.setFocus(false), []);

    // Hold the cursor back until the save rows have finished fading in, the way
    // the option rows already wait on memoryCardLoaded
    useEffect(() => {
        if (!isListShown) {
            setSavesRevealed(false);
            return;
        }
        const timer = setTimeout(() => setSavesRevealed(true), CONTENT_FADE_MS);
        return () => clearTimeout(timer);
    }, [isListShown]);

    // If keyboard navigation was in progress, move the cursor onto the save
    // list once the memory card has loaded it (mouse flows keep no cursor)
    useEffect(() => {
        if (isListShown && pos && pos.group !== "saves") {
            setPosSilently({ group: "saves", index: slotUnderPointer() ?? 0 });
        }
    }, [isListShown]); // eslint-disable-line react-hooks/exhaustive-deps

    const headerText = isListShown
        ? "Select a file."
        : isLoading ? "Checking Save Data File." : "Select a Save Data File.";

    return (
        <>
            {/* One header box across all three states. Each state used to render
                its own, so selecting an option unmounted the previous box and
                mounted a new one — the bar faded out and back in at every step
                rather than just changing its text. */}
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="MemCardHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite(headerText)}</ContentBox>
                {isListShown && <ContentBox data-label="historyFileLabel" className="h-full w-[225px] absolute top-0 right-[280px] flex">{textToSprite("FILE", false, "yellow")}{textToSprite((selectedHistoryType !== "education") ? " 01" : " 02")}</ContentBox>}
            </div>

            {!optionSelected && <ContentBox data-label="memCardSelector" className="absolute z-1 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <ul className={`${styles.historyOptions} flex flex-col items-center gap-1`}>
                    {OPTIONS.map((option, index) => (
                        <li key={option} className="w-full flex justify-center mr-1" data-focused={isFocused("options", index) && memoryCardLoaded} onMouseEnter={() => focus({ group: "options", index })} onClick={() => { onClickHandler(option, true) }}>
                            <button>{textToSprite(option.charAt(0).toUpperCase() + option.slice(1), undefined, memoryCardLoaded ? "white" : "grey")}</button>
                        </li>
                    ))}
                </ul>
            </ContentBox>}

            {isLoading && <MemCardLoadingBar memoryCardProgress={memoryCardProgress} setMemoryCardProgress={setMemoryCardProgress} />}
            {isListShown && <History historyType={selectedHistoryType} focusedIndex={savesRevealed && pos?.group === "saves" ? pos.index : null} onItemEnter={(index) => focus({ group: "saves", index })} onEmptyClick={() => playSound("error", isSoundEnabled)} />}
        </>
    );
};

export default MemCardSelector;
