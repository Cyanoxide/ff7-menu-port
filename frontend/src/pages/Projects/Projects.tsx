import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import ImageCarousel, { type Shot } from "./ImageCarousel";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import { isPointerMoving } from "../../util/pointerActivity";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import skills from "../../data/skills.json";

import styles from "./Projects.module.scss";

type Entry = {
    key: string;
    name: string;
    icon: string;
    link: string;
    /** Optional fuller title for the detail panel, where there is room for it.
     *  The list column is narrow, so `name` is the short form used there. */
    fullName?: string;
    /** Year it was built, shown beside the name */
    date: string;
    /** Names from skills.json — each is drawn as a materia of that skill's colour */
    skills: string[];
    /** Paths under public/, shown in the carousel. Omit and the Images link
     *  is not offered. `{ src, pan: true }` treats `src` as a whole-page capture
     *  and slides it on hover. See the note in ImageCarousel. */
    screenshots?: Shot[];
    description: string;
    moreInfo: string[];
};

// Looked up by name so an entry can just list what it was built with
const SKILL_BY_NAME = new Map(skills.map((skill) => [skill.name, skill]));

// The sprite font sets each line nowrap, so anything that might overrun its
// column has to be broken into lines up front. Same approach as the resume.
// Characters that fit across the detail panel. The layout is a fixed design
// that scales as a whole, so this holds at every screen size.
const TITLE_WIDTH = 24;

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

/** How long hover is ignored on the tab row after arriving on the page.
 *  The panels fade in over ~450ms, and crossing the row on the way to the list
 *  during that time should not switch tab. */
const TAB_SETTLE_MS = 600;

