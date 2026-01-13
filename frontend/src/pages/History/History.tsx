import ContentBox from "../../components/ContentBox/ContentBox";
import HistorySave from "../../components/HistorySave/HistorySave";
import textToSprite from "../../util/textToSprite";
import educationJSON from "../../data/education.json";
import historyJSON from "../../data/history.json";
import type { HistoryType } from "../../context/types";

interface HistoryProps {
    historyType: string,
}


const HistoryContent: React.FC<HistoryProps> = ({ historyType }) => {
    const history = (historyType === "education") ? (educationJSON as HistoryType[]) : (historyJSON as HistoryType[]);

    const MIN_ITEMS = 3;
    const placeholdersNeeded = Math.max(0, MIN_ITEMS - history.length);

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="historyHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Select a file.")}</ContentBox>
                <ContentBox data-label="historyFileLabel" className="h-full w-[225px] absolute top-0 right-[280px] flex">{textToSprite("FILE", false, "yellow")}{textToSprite((historyType !== "education") ? " 01" : " 02")}</ContentBox>
            </div>
            {history.map((item) => (
                <HistorySave key={item.id} historyItem={item} historyType={historyType} />
            ))}

            {Array.from({ length: placeholdersNeeded }).map((_, index) => (
                <ContentBox data-label="historySave" key={index} className="h-[235px] relative flex items-center"><span className="pl-32">{textToSprite("EMPTY", false, "yellow")}</span></ContentBox>
            ))}
        </>
    );
}

export default HistoryContent;