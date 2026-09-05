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
import type { WindowColor } from "../../context/types";

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

/**
 * The same thing for the guestbook, which shares the page.
 *
 * Kept separate rather than folded into one object with five fields: switching
 * tab must not carry what was typed in one form into the other, and two stores
 * that cannot see each other is a stronger guarantee of that than a convention
 * about which keys belong to which tab.
 */
export interface GuestbookDraft {
    name: string;
    message: string;
    /**
     * The window colours picked for the post. Null means "not chosen yet", so
     * the form seeds from the reader's own colour rather than from a stale one.
     */
    colors: WindowColor | null;
}

const EMPTY_SIGNATURE: GuestbookDraft = { name: "", message: "", colors: null };

let signature: GuestbookDraft = { ...EMPTY_SIGNATURE };

export const guestbookDraft = {
    get(): GuestbookDraft {
        return signature;
    },

    set(next: GuestbookDraft) {
        signature = next;
    },

    clear() {
        signature = { ...EMPTY_SIGNATURE };
    },
};
