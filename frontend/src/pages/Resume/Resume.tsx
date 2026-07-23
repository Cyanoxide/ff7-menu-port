import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import skillsJSON from "../../data/skills.json";
import historyJSON from "../../data/history.json";
import educationJSON from "../../data/education.json";
import type { SkillType, HistoryType } from "../../context/types";

import styles from "./Resume.module.scss";

const TITLE = ["Senior Web Developer &", "Front-End Software Engineer"];

// Colour for the headings (title + section badges). Try white for now; easy to
// switch back to "yellow" or "blue" here.
const HEADING_COLOR = "white";

const CONTACT: [string, string][] = [
    ["Location", "Gloucester, UK"],
    ["Email", "me@jamiepates.co.uk"],
    ["Phone", "+44 7869 666 339"],
    ["Experience", "10+ Years"],
];

const LINKS: [string, string][] = [
    ["Download PDF", "/Jamie_Pates_Resume_2025.pdf"],
    ["GitHub", "https://github.com/Cyanoxide"],
    ["LinkedIn", "https://www.linkedin.com/in/jamiepates/"],
];

const INTRO: string[] = [
    "I'm a Gloucester based Senior Web Developer with over 10 years of hands-on experience across the industry, both on-site and remote.",
    "I lean towards the Front-end side of development, but I'm more than comfortable working on complex Back-end tasks, too.",
    "I've led small teams, and I'm at my best under pressure in startups and fast-growing companies where things change quickly.",
];

const WORK_DESC: Record<number, string> = {
    1: "Overhauled a legacy checkout system, co-developed a bespoke Django and Python e-commerce platform, built payment gateways, B2B reward schemes, and real-time filtering systems. Promoted to Senior and led the web team.",
    2: "Joined as the first employee and grew into Head of Web Development, managing two developers across several platforms, as well as handling, development, graphic design, and IT support.",
    3: "University placement year at a local web agency. Built WordPress sites for clients and extended existing PHP modules to fit their needs.",
};

const PROJECTS = [
    {
        name: "Final Fantasy 7 Menu",
        icon: "/favicon.png",
        iconSize: 40,
        link: "https://jamiepates.com",
        sub: "React & TypeScript Portfolio",
        desc: "This site - A faithful recreation of the FF7 menu, built in React with authentic animations and sounds.",
    },
    {
        name: "Triple Triad",
        icon: "/cardicon.png",
        iconSize: 52,
        link: "https://triple-triad.jamiepates.com",
        sub: "React & TypeScript Card Game",
        desc: "An authentic, fully playable recreation of the FF8 Triple Triad card game, cards and rules included.",
    },
    {
        name: "React XP",
        icon: "/xpicon.png",
        iconSize: 52,
        link: "https://react-xp.jamiepates.com",
        sub: "React & TypeScript Recreation",
        desc: "A semi-authentic Windows XP recreation, focused on UI behaviour, interactions and app state.",
    },
];

// The sprite font renders each line with white-space: nowrap, so text is
// pre-wrapped to a character budget matching the column width (~17px/char).
const wrap = (text: string, max: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
        if (!line) line = word;
        else if ((line + " " + word).length <= max) line += " " + word;
        else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
};

