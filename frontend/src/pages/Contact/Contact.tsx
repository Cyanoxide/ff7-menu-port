import { useEffect, useState, useSyncExternalStore } from "react";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { isPointerMoving } from "../../util/pointerActivity";

import { contactTabs } from "./contactTabs";
import PhsTab from "./PhsTab";
import GuestbookTab from "./GuestbookTab";

import styles from "./Contact.module.scss";

/**
 * The contact page: two tabs over one header, the same arrangement Projects
 * uses for Projects and Websites.
 *
 * The shell owns the header, the tabs and the description strip — everything
 * both tabs have in common — and each tab owns everything below them,
 * including its own useCursorNav. One hook covering both would mean a
 * resolveMove branching on the tab at every turn, for two pages whose only
 * shared row is the tab row itself.
 *
 * The cost of that split is that the tab row is drawn here but the cursor on it
 * belongs to the tab. contactTabs carries the one value across, the same way
 * closeNav does for the X the Menu draws.
 */

const TABS = [
    {
        key: "phs",
        label: "PHS",
        description: "Send me a message over the PHS system.",
    },
    {
        key: "guestbook",
        label: "Guestbook",
        description: "Sign the guestbook and leave a message.",
    },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * How long hover is ignored on the tab row after arriving on the page.
 *
 * The panels fade in over ~450ms, and crossing the row on the way to the form
 * during that time should not switch tab. Same figure and same reason as
 * Projects.
 */
const TAB_SETTLE_MS = 600;

function ContactContent() {
    const { isSoundEnabled } = useContext();
    const [tab, setTab] = useState<TabKey>("phs");
    const [tabsSettled, setTabsSettled] = useState(false);
    const tabFocus = useSyncExternalStore(contactTabs.subscribe, contactTabs.getFocus);

    const tabIndex = TABS.findIndex((entry) => entry.key === tab);

    /**
     * Switching remounts the open tab, which would normally replay
     * .contentBox's fade on every panel underneath. It does not, because
     * .panel-group turns that animation off for anything carrying a data-label
     * — so a newly mounted panel is opaque from its first frame. Every panel
     * either tab renders has one.
     */
    const selectTab = (index: number) => {
        const next = TABS[index];
        if (!next || next.key === tab) return;
        playSound("select", isSoundEnabled);
        setTab(next.key);
    };

    /**
     * Hover switches tab with no click needed, which is easy to trigger by
     * accident while the page is still settling and the pointer crosses the row
     * on its way somewhere else. Clicking a tab still works straight away.
     */
    useEffect(() => {
        const timer = setTimeout(() => setTabsSettled(true), TAB_SETTLE_MS);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => () => contactTabs.setFocus(null), []);

    const TabContent = tab === "phs" ? PhsTab : GuestbookTab;

    return (
        // The panels below overlap by 11px so their borders read as one seam.
        // .contentBox fades in individually, so mid-animation both are translucent
        // and the hidden border shows through — .panel-group moves the fade up a
        // level, compositing the group first and applying the alpha after.
        <div className="panel-group">
            {/* Reuses the shared "header" label rather than a contact-specific
                one, so it is full width for the same reason every other page's
                header is */}
            <ContentBox data-label="header" className="h-[84px] absolute">
                {/* Spaced after the FF7 item menu, where the tabs sit at fixed
                    stops rather than flowing: the first is inset far enough to
                    leave the cursor room beside it. 450px matches Projects, so
                    the two tabbed pages line up as you move between them. */}
                <ul className={`${styles.tabs} flex h-full items-center`}>
                    {TABS.map(({ key, label }, index) => (
                        <li
                            key={key}
                            className={styles.tab}
                            data-focused={tabFocus === index}
                            data-active={key === tab}
                            onPointerEnter={(event) => {
                                if (tabsSettled && event.pointerType === "mouse" && isPointerMoving()) {
                                    selectTab(index);
                                }
                            }}
                            onClick={() => selectTab(index)}
                        >
                            {textToSprite(label)}
                        </li>
                    ))}
                </ul>
            </ContentBox>

            {/* Heights and offsets copied from Projects rather than chosen:
                header 0-84, this strip 93-180, the panels from 190. */}
            <ContentBox className={`${styles.descriptionPanel} h-[87px] absolute top-[93px]`}>
                {textToSprite(TABS[tabIndex].description)}
            </ContentBox>

            <TabContent tabIndex={tabIndex} tabCount={TABS.length} onSelectTab={selectTab} />
        </div>
    );
}

export default ContactContent;
