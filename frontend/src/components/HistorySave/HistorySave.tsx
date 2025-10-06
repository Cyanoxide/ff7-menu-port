
import ContentBox from "../contentBox/ContentBox";
import textToSprite from "../../util/textToSprite";

import styles from "./HistorySave.module.scss";

type HistoryItem = {
    id: number;
    name: string;
    link: string;
    role: string;
    user: string;
    year: string;
    level: string;
    image_path: string;
};

interface historySaveProps {
    historyItem: HistoryItem;
};


const HistorySave: React.FC<historySaveProps> = ({ historyItem, ...props }) => {
    if (!historyItem) return;

    return (
        <>
            <a href={historyItem.link} title={historyItem.name} target="_blank" className={`${styles.historySave} cursor-pointer`} {...props}>
                <ContentBox data-label="historySave" className="h-[235px] relative">
                    <div className="mr-[414px] flex gap-5">
                        <img className="h-[11.5rem] w-auto" src={historyItem.image_path} />
                        <img className="h-[11.5rem] w-auto" src="/portrait.png" />
                        <div className="ml-2 mt-[1.3rem]">
                            <p className="mb-4">{textToSprite(historyItem.user)}</p>
                            <p className="flex"><span className="font-glyph" data-sprite="lv">lv</span><span>{textToSprite(historyItem.level, true)}</span></p>
                        </div>
                    </div>
                    <ContentBox data-label="historySaveMeta" className="absolute w-[27rem] h-[7rem] top-[31px] right-[-2px]">
                        <ul>
                            <li className="flex justify-between mb-3">
                                <span>{textToSprite("Role")}</span>
                                <span>{textToSprite(historyItem.role)}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>{textToSprite("Years")}</span>
                                <span>{textToSprite(historyItem.year)}</span>
                            </li>
                        </ul>
                    </ContentBox>
                    <ContentBox data-label="historySave" className="absolute w-[43.8rem] h-[5rem] bottom-[-11px] right-[-2px]">{textToSprite(historyItem.name)}</ContentBox>
                </ContentBox>
            </a>
        </>
    );
}

export default HistorySave;