const TABS = [
    { key: "projects", label: "Projects" },
    { key: "websites", label: "Websites" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PROJECTS: Entry[] = [
    {
        key: "reactXP",
        name: "React XP",
        date: "2026",
        skills: ["React", "Typescript", "Tailwind"],
        icon: "/xpicon.png",
        link: "https://react-xp.jamiepates.com",
        screenshots: [{ src: "/shots/react-xp.webp", hover: "/shots/react-xp.mp4" }],
        description: "An authentic recreation of Windows XP.",
        moreInfo: ["This is still a work in", "progress, but I'm", "currently working on", "recreating Windows XP", "from scratch using", "React and Typescript."],
    },
    {
        key: "p5rFusion",
        name: "P5R Fusion Calculator",
        date: "2026",
        skills: ["React", "Typescript", "SASS/LESS"],
        icon: "/personaicon.png",
        link: "https://persona-calc.jamiepates.com",
        screenshots: ["/shots/persona-calc.gif"],
        description: "A step-by-step fusion guide for Persona 5 Royal.",
        moreInfo: ["I mostly built this", "because I wanted an", "excuse to play around", "with the Persona 5", "aesthetic. It's a fusion", "calculator for P5R."],
    },
    {
        key: "tripleTriad",
        name: "Triple Triad",
        date: "2025",
        skills: ["React", "Typescript", "Photoshop"],
        icon: "/cardicon.png",
        link: "https://triple-triad.jamiepates.com",
        // Not a pan: the still stands in until hovered, then the video loops
        screenshots: [{ src: "/shots/triple-triad.webp", hover: "/shots/triple-triad.mp4" }],
        description: "Let's play a game of cards!",
        moreInfo: ["This is a React project", "I built to authentically", "recreate the FF8", "version of Triple Triad", "to be playable in a", "web browser."],
    },
    {
        key: "fillerless",
        name: "Fillerless",
        date: "2020",
        skills: ["REST APIs", "SQL", "PHP", "Javascript"],
        icon: "/fillerlessicon.png",
        link: "https://fillerless.jamiepates.com",
        screenshots: [
            { src: "/shots/fillerless-desktop-page.webp", pan: true },
            // One phone capture squares this entry's whole carousel
            { src: "/shots/fillerless-mobile-page.webp", pan: true, mobile: true },
        ],
        description: "An app that provides watchlists for TV Shows and Anime.",
        moreInfo: ["I built this a while back,", "as a way to further", "my understanding", "of how to effectively", "integrate REST APIs", "into my projects."],
    },
    {
        key: "overwatchSens",
        name: "Overwatch Calculator",
        fullName: "Overwatch Sensitivity Calculator",
        date: "2019",
        skills: ["React", "Javascript", "SASS/LESS", "JSON"],
        icon: "/overwatchicon.png",
        link: "https://overwatch-sens.jamiepates.com",
        screenshots: [{ src: "/shots/overwatch-page.webp", pan: true }],
        description: "A mouse sensitivity calculator specifically for Overwatch.",
        moreInfo: ["Calculates your ideal", "sensitivity based on", "your current settings,", "your hero, and the", "settings of professional", "Overwatch players."],
    },
];


const WEBSITES: Entry[] = [
        {
        key: "worktopexpress",
        name: "Worktop Express",
        date: "2020 - 2025",
        skills: ["Python", "Django", "PHP", "Javascript"],
        icon: "/siteicon.png?v=12",
        link: "https://worktop-express.co.uk",
        screenshots: [
            { src: "/shots/worktop-express-desktop-page.webp", pan: true },
            { src: "/shots/worktop-express-mobile-page.webp", pan: true, mobile: true },
        ],
        description: "Websites that I've built, or worked on with others.",
        moreInfo: ["Initially built with PHP, it", "was later migrated to a", "bespoke Python and", "Django CMS, which", "I helped to create."],
    },
    {
        key: "fenix",
        name: "Fenix Shop",
        date: "2023 - 2025",
        skills: ["Python", "Django", "Javascript"],
        icon: "/siteicon.png?v=12",
        link: "https://fenixforinteriors.shop",
        screenshots: [
            { src: "/shots/fenix-desktop-page.webp", pan: true },
            { src: "/shots/fenix-mobile-page.webp", pan: true, mobile: true },
        ],
        description: "Websites that I've built, or worked on with others.",
        moreInfo: ["Whilst at Direct Online", "Services, this was my", "first introduction to", "working with Python,", "and Django."],
    },
    {
        key: "ruroc",
        name: "Ruroc",
        date: "2014 - 2019",
        skills: ["PHP", "CMS", "Photoshop"],
        icon: "/siteicon.png?v=12",
        link: "https://ruroc.com",
        // Two pages rather than one: a product page, then the home page, each
        // captured on desktop and on a phone
        screenshots: [
            { src: "/shots/ruroc-product-desktop-page.webp", pan: true },
            { src: "/shots/ruroc-product-mobile-page.webp", pan: true, mobile: true },
            { src: "/shots/ruroc-home-desktop-page.webp", pan: true },
            { src: "/shots/ruroc-home-mobile-page.webp", pan: true, mobile: true },
        ],
        description: "Websites that I've built, or worked on with others.",
        moreInfo: ["Over my time at Ruroc", "I delivered many new site", "refreshes and page", "designs, largely using", "PHP and Prestashop."],
    },
];

const ENTRIES: Record<TabKey, Entry[]> = { projects: PROJECTS, websites: WEBSITES };

// Drawn with the sprite font's underscore glyphs, the same divider the resume
// puts between its records. 21 spans the panel allowing for its overlap.
const separator = <div className={styles.separator}>{textToSprite("_".repeat(21))}</div>;

function ProjectsContent() {
    const { isSoundEnabled, isCRTEnabled } = useContext();
    const navigate = useNavigate();
    const [tab, setTab] = useState<TabKey>("projects");
    // The whole entry, so the left panel can show everything about it rather
    // than just the two strings the description and info boxes needed
    const [selected, setSelected] = useState<Entry | null>(null);
    const [showImages, setShowImages] = useState(false);
    const [hasScrollbar, setHasScrollbar] = useState(false);
    const [tabsSettled, setTabsSettled] = useState(false);
    const anchorRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const projectListRef = useRef<HTMLDivElement>(null);
    const projectItemRefs = useRef<(HTMLLIElement | null)[]>([]);

    const entries = ENTRIES[tab];
    const tabIndex = TABS.findIndex((entry) => entry.key === tab);

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "tabs", size: TABS.length },
            { id: "items", size: entries.length },
            { id: "close", size: 1 },
        ],
        initial: null,
        fallback: { group: "tabs", index: 0 },
        // Frozen while the captures are open. The arrow keys belong to the
        // carousel then, and moving the selection underneath it left the
        // carousel showing image 4 of an entry that only has 2 — the same
        // reason the Config page disables this while a colour picker is up.
        enabled: !showImages,
        resolveMove: (pos, dir) => {
            // The tab row is a row, so it is the one place left and right mean
            // anything. Everywhere else they are ignored, as before.
            if (dir === "left" || dir === "right") {
                if (pos.group !== "tabs") return null;
                return { group: "tabs", index: (pos.index + (dir === "right" ? 1 : -1) + TABS.length) % TABS.length };
            }

            // Vertically it is one cycle: tabs, then the list, then close.
            // A tab with nothing under it hands straight over to close.
            if (pos.group === "tabs") {
                if (dir === "down") return entries.length ? { group: "items", index: 0 } : { group: "close", index: 0 };
                return { group: "close", index: 0 };
            }

            if (pos.group === "close") {
                if (dir === "down") return { group: "tabs", index: tabIndex };
                return entries.length ? { group: "items", index: entries.length - 1 } : { group: "tabs", index: tabIndex };
            }

            if (dir === "up") return (pos.index === 0) ? { group: "tabs", index: tabIndex } : { group: "items", index: pos.index - 1 };
            return (pos.index === entries.length - 1) ? { group: "close", index: 0 } : { group: "items", index: pos.index + 1 };
        },
        onFocus: (pos) => {
            closeNav.setFocus(pos.group === "close");
            if (pos.group !== "items") {
                // Neither a tab nor the close button describes anything
                setSelected(null);
                return;
            }
            setSelected(entries[pos.index] ?? null);
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
            if (pos.group === "tabs") {
                // Confirming a tab drops the cursor into its list, the way the
                // equipment categories do
                playSound("select", isSoundEnabled);
                const key = TABS[pos.index].key;
                setTab(key);
                const next = ENTRIES[key];
                if (next.length) {
                    setPosSilently({ group: "items", index: 0 });
                    setSelected(next[0]);
                }
                return;
            }
            playSound("select", isSoundEnabled);
            anchorRefs.current[pos.index]?.click();
        },
    });

    // Clicking a tab does what confirming it does: switch, and put the cursor
    // on the tab so the two input routes agree about where it is
    const selectTab = (key: TabKey) => {
        if (key === tab) return;
        playSound("select", isSoundEnabled);
        setTab(key);
    };

    // Whichever tab is showing, its first entry is selected and under the
    // cursor, so the panel is never blank and there is always somewhere to
    // arrow from. Runs on arrival and on every tab change.
    useEffect(() => {
        const list = ENTRIES[tab];

        setSelected(list[0] ?? null);
        setPosSilently(list.length ? { group: "items", index: 0 } : { group: "tabs", index: TABS.findIndex((t) => t.key === tab) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => () => closeNav.setFocus(false), []);

    // Hover switches tab with no click needed, which is easy to trigger by
    // accident while the page is still settling and the pointer crosses the row
    // on its way somewhere else. Clicking a tab still works straight away.
    useEffect(() => {
        const timer = setTimeout(() => setTabsSettled(true), TAB_SETTLE_MS);
        return () => clearTimeout(timer);
    }, []);

    // Keep the keyboard-focused project on screen as the cursor moves.
    useEffect(() => {
        if (pos?.group === "items") {
            projectItemRefs.current[pos.index]?.scrollIntoView({ block: "nearest" });
        }
    }, [pos]);

    return (
        <>
            <ContentBox data-label="header" className="h-[84px] absolute">
                {/* Spaced after the FF7 item menu, where the tabs sit at fixed
                    stops rather than flowing: the first is inset far enough to
                    leave the cursor room beside it. */}
                <ul className={`${styles.tabs} flex h-full items-center`}>
                    {TABS.map(({ key, label }, index) => (
                        <li
                            key={key}
                            className={styles.tab}
                            data-focused={isFocused("tabs", index)}
                            data-active={key === tab}
                            onPointerEnter={(event) => { if (tabsSettled && event.pointerType === "mouse" && isPointerMoving()) selectTab(key); }}
                            onClick={() => selectTab(key)}
                        >
                            {textToSprite(label)}
                        </li>
                    ))}
                </ul>
            </ContentBox>
            <ContentBox data-label="description" className="h-[87px] absolute top-[93px]">{textToSprite(selected?.description ?? "")}</ContentBox>
            <ContentBox data-label="contentLeft" className="absolute top-[190px] bottom-0 flex flex-col">
                {selected && <div className={styles.detail}>
                    <div className={styles.detailHead}>
                        {(() => {
                            const lines = wrap(selected.fullName ?? selected.name, TITLE_WIDTH);
                            const last = lines.length - 1;
                            // A title that runs to two lines takes the date up
                            // beside it, so the block is two lines either way and
                            // nothing below it moves. Only at three does it grow.
                            const inlineDate = lines.length > 1 &&
                                lines[last].length + 1 + selected.date.length <= TITLE_WIDTH;

                            return lines.map((line, index) => (
                                <div key={line} className={index === last && inlineDate ? styles.titleWithDate : undefined}>
                                    {textToSprite(line, false, "blue")}
                                    {index === last && inlineDate &&
                                        <span className={styles.detailDate}>{textToSprite(selected.date)}</span>}
                                </div>
                            )).concat(
                                inlineDate ? [] : [<div key="date" className={styles.detailDate}>{textToSprite(selected.date)}</div>]
                            );
                        })()}
                    </div>

                    {separator}

                    <div>
                        {/* Each skill carries its own materia, drawn the way the
                            skills list draws them: the orb sits inline before the
                            name rather than in a slot */}
                        <div className={styles.skillList}>
                            {selected.skills.map((name) => (
                                <span key={name} className={styles.skill} data-color={SKILL_BY_NAME.get(name)?.color ?? "blue"}>
                                    {textToSprite(name)}
                                </span>
                            ))}
                        </div>
                    </div>

                    {separator}

                    {/* The info text sits in the panel itself now, rather than in a
                        box of its own, which the panel had no room for */}
                    <div className={styles.detailInfo}>
                        {selected.moreInfo.map((item) => (<div key={item}>{textToSprite(item)}</div>))}
                    </div>

                    {/* data-text-color colours the icon as well as the word: the
                        glyph is a .font-glyph, so it takes the coloured
                        spritesheet from the attribute just as the letters do */}
                    {separator}

                    <div className={styles.detailLinks}>
                        {!!selected.link && <a
                            className={styles.viewButton}
                            href={selected.link}
                            target="_blank"
                            rel="noreferrer"
                            data-text-color="yellow"
                            onClick={() => playSound("select", isSoundEnabled)}
                        >
                            {textToSprite("View", false, "yellow")}
                            <span className="font-glyph ml-2" data-sprite="external-link-icon" />
                        </a>}

                        {/* Only offered when there is something to show */}
                        {!!selected.screenshots?.length && <button
                            type="button"
                            className={styles.viewButton}
                            data-text-color="yellow"
                            onClick={() => { playSound("select", isSoundEnabled); setShowImages(true); }}
                        >
                            {textToSprite("Images", false, "yellow")}
                        </button>}
                    </div>
                </div>}
            </ContentBox>
            <ContentBox className="absolute top-[190px] right-0 bottom-0" data-label="contentRight">
                {/* Fixed 48px rows in a 576px viewport => 12 fit in this taller box;
                    pl-24/-ml-24 reserves room for the cursor's left overhang. */}
                <div ref={projectListRef} className={`hide-scrollbar -ml-24 h-[576px] snap-y snap-mandatory overflow-y-auto pl-24 ${hasScrollbar ? "pr-9" : ""}`}>
                    <ul>
                        {entries.map((project, index) => (
                            <li key={project.key} ref={(el) => { projectItemRefs.current[index] = el; }} className={`${styles.item} flex h-[48px] snap-start items-center`} data-focused={isFocused("items", index)} onMouseEnter={() => { if (isPointerMoving()) focus({ group: "items", index }); }} onClick={() => playSound("select", isSoundEnabled)}>
                                <a
                                    href={project.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    ref={(el) => { anchorRefs.current[index] = el; }}
                                    className="flex h-full w-full justify-between items-center"
                                    // An entry with screenshots opens them rather
                                    // than leaving the menu; the carousel carries
                                    // its own link out to the live page. Entries
                                    // without any keep going straight there.
                                    // Confirming with the keyboard clicks this same
                                    // anchor, so both routes agree.
                                    onClick={(event) => {
                                        if (!project.screenshots?.length) return;
                                        event.preventDefault();
                                        setSelected(project);
                                        setShowImages(true);
                                    }}
                                >
                                    <span className="flex items-center">
                                        <img src={project.icon} alt="" width="36" height="36" className={`mr-3 ${tab === "websites" && isCRTEnabled ? styles.crtSoftened : ""}`} />
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
                <Scrollbar targetRef={projectListRef} onVisibleChange={setHasScrollbar} />
            </ContentBox>

            {showImages && selected && (
                // Keyed by entry so a different project always gets a fresh
                // carousel starting at its first image, rather than inheriting
                // an index the new entry may not have
                <ImageCarousel key={selected.key} entry={selected} onClose={() => setShowImages(false)} />
            )}
        </>
    );
}

export default ProjectsContent;
