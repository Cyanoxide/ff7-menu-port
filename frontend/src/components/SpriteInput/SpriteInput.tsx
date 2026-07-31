import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { stripUnsupported, wrapWithOffsets } from "./spriteText";

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
    /** Lets the page focus the field, e.g. when the menu cursor confirms on it */
    inputRef?: React.RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>;
}

const SpriteInput: React.FC<SpriteInputProps> = ({
    value, onChange, cols, maxLength, multiline, rows = 4, placeholder, label, name, type = "text", invalid, inputRef,
}) => {
    const { isSoundEnabled } = useContext();
    const ownRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const fieldRef = inputRef ?? ownRef;
    const viewRef = useRef<HTMLDivElement>(null);
    const caretRef = useRef<HTMLSpanElement>(null);
    const [focused, setFocused] = useState(false);
    const [caret, setCaret] = useState(0);
    // How far the painted text is pushed out of view to keep the caret on screen
    const [scroll, setScroll] = useState({ x: 0, y: 0 });

    // The caret follows the real field's selection, so it lands where editing
    // will actually happen rather than always at the end
    const syncCaret = useCallback(() => {
        const field = fieldRef.current;
        if (field) setCaret(field.selectionStart ?? field.value.length);
    }, [fieldRef]);

    useEffect(() => {
        if (focused) syncCaret();
    }, [value, focused, syncCaret]);

    /**
     * Keeps the caret in view. The sprite font sets every glyph nowrap and the
     * painted text is plain spans, so a long value simply runs out of the box
     * and over whatever sits next to it — the field has to do its own scrolling
     * rather than relying on the real control's, which is invisible.
     *
     * A layout effect, not an effect: measuring and shifting after paint shows
     * the text in the wrong place for a frame on every keystroke.
     */
    useLayoutEffect(() => {
        const view = viewRef.current;
        const mark = caretRef.current;

        if (!view || !mark) {
            setScroll((current) => (current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 }));
            return;
        }

        setScroll((current) => {
            // Keep a glyph's worth of room ahead of the caret so the character
            // being typed is visible rather than flush against the edge
            const margin = 28;
            // Both are measured against .track, which is the offset parent
            const row = mark.parentElement;
            const left = mark.offsetLeft;

            let { x, y } = current;
            if (left - x > view.clientWidth - margin) x = left - view.clientWidth + margin;
            if (left - x < 0) x = left;

            // Scrolled by whole rows rather than by the caret, so a half-cut
            // line never shows at the top or bottom of the window
            const top = row?.offsetTop ?? 0;
            const height = row?.offsetHeight ?? view.clientHeight;
            if (top - y > view.clientHeight - height) y = top - view.clientHeight + height;
            if (top - y < 0) y = top;

            x = Math.max(0, x);
            y = Math.max(0, y);

            return x === current.x && y === current.y ? current : { x, y };
        });
    }, [value, caret, focused]);

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
                        <span ref={caretRef} className={styles.caret} aria-hidden="true" />
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
        >
            <div
                ref={viewRef}
                className={styles.text}
                aria-hidden="true"
                // Multiline is a fixed window that the track scrolls inside, so
                // the panel does not grow as the message is typed
                style={{ height: multiline ? `calc(${rows} * var(--sprite-line))` : "var(--sprite-line)" }}
            >
                <div
                    className={styles.track}
                    style={{ transform: `translate(${-scroll.x}px, ${-scroll.y}px)` }}
                >
                    {value.length === 0 && !focused && placeholder
                        ? <span className={styles.placeholder}>{textToSprite(placeholder)}</span>
                        : lines.map(renderLine)}
                </div>
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
