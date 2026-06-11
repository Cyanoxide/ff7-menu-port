import { useRef, useState } from "react";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav } from "../../hooks/useCursorNav";

import styles from "./Projects.module.scss";

const PROJECTS = [
    {
        key: "reactXP",
        name: "React XP",
        icon: "/xpicon.png",
        link: "https://react-xp.jamiepates.com",
        description: "An authentic recreation of Windows XP",
        moreInfo: ["This is still a work in", "progress, but I'm", "currently working on", "recreating Windows XP", "from scratch using", "React and Typescript"],
    },
    {
        key: "tripleTriad",
        name: "Triple Triad",
        icon: "/cardicon.png",
        link: "https://triple-triad.jamiepates.com",
        description: "Let's play a game of cards!",
        moreInfo: ["This is a React project", "I built to authentically", "recreate the FF8", "version of Triple Triad", "to be playable in a", "web browser."],
    },
];

function ProjectsContent() {
    const { isSoundEnabled } = useContext();
    const [description, setDescription] = useState("");
    const [moreInfo, setmoreInfo] = useState<string[]>([]);
    const anchorRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    const { focus, isFocused } = useCursorNav({
        groups: [{ id: "items", size: PROJECTS.length }],
        initial: { group: "items", index: 0 },
        enabled: true,
        memoryKey: "projects",
        resolveMove: (pos, dir, { wrap }) => {
            if (dir === "up") return { group: "items", index: wrap(pos.index, -1, PROJECTS.length) };
            if (dir === "down") return { group: "items", index: wrap(pos.index, 1, PROJECTS.length) };
            return null;
        },
        onFocus: (pos) => {
            const project = PROJECTS[pos.index];
            setDescription(project.description);
            setmoreInfo(project.moreInfo);
        },
        onConfirm: (pos) => {
            playSound("select", isSoundEnabled);
            anchorRefs.current[pos.index]?.click();
        },
    });

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
                    {moreInfo.map((item) => (<div key={item} className="mb-2">{textToSprite(item)}</div>))}
                </ContentBox>}
            </ContentBox>
            <ContentBox className="absolute top-[190px] right-0 bottom-0" data-label="contentRight">
                <ul>
                    {PROJECTS.map((project, index) => (
                        <li key={project.key} className={`${styles.item} ${index < PROJECTS.length - 1 ? "mb-2.5" : ""}`} data-focused={isFocused("items", index)} onMouseEnter={() => focus({ group: "items", index })} onClick={() => playSound("select", isSoundEnabled)}>
                            <a href={project.link} ref={(el) => { anchorRefs.current[index] = el; }} className="flex justify-between items-center">
                                <span className="flex items-center">
                                    <img src={project.icon} alt="Card Icon" width="36" height="36" className="mr-3" />
                                    <span>{textToSprite(project.name)}</span>
                                </span>
                                <span className="flex">
                                    <span className="mr-2">{textToSprite(":")}</span>
                                    <span className="mt-1">{textToSprite("1", true)}</span>
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default ProjectsContent;
