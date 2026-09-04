import { afterEach, describe, expect, it, vi } from "vitest";

import { requestToken, sendMessage } from "./contactApi";
import messages from "../../../public/contact-messages.json";

/**
 * The contact form's send path.
 *
 * This is the part of the page most able to fail silently. Every outcome — a
 * stale token, a rate limit, a mailer that refused the message, a honeypot that
 * quietly sent nothing — arrives as the same one-line status beside Send, so a
 * regression that turns a failure into an apparent success is invisible by eye
 * and stays invisible until someone says they never got a reply.
 *
 * The handler itself is covered by tests/contact.sh, which drives it over HTTP.
 * What is checked here is the half that runs in the browser: that the request
 * is shaped the way the handler expects, and that every kind of refusal comes
 * back as a failure rather than as a shrug.
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

describe("requestToken", () => {
    it("returns the token the handler issued", async () => {
        mockFetch(async () => respond({ ok: true, token: "1234:abcd:sig" }));
        expect(await requestToken()).toBe("1234:abcd:sig");
    });

    it("asks contact.php for it", async () => {
        const fetchMock = mockFetch(async () => respond({ ok: true, token: "t" }));
        await requestToken();
        expect(fetchMock).toHaveBeenCalledWith("/contact.php");
    });

    /**
     * A token that could not be fetched is not worth interrupting the page for.
     * The send reports what went wrong, and the channels list still works — so
     * this must not throw into the mount effect and take the panel down.
     */
    it("returns an empty string when the request fails", async () => {
        mockFetch(async () => { throw new Error("offline"); });
        expect(await requestToken()).toBe("");
    });

    it("returns an empty string when the body carries no token", async () => {
        mockFetch(async () => respond({ ok: false, error: "Form is not configured." }));
        expect(await requestToken()).toBe("");
    });

    it("returns an empty string rather than a non-string token", async () => {
        mockFetch(async () => respond({ ok: true, token: 12345 }));
        expect(await requestToken()).toBe("");
    });
});

describe("sendMessage", () => {
    const input = {
        name: "Cloud",
        email: "cloud@example.com",
        message: "Hello.",
        token: "1234:abcd:sig",
        website: "",
    };

    it("posts the message as JSON", async () => {
        const fetchMock = mockFetch(async () => respond({ ok: true }));

        await sendMessage(input);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/contact.php");
        expect(init?.method).toBe("POST");
        // The handler reads php://input and json_decodes it. Form encoding gets
        // a 400, which is exactly the sort of thing nobody notices by eye.
        expect(init?.headers).toEqual({ "Content-Type": "application/json" });
        expect(JSON.parse(String(init?.body))).toEqual(input);
    });

    it("carries the token, so the handler does not refuse it as expired", async () => {
        const fetchMock = mockFetch(async () => respond({ ok: true }));
        await sendMessage(input);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).token).toBe("1234:abcd:sig");
    });

    it("carries the honeypot, so a bot that filled it is still caught", async () => {
        const fetchMock = mockFetch(async () => respond({ ok: true }));
        await sendMessage({ ...input, website: "http://spam.example" });
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).website).toBe("http://spam.example");
    });

    it("reports success when the handler accepted it", async () => {
        mockFetch(async () => respond({ ok: true }));
        expect(await sendMessage(input)).toEqual({ ok: true });
    });

    /**
     * The handler's own reason wins. It knows things the page cannot — which
     * rate limit was hit, whether the token was stale or already spent — and
     * those are the cases where a generic failure is least useful, because the
     * fix differs for each.
     */
    it("surfaces the handler's reason for a refusal", async () => {
        mockFetch(async () => respond({ ok: false, error: "Message limit reached." }, false, 429));
        expect(await sendMessage(input)).toEqual({ ok: false, error: "Message limit reached." });
    });

    /**
     * The case that must never be read as success: a 200 whose body says it
     * failed. Checking response.ok alone would let this through, and the page
     * would clear the form and say "Message sent" over a message that was not.
     */
    it("treats a 200 with ok:false as a failure", async () => {
        mockFetch(async () => respond({ ok: false, error: "Message could not be sent." }));
        expect(await sendMessage(input)).toEqual({ ok: false, error: "Message could not be sent." });
    });

    it("falls back to a message when a refusal carries no reason", async () => {
        mockFetch(async () => respond({ ok: false }, false, 500));
        expect(await sendMessage(input)).toEqual({ ok: false, error: messages.sendFailed });
    });

    it("fails rather than throwing when the body is not JSON", async () => {
        mockFetch(async () => notJson());

        expect(await sendMessage(input)).toEqual({ ok: false, error: messages.sendFailed });
    });

    it("reports the server as unreachable when the request never left", async () => {
        mockFetch(async () => { throw new TypeError("Failed to fetch"); });
        expect(await sendMessage(input)).toEqual({ ok: false, error: messages.unreachable });
    });

    /**
     * A filled honeypot is answered with a cheerful 200 and no email, on
     * purpose — a bot told it failed tries something else, one told it
     * succeeded goes away. So this *is* reported as sent, and that is correct
     * rather than a bug. Pinned here so the next person to read the handler and
     * find no mail in the log knows this is the intended behaviour.
     */
    it("reports a honeypot's cheerful 200 as sent", async () => {
        mockFetch(async () => respond({ ok: true }));
        expect(await sendMessage({ ...input, website: "bot" })).toEqual({ ok: true });
    });
});
