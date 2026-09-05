/**
 * Which tab the cursor is on, shared between the page shell and whichever tab
 * is open.
 *
 * The tab row is drawn by the shell, in the header box, because it is the one
 * piece of the page that both tabs have. But the cursor that lands on it
 * belongs to the open tab's useCursorNav — each tab has its own set of groups,
 * and one hook covering both would mean a resolveMove that had to branch on the
 * tab at every turn.
 *
 * So the nav lives in the tab and the drawing lives in the shell, and this
 * carries the one value between them. Same shape and the same reasoning as
 * closeNav, which does exactly this for the X the Menu draws.
 *
 * Null means the cursor is somewhere else on the page.
 */

let focused: number | null = null;
const listeners = new Set<() => void>();

export const contactTabs = {
    getFocus(): number | null {
        return focused;
    },

    setFocus(index: number | null) {
        if (index === focused) return;
        focused = index;
        listeners.forEach((listener) => listener());
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
