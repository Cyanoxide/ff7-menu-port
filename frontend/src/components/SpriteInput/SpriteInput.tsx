import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import Scrollbar from "../Scrollbar/Scrollbar";
import { glyphWidth, stripUnsupported, textWidth, wrapWithOffsets } from "./spriteText";

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
 * Which glyph draws the caret. The uppercase I is the narrowest upright in the
 * sheet at 7px, so it reads as a caret rather than as a letter someone typed.
 */
const CARET_GLYPH = "I";

/**
 * Keeps every autofill mechanism off these fields.
 *
 * The component used to opt *in* — autoComplete was set to "email" or "name"
 * from the type — and a dropdown appearing over the field, or a value arriving
 * without a keystroke, breaks the menu's flow: the cursor is somewhere the
 * value did not come from, and the painted glyphs and the real control briefly
 * disagree.
 *
 * The two data attributes are 1Password's and LastPass's opt-outs; neither
 * looks at autocomplete.
 */
const noAutofill = {
    autoComplete: "off",
    autoCorrect: "off",
    spellCheck: false,
    "data-1p-ignore": true,
    "data-lpignore": true,
} as const;

interface SpriteInputProps {
    value: string;
    onChange: (value: string) => void;

    maxLength: number;
    /** Renders a textarea rather than an input */
    multiline?: boolean;
    /** Visible lines when multiline */
    rows?: number;
    label: string;
    name: string;
    /*
     * There is deliberately no `type` here any more. Every field renders as
     * type="text": type="email" is the strongest trigger there is for the
     * browser's own autofill, and inputMode="email" made iOS abandon opening
     * the keyboard. Validity is checked by the page and again by the handler.
     */
    invalid?: boolean;
    /** The menu cursor is on this field's row, without it being typed into yet */
    selected?: boolean;
    /** Lets the page focus the field, e.g. when the menu cursor confirms on it */
    inputRef?: React.RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>;
}

