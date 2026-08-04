/**
 * Scrolls a list so one of its rows is on screen, touching only that list.
 *
 * `element.scrollIntoView({ block: "nearest" })` is the obvious way to do this
 * and is what the menu pages used to call, but it scrolls *every* scrollable
 * ancestor — the document included. #root's layout box is close to a thousand
 * pixels tall whatever the screen, so on a short viewport (a landscape phone)
 * the document overflows and is scrollable even though nothing looks scrollable,
 * and moving the cursor down a list dragged the whole app up behind the top of
 * the screen. `overflow: hidden` on html does not prevent that: it removes the
 * scrollbar, not the ability to be scrolled programmatically.
 */

const scrollParent = (element: HTMLElement): HTMLElement | null => {
    let node = element.parentElement;
    while (node) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
};

export const scrollIntoList = (item: HTMLElement | null | undefined) => {
    const list = item ? scrollParent(item) : null;
    if (!item || !list) return;

    const itemBox = item.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();

    // Rects come back in on-screen pixels and scrollTop is in layout pixels, so
    // the app's scale has to come out of the difference before it is applied
    const scale = listBox.height / list.clientHeight || 1;

    // Matches "nearest": move by exactly enough to bring the row inside, and do
    // nothing at all when it already is
    if (itemBox.top < listBox.top) {
        list.scrollTop -= (listBox.top - itemBox.top) / scale;
    } else if (itemBox.bottom > listBox.bottom) {
        list.scrollTop += (itemBox.bottom - listBox.bottom) / scale;
    }
};
