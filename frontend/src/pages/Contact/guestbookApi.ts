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

const ENDPOINT = "/guestbook.php";

export interface GuestbookEntry {
    name: string;
    message: string;
    /** Unix seconds. Formatted for display by formatSignedAt. */
    at: number;
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
}

/**
 * The date under a signature.
 *
 * UTC, and assembled by hand rather than by toLocaleDateString. The sprite font
 * has no glyph for most of what a locale might produce — no comma in some, no
 * month names at all — and a date that renders as a row of gaps on one visitor's
 * machine and not another's is not worth the friendliness.
 */
export function formatSignedAt(at: number): string {
    const date = new Date(at * 1000);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
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
