import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import ContentBox from "../../components/ContentBox/ContentBox";
import ProgressBar from "../../components/ProgressBar/ProgressBar";
import MateriaSlotPreview from "../../components/MateriaSlotPreview/MateriaSlotPreview";
import Scrollbar from "../../components/Scrollbar/Scrollbar";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { markKeyboardNavigation } from "../../hooks/useCursorNav";
import { useContext } from "../../context/context";
import { KIT_ASSETS, KIT_ENTRIES, KIT_GROUPS } from "./kit";

import styles from "./StyleGuide.module.scss";

/**
 * A proof of concept for a component kit built out of this project's parts.
 *
 * Inside the menu's own frame rather than a separate documentation site: it is
 * the cheapest way to find out whether the idea is worth extracting, and it
 * keeps the examples honest, since they are the same components the rest of the
 * app renders.
 *
 * The snippets carry their images as data URIs so a paste works anywhere and
 * nothing hotlinks this site.
 */

/**
 * Characters that fit across the notes column. The sprite font sets every line
 * nowrap, so prose has to be broken up front — the same constraint the projects
 * page works around, and the reason there is no CSS answer to this.
 */
const NOTE_WIDTH = 36;

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

/**
 * Its own component so the scrollbar gets a stable ref. Sharing one map of refs
 * from the page meant handing Scrollbar a freshly built object every render, and
 * it never saw a target to measure.
 */
const CodeBlock: React.FC<{ code: string; children: React.ReactNode }> = ({ code, children }) => {
    const ref = useRef<HTMLPreElement>(null);

    return (
        <div className={styles.codeBox}>
            <pre ref={ref} className={`hide-scrollbar ${styles.code}`}>{code}</pre>
            <Scrollbar targetRef={ref} />
            {children}
        </div>
    );
};

