import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import { isPointerMoving } from "../../util/pointerActivity";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import styles from "./Projects.module.scss";

const PROJECTS = [
    {
        key: "reactXP",
        name: "React XP",
        icon: "/xpicon.png",
        link: "https://react-xp.jamiepates.com",
        description: "An authentic recreation of Windows XP",
        moreInfo: ["This is still a work in", "progress, but I'm", "currently working on", "recreating Windows XP", "from scratch using", "React and Typescript."],
    },
    {
        key: "p5rFusion",
        name: "P5R Fusion Calculator",
        icon: "/personaicon.png",
        link: "https://persona-calc.jamiepates.com",
        description: "A step-by-step fusion guide for Persona 5 Royal",
        moreInfo: ["I mostly built this", "because I wanted an", "excuse to play around", "with the Persona 5", "aesthetic. It's a fusion", "calculator for P5R."],
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
    const navigate = useNavigate();
    const [description, setDescription] = useState("");
    const [moreInfo, setmoreInfo] = useState<string[]>([]);
    const anchorRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const projectListRef = useRef<HTMLDivElement>(null);
    const projectItemRefs = useRef<(HTMLLIElement | null)[]>([]);

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [{ id: "items", size: PROJECTS.length }, { id: "close", size: 1 }],
        initial: null,
        fallback: { group: "items", index: 0 },
        enabled: true,
        resolveMove: (pos, dir) => {
            if (dir !== "up" && dir !== "down") return null;
            if (pos.group === "close") return { group: "items", index: (dir === "down") ? 0 : PROJECTS.length - 1 };
            if (dir === "up") return (pos.index === 0) ? { group: "close", index: 0 } : { group: "items", index: pos.index - 1 };
            return (pos.index === PROJECTS.length - 1) ? { group: "close", index: 0 } : { group: "items", index: pos.index + 1 };
        },
        onFocus: (pos) => {
            closeNav.setFocus(pos.group === "close");
            if (pos.group !== "items") return;
            const project = PROJECTS[pos.index];
            setDescription(project.description);
            setmoreInfo(project.moreInfo);
        },
        onConfirm: (pos) => {
            if (pos.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                setPosSilently(null);
                markKeyboardNavigation();
                navigate("/");
                return;
            }
            playSound("select", isSoundEnabled);
            anchorRefs.current[pos.index]?.click();
        },
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    // Keep the keyboard-focused project on screen as the cursor moves.
    useEffect(() => {
        if (pos?.group === "items") {
            projectItemRefs.current[pos.index]?.scrollIntoView({ block: "nearest" });
        }
    }, [pos]);

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
                {/* Fixed 48px rows in a 576px viewport => 12 fit in this taller box;
                    pl-24/-ml-24 reserves room for the cursor's left overhang. */}
                <div ref={projectListRef} className="hide-scrollbar -ml-24 h-[576px] snap-y snap-mandatory overflow-y-auto pl-24 pr-9">
                    <ul>
                        {PROJECTS.map((project, index) => (
                            <li key={project.key} ref={(el) => { projectItemRefs.current[index] = el; }} className={`${styles.item} flex h-[48px] snap-start items-center`} data-focused={isFocused("items", index)} onMouseEnter={() => { if (isPointerMoving()) focus({ group: "items", index }); }} onClick={() => playSound("select", isSoundEnabled)}>
                                <a href={project.link} ref={(el) => { anchorRefs.current[index] = el; }} className="flex h-full w-full justify-between items-center">
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
                </div>
                <Scrollbar targetRef={projectListRef} />
            </ContentBox>
        </>
    );
}

export default ProjectsContent;
