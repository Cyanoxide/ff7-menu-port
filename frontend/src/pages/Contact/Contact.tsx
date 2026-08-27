import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import SpriteInput from "../../components/SpriteInput/SpriteInput";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import type { CursorPos, FocusSource } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import { contactDraft } from "./draft";
/**
 * The same file contact.php reads at runtime, so the two cannot drift — they
 * already had, in two places. It lives in public/ because that is what Vite
 * copies into dist/ verbatim for the handler to find; importing it from here
 * bundles the identical strings into the client.
 */
import messages from "../../../public/contact-messages.json";

import styles from "./Contact.module.scss";

/**
 * The contact page.
 *
 * No FF7 menu does this, so the framing is invented: the PHS is the party's
 * field communicator, which is as close as the game gets to "send a message"
 * and keeps the page believable next to the others.
 */

const ENDPOINT = "/contact.php";

const LIMITS = { name: 60, email: 254, message: 2000 };

type LinkEntry = { id: string; label: string; detail: string; href: string };

/**
 * LinkedIn is the address already used on the resume page — the two must not
 * drift apart. Reddit is missing because the account has not been supplied yet;
 * an entry with no href is skipped rather than rendered as a dead row.
 */
const LINKS: LinkEntry[] = [
    { id: "github", label: "Github", detail: "Source code and projects", href: "https://github.com/Cyanoxide" },
    { id: "linkedin", label: "LinkedIn", detail: "Work history and contacts", href: "https://www.linkedin.com/in/jamiepates/" },
    { id: "reddit", label: "Reddit", detail: "Posts and project threads", href: "https://www.reddit.com/user/Xianoxide/" },
    { id: "kofi", label: "Ko-fi", detail: "Donations and support", href: "https://www.ko-fi.com/cyanoxide/" },
];

const LABELS = ["Name", "Email", "Message"] as const;

/**
 * The header is static. It described whatever the cursor was on, which meant the
 * top of the page flickered through four different strings as you moved down the
 * form — the other menus' headers do not move like that.
 */
/**
 * The header names the screen; the description panel below it says what the
 * screen is for. Same split as Projects and Skills, where the header carries
 * the tabs or the title and the strip under it carries the prose.
 */
const HEADING = "PHS";
const DESCRIPTION = "Send me a message over the PHS system.";

type Status = "idle" | "sending" | "sent" | "error";

