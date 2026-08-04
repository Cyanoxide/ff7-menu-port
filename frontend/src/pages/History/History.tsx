import ContentBox from "../../components/ContentBox/ContentBox";
import HistorySave from "../../components/HistorySave/HistorySave";
import textToSprite from "../../util/textToSprite";
import educationJSON from "../../data/education.json";
import historyJSON from "../../data/history.json";
import type { HistoryType } from "../../context/types";

import saveStyles from "../../components/HistorySave/HistorySave.module.scss";

interface HistoryProps {
    historyType: string,
    focusedIndex?: number | null,
    onItemEnter?: (index: number) => void,
    onEmptyClick?: () => void,
}


const HistoryContent: React.FC<HistoryProps> = ({ historyType, focusedIndex = null, onItemEnter, onEmptyClick }) => {
    const history = (historyType === "education") ? (educationJSON as HistoryType[]) : (historyJSON as HistoryType[]);

    const MIN_ITEMS = 3;
    const placeholdersNeeded = Math.max(0, MIN_ITEMS - history.length);

    return (
        <>
            {history.map((item, index) => (
                <HistorySave key={item.id} historyItem={item} historyType={historyType} focused={focusedIndex === index} onEnter={() => onItemEnter?.(index)} />
            ))}

            {Array.from({ length: placeholdersNeeded }).map((_, index) => {
                const slotIndex = history.length + index;
                return (
                    <div key={index} className={saveStyles.historySave} data-focused={focusedIndex === slotIndex} onMouseEnter={() => onItemEnter?.(slotIndex)} onClick={() => onEmptyClick?.()}>
                        <ContentBox data-label="historySave" className="h-[235px] relative flex items-center"><span className="pl-32">{textToSprite("EMPTY", false, "yellow")}</span></ContentBox>
                    </div>
                );
            })}
        </>
    );
}

export default HistoryContent;
