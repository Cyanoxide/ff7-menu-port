import { useState } from "react";

import ContentBox from "../contentBox/ContentBox";
import PartyMember from "../PartyMember/PartyMember";
import textToSprite from "../../util/textToSprite";

import styles from "./ProjectsContent.module.scss";

function ProjectsContent() {
    const [description, setDescription] = useState("");
    const [moreInfo, setmoreInfo] = useState<string[]>([]);

    const handleMouseEnter = (item: string) => {
        if (item === "tripleTriad") {
            setDescription("Let's play a game of cards!");
            setmoreInfo(["This is a React project", "I built to authentically", "recreate the FF8", "version of Triple Triad", "to be playable in a", "web browser."])
        }
    }

    const handleMouseLeave = () => {
        setDescription("");
        setmoreInfo([]);
    }



    return (
        <>
            <ContentBox data-label="header" className="h-[84px] absolute">
                <div className="ml-4">
                    <span>{textToSprite("Use")}</span>
                </div>
            </ContentBox>
            <ContentBox data-label="description" className="h-[87px] absolute top-[93px]">{textToSprite(description)}</ContentBox>
            <ContentBox data-label="contentLeft" className="absolute top-[190px] bottom-0">
                <PartyMember memberId={1} />
                {!!moreInfo.length && <ContentBox className="absolute bottom-[20px] left-[30px] right-[34px]" data-label="moreInfo">
                    {moreInfo.map((item) => (<div className="mb-2">{textToSprite(item)}</div>))}
                </ContentBox>}
            </ContentBox>
            <ContentBox className="absolute top-[190px] right-0 bottom-0" data-label="contentRight">
                <ul>
                    <li className={styles.item} onMouseEnter={() => handleMouseEnter("tripleTriad")} onMouseLeave={handleMouseLeave}>
                        <a href="https://triple-triad.jamiepates.com" className="flex justify-between items-center" target="_blank">
                            <span className="flex items-center">
                                <img src="/cardicon.gif" alt="Card Icon" width="36" height="36" className="mr-2" />
                                <span>{textToSprite("Triple Triad")}</span>
                            </span>
                            <span className="flex">
                                <span className="mr-2">{textToSprite(":")}</span>
                                <span className="mt-1">{textToSprite("1", true)}</span>
                            </span>
                        </a>
                    </li>
                </ul>
            </ContentBox>
        </>
    );
}

export default ProjectsContent;