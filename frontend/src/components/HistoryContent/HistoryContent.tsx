import ContentBox from "../contentBox/ContentBox";
import PartyMember from "../PartyMember/PartyMember";
import textToSprite from "../../util/textToSprite";

import styles from "./HistoryContent.module.scss";

function HistoryContent() {
    return (
        <>
            <ContentBox data-label="historyHeader" top={0}><div></div></ContentBox>
        </>
    );
}

export default HistoryContent;