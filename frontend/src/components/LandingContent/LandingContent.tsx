import ContentBox from "../contentBox/ContentBox";
import PartyMember from "../PartyMember/PartyMember";
import Time from "../Time/Time";
import textToSprite from "../../util/textToSprite";

function LandingContent() {
    return (
        <>
            <ContentBox className="w-[1000px] h-[720px] m-auto absolute top-[44px]" data-label="party">
                <PartyMember memberId={1} showProgressBars={true} />
                <ContentBox className="absolute left-[53px] right-[220px] top-[294px]" data-label="bio">
                    <p className="mb-2">{textToSprite("I'm a Senior Web Developer based in")}</p>
                    <p className="mb-6">{textToSprite("Gloucester, UK.")}</p>
                    <p className="mb-6">{textToSprite("Welcome to my WIP sandbox.")}</p>
                    <p className="mb-2">{textToSprite("I plan to add an ever-growing collection")}</p>
                    <p className="mb-2">{textToSprite("of small technical projects here, mostly")}</p>
                    <p className="mb-2">{textToSprite("built with PS1 aesthetics in mind.")}</p>
                </ContentBox>
            </ContentBox>
            <ContentBox className="w-[280px] h-[110px] m-auto absolute right-0 bottom-[110px]" data-label="metaInfo">
                <ul className="flex justify-between flex-col h-full">
                    <li className="flex justify-between">
                        <span>{textToSprite("Time")}</span>
                        <Time />
                    </li>
                    <li className="flex justify-between">
                        <span>{textToSprite("Gil")}</span>
                        <span>{textToSprite("77777", true)}</span>
                    </li>
                </ul>
            </ContentBox>
            <ContentBox className="w-[535px] h-[95px] m-auto absolute right-0 bottom-0" data-label="pageInfo">{textToSprite("Homepage")}</ContentBox>
        </>
    );
}

export default LandingContent;