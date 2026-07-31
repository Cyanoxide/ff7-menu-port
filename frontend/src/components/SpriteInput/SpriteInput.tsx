import { useEffect, useMemo, useRef, useState } from "react";

import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";

import styles from "./SpriteInput.module.scss";

/**
 * A text field drawn in the sprite font.
 *
 * There is a real <input>/<textarea> underneath, transparent and stretched over
 * the whole field, and the visible text is spans painted from it. Everything
 * that makes a form field work — selection, paste, autofill, the mobile
 * keyboard, tabbing, screen readers — keeps working, and useCursorNav already
 * ignores key presses aimed at an editable element, so the menu's arrow keys do
 * not fight with typing.
 *
 * Drawing the glyphs and running our own key handling instead was the obvious
 * alternative and is a trap: it reimplements text editing badly and loses paste
 * on mobile entirely.
 */

/**
 * The sprite sheet's own characters, from font.css. Anything else has no glyph
 * and would render as a gap, so it is dropped on the way in rather than typed
 * into a hole. Note there is no double quote in the sheet.
 */
// eslint-disable-next-line no-useless-escape
const ALLOWED = /[^A-Za-z0-9 £_\-,;:!?.()\[\]{}@*\/\\'&#%`^+<=>|~$\n]/g;

export const stripUnsupported = (text: string) => text.replace(ALLOWED, "");

/**
 * Breaks text to a character budget, keeping each line's offset in the original
 * string so the caret can be placed on the right line. The sprite font sets
 * every glyph nowrap, so wrapping has to happen here rather than in CSS.
 */
export const wrapWithOffsets = (text: string, max: number): { text: string; start: number }[] => {
    const lines: { text: string; start: number }[] = [];

    for (const paragraph of text.split("\n")) {
        // Offset of this paragraph within the whole string
        const base = lines.length
            ? text.indexOf(paragraph, lines[lines.length - 1].start + lines[lines.length - 1].text.length)
            : 0;

        let line = "";
        let start = base;

        for (const word of paragraph.split(" ")) {
            const candidate = line ? `${line} ${word}` : word;

            if (candidate.length <= max) {
                line = candidate;
                continue;
            }

            if (line) {
                lines.push({ text: line, start });
                start += line.length + 1;
            }

            // A single word longer than the budget still has to go somewhere
            let rest = word;
            while (rest.length > max) {
                lines.push({ text: rest.slice(0, max), start });
                start += max;
                rest = rest.slice(max);
            }
            line = rest;
        }

        lines.push({ text: line, start });
    }

    return lines;
};

interface SpriteInputProps {
    value: string;
    onChange: (value: string) => void;
    /** Characters that fit across the field; also the wrap budget when multiline */
    cols: number;
    maxLength: number;
    /** Renders a textarea rather than an input */
    multiline?: boolean;
    /** Visible lines when multiline */
    rows?: number;
    /** Shown dimmed while the field is empty */
    placeholder?: string;
    label: string;
    name: string;
    type?: "text" | "email";
    invalid?: boolean;
}

const SpriteInput: React.FC<SpriteInputProps> = ({
    value, onChange, cols, maxLength, multiline, rows = 4, placeholder, label, name, type = "text", invalid,
}) => {
    const { isSoundEnabled } = useContext();
    const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const [focused, setFocused] = useState(false);
    const [caret, setCaret] = useState(0);

    // The caret follows the real field's selection, so it lands where editing
    // will actually happen rather than always at the end
    const syncCaret = () => {
        const field = fieldRef.current;
        if (field) setCaret(field.selectionStart ?? field.value.length);
    };

    useEffect(() => {
        if (focused) syncCaret();
    }, [value, focused]);

    const lines = useMemo(
        () => (multiline ? wrapWithOffsets(value, cols) : [{ text: value, start: 0 }]),
        [value, cols, multiline],
    );

    const handleChange = (next: string) => {
        const cleaned = stripUnsupported(multiline ? next : next.replace(/\n/g, "")).slice(0, maxLength);
        if (cleaned.length > value.length) playSound("select", isSoundEnabled);
        onChange(cleaned);
    };

    /** Splits a line around the caret so it can be drawn between the glyphs */
    const renderLine = (line: { text: string; start: number }, index: number) => {
        const isLast = index === lines.length - 1;
        const end = line.start + line.text.length;
        const showCaret = focused && caret >= line.start && (caret <= end || (isLast && caret >= end));
        const at = Math.max(0, Math.min(line.text.length, caret - line.start));

        return (
            <span key={index} className={styles.line}>
                {showCaret ? (
                    <>
                        {textToSprite(line.text.slice(0, at))}
                        <span className={styles.caret} aria-hidden="true" />
                        {textToSprite(line.text.slice(at))}
                    </>
                ) : (
                    // A blank line still needs to occupy its row
                    textToSprite(line.text) ?? <span className={styles.blank} />
                )}
            </span>
        );
    };

    return (
        <div
            className={styles.field}
            data-focused={focused}
            data-invalid={invalid}
            data-multiline={multiline}
            style={multiline ? { minHeight: `calc(${rows} * var(--sprite-line))` } : undefined}
        >
            <div className={styles.text} aria-hidden="true">
                {value.length === 0 && !focused && placeholder
                    ? <span className={styles.placeholder}>{textToSprite(placeholder)}</span>
                    : lines.map(renderLine)}
            </div>

            {multiline ? (
                <textarea
                    ref={fieldRef}
                    className={styles.input}
                    name={name}
                    aria-label={label}
                    value={value}
                    maxLength={maxLength}
                    spellCheck={false}
                    onChange={(event) => handleChange(event.target.value)}
                    onSelect={syncCaret}
                    onKeyUp={syncCaret}
                    onClick={syncCaret}
                    onFocus={() => { setFocused(true); syncCaret(); }}
                    onBlur={() => setFocused(false)}
                />
            ) : (
                <input
                    ref={fieldRef}
                    className={styles.input}
                    name={name}
                    type={type}
                    aria-label={label}
                    value={value}
                    maxLength={maxLength}
                    spellCheck={false}
                    autoComplete={type === "email" ? "email" : "name"}
                    onChange={(event) => handleChange(event.target.value)}
                    onSelect={syncCaret}
                    onKeyUp={syncCaret}
                    onClick={syncCaret}
                    onFocus={() => { setFocused(true); syncCaret(); }}
                    onBlur={() => setFocused(false)}
                />
            )}
        </div>
    );
};

export default SpriteInput;
