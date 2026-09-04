import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import SpriteInput from "../../components/SpriteInput/SpriteInput";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import { wrapWithOffsets } from "../../components/SpriteInput/spriteText";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { scrollIntoList } from "../../util/scrollIntoList";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import type { CursorPos, FocusSource } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import { contactTabs } from "./contactTabs";
import { guestbookDraft } from "./draft";
import {
    formatSignedAt,
    loadGuestbook,
    signGuestbook,
    type GuestbookEntry,
} from "./guestbookApi";
import messages from "../../../public/guestbook-messages.json";

import styles from "./Contact.module.scss";

/**
 * The guestbook.
 *
 * Entries above, the form to add one below them, in the same panel — chosen
 * over putting the form in the narrow right-hand column, where 222px of usable
 * width would wrap a message every few words.
 *
 * Everything published here went through guestbook.php's checks and is live the
 * moment it passes them. Moderation is a signed link in the notification email;
 * there is nothing in the app that removes an entry, deliberately, because that
 * would be something to protect.
 */

/** Matches the handler's own limits. Checked there too; this only saves a trip. */
const LIMITS = { name: 32, message: 500 };

/**
 * The pixel budget a message line wraps to.
 *
 * The sprite font wraps nothing — every glyph is a nowrap span — so the text
 * has to be broken up here. Measured, not guessed: the list column is 773px
 * wide, less the 46px scrollbar gutter, which leaves 727. 720 keeps a little
 * slack for the widest glyphs, since wrapWithOffsets fits whole words and a
 * line that only just fits is a line that overruns as soon as a capital W
 * lands at the end of it.
 */
const MESSAGE_WIDTH = 720;

const LABELS = ["Name", "Message"] as const;

/**
 * Drawn with the sprite font's underscore glyphs, the same divider the resume
 * and the projects list use. 32 spans the list column.
 */
const separator = <div className={styles.gbSeparator}>{textToSprite("_".repeat(32))}</div>;

type Status = "loading" | "idle" | "signing" | "signed" | "error";

interface GuestbookTabProps {
    /** Which tab is open, so the cursor can come back to it from the close button */
    tabIndex: number;
    tabCount: number;
    onSelectTab: (index: number) => void;
}

