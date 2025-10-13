import ContentBox from "../contentBox/ContentBox";
import HistorySave from "../HistorySave/HistorySave";
import textToSprite from "../../util/textToSprite";
import historyJSON from "../../data/history.json";
import type { History } from "../../context/types";

function HistoryContent() {
    const history = (historyJSON as History[]);

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="historyHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Select a file.")}</ContentBox>
                <ContentBox data-label="historyFileLabel" className="h-full w-[225px] absolute top-0 right-[280px]">{textToSprite("FILE  01")}</ContentBox>
            </div>
            {history.map((item) => (
                <HistorySave key={item.id} historyItem={item} />
            ))}
        </>
    );
}

export default HistoryContent;