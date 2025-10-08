import { useContext } from "../../context/context";

import textToSprite from "../../util/textToSprite";

const Time = () => {
    const { seconds } = useContext();

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    return <span data-label="time">{textToSprite(formatTime(seconds), true)}</span>;
}

export default Time;