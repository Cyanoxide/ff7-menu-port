/**
 * Talking to contact.php.
 *
 * Pulled out of the component so the send path can be tested without mounting a
 * page. It is the part most able to fail silently — every failure mode ends in
 * the same one-line status message beside Send, and three of them
 * (a rejected token, a refused rate limit, a mailer that did not accept the
 * message) look identical from the outside.
 *
 * Everything here returns a result rather than throwing. The page has one place
 * to put an error, so an exception escaping into a click handler would be a
 * blank status line and a message nobody sent.
 */

/**
 * The same file contact.php reads at runtime, so the two cannot drift — they
 * already had, in two places. It lives in public/ because that is what Vite
 * copies into dist/ verbatim for the handler to find; importing it here bundles
 * the identical strings into the client.
 */
import messages from "../../../public/contact-messages.json";

const ENDPOINT = "/contact.php";

export interface ContactMessage {
    name: string;
    email: string;
    message: string;
    /** The signed token from the handler's GET */
    token: string;
    /** The honeypot's value, read straight off the DOM. Empty for a real person. */
    website: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Fetch a signed token.
 *
 * Doing this is also what starts the clock on the handler's minimum fill time —
 * a form submitted within a few seconds of the page opening was not filled in
 * by a person.
 *
 * Returns an empty string rather than throwing. A token that could not be
 * fetched is not worth interrupting the page for: the links still work, and the
 * send itself reports what went wrong.
 */
export async function requestToken(): Promise<string> {
    try {
        const response = await fetch(ENDPOINT);
        const body = await response.json();
        return typeof body?.token === "string" ? body.token : "";
    } catch {
        return "";
    }
}

/**
 * Post a message.
 *
 * A token is single use, so the caller refreshes it after a successful send.
 * Without that, writing a second message fails with "Already sent" and the only
 * way out is a reload.
 */
export async function sendMessage(input: ContactMessage): Promise<SendResult> {
    let response: Response;

    try {
        response = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
    } catch {
        // The request never left, so nothing was sent and nothing is pending
        return { ok: false, error: messages.unreachable };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
        /**
         * The handler's own reason wins where it gave one. It knows things the
         * page cannot — which rate limit was hit, whether the token was stale
         * or already spent — and those are the cases where a generic failure is
         * least useful, because the fix differs for each.
         */
        return { ok: false, error: body?.error ?? messages.sendFailed };
    }

    return { ok: true };
}
