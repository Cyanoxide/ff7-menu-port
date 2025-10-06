import ContentBox from "../contentBox/ContentBox";
import HistorySave from "../HistorySave/HistorySave";
import textToSprite from "../../util/textToSprite";

function HistoryContent() {
    const history = [
        {
            id: 1,
            name: "Direct Online Services",
            link: "https://www.directonlineservices.com/",
            user: "Jamie Pates",
            level: "34",
            role: "Senior Web Dev.",
            year: "2020-24",
            image_path: "/history__dos.png"
        },
        {
            id: 2,
            name: "Ruroc",
            link: "https://www.ruroc.com/",
            user: "Jamie Pates",
            level: "28",
            role: "Head Web Dev.",
            year: "2014-19",
            image_path: "/history__ruroc.png"
        },
        {
            id: 3,
            name: "Tangy Media",
            link: "https://www.tangymedia.co.uk/",
            user: "Jamie Pates",
            level: "22",
            role: "WordPress Dev.",
            year: "2012-13",
            image_path: "/history__tangymedia.png"
        },
    ]

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