import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import playSound from "../util/sounds";
import { useContext } from "../context/context";

export type NavDirection = "up" | "down" | "left" | "right";
export type NavPageJump = "pageUp" | "pageDown";
type NavAction = NavDirection | NavPageJump | "confirm" | "cancel";

/**
 * Where a cursor move came from. Pages use it to tell a deliberate keyboard
 * move from the mouse happening to pass over something — the two want
 * different behaviour on a page whose rows are text fields.
 */
export type FocusSource = "key" | "pointer" | "initial";

export interface CursorPos {
    group: string;
    index: number;
}

export interface NavGroup {
    id: string;
    size: number;
    isDisabled?: (index: number) => boolean;
}

export interface CursorNavOptions {
    groups: NavGroup[];
    initial: CursorPos | null;
    /** Where the cursor appears when a movement key is pressed while no cursor is shown */
    fallback?: CursorPos;
    enabled: boolean;
    memoryKey?: string;
    /**
     * Keep handling the arrow keys while a text field has focus.
     *
     * Off by default, and it must stay off by default: every other page relies
     * on the menu getting out of the way once you are typing — name entry most
     * of all, where the arrows belong to the glyph grid.
     *
     * A page that turns this on is saying its rows *are* the fields, so moving
     * between them is navigation rather than editing. The cost is that the
     * arrows no longer move the text caret inside a field; Home, End and the
     * mouse still do.
     *
     * Only the four directions are taken. Enter, Escape, Space and the rest are
     * left to the field, so typing, newlines and Escape-to-blur are unaffected.
     */
    navigateWhileEditing?: boolean;
    resolveMove: (pos: CursorPos, dir: NavDirection, helpers: { wrap: (index: number, delta: 1 | -1, size: number) => number }) => CursorPos | null;
    resolvePageJump?: (pos: CursorPos, dir: NavPageJump) => CursorPos | null;
    onFocus: (pos: CursorPos, source: FocusSource) => void;
    onConfirm: (pos: CursorPos) => void;
    onCancel?: () => boolean;
    onSwitch?: () => void;
}

const KEY_MAP: Record<string, NavAction> = {
    ArrowUp: "up", Numpad8: "up",
    ArrowDown: "down", Numpad2: "down",
    ArrowLeft: "left", Numpad4: "left",
    ArrowRight: "right", Numpad6: "right",
    Enter: "confirm", NumpadEnter: "confirm",
    Space: "cancel", Numpad0: "cancel", Insert: "cancel", Escape: "cancel",
    PageUp: "pageUp", Numpad9: "pageUp",
    PageDown: "pageDown", Numpad3: "pageDown",
};

const SWITCH_CODES = ["ControlLeft", "ControlRight", "NumpadDecimal"];

const wrap = (index: number, delta: 1 | -1, size: number) => (index + delta + size) % size;

const cursorMemory = new Map<string, CursorPos>();

// When navigation is triggered by keyboard, the destination surface starts
// with its first item focused; mouse navigation starts with no cursor.
let keyboardNavIntent = false;

export const markKeyboardNavigation = () => {
    keyboardNavIntent = true;
};

export const consumeKeyboardNavIntent = () => {
    const intent = keyboardNavIntent;
    keyboardNavIntent = false;
    return intent;
};

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
    return target instanceof HTMLInputElement && target.type !== "range";
};

export function useCursorNav(options: CursorNavOptions) {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();

    const [pos, setPos] = useState<CursorPos | null>(() => {
        if (options.memoryKey && cursorMemory.has(options.memoryKey)) {
            return cursorMemory.get(options.memoryKey)!;
        }
        if (consumeKeyboardNavIntent()) {
            return options.fallback ?? options.initial;
        }
        return options.initial;
    });

    const stateRef = useRef({ options, pos, isSoundEnabled, navigate });
    stateRef.current = { options, pos, isSoundEnabled, navigate };

    const ctrlComboUsedRef = useRef(false);
    const initialFocusSentRef = useRef(false);

    const remember = (next: CursorPos) => {
        const { memoryKey } = stateRef.current.options;
        if (memoryKey) cursorMemory.set(memoryKey, next);
    };

    const moveTo = useCallback((next: CursorPos, silent: boolean, source: FocusSource = "pointer") => {
        const { options: opts, pos: current, isSoundEnabled: sound } = stateRef.current;
        const group = opts.groups.find(g => g.id === next.group);
        if (!group || next.index < 0 || next.index >= group.size) return;
        if (group.isDisabled?.(next.index)) return;
        if (current && current.group === next.group && current.index === next.index) return;

        setPos(next);
        remember(next);
        if (!silent) playSound("select", sound);
        opts.onFocus(next, source);
    }, []);

    const focus = useCallback(
        (next: CursorPos, source: FocusSource = "pointer") => moveTo(next, false, source),
        [moveTo],
    );
    const setPosSilently = useCallback((next: CursorPos | null) => {
        setPos(next);
        if (next) remember(next);
    }, []);

    // Initial focus renders the focused option's preview without the cursor sound
    useEffect(() => {
        if (initialFocusSentRef.current) return;
        initialFocusSentRef.current = true;
        if (stateRef.current.pos) stateRef.current.options.onFocus(stateRef.current.pos, "initial");
    }, []);

    // Clamp when a group shrinks underneath the cursor
    useEffect(() => {
        if (!pos) return;
        const group = options.groups.find(g => g.id === pos.group);
        if (group && group.size > 0 && pos.index >= group.size) {
            setPosSilently({ group: pos.group, index: group.size - 1 });
        }
    });

    useEffect(() => {
        if (!options.enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const { options: opts, pos: current, isSoundEnabled: sound, navigate: nav } = stateRef.current;

            if (e.ctrlKey && !SWITCH_CODES.includes(e.code)) ctrlComboUsedRef.current = true;
            if (SWITCH_CODES.includes(e.code)) {
                ctrlComboUsedRef.current = false;
                return;
            }
            const action = KEY_MAP[e.code];
            if (!action) return;

            if (isEditableTarget(e.target)) {
                // A page that navigates between fields still wants the arrows;
                // everything else — Enter, Escape, Space — belongs to the field.
                const isDirection = action === "up" || action === "down"
                    || action === "left" || action === "right";
                if (!opts.navigateWhileEditing || !isDirection) return;
            }
            if (e.metaKey || e.altKey || e.ctrlKey) return;

            e.preventDefault();
            if (e.repeat && (action === "confirm" || action === "cancel")) return;

            if (action === "confirm") {
                if (current) opts.onConfirm(current);
                else if (opts.fallback) moveTo(opts.fallback, false, "key");
                return;
            }

            if (action === "cancel") {
                if (opts.onCancel?.()) return;
                playSound("back", sound);
                markKeyboardNavigation();
                nav("/");
                return;
            }

            if (!current) {
                if (opts.fallback) moveTo(opts.fallback, false, "key");
                return;
            }

            const next = (action === "pageUp" || action === "pageDown")
                ? opts.resolvePageJump?.(current, action) ?? null
                : opts.resolveMove(current, action, { wrap });

            if (next) moveTo(next, false, "key");
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const { options: opts, isSoundEnabled: sound } = stateRef.current;
            if (!SWITCH_CODES.includes(e.code) || ctrlComboUsedRef.current) return;
            if (opts.onSwitch) {
                playSound("select", sound);
                markKeyboardNavigation();
                opts.onSwitch();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [options.enabled, moveTo]);

    const isFocused = useCallback((group: string, index: number) =>
        pos?.group === group && pos.index === index, [pos]);

    return { pos, focus, setPosSilently, isFocused };
}
