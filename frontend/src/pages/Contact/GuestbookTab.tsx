import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import BGColorPicker from "../../components/BGColorPicker/BGColorPicker";
import SpriteInput from "../../components/SpriteInput/SpriteInput";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import { wrapWithOffsets } from "../../components/SpriteInput/spriteText";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { scrollIntoList } from "../../util/scrollIntoList";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import type { CursorPos, FocusSource } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";
import type { WindowColor, WindowCorner } from "../../context/types";

import { contactAlert } from "./contactAlert";
import { contactTabs } from "./contactTabs";
import { guestbookDraft } from "./draft";
import {
    collapseBlankLines,
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
const LIMITS = { name: 12, message: 255 };

/**
 * How long an alert stays up before it clears itself.
 *
 * Only the settled ones — "Signed. Thank you!" and the refusals. "Signing..."
 * is a request in flight and clears when the request does.
 */
const ALERT_MS = 4000;

/**
 * The pixel budget a message line wraps to.
 *
 * The sprite font wraps nothing — every glyph is a nowrap span — so the text
 * has to be broken up here. **Measured in the browser, not derived** — the
 * panel's padding has moved around enough that arithmetic from its width kept
 * going stale. The entry box has 503px inside its border and padding, and 520
 * was wrapping lines to 514, so the text ran right up to the frame before it
 * broke.
 *
 * 480 leaves about 23px, which is a wide glyph's worth: wrapWithOffsets fits
 * whole words, so a line that only just fits is a line that overruns as soon as
 * a capital W lands at the end of it.
 */
const MESSAGE_WIDTH = 480;

/**
 * And the same when there is no scrollbar, so a short guestbook uses the width
 * the bar would have taken. 32.8px of gutter comes back — see .gbListWrap.
 *
 * Safe to reclaim, despite how these usually go. The classic failure is a loop:
 * widen, the text re-wraps to fewer lines, it no longer overflows, the bar
 * hides, which widens it again. That needs reclaiming to make the content
 * *taller*, and it cannot — wider lines are the same number or fewer, never
 * more. So each state is stable once reached and there is nothing to oscillate.
 */
const MESSAGE_WIDTH_NO_BAR = 513;

const LABELS = ["Name", "Message"] as const;

const CORNERS: WindowCorner[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];

/**
 * How wide the last signer's name may be, and how many lines of it are shown.
 *
 * The meta items take a full row each now rather than half of one, with the
 * value under its label — so a name has the panel's whole 413px inside its
 * border and padding instead of about 200. 400 leaves a little slack.
 *
 * Two lines is still the cap. A name is 12 characters at most, but 12 capital
 * Ws is 432px, so it can still want a second row — and a third would push the
 * meta box down into the form below it. .gbMetaPanel's overflow is the
 * backstop for anything past that.
 */
const META_NAME_WIDTH = 400;
const META_NAME_LINES = 2;

/**
 * Visible lines in the message box. It scrolls by whole rows past that.
 *
 * A budget rather than a preference. The column is 635px and the meta panel
 * takes 170 of it, leaving 465 — against which everything in the form panel
 * adds up:
 *
 *   border + padding    52
 *   name row            64     the Name box and the colour picker, side by side
 *   gap                 12
 *   message box        231.6   5 rows: 210 + 21.6 of padding and border
 *   Sign row            48
 *   status row          41.6   only when there is something to say
 *   ------------------------
 *                      449.2
 *
 * It was three for a while, when the picker had a row of its own and wanted 92px
 * the panel did not have. Sharing the Name row gave all of that back. Anything
 * that grows here has to come from the meta panel's height or from these rows,
 * or the form runs out of the foot of the stage where nothing clips it.
 */
const MESSAGE_ROWS = 5;

type Status = "loading" | "idle" | "signing" | "signed" | "error";

interface GuestbookTabProps {
    /** Which tab is open, so the cursor can come back to it from the close button */
    tabIndex: number;
    tabCount: number;
    onSelectTab: (index: number) => void;
}

const GuestbookTab: React.FC<GuestbookTabProps> = ({ tabIndex, tabCount, onSelectTab }) => {
    const { isSoundEnabled, windowColor } = useContext();
    const navigate = useNavigate();

    const [entries, setEntries] = useState<GuestbookEntry[]>([]);
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState<Status>("loading");
    const [error, setError] = useState("");
    /**
     * Why the list could not be loaded, kept apart from the signing status.
     *
     * They shared one pair of state fields at first, so a failed load reported
     * itself twice — once in the empty list, where it belongs, and again under
     * the form, where it read as though signing had gone wrong. Nothing the
     * form did caused it and nothing the form can do fixes it.
     */
    const [loadError, setLoadError] = useState("");
    const [invalid, setInvalid] = useState<string[]>([]);

    // Seeded from the draft, so switching to the PHS tab and back finds what was
    // half-typed still there. See draft.ts for why it is not localStorage.
    const [name, setName] = useState(() => guestbookDraft.get().name);
    const [message, setMessage] = useState(() => guestbookDraft.get().message);

    /**
     * The window colours this entry will be published in — or null for "the
     * ones the reader has configured".
     *
     * Null rather than a copy of `windowColor`, and resolved at render below.
     * Snapshotting it in a useState initialiser looked equivalent and was not:
     * the provider loads the saved colour in an effect, so on a direct load of
     * /contact the first render still has the default blue, and the picker
     * captured that instead of the colour the site was about to repaint itself
     * in.
     *
     * Following it also means it stays right if the colour changes while the
     * page is open. The moment a corner is picked the value detaches, so
     * editing here never reaches back into the reader's own setting.
     */
    const [chosenColors, setChosenColors] = useState<WindowColor | null>(
        () => guestbookDraft.get().colors,
    );
    const colors = chosenColors ?? windowColor;
    const [activeColorPicker, setActiveColorPicker] = useState<WindowCorner | null>(null);
    const [pickerOpenedByKeyboard, setPickerOpenedByKeyboard] = useState(false);

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
     * Whether the list is long enough to scroll. Reported by Scrollbar, which
     * measures it — the gutter it needs is only reserved when it is there.
     */
    const [hasScrollbar, setHasScrollbar] = useState(false);

    /** What last moved the cursor. Read by the scroll-into-view effect below. */
    const focusSource = useRef<FocusSource>("initial");

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
            // Reported by the list, not by the form. See loadError.
            setLoadError(result.error);
            setStatus((current) => (current === "loading" ? "idle" : current));
            return;
        }

        setLoadError("");
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
        guestbookDraft.set({ name, message, colors: chosenColors });
    }, [name, message, chosenColors]);

    useEffect(() => () => {
        closeNav.setFocus(false);
        contactTabs.setFocus(null);
        // Leaving the tab takes the message with it, or the strip would keep
        // reporting a signature on a screen that has nothing to do with it
        contactAlert.clear();
    }, []);

    /**
     * Alerts take themselves down.
     *
     * They are in a box of their own above the form now, so one left up sits
     * there as a permanent-looking panel long after the thing it is about. Only
     * the settled states are cleared: "signing" is a request in flight and ends
     * when the request does.
     */
    useEffect(() => {
        if (status !== "signed" && status !== "error") return;
        const timer = setTimeout(() => {
            setStatus("idle");
            setError("");
        }, ALERT_MS);
        return () => clearTimeout(timer);
    }, [status, error]);

    /**
     * Hand whatever the form has to say to the description strip, which is
     * drawn by Contact.tsx — see contactAlert for why it goes through a store.
     *
     * Text and a tone rather than rendered glyphs, so the strip decides how to
     * draw it. "loading" says nothing: arriving on the tab is not an event.
     */
    useEffect(() => {
        if (status === "signing") {
            contactAlert.set({ text: messages.signing, tone: "grey" });
        } else if (status === "signed") {
            contactAlert.set({ text: messages.signed, tone: "blue" });
        } else if (status === "error" && error) {
            contactAlert.set({ text: error, tone: "red" });
        } else {
            contactAlert.clear();
        }
    }, [status, error]);

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
            colors,
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
        // Back to following the reader's colour, rather than to a copy of
        // whatever it happened to be a moment ago
        setChosenColors(null);
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
            { id: "colors", size: CORNERS.length },
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
        // Frozen while the picker is open: the arrows belong to its sliders
        // then, the same as on the config screen.
        enabled: !activeColorPicker,
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

            /**
             * Down walks the form in the order it is drawn:
             *
             *   Name -> the four corners -> Message -> Sign -> close -> Name
             *
             * The colour picker sits on the Name row, so it comes between the
             * Name box and the Message box rather than after them. Its corners
             * go in their own order — up-left, up-right, down-left, down-right —
             * which is the order CORNERS is written in.
             *
             * The entries are not on that path. There can be a hundred of them
             * and walking through the lot to reach the form would be absurd;
             * left and right cross between the two columns instead, which is the
             * same shortcut the PHS tab puts between its fields and its links.
             */

            // The tab row is a row, so it is the one place left and right switch
            // tabs rather than crossing the page.
            if (current.group === "tabs") {
                if (dir === "left" || dir === "right") {
                    return { group: "tabs", index: (current.index + (dir === "right" ? 1 : -1) + tabCount) % tabCount };
                }
                if (dir === "down") return { group: "fields", index: 0 };
                return { group: "close", index: 0 };
            }

            if (current.group === "entries") {
                // Left is the way out, because the form is the left-hand column.
                // Nothing is to the right of the entries.
                if (dir === "left") return { group: "fields", index: 0 };
                if (dir === "right") return null;
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
                // Right crosses to the entries from either field
                if (dir === "right" && entries.length) return { group: "entries", index: 0 };

                if (current.index === 0) {
                    if (dir === "up") return { group: "tabs", index: tabIndex };
                    if (dir === "down") return { group: "colors", index: 0 };
                    return null;
                }

                // Message: back up into the last corner, on to Sign
                if (dir === "up") return { group: "colors", index: CORNERS.length - 1 };
                if (dir === "down") return { group: "sign", index: 0 };
                return null;
            }

            /**
             * The four corners. Down and up run through them one at a time, in
             * the order they are named; left and right cross the pair on the
             * row, which is what those keys do everywhere else on a 2x2.
             */
            if (current.group === "colors") {
                const column = current.index % 2;
                if (dir === "left" || dir === "right") {
                    return { group: "colors", index: current.index - column + (1 - column) };
                }
                if (dir === "up") {
                    return current.index === 0
                        ? { group: "fields", index: 0 }
                        : { group: "colors", index: current.index - 1 };
                }
                return current.index === CORNERS.length - 1
                    ? { group: "fields", index: 1 }
                    : { group: "colors", index: current.index + 1 };
            }

            if (current.group === "sign") {
                if (dir === "up") return { group: "fields", index: 1 };
                if (dir === "down") return { group: "close", index: 0 };
                if (dir === "right" && entries.length) return { group: "entries", index: 0 };
                return null;
            }

            /**
             * close. Down wraps back to the top of the form, and **left reaches
             * the tab row** — the tabs are not on the down path, so this is how
             * the keyboard gets to them without walking the whole page.
             */
            if (dir === "down") return { group: "fields", index: 0 };
            if (dir === "up") return { group: "sign", index: 0 };
            if (dir === "left") return { group: "tabs", index: tabIndex };
            return null;
        },
        onFocus: (current: CursorPos, source: FocusSource) => {
            focusSource.current = source;
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

            if (current.group === "colors") {
                openColorPicker(CORNERS[current.index], true);
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

    /**
     * Keep the *keyboard*-focused entry on screen as the cursor moves.
     *
     * Gated on the focus having come from a key. Hovering an entry moves the
     * cursor too, so without the guard the list scrolled itself under the
     * pointer — mousing across it dragged it along, with nothing clicked and
     * nothing scrolled. Scrolling a list to reveal something the mouse is
     * already on top of is never useful; only the keyboard can move the cursor
     * somewhere off screen.
     *
     * scrollIntoList rather than scrollIntoView: #root's layout box is taller
     * than a landscape phone's screen, so the document itself is scrollable and
     * scrollIntoView drags the whole app off the top.
     */
    useEffect(() => {
        if (pos?.group === "entries" && focusSource.current === "key") {
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

    const openColorPicker = (corner: WindowCorner, viaKeyboard: boolean = false) => {
        playSound("select", isSoundEnabled);
        setPickerOpenedByKeyboard(viaKeyboard);
        setActiveColorPicker(corner);
    };

    const clearStatus = () => {
        if (status === "error" || status === "signed") {
            setStatus("idle");
            setError("");
        }
    };

    const field = (
        index: number,
        id: "name" | "message",
        value: string,
        onChange: (next: string) => void,
    ) => (
        <li
            className={styles.gbField}
            // Gated on keyboardMode: the hand only appears when the arrows put
            // it there, never under the mouse.
            data-focused={keyboardMode && isFocused("fields", index)}
            onKeyDown={handleFieldKeyDown}
        >
            <div
                className={styles.gbFieldMain}
                onMouseEnter={() => {
                    // Explicit as well as via onFocus, because moveTo returns
                    // early when the cursor is already here — so mousing onto
                    // the row the arrows last left would keep the hand.
                    setKeyboardMode(false);
                    focus({ group: "fields", index });
                }}
            >
                {/* The name of the field is a placeholder inside the box now,
                    not a label beside it. `label` stays for screen readers,
                    which get nothing from a placeholder. */}
                <SpriteInput
                    inputRef={fieldOrder[index]}
                    name={id}
                    label={LABELS[index]}
                    placeholder={LABELS[index]}
                    value={value}
                    onChange={(next) => { clearStatus(); onChange(next); }}
                    maxLength={LIMITS[id]}
                    multiline={id === "message"}
                    rows={MESSAGE_ROWS}
                    selected={isFocused("fields", index)}
                    invalid={invalid.includes(id)}
                />
            </div>
        </li>
    );


    /**
     * What the list column shows when it has nothing to list.
     *
     * A failed load and an empty guestbook are not the same thing and must not
     * read the same: one is "nobody has signed yet", the other is "the server
     * did not answer", and the second is worth knowing about.
     */
    const listPlaceholder = () => {
        if (status === "loading") return null;
        if (loadError && !entries.length) {
            return <p className={styles.gbPlaceholder}>{textToSprite(loadError, false, "red")}</p>;
        }
        if (!entries.length) {
            return <p className={styles.gbPlaceholder}>{textToSprite(messages.empty, false, "grey")}</p>;
        }
        return null;
    };

    return (
        <>
            {/*
              * The entries, and nothing else. The panel holds one thing so the
              * list can be its full height and the scrollbar can sit against
              * the frame — which is why the form moved out to its own panel
              * rather than sharing this one.
              */}
            <ContentBox data-label="guestbook" className={`${styles.gbListPanel} absolute top-[190px] right-0 bottom-0`}>
                <div className={styles.gbListWrap} data-scrollbar={hasScrollbar || undefined}>
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
                                    /*
                                     * Separate from data-focused, and only true
                                     * when the *keyboard* put the cursor here.
                                     *
                                     * The date is revealed by :hover, but a
                                     * keyboard user produces none — and
                                     * data-focused cannot stand in for it,
                                     * because the cursor stays where it was
                                     * last left. Tying the date to it meant a
                                     * date stayed up after the pointer had gone
                                     * and only cleared when something else took
                                     * the cursor. That is right for the hand,
                                     * which is meant to remember, and wrong for
                                     * a label that should follow the pointer.
                                     */
                                    data-keyed={(keyboardMode && isFocused("entries", index)) || undefined}
                                    onMouseEnter={() => focus({ group: "entries", index })}
                                >
                                    <div className={styles.gbEntryHead}>
                                        {/* Cyan, which is what the blue sheet renders as.
                                            It is the colour this site keeps for headings,
                                            and a signer's name is the heading of its entry. */}
                                        {textToSprite(entry.name, false, "blue")}
                                        <span className={styles.gbDate}>
                                            {textToSprite(formatSignedAt(entry.at), false, "grey")}
                                        </span>
                                    </div>
                                    {/* Each message in its own window, which is what
                                        separates one entry from the next — the underscore
                                        divider the list used to draw is gone with it. */}
                                    {/* Drawn in the colours its signer picked. An entry
                                        with none — anything signed before the picker
                                        existed — falls back per corner to whatever the
                                        reader has configured. */}
                                    <ContentBox
                                        className={styles.gbMessage}
                                        data-label="guestbookEntry"
                                        windowColor={entry.colors ?? undefined}
                                    >
                                        {/* Wrapped to a measured pixel width, because the
                                            sprite font sets every glyph nowrap and a long
                                            message would otherwise run out of the box */}
                                        {/* collapseBlankLines, not the raw message:
                                            an entry is stored exactly as it was
                                            typed, and tidied here on the way out */}
                                        {wrapWithOffsets(
                                            collapseBlankLines(entry.message),
                                            hasScrollbar ? MESSAGE_WIDTH : MESSAGE_WIDTH_NO_BAR,
                                        ).map((line, n) => (
                                            <p key={n} className={styles.gbLine}>
                                                {line.text ? textToSprite(line.text) : null}
                                            </p>
                                        ))}
                                    </ContentBox>
                                </li>
                            ))}
                        </ul>
                        {listPlaceholder()}
                    </div>
                    <Scrollbar targetRef={listRef} onVisibleChange={setHasScrollbar} />
                </div>
            </ContentBox>

            {/* The meta box and the form, stacked. A flex column rather than
                two absolutely-placed panels, so neither has to be told a
                height. */}
            <div className={styles.gbFormColumn}>
                <ContentBox data-label="guestbookMeta" className={styles.gbMetaPanel}>
                    <dl className={styles.gbMeta}>
                        <div className={styles.gbMetaItem}>
                            <dt>{textToSprite("Total Signed", false, "grey")}</dt>
                            <dd>{textToSprite(String(count), true)}</dd>
                        </div>
                        {entries.length > 0 && (
                            <div className={styles.gbMetaItem}>
                                <dt>{textToSprite("Last by", false, "grey")}</dt>
                                <dd>
                                    {wrapWithOffsets(entries[0].name, META_NAME_WIDTH)
                                        .slice(0, META_NAME_LINES)
                                        .map((line, n) => (
                                            <span key={n} className={styles.gbLine}>
                                                {textToSprite(line.text, false, "blue")}
                                            </span>
                                        ))}
                                </dd>
                            </div>
                        )}
                    </dl>
                </ContentBox>

                <ContentBox data-label="guestbookSign" className={styles.gbSignPanel}>
                <div className={styles.gbSignColumn}>
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
                        {/*
                          * Name and the colour picker share a row. The picker is
                          * sized to a field's height so the two read as one, and
                          * a name is 32 characters at most — it never needed the
                          * whole column.
                          *
                          * Compact for a second reason too: the config screen's
                          * slider panel is 34rem and this column is 470px, so at
                          * full width it hung across the entries beside it.
                          */}
                        <li className={styles.gbNameRow}>
                            {field(0, "name", name, setName)}
                            <BGColorPicker
                                compact
                                color={colors}
                                defaultColor={windowColor}
                                onChange={setChosenColors}
                                activeColorPicker={activeColorPicker}
                                setActiveColorPicker={setActiveColorPicker}
                                focusSlidersOnOpen={pickerOpenedByKeyboard}
                                // Same rule as the config screen: hold the
                                // cursor back only for a picker opened by
                                // keyboard, which puts one on its own sliders.
                                focusedCorner={(activeColorPicker && pickerOpenedByKeyboard)
                                ? null
                                : CORNERS.find((_, index) => isFocused("colors", index)) ?? null}
                                onCornerEnter={(corner) => focus({ group: "colors", index: CORNERS.indexOf(corner) })}
                                onCornerClick={(corner) => openColorPicker(corner, false)}
                            />
                        </li>
                        {field(1, "message", message, setMessage)}
                    </ul>

                    <div className={styles.gbSignRow}>
                        {/* How much of the message is spent, updating as it is
                            typed. Grey, because it is a note about the field
                            rather than something to act on. */}
                        <span className={styles.gbCounter}>
                            {textToSprite(`${message.length}/${LIMITS.message}`, true, "grey")}
                        </span>
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
            </div>
        </>
    );
};

export default GuestbookTab;
