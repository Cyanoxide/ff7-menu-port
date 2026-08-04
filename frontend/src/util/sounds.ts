/**
 * Menu sound effects, played through the Web Audio API.
 *
 * The obvious implementation — `new Audio(src).play()` per sound — is what this
 * replaces, and it behaved badly on iOS in three separate ways:
 *
 *  - **Late.** Each call built a fresh element, which then had to fetch (or at
 *    least re-read) and decode the file before it made a sound. On desktop that
 *    is fast enough to miss; on a phone the cursor had already moved on.
 *  - **Silent.** Safari only lets audio start from inside a user gesture. An
 *    element created in a hover or an effect had no gesture behind it, so the
 *    first sounds of a session were dropped.
 *  - **Overlapping.** Nothing tied a sound to the element that made it, so two
 *    events firing together produced two copies a few milliseconds apart, which
 *    reads as one smeared sound rather than two.
 *
 * Decoding every clip once up front and firing a buffer source per play fixes
 * all three: playback becomes a scheduling call with no I/O, and one unlock
 * during the first gesture covers every sound afterwards. The whole set is
 * ~130KB, so preloading it is cheaper than the stutter of not doing so.
 */

export type sounds = "select" | "back" | "error" | "materia" | "slash" | "crit" | "limit" | "delete" | "heal" | "save" | "saveSelect" | "fanfare";

const FILES: Record<sounds, string> = {
    select: "select.mp3",
    back: "back.mp3",
    error: "error.mp3",
    materia: "materia.mp3",
    slash: "slash.mp3",
    crit: "crit.mp3",
    limit: "limit.mp3",
    delete: "delete.mp3",
    heal: "heal.mp3",
    save: "save.mp3",
    saveSelect: "saveSelect.mp3",
    fanfare: "fanfare.mp3",
};

const VOLUME = 0.2;

/**
 * Two events landing on the same element from one tap — a synthetic mouseenter
 * and the click behind it — used to fire the same clip twice, milliseconds
 * apart. Identical sounds inside this window collapse to one. It is short
 * enough that deliberate repeats (a held arrow key repeats no faster than about
 * 30ms) still sound individually.
 */
const DEDUPE_MS = 20;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;
let contextUnavailable = false;

/**
 * Whether a user gesture has happened yet. Until one has, the context cannot be
 * running, and a sound started against a suspended context is not dropped by the
 * browser — it is scheduled. Every hover on the way to the first click piles up
 * and the whole backlog fires the moment the context resumes.
 *
 * Sound is opt-in, but the setting is remembered, so a returning visitor has it
 * on before they have touched anything and hits exactly that.
 */
let gestureSeen = false;

const buffers = new Map<sounds, AudioBuffer>();
const loading = new Map<sounds, Promise<void>>();
const lastPlayed = new Map<sounds, number>();

const getContext = (): AudioContext | null => {
    if (context || contextUnavailable) return context;
    if (typeof window === "undefined") return null;

    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) {
        // Nothing to fall back to, but the menu must not break over a sound
        contextUnavailable = true;
        return null;
    }

    context = new Ctor();
    preload();
    return context;
};

const load = (name: sounds): Promise<void> => {
    const existing = loading.get(name);
    if (existing) return existing;

    const request = (async () => {
        const ctx = getContext();
        if (!ctx) return;

        const response = await fetch(`/audio/${FILES[name]}`);
        const encoded = await response.arrayBuffer();
        // Safari's decodeAudioData settles its callbacks, not the promise it returns
        const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
            ctx.decodeAudioData(encoded, resolve, reject);
        });
        buffers.set(name, decoded);
    })().catch(() => {
        // A clip that will not decode should cost silence, not a crash. Drop the
        // record so a later play retries rather than being stuck on a failure.
        loading.delete(name);
    });

    loading.set(name, request);
    return request;
};

/** Decodes the whole set, so no single play is the one that pays for loading */
const preload = () => {
    (Object.keys(FILES) as sounds[]).forEach(load);
};

/**
 * Safari starts the context suspended and only resumes it from inside a user
 * gesture, so the first tap or key press has to do it. Resuming is most of the
 * job; the silent one-frame source is what convinces older iOS the context is
 * genuinely gesture-backed.
 */
const unlock = () => {
    // Set before resume() is even asked for: the click that follows a
    // pointerdown arrives long before the resume promise settles, and that
    // click's own sound is one we do want to hear.
    gestureSeen = true;

    const ctx = getContext();
    if (!ctx) return;

    if (ctx.state !== "running") void ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start(0);
};

/**
 * Only these count. The activation events a browser will unlock audio on are
 * pointer and key presses — a hover is not one, which is why no amount of moving
 * the mouse around the menu will start the sound. touchend is here for iOS,
 * which treats it as the activation rather than the pointerdown.
 */
const GESTURES = ["pointerdown", "touchend", "keydown"] as const;

const armUnlock = () => {
    const onGesture = () => {
        unlock();
        GESTURES.forEach((type) => window.removeEventListener(type, onGesture));
    };
    GESTURES.forEach((type) => window.addEventListener(type, onGesture, { passive: true }));
};

if (typeof window !== "undefined") {
    armUnlock();

    /**
     * iOS suspends the context when the page goes into the background, and on an
     * audio interruption such as a call. Coming back needs a fresh gesture, so
     * the listeners are put back rather than being a one-time thing — otherwise
     * sound simply stops working for the rest of the visit.
     */
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (context && context.state !== "running") {
            gestureSeen = false;
            armUnlock();
        }
    });
}

const start = (name: sounds, isLoop: boolean) => {
    const ctx = getContext();
    const buffer = ctx && buffers.get(name);
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = isLoop;

    const gain = ctx.createGain();
    gain.gain.value = VOLUME;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    // Each play gets its own nodes, so they are released once the clip ends
    // rather than accumulating across a long session
    source.onended = () => {
        source.disconnect();
        gain.disconnect();
    };
};

const playSound = (soundName: sounds, isSoundEnabled: boolean, isLoop: boolean = false) => {
    if (!isSoundEnabled) return;

    const ctx = getContext();
    if (!ctx) return;

    // Nothing has unlocked audio yet, so this cannot be heard now and must not
    // be scheduled for later — that is the backlog. Drop it. Hovering the menu
    // before the first click is exactly this case, and silence there is correct
    // rather than a compromise: the browser was never going to play it.
    if (ctx.state !== "running" && !gestureSeen) return;

    const now = performance.now();
    if (now - (lastPlayed.get(soundName) ?? -Infinity) < DEDUPE_MS) return;
    lastPlayed.set(soundName, now);

    const play = () => {
        if (buffers.has(soundName)) {
            start(soundName, isLoop);
            return;
        }
        // Only reachable in the first moments of a session, before the preload
        // finishes. Late beats silent, and it corrects itself immediately after.
        void load(soundName).then(() => start(soundName, isLoop));
    };

    if (ctx.state === "running") {
        play();
        return;
    }

    /**
     * A gesture has happened but resume() has not settled yet — the first click
     * of a session. One sound, wanted, so it waits rather than being dropped.
     *
     * Checked again on the way out: resume() settling does not promise the
     * context actually started, and playing into one that is still suspended is
     * what schedules a sound for later instead of playing it. That is the
     * backlog this whole path exists to avoid.
     */
    void ctx.resume().then(() => {
        if (ctx.state === "running") play();
    });
};

export default playSound;
