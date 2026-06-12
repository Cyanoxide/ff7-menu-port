import { useEffect, useRef } from "react";

const KONAMI_SEQUENCE = [
    "ArrowUp", "ArrowUp",
    "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight",
    "ArrowLeft", "ArrowRight",
    "KeyB", "KeyA",
];

export function useKonamiCode(onUnlock: () => void, enabled: boolean = true) {
    const progressRef = useRef(0);
    const onUnlockRef = useRef(onUnlock);
    onUnlockRef.current = onUnlock;

    useEffect(() => {
        if (!enabled) {
            progressRef.current = 0;
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;

            if (e.code === KONAMI_SEQUENCE[progressRef.current]) {
                progressRef.current++;
                if (progressRef.current === KONAMI_SEQUENCE.length) {
                    progressRef.current = 0;
                    onUnlockRef.current();
                }
            } else {
                // A wrong key restarts the sequence (but may itself be the first input)
                progressRef.current = (e.code === KONAMI_SEQUENCE[0]) ? 1 : 0;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [enabled]);
}
