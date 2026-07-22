import { useState } from "react";
import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import Time from "../../components/Time/Time";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import locations from "../../data/locations.json";
import styles from "./Landing.module.scss";

function LandingContent() {
    const { isSoundEnabled } = useContext();

    // Show a random FF7 location screen name, re-rolled on each page load
    // or whenever the refresh button is pressed.
    const [location, setLocation] = useState(
        () => locations[Math.floor(Math.random() * locations.length)]
    );

    const refreshLocation = () => {
        playSound("select", isSoundEnabled);
        setLocation(prev => {
            if (locations.length < 2) return prev;
            let next = prev;
            while (next === prev) next = locations[Math.floor(Math.random() * locations.length)];
            return next;
        });
    };

    return (
        <>
            <ContentBox className="w-[1000px] h-[720px] m-auto absolute top-[44px]" data-label="party">
                <PartyMember memberId={1} showProgressBars={true} healthReduction={true} />
                <div className="flex items-center justify-center h-[340px] w-[720px] left-[53px] right-[220px] top-[294px] absolute">
                    <ContentBox data-label="bio">
                        <p className="mb-2">{textToSprite("I'm a Senior Web Developer based in")}</p>
                        <p className="mb-6">{textToSprite("Gloucester, UK.")}</p>
                        <p className="mb-6">{textToSprite("Welcome to my personal sandbox.")}</p>
                        <p className="mb-2">{textToSprite("I plan to add an ever-growing collection")}</p>
                        <p className="mb-2">{textToSprite("of small technical projects here, mostly")}</p>
                        <p className="mb-2">{textToSprite("built with PS1 aesthetics in mind.")}</p>
                    </ContentBox>
                </div>
            </ContentBox>
            <ContentBox className="w-[280px] h-[110px] m-auto absolute right-0 bottom-[110px]" data-label="metaInfo">
                <ul className="flex justify-between flex-col h-full">
                    <li className="flex justify-between">
                        <span>{textToSprite("Time")}</span>
                        <Time />
                    </li>
                    <li className="flex justify-between">
                        <span>{textToSprite("Gil")}</span>
                        <span>{textToSprite("86675", true)}</span>
                    </li>
                </ul>
            </ContentBox>
            <ContentBox className={`${styles.pageInfo} w-[535px] h-[95px] m-auto absolute right-0 top-0 flex items-center justify-between`} data-label="pageInfo">
                <span>{textToSprite(location)}</span>
                <span className={`${styles.refresh} font-glyph`} data-sprite="reset-icon" onClick={refreshLocation}></span>
            </ContentBox>
        </>
    );
}

export default LandingContent;