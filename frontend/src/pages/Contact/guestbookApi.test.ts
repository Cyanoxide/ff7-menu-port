import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGuestbook, signGuestbook } from "./guestbookApi";

function mockFetch(body: unknown, ok = true) {
    const fetchMock = vi.fn(async () => ({ ok, json: async () => body }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const entry = { name: "Cloud", message: "Nice sandbox.", at: 1757000000 };

const signature = {
    name: "Cloud",
    message: "Nice sandbox.",
    token: "1234:abcd:sig",
    website: "",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("loadGuestbook", () => {
    it("returns the entries and the count", async () => {
        mockFetch({ ok: true, token: "t", count: 42, entries: [entry] });
        const result = await loadGuestbook();
        expect(result).toEqual({ ok: true, page: { token: "t", count: 42, entries: [entry] } });
    });

    it("ignores entries that are missing a name or a message", async () => {
        mockFetch({ ok: true, token: "t", count: 2, entries: [entry, { name: "Broken" }] });
        const result = await loadGuestbook();
        expect(result.ok && result.page.entries).toEqual([entry]);
    });

    it("fails with the handler's error", async () => {
        mockFetch({ ok: false, error: "Guestbook is not set up." }, false);
        expect(await loadGuestbook()).toEqual({ ok: false, error: "Guestbook is not set up." });
    });
});

describe("signGuestbook", () => {
    it("posts the signature to guestbook.php", async () => {
        const fetchMock = mockFetch({ ok: true });
        await signGuestbook(signature);

        const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/guestbook.php");
        expect(options.method).toBe("POST");
        expect(JSON.parse(String(options.body))).toEqual(signature);
    });

    it("fails with the handler's error", async () => {
        mockFetch({ ok: false, error: "Entries cannot contain links." }, false);
        expect(await signGuestbook(signature)).toEqual({ ok: false, error: "Entries cannot contain links." });
    });

    it("fails when the body says ok is false, even on a 200", async () => {
        mockFetch({ ok: false, error: "Guestbook is busy. Try later." });
        expect(await signGuestbook(signature)).toEqual({ ok: false, error: "Guestbook is busy. Try later." });
    });
});