function ContactContent() {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();

    const links = LINKS.filter((link) => link.href);

    // Seeded from the draft, so backing out to the menu and coming back finds
    // the message still there. See draft.ts for why it is not localStorage.
    const [name, setName] = useState(() => contactDraft.get().name);
    const [email, setEmail] = useState(() => contactDraft.get().email);
    const [message, setMessage] = useState(() => contactDraft.get().message);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState("");
    const [invalid, setInvalid] = useState<string[]>([]);

    /**
     * Whether the cursor is being driven by the keyboard.
     *
     * The fields show no hand cursor under the mouse — you can see perfectly
     * well which box you clicked into, and a hand hovering every row you pass
     * over is noise. Arrow-key navigation is the case that needs it, because
     * then nothing else says where you are.
     *
     * Starts false so arriving on the page neither draws a cursor nor steals
     * the keyboard — on a phone, auto-focusing on arrival would throw the
     * on-screen keyboard up over the form.
     */
    const [keyboardMode, setKeyboardMode] = useState(false);
    // resolveMove is called from the hook's key handler, which closes over the
    // options object of the current render — but a ref keeps this honest even
    // if that ever changes.
    const keyboardModeRef = useRef(false);
    keyboardModeRef.current = keyboardMode;

    /**
     * The signed token from the handler's GET. Fetching it is also what starts
     * the clock on the minimum fill time — a form submitted within a few
     * seconds of the page opening was not filled in by a person.
     *
     * A token is single-use now, so this is refreshed after a send rather than
     * fetched once. Without that, writing a second message would fail with
     * "Already sent" and the only way out would be a reload.
     */
    const tokenRef = useRef("");

    /**
     * The honeypot. A real input, rendered and left empty, hidden from sight and
     * from screen readers. Its value is read straight off the DOM rather than
     * held in state: a person never touches it, so anything in it was put there
     * by a bot filling every field it found.
     */
    const honeypotRef = useRef<HTMLInputElement>(null);

    const nameRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const emailRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const messageRef = useRef<(HTMLInputElement & HTMLTextAreaElement) | null>(null);
    const fieldRefs = { name: nameRef, email: emailRef, message: messageRef };
    // The same three in cursor order, for the nav to index by position
    const fieldOrder = [nameRef, emailRef, messageRef];

    /**
     * Fetch a token. The flag lets the mount effect drop a late response after
     * the page has gone, without a refresh having to care.
     */
    const fetchToken = useCallback(async (isStale: () => boolean = () => false) => {
        try {
            const response = await fetch(ENDPOINT);
            const body = await response.json();
            if (!isStale() && body?.token) tokenRef.current = body.token;
        } catch {
            // Not worth interrupting the page for: the send itself reports what
            // went wrong, and the links still work
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchToken(() => cancelled);
        return () => { cancelled = true; };
    }, [fetchToken]);

    const send = async () => {
        if (status === "sending") return;

        const missing = [
            ...(name.trim() ? [] : ["name"]),
            ...(email.trim() ? [] : ["email"]),
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
        setStatus("sending");
        setError("");

        try {
            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                    token: tokenRef.current,
                    website: honeypotRef.current?.value ?? "",
                }),
            });

            const body = await response.json().catch(() => null);

            if (!response.ok || !body?.ok) {
                setStatus("error");
                setError(body?.error ?? messages.sendFailed);
                playSound("error", isSoundEnabled);
                return;
            }

            setStatus("sent");
            setName("");
            setEmail("");
            setMessage("");
            // The mirror effect would empty the draft anyway; saying so here
            // means the intent does not depend on reading that effect.
            contactDraft.clear();
            playSound("save", isSoundEnabled);
            // The token that just sent is spent. Without a new one, a second
            // message would be refused as a replay.
            void fetchToken();
        } catch {
            setStatus("error");
            setError(messages.unreachable);
            playSound("error", isSoundEnabled);
        }
    };

    /**
     * Put the caret in a field, at the end of whatever is already there.
     *
     * setSelectionRange throws outright on an input whose type does not support
     * selection — `email` is one of them — and the throw happened inside the
     * nav's onFocus, which took the whole keyboard handler down with it. Typing
     * after arrowing onto the email row silently did nothing.
     */
    const focusField = (index: number) => {
        const el = fieldOrder[index].current;
        if (!el) return;
        el.focus();
        try {
            el.setSelectionRange(el.value.length, el.value.length);
        } catch {
            // type="email" and friends: focus is enough, the caret lands at the end
        }
    };

    const { focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "fields", size: 3 },
            { id: "send", size: 1 },
            { id: "links", size: links.length },
            { id: "close", size: 1 },
        ],
        // Arriving puts the cursor on the first field, focused rather than
        // selected — the same as every other page
        initial: { group: "fields", index: 0 },
        fallback: { group: "fields", index: 0 },
        enabled: true,
        // The rows on this page *are* the fields, so up/down between them is
        // navigation, not editing. See the option's own note for the trade-off.
        navigateWhileEditing: true,
        resolveMove: (current, dir) => {
            /**
             * The first arrow press only reveals the cursor where it already
             * is. Moving as well would skip the Name row — the cursor starts
             * there invisibly, so the first Down would land on Email and Name
             * could never be reached going downwards.
             */
            if (!keyboardModeRef.current) {
                setKeyboardMode(true);
                if (current.group === "fields") focusField(current.index);
                return null;
            }

            /**
             * Up and down walk the whole page in one loop:
             *
             *   close -> Name -> Email -> Message -> Send -> links -> close
             *
             * Every stop is reachable with down alone. Left and right are only
             * shortcuts across the seam between the form and the channels, so
             * nobody has to walk past three fields to reach a link.
             */
            const lastLink = links.length - 1;

            if (current.group === "fields") {
                if (dir === "up") {
                    return current.index === 0
                        ? { group: "close", index: 0 }
                        : { group: "fields", index: current.index - 1 };
                }
                if (dir === "down") {
                    return current.index === 2
                        ? { group: "send", index: 0 }
                        : { group: "fields", index: current.index + 1 };
                }
                if (dir === "right" && links.length) return { group: "links", index: 0 };
                return null;
            }

            if (current.group === "send") {
                if (dir === "up") return { group: "fields", index: 2 };
                // Into the links, not past them. Skipping to close left the
                // channels reachable only sideways.
                if (dir === "down") {
                    return links.length ? { group: "links", index: 0 } : { group: "close", index: 0 };
                }
                if (dir === "right" && links.length) return { group: "links", index: 0 };
                return null;
            }

            if (current.group === "links") {
                if (dir === "up") {
                    return current.index === 0
                        ? { group: "send", index: 0 }
                        : { group: "links", index: current.index - 1 };
                }
                if (dir === "down") {
                    return current.index === lastLink
                        ? { group: "close", index: 0 }
                        : { group: "links", index: current.index + 1 };
                }
                if (dir === "left") return { group: "fields", index: 0 };
                return null;
            }

            // close
            if (dir === "down") return { group: "fields", index: 0 };
            if (dir === "up") {
                return links.length ? { group: "links", index: lastLink } : { group: "send", index: 0 };
            }
            return null;
        },
        onFocus: (current: CursorPos, source: FocusSource) => {
            closeNav.setFocus(current.group === "close");

            if (source === "pointer") {
                // The mouse moved here, so the mouse can speak for itself.
                setKeyboardMode(false);
                return;
            }
            if (source !== "key") return;

            setKeyboardMode(true);

            /**
             * Landing on a field starts typing in it. This is what Enter used
             * to be for: arrowing onto a row and then having to confirm before
             * you could type read as the field being broken.
             */
            if (current.group === "fields") {
                focusField(current.index);
                return;
            }

            // Leaving the fields hands the keyboard back, or the field keeps
            // swallowing every character while the cursor sits on Send.
            const active = document.activeElement;
            if (fieldOrder.some((ref) => ref.current === active)) {
                (active as HTMLElement).blur();
            }
        },
        onConfirm: (current) => {
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                setPosSilently(null);
                markKeyboardNavigation();
                navigate("/");
                return;
            }

            if (current.group === "fields") {
                // Arrowing onto a field already focuses it, so Enter is only
                // reached from a mouse-placed cursor. Same effect either way.
                const el = fieldOrder[current.index].current;
                playSound("select", isSoundEnabled);
                el?.focus();
                el?.setSelectionRange(el.value.length, el.value.length);
                return;
            }

            if (current.group === "send") {
                send();
                return;
            }

            playSound("select", isSoundEnabled);
            window.open(links[current.index].href, "_blank");
        },
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    // Mirrored on every keystroke rather than saved on the way out: unmount
    // cleanup would close over stale values, and there is nothing to debounce
    // when the write is an object assignment.
    useEffect(() => {
        contactDraft.set({ name, email, message });
    }, [name, email, message]);

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
        if (status !== "idle") {
            setStatus("idle");
            setError("");
        }
    };

    const field = (index: number, id: "name" | "email" | "message", value: string, onChange: (next: string) => void) => {
        const label = LABELS[index];

        return (
            <li
                className={styles.field}
                // Gated on keyboardMode: the hand only appears when the arrows
                // put it there, never under the mouse.
                data-focused={keyboardMode && isFocused("fields", index)}
                onMouseEnter={() => {
                    // Explicit as well as via onFocus, because moveTo returns
                    // early when the cursor is already on this row — so mousing
                    // onto the row the arrows last left would keep the hand.
                    setKeyboardMode(false);
                    focus({ group: "fields", index });
                }}
                onKeyDown={handleFieldKeyDown}
            >
                <span className={styles.fieldLabel}>{textToSprite(label, false, "grey")}</span>
                <SpriteInput
                    inputRef={fieldRefs[id]}
                    name={id}
                    label={label}
                    type={id === "email" ? "email" : "text"}
                    value={value}
                    onChange={(next) => { clearStatus(); onChange(next); }}
                    maxLength={LIMITS[id]}
                    multiline={id === "message"}
                    rows={4}
                    selected={isFocused("fields", index)}
                    invalid={invalid.includes(id)}
                />
            </li>
        );
    };

    const statusLine = () => {
        if (status === "sending") return textToSprite(messages.sending, false, "grey");
        if (status === "sent") return textToSprite(messages.sent, false, "blue");
        if (status === "error" && error) return textToSprite(error, false, "red");
        return null;
    };

    return (
        // The two panels below overlap by 11px so their borders read as one seam.
        // .contentBox fades in individually, so mid-animation both are translucent
        // and the hidden border shows through — .panel-group moves the fade up a
        // level, compositing the group first and applying the alpha after.
        <div className="panel-group">
            {/* Reuses the shared "header" label rather than a contact-specific
                one, so it is full width for the same reason every other page's
                header is */}
            <ContentBox data-label="header" className="h-[84px] absolute">
                {textToSprite(HEADING)}
            </ContentBox>
            {/* Heights and offsets copied from Projects rather than chosen:
                header 0-84, this strip 93-180, the panels from 190. */}
            <ContentBox className={`${styles.descriptionPanel} h-[87px] absolute top-[93px]`}>
                {textToSprite(DESCRIPTION)}
            </ContentBox>

            {/* Absolutely positioned and overlapping, the same as Skills and
                Equip. Laying the two out with flex instead makes them overrun
                the 1100px stage. */}
            <ContentBox data-label="contactForm" className={`${styles.formPanel} absolute top-[190px] bottom-0`}>
                <div className={styles.formColumn}>
                    <input
                        ref={honeypotRef}
                        type="text"
                        name="website"
                        className={styles.honeypot}
                        tabIndex={-1}
                        autoComplete="off"
                        /*
                         * A password manager filling this is indistinguishable
                         * from a bot filling it, and the handler answers a
                         * filled honeypot with a cheerful 200 and no email. The
                         * field is named "website", which is exactly the sort
                         * of thing a manager offers to fill, so it needs the
                         * same opt-outs the real fields carry.
                         */
                        data-1p-ignore
                        data-lpignore="true"
                        aria-hidden="true"
                    />
                    <ul className={styles.fields}>
                        {field(0, "name", name, setName)}
                        {field(1, "email", email, setEmail)}
                        {field(2, "message", message, setMessage)}
                    </ul>

                    {/* Status first, Send last: the row is right-aligned, so
                        whatever comes last is the flush edge. With Send first
                        the empty status span and the row gap sat to its right
                        and held it 24px off the fields' edge. */}
                    <div className={styles.sendRow}>
                        <span className={styles.status}>{statusLine()}</span>
                        <button
                            type="button"
                            className={styles.send}
                            data-focused={isFocused("send", 0)}
                            data-disabled={status === "sending"}
                            onMouseEnter={() => focus({ group: "send", index: 0 })}
                            onClick={send}
                        >
                            {textToSprite("Send", false, "white")}
                        </button>
                    </div>
                </div>
            </ContentBox>

            <ContentBox data-label="contactChannels" className={`${styles.channelsPanel} absolute top-[190px] right-0 bottom-0`}>
                <div className={styles.linkColumn}>
                    <p className={styles.linkHeading}>{textToSprite("Channels", false, "grey")}</p>
                    <ul className={styles.links}>
                        {links.map((link, index) => (
                            <li key={link.id}>
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.link}
                                    data-text-color="yellow"
                                    data-focused={isFocused("links", index)}
                                    onMouseEnter={() => focus({ group: "links", index })}
                                    onClick={() => playSound("select", isSoundEnabled)}
                                >
                                    {textToSprite(link.label, false, "yellow")}
                                    <span className="font-glyph ml-2" data-sprite="external-link-icon"></span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </ContentBox>
        </div>
    );
}

export default ContactContent;
