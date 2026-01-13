type sounds = "select" | "back" | "error" | "materia" | "slash" | "crit" | "delete" | "heal" | "save" | "saveSelect";

export const loadSound = (sound: sounds) => {
    if (typeof window == "undefined") return;

    const src = "/audio/";

    const sounds = {
        "select": "select.mp3",
        "back": "back.mp3",
        "error": "error.mp3",
        "materia": "materia.mp3",
        "slash": "slash.mp3",
        "crit": "crit.mp3",
        "delete": "delete.mp3",
        "heal": "heal.mp3",
        "save": "save.mp3",
        "saveSelect": "saveSelect.mp3",
    }

    return new Audio(`${src}${sounds[sound]}`);
}

export const playLoadedSound = (audio: HTMLAudioElement | undefined, isSoundEnabled: boolean, isloop: boolean = false) => {
    if (isSoundEnabled && audio) {
        if (isloop) audio.loop = true;
        audio.volume = 0.2;
        audio.play().catch(() => { });
    }
}

export const stopLoadedSound = (audio: HTMLAudioElement | undefined, isSoundEnabled: boolean) => {
    if (isSoundEnabled && audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

const playSound = (soundName: sounds, isSoundEnabled: boolean, isloop: boolean = false) => {
    const audio = loadSound(soundName);

    if (isSoundEnabled && audio) {
        if (isloop) audio.loop = true;
        audio.volume = 0.2;
        audio.play().catch(() => { });
    }
}

export default playSound;