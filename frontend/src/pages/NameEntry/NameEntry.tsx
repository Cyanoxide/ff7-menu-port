import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";
import { defaultUserName } from "../../context/defaults";
import partyMemberJSON from "../../data/partyMember.json";
import type { PartyMemberType } from "../../context/types";

import ContentBox from "../../components/ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import styles from "./NameEntry.module.scss";

// Longest name that fits the FF7 name-entry slots
const MAX_LENGTH = 11;
const COLS = 10;

// On-screen keyboard, laid out to mirror the FF7 naming screen. The final
// lowercase row is short, leaving two empty (non-navigable) cells at its end.
const KEY_ROWS: (string | null)[][] = [
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
    ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"],
    ["U", "V", "W", "X", "Y", "Z", ",", ".", "+", "-"],
    ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    ["k", "l", "m", "n", "o", "p", "q", "r", "s", "t"],
    ["u", "v", "w", "x", "y", "z", ":", ";", null, null],
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
];
const ROWS = KEY_ROWS.length;

const CONTROLS = ["Space", "Delete", "Select", "Default"];

const cellAt = (row: number, col: number): string | null =>
    (row >= 0 && row < ROWS && col >= 0 && col < COLS) ? KEY_ROWS[row][col] : null;

// Column indices that hold a key on a given row (skips the empty tail cells)
const rowCols = (row: number): number[] =>
    KEY_ROWS[row].map((ch, col) => (ch !== null ? col : -1)).filter((col) => col >= 0);

function NameEntry() {
    const { isSoundEnabled, userName, dispatch } = useContext();
    const navigate = useNavigate();
    const partyMember = (partyMemberJSON as PartyMemberType[])[0];

    const [name, setName] = useState(userName || defaultUserName);

    const appendChar = (ch: string | null) => {
        if (ch === null) return;
        if (name.length >= MAX_LENGTH) {
            playSound("error", isSoundEnabled);
            return;
        }
        playSound("select", isSoundEnabled);
        setName(name + ch);
    };

    const deleteChar = () => {
        if (!name.length) {
            playSound("error", isSoundEnabled);
            return;
        }
        playSound("select", isSoundEnabled);
        setName(name.slice(0, -1));
    };

    const restoreDefault = () => {
        playSound("select", isSoundEnabled);
        setName(defaultUserName);
    };

    const confirmName = () => {
        const finalName = name.trim() || defaultUserName;
        playSound("select", isSoundEnabled);
        dispatch({ type: "SET_USER_NAME", payload: finalName });
        localStorage.setItem("userName", finalName);
        markKeyboardNavigation();
        navigate("/");
    };

    const runControl = (index: number) => {
        if (index === 0) appendChar(" ");
        else if (index === 1) deleteChar();
        else if (index === 2) confirmName();
        else restoreDefault();
    };

    const goBack = () => {
        playSound("back", isSoundEnabled);
        markKeyboardNavigation();
        navigate("/");
    };

    const { focus, isFocused } = useCursorNav({
        groups: [
            { id: "keys", size: ROWS * COLS, isDisabled: (index) => cellAt(Math.floor(index / COLS), index % COLS) === null },
            { id: "controls", size: CONTROLS.length },
        ],
        initial: null,
        fallback: { group: "keys", index: 0 },
        enabled: true,
        resolveMove: (current, dir, { wrap }) => {
            if (current.group === "controls") {
                if (dir === "up") return { group: "controls", index: wrap(current.index, -1, CONTROLS.length) };
                if (dir === "down") return { group: "controls", index: wrap(current.index, 1, CONTROLS.length) };
                if (dir === "left") {
                    // Step back onto the rightmost key of the matching row
                    const row = Math.min(current.index, ROWS - 1);
                    const cols = rowCols(row);
                    return { group: "keys", index: row * COLS + cols[cols.length - 1] };
                }
                return null;
            }

            const row = Math.floor(current.index / COLS);
            const col = current.index % COLS;

            if (dir === "left" || dir === "right") {
                const cols = rowCols(row);
                const pos = cols.indexOf(col);
                if (dir === "right" && pos === cols.length - 1) {
                    return { group: "controls", index: Math.min(row, CONTROLS.length - 1) };
                }
                const nextPos = wrap(pos, dir === "right" ? 1 : -1, cols.length);
                return { group: "keys", index: row * COLS + cols[nextPos] };
            }

            // Vertical: walk rows in the chosen direction, skipping empty cells
            const step = dir === "up" ? -1 : 1;
            let nextRow = row;
            for (let i = 0; i < ROWS; i++) {
                nextRow = (nextRow + step + ROWS) % ROWS;
                if (cellAt(nextRow, col) !== null) return { group: "keys", index: nextRow * COLS + col };
            }
            return null;
        },
        onFocus: () => { },
        onConfirm: (current) => {
            if (current.group === "controls") runControl(current.index);
            else appendChar(cellAt(Math.floor(current.index / COLS), current.index % COLS));
        },
    });

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="nameHeader" className="h-full absolute top-0 left-0 right-0">
                    {textToSprite("Please enter a name.")}
                </ContentBox>
                <div className={`${styles.close} absolute`} onClick={goBack}>
                    <ContentBox data-label="nameClose" className={styles.closeBox}>
                        {textToSprite("X")}
                    </ContentBox>
                </div>
            </div>
            <ContentBox data-label="namePreview" className={styles.preview}>
                <img src={partyMember.image_path} alt="Party Member Portrait" width={145} className={`object-contain ${styles.portrait}`} />
                {/* Fixed M-width slots, each underlined by a stretched underscore */}
                <div className={styles.nameSlots}>
                    {Array.from({ length: MAX_LENGTH }).map((_, i) => {
                        const ch = name[i];
                        // The slot the next typed glyph will fill has a grey underscore; all others are white
                        const isActive = i === name.length;
                        return (
                            <span key={i} className={styles.slot}>
                                <span className={styles.underline} data-text-color={isActive ? "grey" : undefined}>
                                    <span className="font-glyph" data-sprite="_"></span>
                                </span>
                                {ch && ch !== " " && <span className={`font-glyph ${styles.slotChar}`} data-sprite={ch}></span>}
                            </span>
                        );
                    })}
                </div>
            </ContentBox>
            <div className={styles.body}>
                {/* right-side container box (visual only); the keyboard overlaps its edge */}
                <ContentBox data-label="nameControls" className={styles.controlsBox} />
                <ContentBox data-label="nameKeyboard" className={styles.keyboard}>
                    <div className={styles.keyGrid}>
                        {KEY_ROWS.map((row, r) => (
                            <div key={r} className={styles.keyRow}>
                                {row.map((ch, c) => (
                                    ch === null
                                        ? <span key={c} className={styles.key} />
                                        : <button
                                            key={c}
                                            className={styles.key}
                                            data-focused={isFocused("keys", r * COLS + c)}
                                            onMouseEnter={() => focus({ group: "keys", index: r * COLS + c })}
                                            onClick={() => appendChar(ch)}
                                        >
                                            {textToSprite(ch)}
                                        </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </ContentBox>
                {/* option list overlays the container box, in its own layer above the
                    keyboard so the option cursor's tail isn't clipped by it */}
                <div className={styles.controls}>
                    {CONTROLS.map((label, i) => (
                        <button
                            key={label}
                            className={styles.control}
                            data-focused={isFocused("controls", i)}
                            onMouseEnter={() => focus({ group: "controls", index: i })}
                            onClick={() => runControl(i)}
                        >
                            {textToSprite(label)}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

export default NameEntry;
