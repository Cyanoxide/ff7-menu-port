import { afterEach, describe, expect, it, vi } from "vitest";

import { formatSignedAt, loadGuestbook, signGuestbook } from "./guestbookApi";
import messages from "../../../public/guestbook-messages.json";

/**
 * The guestbook's client half.
 *
 * The handler is covered by tests/guestbook.sh, which drives it over HTTP and
 * checks the notification and the delete link as well. What is checked here is
 * what the browser does with the answer — in particular that a refusal never
 * arrives looking like a signature, since the page clears the form and says
 * "Signed. Thank you!" on the strength of it.
 */

const respond = (body: unknown, ok = true, status = 200) =>
    ({
        ok,
        status,
        json: async () => body,
    }) as Response;

/**
 * A 200 that is not JSON at all — an error page, or index.html because the SPA
 * rewrite swallowed the request and served the app instead of the handler.
 * json() rejects, which is the case the caller has to survive.
 */
const notJson = () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError("Unexpected token <"); },
}) as unknown as Response;

const mockFetch = (impl: (...args: Parameters<typeof fetch>) => Promise<Response>) => {
    const fn = vi.fn(impl);
    vi.stubGlobal("fetch", fn);
    return fn;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("formatSignedAt", () => {
    /**
     * UTC and assembled by hand. The sprite font has no glyph for most of what a
     * locale might produce, so a date built with toLocaleDateString renders as a
     * row of gaps on some visitors' machines and not others'.
     */
    it("formats unix seconds as an ISO date in UTC", () => {
        expect(formatSignedAt(Date.UTC(2026, 8, 4, 12, 0, 0) / 1000)).toBe("2026-09-04");
    });

    it("pads single-digit months and days", () => {
        expect(formatSignedAt(Date.UTC(2026, 0, 5, 0, 0, 0) / 1000)).toBe("2026-01-05");
    });

    // Late in the UTC day, where anything reading local time in a western zone
    // would report the day before.
    it("does not slip a day for a late-evening signature", () => {
        expect(formatSignedAt(Date.UTC(2026, 8, 4, 23, 59, 0) / 1000)).toBe("2026-09-04");
    });

    it("returns an empty string rather than NaN for a bad timestamp", () => {
        expect(formatSignedAt(Number.NaN)).toBe("");
    });
});

describe("loadGuestbook", () => {
    const page = {
        ok: true,
        token: "1234:abcd:sig",
        count: 42,
        entries: [
            { name: "Cloud", message: "Nice sandbox.", at: 1_757_000_000 },
            { name: "Tifa", message: "Love the card game.", at: 1_756_000_000 },
        ],
    };

    it("returns the entries, the count and a token", async () => {
        mockFetch(async () => respond(page));

        const result = await loadGuestbook();

        expect(result).toEqual({
            ok: true,
            page: {
                token: "1234:abcd:sig",
                count: 42,
                entries: page.entries,
            },
        });
    });

    it("asks guestbook.php for them", async () => {
        const fetchMock = mockFetch(async () => respond(page));
        await loadGuestbook();
        expect(fetchMock).toHaveBeenCalledWith("/guestbook.php");
    });

    /**
     * count is every entry ever kept; entries is the page of them that came
     * back. The side panel shows the first and the list shows the second, so
     * they are deliberately allowed to differ.
     */
    it("keeps the total apart from the number returned", async () => {
        mockFetch(async () => respond({ ...page, count: 500 }));
        const result = await loadGuestbook();
        expect(result.ok && result.page.count).toBe(500);
        expect(result.ok && result.page.entries).toHaveLength(2);
    });

    /**
     * A row with no name or no message would render as a cursor stop with
     * nothing in it — worse than not being there, because it is not obviously
     * wrong. Dropped rather than drawn.
     */
    it("drops entries that are not entry-shaped", async () => {
        mockFetch(async () => respond({
            ...page,
            entries: [
                { name: "Cloud", message: "Fine.", at: 1 },
                { name: "Broken" },
                null,
                "not an entry",
                { message: "no name", at: 2 },
            ],
        }));

        const result = await loadGuestbook();
        expect(result.ok && result.page.entries).toEqual([{ name: "Cloud", message: "Fine.", at: 1 }]);
    });

    it("defaults a missing timestamp rather than dropping the entry", async () => {
        mockFetch(async () => respond({ ...page, entries: [{ name: "Cloud", message: "Fine." }] }));
        const result = await loadGuestbook();
        expect(result.ok && result.page.entries).toEqual([{ name: "Cloud", message: "Fine.", at: 0 }]);
    });

    it("copes with a response carrying no entries at all", async () => {
        mockFetch(async () => respond({ ok: true, token: "t", count: 0 }));
        const result = await loadGuestbook();
        expect(result.ok && result.page.entries).toEqual([]);
    });

    /**
     * "Guestbook is not set up" and "the server did not answer" are different
     * problems with different fixes, and the handler is the only one that knows
     * which of the two it is.
     */
    it("surfaces the handler's reason for refusing", async () => {
        mockFetch(async () => respond({ ok: false, error: "Guestbook is not set up." }, false, 503));
        expect(await loadGuestbook()).toEqual({ ok: false, error: "Guestbook is not set up." });
    });

    it("falls back to a message when a refusal carries no reason", async () => {
        mockFetch(async () => respond({ ok: false }, false, 500));
        expect(await loadGuestbook()).toEqual({ ok: false, error: messages.loadFailed });
    });

    it("reports the server as unreachable when the request never left", async () => {
        mockFetch(async () => { throw new TypeError("Failed to fetch"); });
        expect(await loadGuestbook()).toEqual({ ok: false, error: messages.unreachable });
    });
});

describe("signGuestbook", () => {
    const input = {
        name: "Cloud",
        message: "Nice sandbox.",
        token: "1234:abcd:sig",
        website: "",
    };

    it("posts the signature as JSON", async () => {
        const fetchMock = mockFetch(async () => respond({ ok: true }));

        await signGuestbook(input);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/guestbook.php");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({ "Content-Type": "application/json" });
        expect(JSON.parse(String(init?.body))).toEqual(input);
    });

    /**
     * The handler echoes the stored entry back so the list can show it without a
     * second round trip — and it is the stored one, not what was typed, so the
     * row on screen is what the server actually kept.
     */
    it("returns the entry the handler stored", async () => {
        mockFetch(async () => respond({
            ok: true,
            entry: { name: "Cloud", message: "Nice sandbox.", at: 1_757_000_000 },
        }));

        expect(await signGuestbook(input)).toEqual({
            ok: true,
            entry: { name: "Cloud", message: "Nice sandbox.", at: 1_757_000_000 },
        });
    });

    // The signature still counts; the caller falls back to a refresh.
    it("still succeeds when no entry is echoed back", async () => {
        mockFetch(async () => respond({ ok: true }));
        expect(await signGuestbook(input)).toEqual({ ok: true, entry: null });
    });

    it("surfaces the handler's reason for refusing", async () => {
        mockFetch(async () => respond({ ok: false, error: "Entries cannot contain links." }, false, 422));
        expect(await signGuestbook(input)).toEqual({ ok: false, error: "Entries cannot contain links." });
    });

    /**
     * The one that must never read as a signature. Checking response.ok alone
     * would let it through and the page would clear the form and thank someone
     * for an entry nobody stored.
     */
    it("treats a 200 with ok:false as a failure", async () => {
        mockFetch(async () => respond({ ok: false, error: "Guestbook is busy. Try later." }));
        expect(await signGuestbook(input)).toEqual({ ok: false, error: "Guestbook is busy. Try later." });
    });

    it("fails rather than throwing when the body is not JSON", async () => {
        mockFetch(async () => notJson());

        expect(await signGuestbook(input)).toEqual({ ok: false, error: messages.fallback });
    });

    it("reports the server as unreachable when the request never left", async () => {
        mockFetch(async () => { throw new TypeError("Failed to fetch"); });
        expect(await signGuestbook(input)).toEqual({ ok: false, error: messages.unreachable });
    });
});
