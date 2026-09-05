/**
 * Talking to guestbook.php.
 *
 * The same shape as contactApi, and for the same reason: the page has one line
 * to report anything that goes wrong, so every failure has to arrive as a
 * string rather than as an exception thrown into a click handler.
 *
 * One difference worth knowing about. The contact form's GET exists only to
 * hand out a token; the guestbook's returns the entries as well, because the
 * page needs both on arrival and there is no reason to ask twice.
 */

/** Read at runtime by guestbook.php and bundled here, so the strings cannot drift. */
import messages from "../../../public/guestbook-messages.json";
import type { WindowColor } from "../../context/types";

const ENDPOINT = "/guestbook.php";

export interface GuestbookEntry {
    name: string;
    message: string;
    /** Unix seconds. Formatted for display by formatSignedAt. */
    at: number;
    /**
     * The window colours this signer chose, or null to draw the entry in
     * whatever the *reader* has configured. Null is meaningful, not missing:
     * entries signed before the picker existed have none.
     */
    colors: WindowColor | null;
}

export interface GuestbookPage {
    entries: GuestbookEntry[];
    /** Every entry ever kept, which is not the same as how many were returned. */
    count: number;
    token: string;
}

export type LoadResult =
    | { ok: true; page: GuestbookPage }
    | { ok: false; error: string };

export type SignResult =
    | { ok: true; entry: GuestbookEntry | null }
    | { ok: false; error: string };

export interface GuestbookSignature {
    name: string;
    message: string;
    token: string;
    /** The honeypot's value. Empty for a real person. */
    website: string;
    colors: WindowColor;
}

/**
 * The date under a signature, as DD/MM/YY.
 *
 * UTC, and assembled by hand rather than by toLocaleDateString. The sprite font
 * has no glyph for most of what a locale might produce — no comma in some, no
 * month names at all — and a date that renders as a row of gaps on one visitor's
 * machine and not another's is not worth the friendliness. Fixing the order also
 * means it reads the same for everyone, which a locale would not.
 */
export function formatSignedAt(at: number): string {
    const date = new Date(at * 1000);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (value: number) => String(value).padStart(2, "0");
    return [
        pad(date.getUTCDate()),
        pad(date.getUTCMonth() + 1),
        String(date.getUTCFullYear()).slice(-2),
    ].join("/");
}

/**
 * A message as it is *shown*, with runs of blank lines collapsed to one.
 *
 * Nothing stops someone signing with twenty newlines in the middle of their
 * message, and the handler has no business rewriting what was written — but a
 * guestbook where one entry is a screen of empty blue is a guestbook nobody
 * scrolls past. So the text is stored exactly as typed and tidied on the way
 * out; take this out and the original is still there.
 *
 * `\n{3,}` is two or more *blank* lines: three newlines in a row already means
 * two empty rows between paragraphs. One is left, which is what a paragraph
 * break looks like everywhere else on the site.
 *
 * CRLF is normalised first. A textarea produces bare newlines, but this text
 * arrives from an HTTP request rather than from the field, and a stray carriage
 * return would leave the run unmatched and the blank lines in place.
 */
export function collapseBlankLines(message: string): string {
    return message.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
}

const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;

/**
 * A colour set from the handler, or null.
 *
 * Checked channel by channel rather than trusted, because these values go
 * straight into a CSS gradient — anything that is not a number would produce a
 * malformed rgb() and silently drop the whole background. The handler validates
 * the same shape on the way in; this is the half that has to hold if the file
 * on disk was ever edited by hand.
 */
function toColors(raw: unknown): WindowColor | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;

    const colors = {} as WindowColor;
    for (const corner of CORNERS) {
        const channels = value[corner];
        if (!Array.isArray(channels) || channels.length !== 3) return null;
        if (!channels.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
        colors[corner] = [channels[0], channels[1], channels[2]];
    }
    return colors;
}

/** Anything the handler returns that is not an entry-shaped object is dropped
 *  rather than rendered as a row of blanks. */
function toEntry(raw: unknown): GuestbookEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    if (typeof value.name !== "string" || typeof value.message !== "string") return null;
    return {
        name: value.name,
        message: value.message,
        at: typeof value.at === "number" ? value.at : 0,
        colors: toColors(value.colors),
    };
}

/** The entries, newest first, and a token to sign with. */
export async function loadGuestbook(): Promise<LoadResult> {
    let response: Response;

    try {
        response = await fetch(ENDPOINT);
    } catch {
        return { ok: false, error: messages.unreachable };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
        // The handler says so itself when it is switched off or unconfigured,
        // and those are exactly the cases where "could not load" is useless.
        return { ok: false, error: body?.error ?? messages.loadFailed };
    }

    const entries = Array.isArray(body.entries)
        ? body.entries.map(toEntry).filter((entry: GuestbookEntry | null): entry is GuestbookEntry => entry !== null)
        : [];

    return {
        ok: true,
        page: {
            entries,
            count: typeof body.count === "number" ? body.count : entries.length,
            token: typeof body.token === "string" ? body.token : "",
        },
    };
}

/**
 * Sign the guestbook.
 *
 * The handler echoes the stored entry back, so the list can show it without a
 * second round trip. It is allowed to be missing — the signature still counts,
 * and the caller falls back to what was typed.
 */
export async function signGuestbook(input: GuestbookSignature): Promise<SignResult> {
    let response: Response;

    try {
        response = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
    } catch {
        return { ok: false, error: messages.unreachable };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
        return { ok: false, error: body?.error ?? messages.fallback };
    }

    return { ok: true, entry: toEntry(body.entry) };
}