function StyleGuide() {
    const { isSoundEnabled } = useContext();
    const [copied, setCopied] = useState<string | null>(null);
    const [activeGroup, setActiveGroup] = useState(KIT_GROUPS[0]?.id ?? "");

    const scrollerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    const copy = async (entryName: string, code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            playSound("select", isSoundEnabled);
            setCopied(entryName);
            window.setTimeout(() => setCopied((current) => (current === entryName ? null : current)), 1600);
        } catch {
            playSound("error", isSoundEnabled);
        }
    };

    const goToGroup = (id: string) => {
        const scroller = scrollerRef.current;
        const section = sectionRefs.current[id];
        if (!scroller || !section) return;

        playSound("select", isSoundEnabled);
        scroller.scrollTo({ top: section.offsetTop - 8, behavior: "smooth" });
    };

    // Mark whichever group the reader has reached, so the left column tracks the
    // page rather than only responding to clicks
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        const onScroll = () => {
            // The final group is usually shorter than the viewport, so it can
            // never scroll far enough to cross a plain threshold. Reaching the
            // bottom means you are looking at it, whatever the arithmetic says.
            const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
            if (atBottom) {
                setActiveGroup(KIT_GROUPS[KIT_GROUPS.length - 1].id);
                return;
            }

            const reached = KIT_GROUPS.filter((group) => {
                const section = sectionRefs.current[group.id];
                return section && section.offsetTop - 40 <= scroller.scrollTop;
            });
            setActiveGroup(reached.length ? reached[reached.length - 1].id : KIT_GROUPS[0].id);
        };

        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => scroller.removeEventListener("scroll", onScroll);
    }, []);

    const demo = (kind: string) => {
        if (kind === "contentBox") {
            return <ContentBox className={styles.demoWindow}>{textToSprite("Window")}</ContentBox>;
        }
        if (kind === "progressBar") {
            return (
                <div className={styles.demoStack}>
                    <ProgressBar percentage={64} />
                    <ProgressBar percentage={100} accentColor="#dfbddd" data-limit="true" />
                </div>
            );
        }
        if (kind === "cursor") {
            return (
                <ul className={styles.demoRows}>
                    <li data-focused="true">{textToSprite("Focused")}</li>
                    <li>{textToSprite("Not focused")}</li>
                </ul>
            );
        }
        return (
            <div className={styles.demoStack}>
                <span className={styles.demoMateria}>{textToSprite("Materia")}</span>
                <MateriaSlotPreview multiSlots={2} singleSlots={1} />
            </div>
        );
    };

    return (
        <div className="panel-group">
            <div className={styles.headRow}>
                <ContentBox data-label="styleGuideHeader" className={styles.header}>
                    {textToSprite("A kit of the parts this menu is built from.")}
                </ContentBox>

                {/* This page is not in the menu, so it carries its own name and
                    close button rather than the ones Menu draws for menu pages */}
                <Link
                    to="/"
                    className={styles.close}
                    onClick={() => { playSound("back", isSoundEnabled); markKeyboardNavigation(); }}
                    onMouseEnter={() => playSound("select", isSoundEnabled)}
                >
                    <ContentBox data-label="styleGuideName" className={styles.nameBox}>
                        {textToSprite("Kit")}
                    </ContentBox>
                    <ContentBox data-label="close" className={styles.closeBox}>
                        {textToSprite("X")}
                    </ContentBox>
                </Link>
            </div>

            <ContentBox data-label="styleGuideNav" className={styles.nav}>
                {/* Painted from the inlined data URI rather than a file, so the
                    page itself shows that the snippets' images resolve */}
                <span
                    className={styles.inlineProof}
                    style={{ backgroundImage: `url(${KIT_ASSETS.cursor})` }}
                    aria-hidden="true"
                />

                <ul>
                    {KIT_GROUPS.map((group) => (
                        <li
                            key={group.id}
                            className={styles.navItem}
                            data-focused={activeGroup === group.id}
                            onClick={() => goToGroup(group.id)}
                            onMouseEnter={() => playSound("select", isSoundEnabled)}
                        >
                            {textToSprite(group.name)}
                        </li>
                    ))}
                </ul>
            </ContentBox>

            <ContentBox data-label="styleGuideBody" className={styles.body}>
                <div ref={scrollerRef} className={`hide-scrollbar ${styles.scroller}`}>
                    {KIT_GROUPS.map((group) => (
                        <div
                            key={group.id}
                            ref={(el) => { sectionRefs.current[group.id] = el; }}
                            className={styles.group}
                        >
                            <h2 className={styles.groupName}>{textToSprite(group.name)}</h2>

                            {KIT_ENTRIES.filter((entry) => entry.group === group.id).map((entry) => (
                                <section key={entry.name} className={styles.entry}>
                                    {entry.notes.flatMap((note) => wrap(note, NOTE_WIDTH)).map((line, index) => (
                                        <p key={index} className={styles.note}>{textToSprite(line)}</p>
                                    ))}

                                    <div className={styles.entryBody}>
                                        <div className={styles.demo}>{demo(entry.demo)}</div>

                                        <CodeBlock code={entry.code}>
                                            {/* Inside the block rather than above it.
                                                Placeholder glyph until the kit has its own */}
                                            <button
                                                type="button"
                                                className={styles.copy}
                                                title={copied === entry.name ? "Copied" : "Copy"}
                                                onClick={() => copy(entry.name, entry.code)}
                                                data-copied={copied === entry.name}
                                            >
                                                <span className="font-glyph" data-sprite="edit-icon" data-text-color="yellow" />
                                            </button>
                                        </CodeBlock>
                                    </div>
                                </section>
                            ))}
                        </div>
                    ))}

                    <p className={styles.note}>{textToSprite("Border 0.4kb, cursor 0.8kb, materia 0.7kb.")}</p>
                    <p className={styles.note}>{textToSprite("Base64 adds about a third to each.")}</p>
                </div>

                <Scrollbar targetRef={scrollerRef} />
            </ContentBox>
        </div>
    );
}

export default StyleGuide;
