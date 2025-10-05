import ContentBox from "../contentBox/ContentBox";
import HistorySave from "../HistorySave/HistorySave";
import textToSprite from "../../util/textToSprite";

import styles from "./HistoryContent.module.scss";

function HistoryContent() {
    const history = [
        {
            id: 1,
            name: "Direct Online Services",
            link: "https://www.worktop-express.co.uk/",
            level: "24",
            time: "59:23:01",
            gil: 54799
        },
        {
            id: 2,
            name: "Ruroc",
            link: "https://www.ruroc.com/",
            level: "28",
            time: "34:42:30",
            gil: 41045
        },
        {
            id: 3,
            name: "Tangy Media",
            link: "https://www.tangymedia.co.uk/",
            level: "22",
            time: "8:09:49",
            gil: 24350
        },
    ]

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="historyHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Select a file.")}</ContentBox>
                <ContentBox data-label="historyFileLabel" className="h-full w-[225px] absolute top-0 right-[278px]">{textToSprite("FILE  01")}</ContentBox>
            </div>
            <HistorySave />
            <HistorySave />
            <HistorySave />
        </>
    );
}

export default HistoryContent;