const GuestbookTab: React.FC<GuestbookTabProps> = ({ tabIndex, tabCount, onSelectTab }) => {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();

    const [entries, setEntries] = useState<GuestbookEntry[]>([]);
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState<Status>("loading");
    const [error, setError] = useState("");
    const [invalid, setInvalid] = useState<string[]>([]);

    // Seeded from the draft, so switching to the PHS tab and back finds what was
    // half-typed still there. See draft.ts for why it is not localStorage.
    const [name, setName] = useState(() => guestbookDraft.get().name);
    const [message, setMessage] = useState(() => guestbookDraft.get().message);

    /**
     * The signed token. Fetched with the entries, since the handler returns both
     * from one GET, and refreshed after a signature because a token is single
     * use — without that, signing twice fails as a replay and the only way out
     * is a reload.
     */
    const tokenRef = useRef("");

    /**
     * The honeypot. A real input, rendered and left empty, hidden from sight and
     * from screen readers. Read straight off the DOM rather than held in state:
     * a person never touches it, so anything in it was put there by a bot.
     */
    const honeypotRef = useRef<HTMLInputElement>(null);

    /**
     * Whether the cursor is being driven by the keyboard.
     *
     * The fields show no hand under the mouse — you can see which box you
     * clicked into, and a hand following the pointer down the form is noise.
     * Arrow keys are the case that needs it, because then nothing else says
     * where you are. Same rule as the PHS tab.
     */
    const [keyboardMode, setKeyboardMode] = useState(false);
    const keyboardModeRef = useRef(false);
    keyboardModeRef.current = keyboardMode;

    const nameRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const messageRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const fieldOrder = [nameRef, messageRef];

    const listRef = useRef<HTMLDivElement>(null);
    const entryRefs = useRef<(HTMLLIElement | null)[]>([]);

    /**
     * Load the entries and a token together.
     *
     * Also used after signing, so the list that comes back is the handler's
     * rather than ours with a row pushed onto the front — the two agree in the
     * ordinary case, and where they do not the server is right.
     */
    const refresh = useCallback(async (isStale: () => boolean = () => false) => {
        const result = await loadGuestbook();
        if (isStale()) return;

        if (!result.ok) {
            setStatus("error");
            setError(result.error);
            return;
        }

        tokenRef.current = result.page.token;
        setEntries(result.page.entries);
        setCount(result.page.count);
        setStatus((current) => (current === "loading" ? "idle" : current));
    }, []);

    useEffect(() => {
        let cancelled = false;
        refresh(() => cancelled);
        return () => { cancelled = true; };
    }, [refresh]);

    // Mirrored on every keystroke rather than saved on the way out: unmount
    // cleanup would close over stale values, and there is nothing to debounce
    // when the write is an object assignment.
    useEffect(() => {
        guestbookDraft.set({ name, message });
    }, [name, message]);

    useEffect(() => () => {
        closeNav.setFocus(false);
        contactTabs.setFocus(null);
    }, []);

    const sign = async () => {
        if (status === "signing") return;

        const missing = [
            ...(name.trim() ? [] : ["name"]),
            ...(message.trim() ? [] : ["message"]),
        ];

        // Checked here as well as in PHP so an empty form does not cost a round
        // trip; the handler stays the authority, since this half is bypassable
        if (missing.length) {
            setInvalid(missing);
            setStatus("error");
            setError(messages.emptyFields);
            playSound("error", isSoundEnabled);
            return;
        }

        setInvalid([]);
        setStatus("signing");
        setError("");

        const result = await signGuestbook({
            name,
            message,
            token: tokenRef.current,
            website: honeypotRef.current?.value ?? "",
        });

        if (!result.ok) {
            setStatus("error");
            setError(result.error);
            playSound("error", isSoundEnabled);
            return;
        }

        setStatus("signed");
        setName("");
        setMessage("");
        guestbookDraft.clear();
        playSound("save", isSoundEnabled);

        /**
         * Show it straight away rather than waiting for the round trip. The
         * handler echoes the stored entry back, so this is what was actually
         * saved and not a guess; refresh() then reconciles with the real list
         * and brings a fresh token with it.
         */
        if (result.entry) {
            setEntries((current) => [result.entry as GuestbookEntry, ...current]);
            setCount((current) => current + 1);
        }
        void refresh();
    };

    /**
     * Put the caret in a field, at the end of whatever is already there.
     *
     * setSelectionRange throws on an input whose type does not support
     * selection, and a throw inside the nav's onFocus takes the whole keyboard
     * handler down with it — which on the PHS tab silently stopped typing after
     * arrowing onto a row.
     */
    const focusField = (index: number) => {
        const el = fieldOrder[index].current;
        if (!el) return;
        el.focus();
        try {
            el.setSelectionRange(el.value.length, el.value.length);
        } catch {
            // Focus is enough; the caret lands at the end anyway
        }
    };

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "tabs", size: tabCount },
            { id: "entries", size: entries.length },
            { id: "fields", size: 2 },
            { id: "sign", size: 1 },
            { id: "close", size: 1 },
        ],
        /**
         * Arriving puts the cursor on the tab rather than in the list or the
         * form. The list is the thing you came to read, and dropping the cursor
         * into a text field would throw a phone's keyboard up over the entries
         * before anyone had seen one.
         */
        initial: { group: "tabs", index: tabIndex },
        fallback: { group: "tabs", index: tabIndex },
        enabled: true,
        // The rows on the lower half of this tab *are* the fields, so up and
        // down between them is navigation rather than editing.
        navigateWhileEditing: true,
        resolveMove: (current, dir) => {
            /**
             * The first arrow press only reveals the cursor where it already is.
             * Moving as well would skip whatever it started on.
             */
            if (!keyboardModeRef.current) {
                setKeyboardMode(true);
                if (current.group === "fields") focusField(current.index);
                return null;
            }

            const lastEntry = entries.length - 1;

            // The tab row is a row, so it is the one place left and right switch
            // tabs. Everywhere else they are a shortcut across the page.
            if (current.group === "tabs") {
                if (dir === "left" || dir === "right") {
                    return { group: "tabs", index: (current.index + (dir === "right" ? 1 : -1) + tabCount) % tabCount };
                }
                if (dir === "down") {
                    return entries.length ? { group: "entries", index: 0 } : { group: "fields", index: 0 };
                }
                return { group: "close", index: 0 };
            }

            /**
             * Left or right out of the list, rather than only up and down.
             *
             * The list can hold a hundred entries, and without a way across
             * them the form underneath would be a hundred key presses away.
             * Same shortcut the PHS tab puts between its fields and its links.
             */
            if (current.group === "entries") {
                if (dir === "left" || dir === "right") return { group: "fields", index: 0 };
                if (dir === "up") {
                    return current.index === 0
                        ? { group: "tabs", index: tabIndex }
                        : { group: "entries", index: current.index - 1 };
                }
                return current.index === lastEntry
                    ? { group: "fields", index: 0 }
                    : { group: "entries", index: current.index + 1 };
            }

            if (current.group === "fields") {
                if (dir === "up") {
                    if (current.index > 0) return { group: "fields", index: current.index - 1 };
                    return entries.length
                        ? { group: "entries", index: lastEntry }
                        : { group: "tabs", index: tabIndex };
                }
                if (dir === "down") {
                    return current.index === 1
                        ? { group: "sign", index: 0 }
                        : { group: "fields", index: current.index + 1 };
                }
                // Back into the list, so the shortcut works both ways
                if (dir === "left" && entries.length) return { group: "entries", index: 0 };
                return null;
            }

            if (current.group === "sign") {
                if (dir === "up") return { group: "fields", index: 1 };
                if (dir === "down") return { group: "close", index: 0 };
                return null;
            }

            // close
            if (dir === "down") return { group: "tabs", index: tabIndex };
            if (dir === "up") return { group: "sign", index: 0 };
            return null;
        },
        onFocus: (current: CursorPos, source: FocusSource) => {
            closeNav.setFocus(current.group === "close");
            contactTabs.setFocus(current.group === "tabs" ? current.index : null);

            if (source === "pointer") {
                // The mouse moved here, so the mouse can speak for itself
                setKeyboardMode(false);
                return;
            }
            if (source !== "key") return;

            setKeyboardMode(true);

            // Landing on a field starts typing in it, rather than needing Enter
            if (current.group === "fields") {
                focusField(current.index);
                return;
            }

            // Leaving the fields hands the keyboard back, or the field keeps
            // swallowing every character while the cursor sits on Sign
            const active = document.activeElement;
            if (fieldOrder.some((ref) => ref.current === active)) {
                (active as HTMLElement).blur();
            }
        },
        onConfirm: (current) => {
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                contactTabs.setFocus(null);
                setPosSilently(null);
                markKeyboardNavigation();
                navigate("/");
                return;
            }

            if (current.group === "tabs") {
                onSelectTab(current.index);
                return;
            }

            if (current.group === "fields") {
                const el = fieldOrder[current.index].current;
                playSound("select", isSoundEnabled);
                el?.focus();
                try {
                    el?.setSelectionRange(el.value.length, el.value.length);
                } catch {
                    // As above: focus is enough
                }
                return;
            }

            if (current.group === "sign") {
                sign();
                return;
            }

            // An entry does nothing when confirmed — there is nowhere to go and
            // nothing to open. The cursor rests on it and that is all.
        },
    });

    // Keep the keyboard-focused entry on screen as the cursor moves.
    //
    // scrollIntoList rather than scrollIntoView: #root's layout box is taller
    // than a landscape phone's screen, so the document itself is scrollable and
    // scrollIntoView drags the whole app off the top.
    useEffect(() => {
        if (pos?.group === "entries") {
            scrollIntoList(entryRefs.current[pos.index]);
        }
    }, [pos]);

    /**
     * Escape leaves the field rather than the page. The nav hook never sees the
     * key while an editable element has focus, so the field has to hand control
     * back itself; without this a keyboard user is stuck inside the input.
     */
    const handleFieldKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        (event.target as HTMLElement).blur();
        playSound("back", isSoundEnabled);
    };

    const clearStatus = () => {
        if (status === "error" || status === "signed") {
            setStatus("idle");
            setError("");
        }
    };

    const field = (index: number, id: "name" | "message", value: string, onChange: (next: string) => void) => (
        <li
            className={styles.gbField}
            // Gated on keyboardMode: the hand only appears when the arrows put
            // it there, never under the mouse.
            data-focused={keyboardMode && isFocused("fields", index)}
            onMouseEnter={() => {
                // Explicit as well as via onFocus, because moveTo returns early
                // when the cursor is already on this row — so mousing onto the
                // row the arrows last left would keep the hand.
                setKeyboardMode(false);
                focus({ group: "fields", index });
            }}
            onKeyDown={handleFieldKeyDown}
        >
            <span className={styles.gbFieldLabel}>{textToSprite(LABELS[index], false, "grey")}</span>
            <div className={styles.gbFieldBox}>
                <SpriteInput
                    inputRef={fieldOrder[index]}
                    name={id}
                    label={LABELS[index]}
                    value={value}
                    onChange={(next) => { clearStatus(); onChange(next); }}
                    maxLength={LIMITS[id]}
                    multiline={id === "message"}
                    rows={2}
                    selected={isFocused("fields", index)}
                    invalid={invalid.includes(id)}
                />
            </div>
        </li>
    );

    const statusLine = () => {
        if (status === "loading") return null;
        if (status === "signing") return textToSprite(messages.signing, false, "grey");
        if (status === "signed") return textToSprite(messages.signed, false, "blue");
        if (status === "error" && error) return textToSprite(error, false, "red");
        return null;
    };

    /**
     * What the list column shows when it has nothing to list.
     *
     * A failed load and an empty guestbook are not the same thing and must not
     * read the same: one is "nobody has signed yet", the other is "the server
     * did not answer", and the second is worth knowing about.
     */
    const listPlaceholder = () => {
        if (status === "loading") return null;
        if (status === "error" && !entries.length) {
            return <p className={styles.gbPlaceholder}>{textToSprite(error, false, "red")}</p>;
        }
        if (!entries.length) {
            return <p className={styles.gbPlaceholder}>{textToSprite(messages.empty, false, "grey")}</p>;
        }
        return null;
    };

    return (
        <>
            <ContentBox data-label="guestbook" className={`${styles.formPanel} absolute top-[190px] bottom-0`}>
                <div className={styles.formColumn}>
                    <div className={styles.gbListWrap}>
                        <div className={`${styles.gbList} hide-scrollbar`} ref={listRef}>
                            <ul>
                                {entries.map((entry, index) => (
                                    <li
                                        // Entries carry no public id — the stored one is not
                                        // exposed — so the key is what makes a row unique on
                                        // the page: when it was signed, by whom, and where.
                                        key={`${entry.at}-${entry.name}-${index}`}
                                        ref={(el) => { entryRefs.current[index] = el; }}
                                        className={styles.gbEntry}
                                        data-focused={isFocused("entries", index)}
                                        onMouseEnter={() => focus({ group: "entries", index })}
                                    >
                                        <div className={styles.gbEntryHead}>
                                            {textToSprite(entry.name)}
                                            <span className={styles.gbDate}>
                                                {textToSprite(formatSignedAt(entry.at), false, "grey")}
                                            </span>
                                        </div>
                                        {/* Wrapped to a measured pixel width, because the
                                            sprite font sets every glyph nowrap and a long
                                            message would otherwise run out of the panel */}
                                        {wrapWithOffsets(entry.message, MESSAGE_WIDTH).map((line, n) => (
                                            <p key={n} className={styles.gbLine}>
                                                {line.text ? textToSprite(line.text) : null}
                                            </p>
                                        ))}
                                        {index < entries.length - 1 && separator}
                                    </li>
                                ))}
                            </ul>
                            {listPlaceholder()}
                        </div>
                        <Scrollbar targetRef={listRef} />
                    </div>

                    <input
                        ref={honeypotRef}
                        type="text"
                        name="website"
                        className={styles.honeypot}
                        tabIndex={-1}
                        autoComplete="off"
                        /* A password manager filling this is indistinguishable from
                         * a bot filling it, and the handler answers a filled
                         * honeypot with a cheerful 200 and no entry. The field is
                         * named "website", exactly the sort of thing a manager
                         * offers to fill, so it needs the same opt-outs. */
                        data-1p-ignore
                        data-lpignore="true"
                        aria-hidden="true"
                    />

                    <ul className={styles.gbFields}>
                        {field(0, "name", name, setName)}
                        {field(1, "message", message, setMessage)}
                    </ul>

                    {/* Status first, Sign last: the row is right-aligned, so
                        whatever comes last is the flush edge. */}
                    <div className={styles.sendRow}>
                        <span className={styles.status}>{statusLine()}</span>
                        <button
                            type="button"
                            className={styles.send}
                            data-focused={isFocused("sign", 0)}
                            data-disabled={status === "signing" || status === "loading"}
                            onMouseEnter={() => focus({ group: "sign", index: 0 })}
                            onClick={sign}
                        >
                            {textToSprite("Sign", false, "white")}
                        </button>
                    </div>
                </div>
            </ContentBox>

            <ContentBox data-label="guestbookMeta" className={`${styles.channelsPanel} absolute top-[190px] right-0 bottom-0`}>
                <div className={styles.linkColumn}>
                    <p className={styles.linkHeading}>{textToSprite("Signed", false, "grey")}</p>
                    <p className={styles.gbStat}>{textToSprite(String(count), true)}</p>
                    {entries.length > 0 && (
                        <>
                            <p className={styles.linkHeading}>{textToSprite("Newest", false, "grey")}</p>
                            {/* The name is capped at 32 characters by the handler,
                                which is wider than this column — wrapped for the
                                same reason the messages are. */}
                            {wrapWithOffsets(entries[0].name, 200).map((line, n) => (
                                <p key={n} className={styles.gbLine}>{textToSprite(line.text)}</p>
                            ))}
                        </>
                    )}
                </div>
            </ContentBox>
        </>
    );
};

export default GuestbookTab;
