/**
 * What has been typed into the contact form, kept outside React so it survives
 * the page unmounting.
 *
 * Leaving the page throws the component away, and with it a half-written
 * message. That is a real loss for one keystroke: Escape and the X in the
 * corner both close the menu, and either is easy to hit by accident.
 *
 * Module state, not localStorage, on purpose. It lives as long as the tab and
 * dies with a refresh, which is the right lifetime — a draft is worth keeping
 * while you are still in the same visit, and quietly resurrecting someone's
 * half-written message days later is not.
 *
 * Same shape as closeNav and limitGauge: plain module state with a small API,
 * rather than context threaded through the app for one page's benefit.
 */
export interface ContactDraft {
    name: string;
    email: string;
    message: string;
}

const EMPTY: ContactDraft = { name: "", email: "", message: "" };

let draft: ContactDraft = { ...EMPTY };

export const contactDraft = {
    get(): ContactDraft {
        return draft;
    },

    set(next: ContactDraft) {
        draft = next;
    },

    /** Called once a message is actually sent, so returning gives a clean form. */
    clear() {
        draft = { ...EMPTY };
    },
};
