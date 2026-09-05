/**
 * What the page has to say about the last thing you did, shown in the
 * description strip under the header.
 *
 * The strip normally carries the open tab's one-line description. When there is
 * something to report — "Signed. Thank you!", or why an entry was refused — it
 * says that instead, and goes back to the description afterwards.
 *
 * A store rather than a prop, because the strip is drawn by Contact.tsx and the
 * thing that knows is the open tab. Same shape and the same reasoning as
 * contactTabs, which carries the tab cursor the other way across that seam, and
 * as closeNav for the X the Menu draws.
 *
 * Putting the message here rather than in a panel of its own is also what lets
 * it be long: the strip is the full width of the stage, against the 470px
 * column the form lives in.
 */

export interface ContactAlert {
    text: string;
    /** A data-text-color the sprite font knows: "blue", "red", "grey". */
    tone: string;
}

let alert: ContactAlert | null = null;
const listeners = new Set<() => void>();

export const contactAlert = {
    get(): ContactAlert | null {
        return alert;
    },

    /**
     * Compared field by field rather than by identity. Callers build a fresh
     * object each render and useSyncExternalStore re-reads during render, so
     * publishing an equal-but-new object every pass would loop.
     */
    set(next: ContactAlert | null) {
        if (next?.text === alert?.text && next?.tone === alert?.tone) return;
        alert = next;
        listeners.forEach((listener) => listener());
    },

    clear() {
        contactAlert.set(null);
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
