import { useEffect, useRef, useSyncExternalStore } from "react";
import { useContext } from "../../context/context";
import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../ContentBox/ContentBox";
import playSound, { soundDuration } from "../../util/sounds";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCursorNav, markKeyboardNavigation, consumeKeyboardNavIntent } from "../../hooks/useCursorNav";
import { useKonamiCode } from "../../hooks/useKonamiCode";
import { landingNav } from "../../hooks/landingNav";
import { closeNav } from "../../hooks/closeNav";
import menuJSON from "../../data/menu.json";

/** public/audio/fanfare.mp3, measured with ffprobe. Only a fallback -- the
 *  decoded buffer is asked first, so re-encoding the clip needs no change here. */
const FANFARE_MS = 3712;
import type { MenuItem } from "../../context/types";

const Menu = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isSoundEnabled, currentHealth } = useContext();
    const menuItems = (menuJSON as MenuItem[]);
    const navItems = menuItems.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const isLanding = location.pathname === "/";
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

    useKonamiCode(() => {
        playSound("fanfare", isSoundEnabled);
        // Nods for the length of the clip. The fallback is only reached when
        // sound has never been enabled, in which case nothing has decoded the
        // buffer to ask -- the nod still runs, so the easter egg is not silent
        // *and* invisible for anyone playing with the sound off.
        landingNav.actions.headbang?.(soundDuration("fanfare") ?? FANFARE_MS);
    }, isLanding);

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
        const index = navItems.findIndex((item) => `/${item.id}` === location.pathname);
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
                <Link to={`/${menuItem.id}`} className={`${(location.pathname === `/${menuItem.id}`) ? styles.active : ""} w-100`} data-focused={focused && isLanding}><span onClick={() => handleOnClick()} onPointerEnter={(event) => handlePointerEnter(event, menuItem)}>{textToSprite(menuItem.name)}</span></Link>
                {!isLanding && <Link to={"/"} data-label="close" data-focused={closeFocused} onClick={handleClose} onPointerEnter={(event) => { if (event.pointerType === "mouse") playSound("select", isSoundEnabled); }}><ContentBox className="absolute" data-label="close" >{textToSprite("X")}</ContentBox></Link>}
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
    const isMenuPage = isLanding || navItems.some((item) => `/${item.id}` === location.pathname);

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
                        <li key={position} className={`${["/", `/${menuItem && menuItem.id}`].includes(location.pathname) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                            {menuItemContent(menuItem)}
                        </li>
                    )
                })}
            </ul >
        </ContentBox >
    );
}

export default Menu;
