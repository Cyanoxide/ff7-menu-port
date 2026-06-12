// Bridge between page cursors and the close "X" button rendered by the Menu.

let isFocused = false;
const listeners = new Set<() => void>();

export const closeNav = {
    getFocus(): boolean {
        return isFocused;
    },

    setFocus(focus: boolean) {
        if (focus === isFocused) return;
        isFocused = focus;
        listeners.forEach((listener) => listener());
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
