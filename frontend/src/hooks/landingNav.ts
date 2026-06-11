// Bridge between the Menu's cursor (which owns the landing page keys) and the
// PartyMember avatar/revive easter egg rendered by the Landing page.

export type LandingFocus = "avatar" | "revive" | null;

let currentFocus: LandingFocus = null;
const listeners = new Set<() => void>();

export const landingNav = {
    actions: {} as { attack?: () => void; revive?: () => void },

    getFocus(): LandingFocus {
        return currentFocus;
    },

    setFocus(focus: LandingFocus) {
        if (focus === currentFocus) return;
        currentFocus = focus;
        listeners.forEach((listener) => listener());
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
