import { useEffect, useRef, useSyncExternalStore } from "react";
import { useContext } from "../../context/context";
import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../ContentBox/ContentBox";
import playSound from "../../util/sounds";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCursorNav, markKeyboardNavigation, consumeKeyboardNavIntent } from "../../hooks/useCursorNav";
import { useKonamiCode } from "../../hooks/useKonamiCode";
import { lookAt } from "../../hooks/useLookDirection";
import { landingNav } from "../../hooks/landingNav";
import { closeNav } from "../../hooks/closeNav";
import menuJSON from "../../data/menu.json";
import type { MenuItem } from "../../context/types";

const Menu = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isSoundEnabled, currentHealth } = useContext();
    const menuItems = (menuJSON as MenuItem[]);
    const navItems = menuItems.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const isLanding = location.pathname === "/";

    /**
     * A page may have a level below it -- /history/work under /history -- and
     * the heading box belongs to the section, not to the exact URL. Matching on
     * the whole pathname hid the box entirely on a sub-route, which left no way
     * back from a save list.
     *
     * On a sub-route the box takes the sub-route's name and its X goes up one
     * level rather than home, so closing a save list lands on the selector and
     * closing that lands on the menu. Same box, same size, same X, one rung
     * further down.
     */
    const [, section, subPath] = location.pathname.split("/");
    const sectionPath = section ? `/${section}` : "/";

    /**
     * Sections whose second path segment is a *tab*, not a screen below them.
     *
     * History's sub-routes are drilled into — /history/career is a list you
     * opened from the selector — so the heading box takes their name and the X
     * steps back up one level. Projects and Contact are not like that: their
     * segment picks between peers on the same screen, and treating it the same
     * way would put the tab's name in the corner where the section's belongs and
     * make closing the page take two presses of X.
     */
    const TAB_SECTIONS = ["projects", "contact"];
    const subsection = TAB_SECTIONS.includes(section) ? undefined : subPath;

    const closeTo = subsection ? sectionPath : "/";
    const lastMenuIndexRef = useRef(0);
    const closeFocused = useSyncExternalStore(closeNav.subscribe, closeNav.getFocus);

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "menu", size: navItems.length },
            { id: "avatar", size: 1 },
            { id: "revive", size: 1 },
        ],
        initial: null,
        fallback: { group: "menu", index: lastMenuIndexRef.current },
        enabled: isLanding,
        resolveMove: (current, dir, { wrap }) => {
            if (current.group === "menu") {
                if (dir === "up") return { group: "menu", index: wrap(current.index, -1, navItems.length) };
                if (dir === "down") return { group: "menu", index: wrap(current.index, 1, navItems.length) };
                if (dir === "left") return { group: "avatar", index: 0 };
                return null;
            }
            if (current.group === "avatar") {
                if (dir === "right") return { group: "menu", index: lastMenuIndexRef.current };
                if (dir === "down" && currentHealth === 0) return { group: "revive", index: 0 };
                return null;
            }
            // revive
            if (dir === "up") return { group: "avatar", index: 0 };
            if (dir === "right") return { group: "menu", index: lastMenuIndexRef.current };
            return null;
        },
        onFocus: (current) => {
            if (current.group === "menu") {
                lastMenuIndexRef.current = current.index;
                landingNav.setFocus(null);
            } else {
                landingNav.setFocus(current.group === "avatar" ? "avatar" : "revive");
            }
        },
        onConfirm: (current) => {
            if (current.group === "avatar") {
                landingNav.actions.attack?.();
                return;
            }
            if (current.group === "revive") {
                landingNav.actions.revive?.();
                return;
            }
            const menuItem = navItems[current.index];
            if (!menuItem) return;
            playSound("select", isSoundEnabled);
            if (menuItem.path) {
                window.open(menuItem.path, "_blank");
            } else {
                markKeyboardNavigation();
                navigate(`/${menuItem.id}`);
            }
        },
        onCancel: () => {
            if (pos?.group === "avatar" || pos?.group === "revive") {
                playSound("back", isSoundEnabled);
                setPosSilently({ group: "menu", index: lastMenuIndexRef.current });
                landingNav.setFocus(null);
            }
            return true;
        },
    });

    useKonamiCode(() => playSound("fanfare", isSoundEnabled), isLanding);

    /**
     * Point the portrait at whatever the keyboard cursor is on.
     *
     * The portraits follow a position rather than a mouse, so the cursor can
     * hand them one: arrowing down the menu turns the face down the menu, the
     * same as running the mouse down it would. Reads the target's box rather
     * than deriving an angle, so it stays right whatever the layout does.
     *
     * Selecting the avatar aims him at himself, which lands inside the dead
     * zone and comes out as facing front -- the same answer the mouse gives
     * for a cursor resting on the portrait, from the same rule.
     *
     * An effect rather than onFocus, because the row has to have been laid out
     * before it can be measured -- on the first arrow press after arriving, the
     * menu is still opening.
     */
    useEffect(() => {
        if (!isLanding || !pos) return;
        // The menu's rows are told apart by index; the avatar and the revive
        // button are each the only one of their kind.
        const target = pos.group === "menu"
            ? document.querySelector<HTMLElement>(`[data-menu-index="${pos.index}"]`)
            : document.querySelector<HTMLElement>(`[data-look-target="${pos.group}"]`);
        if (!target) return;
        const box = target.getBoundingClientRect();
        if (!box.width || !box.height) return;
        lookAt(box.left + box.width / 2, box.top + box.height / 2);
    }, [isLanding, pos]);

    // Mouse hover on the landing avatar/revive moves the shared cursor
    useEffect(() => {
        landingNav.actions.focusTarget = (target) => focus({ group: target, index: 0 });
        return () => {
            landingNav.actions.focusTarget = undefined;
        };
    }, [focus]);

    // FF7 cursor memory: remember the page you left so the cursor reappears
    // there on the next keypress; the cursor itself hides on navigation
    useEffect(() => {
        if (isLanding) {
            // Keyboard-driven return to the main menu restores the cursor
            if (consumeKeyboardNavIntent()) setPosSilently({ group: "menu", index: lastMenuIndexRef.current });
            return;
        }
        // Section, not pathname: arriving on /history/work should still remember
        // History as the row to come back to.
        const index = navItems.findIndex((item) => `/${item.id}` === sectionPath);
        if (index !== -1) lastMenuIndexRef.current = index;
        setPosSilently(null);
        landingNav.setFocus(null);
    }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    // If the party member is revived while the cursor sits on the vanished revive button
    useEffect(() => {
        if (pos?.group === "revive" && currentHealth !== 0) {
            setPosSilently({ group: "avatar", index: 0 });
            landingNav.setFocus("avatar");
        }
    }, [currentHealth]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClose = () => {
        playSound("back", isSoundEnabled);
    }

    /**
     * Hover-to-focus, mouse only. A tap on a touch screen synthesises a
     * mouseenter as well as the click, so both the hover's cursor sound and the
     * click's select sound fired for one finger — two copies of the same clip a
     * few milliseconds apart. pointerType tells the two inputs apart; the same
     * guard is already on the Projects and Equip lists.
     */
    const handlePointerEnter = (event: React.PointerEvent, menuItem: MenuItem) => {
        if (!isLanding || event.pointerType !== "mouse") return;
        focus({ group: "menu", index: navItems.indexOf(menuItem) });
    }

    const handleOnClick = () => {
        if (!isLanding) return;
        playSound("select", isSoundEnabled);
    }

    /** The open sub-route's name stands in for the section's on the heading box */
    const menuItemLabel = (menuItem: MenuItem) =>
        (subsection && `/${menuItem.id}` === sectionPath)
            ? subsection.charAt(0).toUpperCase() + subsection.slice(1)
            : menuItem.name;

    /**
     * "Education" is the longest heading the box carries, long enough that from
     * the shared left edge it runs up against the X hanging off the right. It
     * is nudged left rather than the box being widened or the X moved, so both
     * stay exactly where they are on every page and only the glyphs shift --
     * which reads as less wrong than the crowding does.
     */
    const isCrowdedHeading = (menuItem: MenuItem) =>
        subsection === "education" && `/${menuItem.id}` === sectionPath;

    const menuItemContent = (menuItem?: MenuItem) => {
        if (!menuItem) return;
        const focused = isFocused("menu", navItems.indexOf(menuItem));

        if (menuItem.path) {
            return (
                <a className="flex w-100" title={menuItem.title || menuItem.name} href={menuItem.path} target="_blank" data-focused={focused} onClick={() => { playSound("select", isSoundEnabled) }} onPointerEnter={(event) => handlePointerEnter(event, menuItem)}>
                    {textToSprite(menuItem.name)}
                    <span className="font-glyph ml-2" data-sprite="external-link-icon"></span>
                </a>
            )
        }

        return (
            <>
                <Link to={`/${menuItem.id}`} className={`${(sectionPath === `/${menuItem.id}`) ? styles.active : ""} w-100`} data-focused={focused && isLanding}><span className={isCrowdedHeading(menuItem) ? styles.longHeading : undefined} onClick={() => handleOnClick()} onPointerEnter={(event) => handlePointerEnter(event, menuItem)}>{textToSprite(menuItemLabel(menuItem))}</span></Link>
                {!isLanding && <Link to={closeTo} data-label="close" data-focused={closeFocused} onClick={handleClose} onPointerEnter={(event) => { if (event.pointerType === "mouse") playSound("select", isSoundEnabled); }}><ContentBox className="absolute" data-label="close" >{textToSprite("X")}</ContentBox></Link>}
            </>
        )
    }

    /**
     * Standalone screens — the name-entry page — aren't in the menu, so the box
     * is hidden there rather than left as an empty stray in the corner.
     *
     * Hidden, not unmounted. Unmounting replays `.contentBox`'s fade-in on the
     * way back to the landing screen, and that fade runs on exactly the same
     * clock as the landing panels' own `.panel-group` fade. For a quarter of a
     * second both are part-transparent at once, and because the party box
     * overlaps this one, it shows straight through it.
     *
     * That is why the menu-linked pages never had the problem: the box stays
     * mounted and opaque across those, so the panels fade in behind it. Staying
     * mounted here gives the same behaviour.
     */
    const isMenuPage = isLanding || navItems.some((item) => `/${item.id}` === sectionPath);

    return (
        <ContentBox
            className={`m-auto w-[270px] absolute right-0 ${(!isLanding) ? "h-[84px]" : "h-[535px]"} ${!isMenuPage ? styles.offstage : ""}`}
            data-label="menu"
            data-animated={isLanding}
        >
            <ul className={styles.menu}>
                {Array.from({ length: 11 }).map((_, position) => {
                    const menuItem = menuItems.find((item) => item.position === position);
                    return (
                        <li key={position} data-menu-index={menuItem ? navItems.indexOf(menuItem) : undefined} className={`${["/", `/${menuItem && menuItem.id}`].includes(sectionPath) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                            {menuItemContent(menuItem)}
                        </li>
                    )
                })}
            </ul >
        </ContentBox >
    );
}

export default Menu;
