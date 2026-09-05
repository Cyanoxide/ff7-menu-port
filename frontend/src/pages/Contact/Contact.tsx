import { useEffect, useSyncExternalStore } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useTabFade } from "../../util/useTabFade";

import { contactAlert } from "./contactAlert";
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
        description: "Send me a email over the PHS system.",
    },
    {
        key: "guestbook",
        label: "Guestbook",
        description: "Sign the guestbook and leave a message.",
    },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ContactContent() {
    const { isSoundEnabled } = useContext();
    const navigate = useNavigate();
    const { contactTab } = useParams();
    const tabFocus = useSyncExternalStore(contactTabs.subscribe, contactTabs.getFocus);
    const alert = useSyncExternalStore(contactAlert.subscribe, contactAlert.get);

    /**
     * The open tab comes from the URL, not from state.
     *
     * Same rule as the history page: derived from the route rather than
     * mirrored into it, so there is only one place that knows which tab is
     * open and a refresh or a shared link comes back to the same one. An
     * unrecognised segment falls back to the first tab rather than 404ing —
     * /contact/nonsense is a typo, not a missing page.
     */
    const routeIndex = Math.max(0, TABS.findIndex((entry) => entry.key === contactTab));
    const routeTab: TabKey = TABS[routeIndex].key;

    /**
     * The content lags the route by one fade-out, so the old tab is still drawn
     * while the screen dips to black. The tab row above does not lag — it takes
     * routeTab, so the tab you pressed lights up on the press.
     */
    const { shown: tab, fading } = useTabFade(routeTab);
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
        if (!next || next.key === routeTab) return;
        playSound("select", isSoundEnabled);
        // The first tab keeps the bare /contact, which is what the menu links to
        navigate(index === 0 ? "/contact" : `/contact/${next.key}`);
    };

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
                    the two tabbed pages line up as you move between them.

                    **Click to switch, not hover.** Hover used to do it, with a
                    settling delay to stop the page changing under a pointer on
                    its way somewhere else — but a top-level tab changing what
                    the whole screen shows because the mouse passed over it is
                    startling however long you wait first. */}
                <ul className={`${styles.tabs} flex h-full items-center`}>
                    {TABS.map(({ key, label }, index) => (
                        <li
                            key={key}
                            className={styles.tab}
                            data-focused={tabFocus === index}
                            data-active={key === routeTab}
                            onClick={() => selectTab(index)}
                        >
                            {textToSprite(label)}
                        </li>
                    ))}
                </ul>
            </ContentBox>

            {/* Everything below the tab row changes with the tab, so it all
                dips out together — see useTabFade. The header stays put: it is
                the frame the change happens inside, and blinking it out would
                take the tabs with it. */}
            <div className="tab-fade" data-fading={fading}>
                {/* Heights and offsets copied from Projects rather than chosen:
                    header 0-84, this strip 93-180, the panels from 190. */}
                {/* The strip doubles as the page's alert line: when a tab has
                    something to report it says that instead of the description, and
                    goes back when it clears. It is the full width of the stage,
                    which is what lets a message be a sentence rather than something
                    squeezed into the 470px column the form lives in. */}
                {/* The label is load-bearing, and its value is not: .panel-group
                    keys `animation: none` off the attribute's presence, so a
                    panel without one keeps .contentBox's own fade and runs it
                    *inside* the group's — the two opacities multiply and the
                    box arrives visibly late. That is what this one did.
                    "contactDescription" rather than "description" because the
                    shared rule for that name adds a 2rem left inset. */}
                <ContentBox data-label="contactDescription" className={`${styles.descriptionPanel} h-[87px] absolute top-[93px]`}>
                    {alert
                        ? textToSprite(alert.text, false, alert.tone)
                        : textToSprite(TABS[tabIndex].description)}
                </ContentBox>

                <TabContent tabIndex={tabIndex} tabCount={TABS.length} onSelectTab={selectTab} />
            </div>
        </div>
    );
}

export default ContactContent;
