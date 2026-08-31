
import { useContext } from "../../context/context";
import ContentBox from "../ContentBox/ContentBox";
import type { PartialWindowColor } from "../../context/types";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import type { HistoryType } from "../../context/types";

import StaticPortrait from "../Portrait/StaticPortrait";

import styles from "./HistorySave.module.scss";

/**
 * EXPERIMENT: a face per save slot, ageing across the career.
 *
 * Keyed on the employer logo rather than on the slot's position, so reordering
 * or adding an entry cannot silently hand someone else's face to a job. Both
 * education entries share the youngest frame.
 */
const HISTORY_SHEET = "/portraits-history-spritesheet.png";
const HISTORY_FRAMES = 4;
/** Frames are 53x61, not the look sheet's 107x122 */
const HISTORY_ASPECT = "53 / 61";

/**
 * The data files give four corners as a flat array, in the order the config
 * screen names them. Undefined leaves the save on whatever colour the player
 * has chosen, so an entry without one is not a special case anywhere -- and a
 * null corner does the same for that corner alone, which ContentBox resolves.
 */
const cornersToWindowColor = (corners?: HistoryType["windowColor"]): PartialWindowColor | undefined =>
    corners && {
        topLeft: corners[0],
        topRight: corners[1],
        bottomLeft: corners[2],
        bottomRight: corners[3],
    };

const HISTORY_FRAME: Record<string, number> = {
    "/history__plymouth.png": 0,
    "/history__gloscol.png": 0,
    "/history__tangymedia.png": 1,
    "/history__ruroc.png": 2,
    "/history__dos.png": 3,
};

interface historySaveProps {
    historyItem: HistoryType;
    historyType: string;
    focused?: boolean;
    onEnter?: () => void;
    /** Slot index, so a stationary pointer can be matched to a row */
    "data-slot"?: number;
};

const HistorySave: React.FC<historySaveProps> = ({ historyItem, historyType, focused = false, onEnter, ...props }) => {
    const { isSoundEnabled } = useContext();
    const windowColor = cornersToWindowColor(historyItem?.windowColor);
    if (!historyItem) return;

    return (
        <>
            <a href={historyItem.link} onMouseEnter={() => onEnter?.()} onClick={() => playSound("saveSelect", isSoundEnabled)} title={historyItem.name} target="_blank" className={`${styles.historySave} cursor-pointer`} data-focused={focused} {...props}>
                <ContentBox data-label="historySave" className="h-[235px] relative" windowColor={windowColor}>
                    <div className="mr-[414px] flex gap-5">
                        <img className="h-[11.5rem] w-auto" src={historyItem.image_path} />
                        {/* Held rather than tracking: three of these render at
                            once, and three identical faces moving in step is
                            worse than three still ones. Sized from its height,
                            so no width prop -- the aspect ratio supplies the
                            other side. */}
                        <StaticPortrait
                            src="/portrait.png"
                            sheet={HISTORY_SHEET}
                            frame={HISTORY_FRAME[historyItem.image_path] ?? 0}
                            frames={HISTORY_FRAMES}
                            aspect={HISTORY_ASPECT}
                            className="h-[11.5rem] w-auto"
                        />
                        <div className="ml-2 mt-[1.3rem]">
                            <p className="mb-4">{textToSprite(historyItem.user)}</p>
                            <p className="flex"><span className="font-glyph" data-sprite="lv">lv</span><span>{textToSprite(historyItem.level.toString(), true)}</span></p>
                        </div>
                    </div>
                    <ContentBox data-label="historySaveMeta" className="absolute w-[27rem] h-[7rem] top-[31px] right-[-2px]" windowColor={windowColor}>
                        <ul>
                            <li className="flex justify-between mb-3">
                                {historyType !== "education" && <span>{textToSprite("Role")}</span>}
                                <span>{textToSprite(historyItem.role)}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>{textToSprite("Years")}</span>
                                <span>{textToSprite(historyItem.year)}</span>
                            </li>
                        </ul>
                    </ContentBox>
                    <ContentBox data-label="historySave" className="absolute w-[43.8rem] h-[5rem] bottom-[-11px] right-[-2px]" windowColor={windowColor}>{textToSprite(historyItem.name)}</ContentBox>
                </ContentBox>
            </a>
        </>
    );
}

export default HistorySave;