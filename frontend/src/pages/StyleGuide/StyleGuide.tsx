import { useState } from "react";

import ContentBox from "../../components/ContentBox/ContentBox";
import ProgressBar from "../../components/ProgressBar/ProgressBar";
import MateriaSlotPreview from "../../components/MateriaSlotPreview/MateriaSlotPreview";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { KIT_ASSETS, KIT_ENTRIES } from "./kit";

import styles from "./StyleGuide.module.scss";

/**
 * A proof of concept for a component kit built out of this project's parts.
 *
 * Deliberately inside the menu's own frame rather than a separate documentation
 * site: it is the cheapest way to find out whether the idea is worth extracting,
 * and it keeps the examples honest, since they are the same components the rest
 * of the app renders.
 *
 * The snippets carry their images as data URIs so a paste works anywhere and
 * nothing hotlinks this site.
 */
function StyleGuide() {
    const { isSoundEnabled } = useContext();
    const [copied, setCopied] = useState<string | null>(null);

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
                <span className={styles.demoMateria} data-color="green">{textToSprite("Materia")}</span>
                <MateriaSlotPreview multiSlots={2} singleSlots={1} />
            </div>
        );
    };

    return (
        <div className="panel-group">
            <ContentBox data-label="styleGuideHeader" className="h-[84px] absolute top-0 left-0 right-0">
                {textToSprite("A kit of the parts this menu is built from.")}
            </ContentBox>

            <ContentBox data-label="styleGuideBody" className="absolute top-[94px] bottom-0 left-0 right-0">
                <div className={`hide-scrollbar ${styles.scroller}`}>
                    <p className={styles.intro}>
                        {textToSprite("Every snippet carries its own images.")}
                    </p>

                    {KIT_ENTRIES.map((entry) => (
                        <section key={entry.name} className={styles.entry}>
                            <h2 className={styles.entryName}>{textToSprite(entry.name)}</h2>

                            <div className={styles.entryBody}>
                                <div className={styles.demo}>{demo(entry.demo)}</div>

                                <div className={styles.detail}>
                                    {entry.notes.map((note) => (
                                        <p key={note} className={styles.note}>{note}</p>
                                    ))}

                                    <div className={styles.codeHead}>
                                        <button
                                            type="button"
                                            className={styles.copy}
                                            onClick={() => copy(entry.name, entry.code)}
                                        >
                                            {textToSprite(copied === entry.name ? "Copied" : "Copy", false, "yellow")}
                                        </button>
                                    </div>
                                    <pre className={styles.code}>{entry.code}</pre>
                                </div>
                            </div>
                        </section>
                    ))}

                    <p className={styles.footnote}>
                        {textToSprite("Border 0.4kb, cursor 0.8kb, materia 0.7kb.")}
                    </p>
                    <p className={styles.footnote}>
                        {textToSprite("Base64 adds about a third to each.")}
                    </p>
                </div>
            </ContentBox>

            {/* Proves the inlined assets resolve: this is the data URI, not a file */}
            <span
                className={styles.inlineProof}
                style={{ backgroundImage: `url(${KIT_ASSETS.cursor})` }}
                aria-hidden="true"
            />
        </div>
    );
}

export default StyleGuide;
