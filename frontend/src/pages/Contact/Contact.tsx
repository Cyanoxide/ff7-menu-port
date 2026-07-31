import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import SpriteInput from "../../components/SpriteInput/SpriteInput";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import styles from "./Contact.module.scss";

/**
 * The contact page.
 *
 * No FF7 menu does this, so the framing is invented: the PHS is the party's
 * field communicator, which is as close as the game gets to "send a message"
 * and keeps the page believable next to the others.
 */

const ENDPOINT = "/contact.php";

/**
 * Characters that fit across the message field at its rendered width. Glyphs
 * are variable width (a 'W' is nearly twice an 'i'), so this is a conservative
 * budget rather than an exact fit; SpriteInput scrolls anything that overruns.
 */
const MESSAGE_COLS = 26;

const LIMITS = { name: 60, email: 254, message: 2000 };

type LinkEntry = { id: string; label: string; detail: string; href: string };

/**
 * LinkedIn is the address already used on the resume page — the two must not
 * drift apart. Reddit is missing because the account has not been supplied yet;
 * an entry with no href is skipped rather than rendered as a dead row.
 */
const LINKS: LinkEntry[] = [
    { id: "linkedin", label: "LinkedIn", detail: "Work history and contacts", href: "https://www.linkedin.com/in/jamiepates/" },
    { id: "reddit", label: "Reddit", detail: "Posts and project threads", href: "" },
    { id: "github", label: "Github", detail: "Source code and projects", href: "https://github.com/Cyanoxide" },
];

const FIELDS = [
    { id: "name", label: "Name", placeholder: "Who is calling?", hint: "Enter your name" },
    { id: "email", label: "Email", placeholder: "Where should the reply go?", hint: "Enter an address for the reply" },
] as const;

const IDLE_HINT = "Send a message over the PHS";

type Status = "idle" | "sending" | "sent" | "error";

function ContactContent() {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();

    const links = LINKS.filter((link) => link.href);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [hint, setHint] = useState(IDLE_HINT);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState("");
    const [invalid, setInvalid] = useState<string[]>([]);

    /**
     * The signed token from the handler's GET. Fetched once on arrival, which is
     * also what starts the clock on its minimum fill time — a form submitted
     * within a few seconds of the page opening was not filled in by a person.
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

    useEffect(() => {
        let cancelled = false;

        fetch(ENDPOINT)
            .then((response) => response.json())
            .then((body) => {
                if (!cancelled && body?.token) tokenRef.current = body.token;
            })
            // A missing token is not worth interrupting the page for: the send
            // itself reports what went wrong, and the links still work
            .catch(() => { });

        return () => { cancelled = true; };
    }, []);

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
            setError("Please fill in every field.");
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
                setError(body?.error ?? "The message could not be sent.");
                playSound("error", isSoundEnabled);
                return;
            }

            setStatus("sent");
            setName("");
            setEmail("");
            setMessage("");
            playSound("save", isSoundEnabled);
        } catch {
            setStatus("error");
            setError("Could not reach the server. Please try again.");
            playSound("error", isSoundEnabled);
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
        resolveMove: (current, dir, { wrap }) => {
            if (current.group === "fields") {
                if (dir === "up") return current.index === 0 ? { group: "close", index: 0 } : { group: "fields", index: current.index - 1 };
                if (dir === "down") return current.index === 2 ? { group: "send", index: 0 } : { group: "fields", index: current.index + 1 };
                if (dir === "right" && links.length) return { group: "links", index: 0 };
                return null;
            }

            if (current.group === "send") {
                if (dir === "up") return { group: "fields", index: 2 };
                if (dir === "down") return { group: "close", index: 0 };
                if (dir === "right" && links.length) return { group: "links", index: 0 };
                return null;
            }

            if (current.group === "links") {
                if (dir === "up") return { group: "links", index: wrap(current.index, -1, links.length) };
                if (dir === "down") return { group: "links", index: wrap(current.index, 1, links.length) };
                if (dir === "left") return { group: "fields", index: 0 };
                return null;
            }

            // close
            if (dir === "down") return { group: "fields", index: 0 };
            if (dir === "up") return { group: "send", index: 0 };
            return null;
        },
        onFocus: (current) => {
            closeNav.setFocus(current.group === "close");

            if (current.group === "fields") setHint(current.index === 2 ? "Type your message" : FIELDS[current.index].hint);
            else if (current.group === "send") setHint("Send the message");
            else if (current.group === "links") setHint(links[current.index].detail);
            else setHint(IDLE_HINT);
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
                // Confirming a field starts typing in it. useCursorNav ignores
                // keys aimed at an editable element, so the menu's arrow keys
                // step back out of the way until the field is blurred.
                const field = [nameRef, emailRef, messageRef][current.index].current;
                playSound("select", isSoundEnabled);
                field?.focus();
                field?.setSelectionRange(field.value.length, field.value.length);
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
        const spec = id === "message"
            ? { label: "Message", placeholder: "" }
            : FIELDS[index];

        return (
            <li
                className={styles.field}
                data-focused={isFocused("fields", index)}
                onMouseEnter={() => focus({ group: "fields", index })}
                onKeyDown={handleFieldKeyDown}
            >
                <span className={styles.fieldLabel}>{textToSprite(spec.label, false, "blue")}</span>
                <SpriteInput
                    inputRef={fieldRefs[id]}
                    name={id}
                    label={spec.label}
                    type={id === "email" ? "email" : "text"}
                    value={value}
                    onChange={(next) => { clearStatus(); onChange(next); }}
                    cols={MESSAGE_COLS}
                    maxLength={LIMITS[id]}
                    multiline={id === "message"}
                    rows={6}
                    placeholder={spec.placeholder}
                    invalid={invalid.includes(id)}
                />
            </li>
        );
    };

    const statusLine = () => {
        if (status === "sending") return textToSprite("Sending...", false, "blue");
        if (status === "sent") return textToSprite("Message sent. Thank you!", false, "yellow");
        if (status === "error" && error) return textToSprite(error, false, "red");
        return null;
    };

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="contactHeader" className="h-full absolute top-0 left-0 right-0">
                    {textToSprite(hint)}
                </ContentBox>
            </div>

            <ContentBox data-label="contactBody" className="h-[45.1rem]">
                <div className={styles.layout}>
                    <div className={styles.formColumn}>
                        <input
                            ref={honeypotRef}
                            type="text"
                            name="website"
                            className={styles.honeypot}
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                        />
                        <ul className={styles.fields}>
                            {field(0, "name", name, setName)}
                            {field(1, "email", email, setEmail)}
                            {field(2, "message", message, setMessage)}
                        </ul>

                        <div className={styles.sendRow}>
                            <button
                                type="button"
                                className={styles.send}
                                data-focused={isFocused("send", 0)}
                                data-disabled={status === "sending"}
                                onMouseEnter={() => focus({ group: "send", index: 0 })}
                                onClick={send}
                            >
                                {textToSprite("Send")}
                            </button>
                            <span className={styles.status}>{statusLine()}</span>
                        </div>
                    </div>

                    <div className={styles.linkColumn}>
                        <p className={styles.linkHeading}>{textToSprite("Channels", false, "blue")}</p>
                        <ul className={styles.links}>
                            {links.map((link, index) => (
                                <li key={link.id}>
                                    <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={styles.link}
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

                        <div className={styles.note}>
                            {["Messages reach me by email.", "I read every one, and reply", "to the address you leave."].map((line, index) => (
                                <p key={index}>{textToSprite(line)}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </ContentBox>
        </>
    );
}

export default ContactContent;