const SpriteInput: React.FC<SpriteInputProps> = ({
    value, onChange, maxLength, multiline, rows = 4, label, name, invalid, selected, inputRef,
}) => {
    const { isSoundEnabled } = useContext();
    const ownRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const fieldRef = inputRef ?? ownRef;
    const viewRef = useRef<HTMLDivElement>(null);
    const caretRef = useRef<HTMLSpanElement>(null);
    const [focused, setFocused] = useState(false);
    /**
     * The real control's selection, mirrored so the painted text can draw it.
     * `caret` is the moving end — where a shift-arrow grows from — which is why
     * it is tracked separately rather than assumed to be `end`.
     */
    const [sel, setSel] = useState({ start: 0, end: 0, caret: 0 });
    const caret = sel.caret;
    /** Where a pointer drag started, so a move can extend from it */
    const dragFrom = useRef<number | null>(null);
    /**
     * The width the painted text has to wrap inside, measured rather than
     * assumed. The real control underneath wraps by width, so anything else
     * here puts the two out of step — a character budget had the sprite text
     * breaking at about two thirds of the box while the real textarea ran on to
     * the edge.
     */
    const [wrapWidth, setWrapWidth] = useState(0);
    // How far the painted text is pushed out of view to keep the caret on screen
    const [scroll, setScroll] = useState({ x: 0, y: 0 });

    // The caret follows the real field's selection, so it lands where editing
    // will actually happen rather than always at the end
    const syncCaret = useCallback(() => {
        const field = fieldRef.current;
        if (!field) return;
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        // "backward" means the caret is at the start of the range
        const caretAt = field.selectionDirection === "backward" ? start : end;
        setSel((current) =>
            current.start === start && current.end === end && current.caret === caretAt
                ? current
                : { start, end, caret: caretAt });
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
    /**
     * Measures the window the text wraps inside. offsetWidth, not
     * getBoundingClientRect: the app scales #root, so the rect is in scaled
     * pixels while every glyph width in the sheet is a design pixel, and mixing
     * the two makes the budget wrong by the scale factor.
     *
     * A ResizeObserver rather than a one-off, so a viewport change that
     * re-scales the layout re-wraps rather than keeping a stale budget.
     */
    useLayoutEffect(() => {
        const el = viewRef.current;
        if (!el) return;

        const measure = () => {
            // clientWidth includes the padding that reserves the scrollbar
            // gutter, so take it off — text wrapped to the padded width would
            // run underneath the bar.
            const cs = getComputedStyle(el);
            const inset = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            setWrapWidth(Math.max(0, el.clientWidth - inset));
        };
        measure();

        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

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

            /**
             * Only a single-line field scrolls sideways. A multiline one wraps,
             * so every line already fits and there is nothing to scroll to.
             *
             * This mattered the moment wrapping became width-based: lines now
             * reach the edge of the window, so the caret at the end of one
             * satisfied the test below and shifted the whole track left by the
             * margin — clipping the first character off every line at once. The
             * old character budget was conservative enough that no line ever
             * came close, which hid it.
             */
            if (multiline) {
                x = 0;
            } else {
                if (left - x > view.clientWidth - margin) x = left - view.clientWidth + margin;
                if (left - x < 0) x = left;
            }

            /**
             * Vertically, a multiline field scrolls *natively* rather than by
             * transform. Scrollbar measures scrollTop/scrollHeight on a real
             * scroller, so translating a track instead would leave it convinced
             * there was nothing to scroll and it would never appear.
             *
             * Still moved by whole rows, so a half-cut line never shows at the
             * top or bottom of the window.
             */
            const top = row?.offsetTop ?? 0;
            const height = row?.offsetHeight ?? view.clientHeight;
            if (multiline) {
                y = 0;
                if (top < view.scrollTop) view.scrollTop = top;
                else if (top + height > view.scrollTop + view.clientHeight) {
                    view.scrollTop = top + height - view.clientHeight;
                }
            } else {
                if (top - y > view.clientHeight - height) y = top - view.clientHeight + height;
                if (top - y < 0) y = top;
            }

            x = Math.max(0, x);
            y = Math.max(0, y);

            return x === current.x && y === current.y ? current : { x, y };
        });
    }, [value, caret, focused, multiline]);

    const lines = useMemo(
        () => (multiline && wrapWidth > 0
            ? wrapWithOffsets(value, wrapWidth)
            : [{ text: value, start: 0 }]),
        [value, wrapWidth, multiline],
    );

    const handleChange = (next: string) => {
        const cleaned = stripUnsupported(multiline ? next : next.replace(/\n/g, "")).slice(0, maxLength);
        if (cleaned.length > value.length) playSound("select", isSoundEnabled);
        onChange(cleaned);
    };

    /**
     * Which painted line a position in the value falls on.
     */
    const lineIndexOf = useCallback((pos: number) => {
        for (let i = lines.length - 1; i > 0; i--) {
            if (pos >= lines[i].start) return i;
        }
        return 0;
    }, [lines]);

    /** The character in a line nearest a horizontal offset, in design pixels. */
    const indexAtX = useCallback((line: { text: string; start: number }, x: number) => {
        let used = 0;
        for (let i = 0; i < line.text.length; i++) {
            const w = glyphWidth(line.text[i]);
            // past the middle of a glyph belongs to the gap after it
            if (x < used + w / 2) return line.start + i;
            used += w;
        }
        return line.start + line.text.length;
    }, []);

    /**
     * Where a pointer landed, as an index into the value.
     *
     * The real control cannot answer this. Its text is rendered in a 16px
     * system font — about 143px wide where the painted sprites span 325px — so
     * its own hit testing puts the caret roughly where the *invisible* text is,
     * and anything past the first half of what you can see lands at the end.
     * The mapping has to go through the same glyph widths that drew the text.
     */
    const indexFromPoint = useCallback((clientX: number, clientY: number) => {
        const view = viewRef.current;
        if (!view || lines.length === 0) return 0;

        const rect = view.getBoundingClientRect();
        // #root is transform-scaled to fit the viewport, so client pixels are
        // not design pixels; offsetWidth is unscaled and gives the ratio.
        const scale = view.offsetWidth ? rect.width / view.offsetWidth : 1;
        const styles = getComputedStyle(view);
        const lineHeight = parseFloat(styles.getPropertyValue("--sprite-line")) || 42;

        const x = (clientX - rect.left) / scale + (multiline ? 0 : scroll.x);
        const y = (clientY - rect.top) / scale + (multiline ? view.scrollTop : 0);

        const row = Math.max(0, Math.min(lines.length - 1, Math.floor(y / lineHeight)));
        return indexAtX(lines[row], x);
    }, [lines, multiline, scroll.x, indexAtX]);

    const select = useCallback((start: number, end = start, backward = false) => {
        const field = fieldRef.current;
        if (!field) return;
        try {
            field.setSelectionRange(start, end, backward ? "backward" : "forward");
        } catch {
            // Some input types refuse setSelectionRange; focus alone still works
        }
        syncCaret();
    }, [fieldRef, syncCaret]);

    /**
     * Place the caret where the pointer actually is.
     *
     * preventDefault stops the browser doing its own placement first, which it
     * would get wrong — see indexFromPoint. Focus then has to be taken by hand,
     * because preventing the default is what would otherwise have granted it.
     */
    const handlePointerDown = (event: React.PointerEvent) => {
        if (event.button !== 0) return;
        const field = fieldRef.current;
        if (!field) return;

        event.preventDefault();
        field.focus();
        const index = indexFromPoint(event.clientX, event.clientY);
        dragFrom.current = index;
        select(index);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent) => {
        if (dragFrom.current === null) return;
        const from = dragFrom.current;
        const to = indexFromPoint(event.clientX, event.clientY);
        select(Math.min(from, to), Math.max(from, to), to < from);
    };

    const endDrag = (event: React.PointerEvent) => {
        if (dragFrom.current === null) return;
        dragFrom.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    /** Double click selects the word under the pointer, as a text field should. */
    const handleDoubleClick = (event: React.MouseEvent) => {
        const index = indexFromPoint(event.clientX, event.clientY);
        const isWord = (ch: string) => /[A-Za-z0-9@._-]/.test(ch);
        if (!value[index] || !isWord(value[index])) return;
        let from = index;
        let to = index;
        while (from > 0 && isWord(value[from - 1])) from -= 1;
        while (to < value.length && isWord(value[to])) to += 1;
        select(from, to);
    };

    /**
     * Arrows move the caret; they only reach the menu when the caret cannot go
     * any further in that direction.
     *
     * That boundary rule is what lets one set of keys do both jobs. Taking
     * every arrow for navigation — which is what this did — left no way to move
     * through your own text; leaving them all to the field would strand the
     * cursor inside it.
     *
     * stopPropagation is the mechanism: useCursorNav listens on window, so an
     * event stopped here never reaches it, and one that is left alone does.
     */
    const handleKeyDown = (event: React.KeyboardEvent) => {
        const field = fieldRef.current;
        if (!field) return;
        const { key, shiftKey } = event;
        if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;

        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? start;
        const collapsed = start === end;

        if (key === "ArrowLeft" || key === "ArrowRight") {
            // A selection always collapses first, so it never escapes early
            const atEdge = collapsed && (key === "ArrowLeft" ? start === 0 : end === value.length);
            if (atEdge && !shiftKey) return;
            event.stopPropagation();
            return;
        }

        // Up and down step between the *painted* lines. A single-line field has
        // none, so they always mean "leave".
        if (!multiline) return;

        /*
         * Read the caret from the control, not from React state. The state is
         * a mirror kept up to date by onSelect, and a selection set in code
         * does not fire one — so anything that moves the caret without the user
         * touching it leaves the mirror stale, and this would then step from
         * the wrong line.
         */
        const here = field.selectionDirection === "backward" ? start : end;
        const row = lineIndexOf(here);
        if (key === "ArrowUp" ? row === 0 : row === lines.length - 1) return;

        event.preventDefault();
        event.stopPropagation();

        const column = textWidth(lines[row].text.slice(0, here - lines[row].start));
        const target = lines[row + (key === "ArrowUp" ? -1 : 1)];
        const next = indexAtX(target, column);

        if (shiftKey) {
            const anchor = here === start ? end : start;
            select(Math.min(anchor, next), Math.max(anchor, next), next < anchor);
        } else {
            select(next);
        }
    };

    /**
     * Draws one line: the glyphs, the selected run behind them, and the caret.
     *
     * The selection has to be painted here rather than left to the browser.
     * ::selection highlights the *real* control's text, which is transparent
     * and a different width, so a native highlight appears in the wrong place
     * and over nothing.
     */
    const renderLine = (line: { text: string; start: number }, index: number) => {
        const isLast = index === lines.length - 1;
        const lineEnd = line.start + line.text.length;
        const showCaret = focused && caret >= line.start
            && (caret <= lineEnd || (isLast && caret >= lineEnd));
        const caretAt = Math.max(0, Math.min(line.text.length, caret - line.start));

        const pieces: React.ReactNode[] = [];
        let run = "";
        let runSelected = false;
        let key = 0;

        const flush = () => {
            if (!run) return;
            const painted = textToSprite(run);
            pieces.push(runSelected
                ? <span key={key++} className={styles.selected}>{painted}</span>
                : <Fragment key={key++}>{painted}</Fragment>);
            run = "";
        };

        for (let i = 0; i <= line.text.length; i++) {
            if (showCaret && i === caretAt) {
                flush();
                pieces.push(
                    /*
                     * The sprite font's own "I" rather than a drawn rectangle,
                     * so the caret is made of the same pixels as the text it
                     * sits in. data-sprite is what font.css keys off.
                     */
                    <span
                        key={key++}
                        ref={caretRef}
                        className={`font-glyph ${styles.caret}`}
                        data-sprite={CARET_GLYPH}
                        aria-hidden="true"
                    />,
                );
            }
            if (i === line.text.length) break;

            const selected = line.start + i >= sel.start && line.start + i < sel.end;
            if (selected !== runSelected) {
                flush();
                runSelected = selected;
            }
            run += line.text[i];
        }
        flush();

        return (
            <span key={index} className={styles.line}>
                {/* An empty line still has to occupy its row */}
                {pieces.length ? pieces : <span className={styles.blank} />}
            </span>
        );
    };


    return (
        <div
            className={styles.field}
            data-focused={focused}
            data-selected={selected}
            data-invalid={invalid}
            data-multiline={multiline}
        >
            <div
                ref={viewRef}
                className={`${styles.text} ${multiline ? "hide-scrollbar" : ""}`}
                aria-hidden="true"
                // Multiline is a fixed window that the track scrolls inside, so
                // the panel does not grow as the message is typed
                style={{ height: multiline ? `calc(${rows} * var(--sprite-line))` : "var(--sprite-line)" }}
            >
                <div
                    className={styles.track}
                    style={{ transform: `translate(${-scroll.x}px, ${-scroll.y}px)` }}
                >
                    {lines.map(renderLine)}
                </div>
            </div>
            {/* The site's own FF7 scrollbar, same component the Skills materia
                list uses. It hides itself when nothing overflows. */}
            {multiline && <Scrollbar targetRef={viewRef} />}

            {multiline ? (
                <textarea
                    ref={fieldRef}
                    className={styles.input}
                    {...noAutofill}
                    name={name}
                    aria-label={label}
                    value={value}
                    maxLength={maxLength}
                    spellCheck={false}
                    onChange={(event) => handleChange(event.target.value)}
                    onSelect={syncCaret}
                    onKeyUp={syncCaret}
                    onKeyDown={handleKeyDown}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={handleDoubleClick}
                    onFocus={() => { setFocused(true); syncCaret(); }}
                    onBlur={() => setFocused(false)}
                />
            ) : (
                <input
                    ref={fieldRef}
                    className={styles.input}
                    name={name}
                    /**
                     * Deliberately not type="email".
                     *
                     * It is the strongest signal there is for the browser's own
                     * autofill, which reserves the right to ignore
                     * autocomplete="off" when it is confident about a field.
                     * inputMode keeps the phone keyboard with the @ key, which
                     * is the only part of type="email" worth having here —
                     * validity is checked by us and again by the handler.
                     *
                     * It also sidesteps setSelectionRange throwing outright on
                     * an email input, which does not support selection.
                     *
                     * No inputMode either, though it is tempting for the @ key.
                     * inputMode="email" makes iOS build a *different* keyboard,
                     * and these fields are focused programmatically — the tap
                     * is preventDefault-ed so the caret can be placed by
                     * measurement rather than by the browser's own hit testing.
                     * A keyboard-type switch on a programmatic focus made the
                     * keyboard start opening and then close again, on the email
                     * field only, in both Safari and Firefox on iOS. It was the
                     * one attribute distinguishing it from the two fields that
                     * worked.
                     */
                    type="text"
                    aria-label={label}
                    value={value}
                    maxLength={maxLength}
                    {...noAutofill}
                    onChange={(event) => handleChange(event.target.value)}
                    onSelect={syncCaret}
                    onKeyUp={syncCaret}
                    onKeyDown={handleKeyDown}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={handleDoubleClick}
                    onFocus={() => { setFocused(true); syncCaret(); }}
                    onBlur={() => setFocused(false)}
                />
            )}
        </div>
    );
};

export default SpriteInput;