function ResumeContent() {
    const { isSoundEnabled, isCRTEnabled } = useContext();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    // PostgreSQL is dropped here only (keeps the resume grid an even count).
    const skills = (skillsJSON as SkillType[]).filter((s) => s.name !== "PostgreSQL");
    const work = historyJSON as HistoryType[];
    const education = educationJSON as HistoryType[];

    const STEP = 72;

    useCursorNav({
        groups: [{ id: "close", size: 1 }],
        initial: null,
        fallback: { group: "close", index: 0 },
        enabled: true,
        resolveMove: (_pos, dir) => {
            const el = scrollRef.current;
            if (el && (dir === "up" || dir === "down")) el.scrollBy({ top: dir === "down" ? STEP : -STEP });
            return null;
        },
        resolvePageJump: (_pos, dir) => {
            const el = scrollRef.current;
            if (el) el.scrollBy({ top: (dir === "pageDown" ? 1 : -1) * el.clientHeight * 0.9 });
            return null;
        },
        onFocus: (pos) => closeNav.setFocus(pos.group === "close"),
        onConfirm: (pos) => {
            if (pos.group !== "close") return;
            playSound("back", isSoundEnabled);
            closeNav.setFocus(false);
            markKeyboardNavigation();
            navigate("/");
        },
        onCancel: () => {
            closeNav.setFocus(false);
            return false;
        },
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    const heading = (title: string) => (
        <div className={styles.heading}>
            <ContentBox data-label="resumeSection">{textToSprite(title, false, HEADING_COLOR)}</ContentBox>
        </div>
    );

    // Divider drawn with the sprite font's underscore glyphs.
    const separator = (key: string) => (
        <div key={key} className={styles.separator}>{textToSprite("_".repeat(40))}</div>
    );

    const externalLink = (label: string, href: string) => (
        <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={styles.link}
            data-text-color="yellow"
            onClick={() => playSound("select", isSoundEnabled)}
        >
            {textToSprite(label, false, "yellow")}
            <span className="font-glyph ml-2" data-sprite="external-link-icon"></span>
        </a>
    );

    const record = (item: HistoryType, desc?: string, centered = false) => (
        <div key={item.id} className={`${styles.record} ${centered ? styles.recordCenter : ""}`}>
            <img src={item.image_path} alt="" className={styles.logo} />
            <div className={styles.recordBody}>
                <div className="flex justify-between items-baseline">
                    <span>{textToSprite(item.name)}</span>
                    <span>{textToSprite(item.year, false, "blue")}</span>
                </div>
                <p className={styles.role}>{textToSprite(item.role, false, "blue")}</p>
                {desc && wrap(desc, 46).map((l, i) => <p key={i} className={styles.line}>{textToSprite(l)}</p>)}
            </div>
        </div>
    );

    const projectRecord = (pr: typeof PROJECTS[number]) => (
        <a
            key={pr.name}
            href={pr.link}
            target="_blank"
            rel="noreferrer"
            className={styles.record}
            onClick={() => playSound("select", isSoundEnabled)}
        >
            <img src={pr.icon} alt="" className={styles.icon} style={{ width: pr.iconSize, height: pr.iconSize }} />
            <div className={styles.recordBody}>
                <p className={styles.projectName}>{textToSprite(pr.name)}</p>
                <p className={styles.role}>{textToSprite(pr.sub, false, "blue")}</p>
                {wrap(pr.desc, 52).map((l, i) => <p key={i} className={styles.line}>{textToSprite(l)}</p>)}
            </div>
        </a>
    );

    const withSeparators = (nodes: React.ReactNode[], prefix: string) =>
        nodes.flatMap((node, i) => (i < nodes.length - 1 ? [node, separator(`${prefix}-${i}`)] : [node]));

    return (
        <>
            <ContentBox data-label="header" className="h-[84px] absolute">
                <div className="ml-4">{textToSprite("Jamie Pates")}</div>
            </ContentBox>

            <ContentBox data-label="resumeContent" className="absolute top-[93px] bottom-0">
                <div ref={scrollRef} className={`${styles.scroll} hide-scrollbar overflow-y-auto`}>
                    <div className={styles.doc}>

                        {/* PROFILE */}
                        <div className={styles.profile}>
                            <div className={styles.profileTop}>
                                <ContentBox data-label="resumeTitle">
                                    {TITLE.map((l, i) => <p key={i} className={styles.title}>{textToSprite(l, false, HEADING_COLOR)}</p>)}
                                </ContentBox>
                                <ul className={styles.links}>
                                    {LINKS.map(([label, href]) => <li key={label}>{externalLink(label, href)}</li>)}
                                </ul>
                            </div>
                            {separator("sep-title")}
                            <div className={styles.profileRow}>
                                <img src="/portrait.png" alt="Portrait" className={styles.portrait} />
                                <ul className={styles.stats}>
                                    {CONTACT.map(([label, value]) => (
                                        <li key={label} className="flex justify-between">
                                            <span>{textToSprite(label, false, "blue")}</span>
                                            <span>{textToSprite(value)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {separator("sep-intro")}

                        {INTRO.map((para, b) => (
                            <div key={b} className={styles.paragraph}>
                                {wrap(para, 55).map((l, i) => <p key={i} className={styles.line}>{textToSprite(l)}</p>)}
                            </div>
                        ))}

                        {/* SKILLS */}
                        {separator("sep-skills")}
                        {heading("Skills")}
                        <div className={styles.materiaGrid}>
                            {skills.map((skill) => (
                                <div key={skill.id} className={styles.materiaRow}>
                                    <span className={`${styles.materia} flex items-center`} data-color={skill.color}>
                                        {textToSprite(skill.name)}
                                    </span>
                                    <ul className={`${styles.stars} flex`}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <li key={i} className={styles.star} data-color={skill.color} data-star={i < skill.score} data-crt={isCRTEnabled}></li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* WORK HISTORY */}
                        {separator("sep-work")}
                        {heading("Work History")}
                        {withSeparators(work.map((item) => record(item, WORK_DESC[item.id])), "w")}

                        {/* EDUCATION */}
                        {separator("sep-edu")}
                        {heading("Education")}
                        {withSeparators(education.map((item) => record(item, undefined, true)), "e")}

                        {/* PROJECTS */}
                        {separator("sep-proj")}
                        {heading("Personal Projects")}
                        {withSeparators(PROJECTS.map((pr) => projectRecord(pr)), "p")}

                        {separator("sep-links")}
                        <div className={styles.footerLinks}>
                            {externalLink("Download PDF", LINKS[0][1])}
                            <div className={styles.footerRight}>
                                {externalLink("GitHub", LINKS[1][1])}
                                <span className={styles.pipe}>{textToSprite("|", false, "grey")}</span>
                                {externalLink("LinkedIn", LINKS[2][1])}
                            </div>
                        </div>
                    </div>
                </div>
                <Scrollbar targetRef={scrollRef} />
            </ContentBox>
        </>
    );
}

export default ResumeContent;
