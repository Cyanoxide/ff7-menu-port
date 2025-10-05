
import ContentBox from "../contentBox/ContentBox";
import PartyMember from "../PartyMember/PartyMember";
import textToSprite from "../../util/textToSprite";

// import styles from "./HistorySave.module.scss";

function HistorySave() {
    return (
        <>
            <ContentBox data-label="historySave" className="h-[235px] relative">
                <ContentBox data-label="historySave" className="absolute w-[17rem] h-[7rem] top-[31px] right-[-2px]"></ContentBox>
                <ContentBox data-label="historySave" className="absolute w-[34rem] h-[5rem] bottom-[-11px] right-[-2px]"></ContentBox>
            </ContentBox>
        </>
    );
}

export default HistorySave;