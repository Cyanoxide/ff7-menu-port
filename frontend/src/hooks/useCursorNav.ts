import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import playSound from "../util/sounds";
import { useContext } from "../context/context";

export type NavDirection = "up" | "down" | "left" | "right";
export type NavPageJump = "pageUp" | "pageDown";
type NavAction = NavDirection | NavPageJump | "confirm" | "cancel";

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
    resolveMove: (pos: CursorPos, dir: NavDirection, helpers: { wrap: (index: number, delta: 1 | -1, size: number) => number }) => CursorPos | null;
    resolvePageJump?: (pos: CursorPos, dir: NavPageJump) => CursorPos | null;
    onFocus: (pos: CursorPos) => void;
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

    const moveTo = useCallback((next: CursorPos, silent: boolean) => {
        const { options: opts, pos: current, isSoundEnabled: sound } = stateRef.current;
        const group = opts.groups.find(g => g.id === next.group);
        if (!group || next.index < 0 || next.index >= group.size) return;
        if (group.isDisabled?.(next.index)) return;
        if (current && current.group === next.group && current.index === next.index) return;

        setPos(next);
        remember(next);
        if (!silent) playSound("select", sound);
        opts.onFocus(next);
    }, []);

    const focus = useCallback((next: CursorPos) => moveTo(next, false), [moveTo]);
    const setPosSilently = useCallback((next: CursorPos | null) => {
        setPos(next);
        if (next) remember(next);
    }, []);

    // Initial focus renders the focused option's preview without the cursor sound
    useEffect(() => {
        if (initialFocusSentRef.current) return;
        initialFocusSentRef.current = true;
        if (stateRef.current.pos) stateRef.current.options.onFocus(stateRef.current.pos);
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
            if (isEditableTarget(e.target)) return;

            const action = KEY_MAP[e.code];
            if (!action) return;
            if (e.metaKey || e.altKey || e.ctrlKey) return;

            e.preventDefault();
            if (e.repeat && (action === "confirm" || action === "cancel")) return;

            if (action === "confirm") {
                if (current) opts.onConfirm(current);
                else if (opts.fallback) moveTo(opts.fallback, false);
                return;
            }

            if (action === "cancel") {
                if (opts.onCancel?.()) return;
                playSound("back", sound);
                nav("/");
                return;
            }

            if (!current) {
                if (opts.fallback) moveTo(opts.fallback, false);
                return;
            }

            const next = (action === "pageUp" || action === "pageDown")
                ? opts.resolvePageJump?.(current, action) ?? null
                : opts.resolveMove(current, action, { wrap });

            if (next) moveTo(next, false);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const { options: opts, isSoundEnabled: sound } = stateRef.current;
            if (!SWITCH_CODES.includes(e.code) || ctrlComboUsedRef.current) return;
            if (opts.onSwitch) {
                playSound("select", sound);
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
