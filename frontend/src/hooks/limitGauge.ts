// The limit gauge, kept outside React so it survives moving between pages.
//
// PartyMember remounts on every route change, so component state would restart
// the refill each time you came back to the landing page. Module state does not,
// and it still starts full on a reload, which is what we want.

/** How long the gauge takes to refill once it has been spent */
const REFILL_MS = 5 * 60 * 1000;

/** How often the refill is published while it is running */
const TICK_MS = 1000;

let spentAt: number | null = null;
/**
 * The published value. useSyncExternalStore compares snapshots by identity and
 * re-reads during render, so this has to be a stored number rather than one
 * computed from the clock on every call — otherwise every render sees a new
 * value and React loops.
 */
let charge = 100;
let timer: number | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const percentageNow = () => {
    if (spentAt === null) return 100;
    return Math.min(100, ((Date.now() - spentAt) / REFILL_MS) * 100);
};

const stopTicking = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
};

const startTicking = () => {
    stopTicking();
    // Deliberately keeps running with nobody subscribed: that is what lets the
    // gauge carry on filling while you are on another page
    timer = window.setInterval(() => {
        charge = percentageNow();

        if (charge >= 100) {
            spentAt = null;
            charge = 100;
            stopTicking();
        }

        notify();
    }, TICK_MS);
};

export const limitGauge = {
    getCharge: () => charge,

    isReady: () => charge >= 100,

    /** Empties the gauge and starts it refilling */
    spend() {
        spentAt = Date.now();
        charge = 0;
        notify();
        startTicking();
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};

/** Exposed for the bar's transition timing, which paces itself to the tick */
export const LIMIT_REFILL_TICK_MS = TICK_MS;
