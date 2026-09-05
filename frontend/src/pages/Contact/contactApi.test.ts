import { afterEach, describe, expect, it, vi } from "vitest";
import { requestToken, sendMessage } from "./contactApi";

function mockFetch(body: unknown, ok = true) {
    const fetchMock = vi.fn(async () => ({ ok, json: async () => body }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const message = {
    name: "Cloud",
    email: "cloud@example.com",
    message: "Hello.",
    token: "1234:abcd:sig",
    website: "",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("requestToken", () => {
    it("returns the token", async () => {
        mockFetch({ ok: true, token: "1234:abcd:sig" });
        expect(await requestToken()).toBe("1234:abcd:sig");
    });

    it("returns an empty string when the request fails", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
        expect(await requestToken()).toBe("");
    });
});

describe("sendMessage", () => {
    it("posts the message to contact.php", async () => {
        const fetchMock = mockFetch({ ok: true });
        await sendMessage(message);

        const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/contact.php");
        expect(options.method).toBe("POST");
        expect(JSON.parse(String(options.body))).toEqual(message);
    });

    it("succeeds when the handler accepts it", async () => {
        mockFetch({ ok: true });
        expect(await sendMessage(message)).toEqual({ ok: true });
    });

    it("fails with the handler's error", async () => {
        mockFetch({ ok: false, error: "Message limit reached." }, false);
        expect(await sendMessage(message)).toEqual({ ok: false, error: "Message limit reached." });
    });

    it("fails when the body says ok is false, even on a 200", async () => {
        mockFetch({ ok: false, error: "Message could not be sent." });
        expect(await sendMessage(message)).toEqual({ ok: false, error: "Message could not be sent." });
    });

    it("fails when the server cannot be reached", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
        expect(await sendMessage(message)).toEqual({ ok: false, error: "Could not reach the server." });
    });
});
