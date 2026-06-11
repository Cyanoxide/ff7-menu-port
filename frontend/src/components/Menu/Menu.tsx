import { useEffect } from "react";
import { useContext } from "../../context/context";
import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../ContentBox/ContentBox";
import playSound from "../../util/sounds";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCursorNav } from "../../hooks/useCursorNav";
import menuJSON from "../../data/menu.json";
import type { MenuItem } from "../../context/types";

const Menu = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isSoundEnabled } = useContext();
    const menuItems = (menuJSON as MenuItem[]);
    const navItems = menuItems.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const isLanding = location.pathname === "/";

    const { focus, setPosSilently, isFocused } = useCursorNav({
        groups: [{ id: "menu", size: navItems.length }],
        initial: { group: "menu", index: 0 },
        enabled: isLanding,
        resolveMove: (pos, dir, { wrap }) => {
            if (dir === "up") return { group: "menu", index: wrap(pos.index, -1, navItems.length) };
            if (dir === "down") return { group: "menu", index: wrap(pos.index, 1, navItems.length) };
            return null;
        },
        onFocus: () => { },
        onConfirm: (pos) => {
            const menuItem = navItems[pos.index];
            if (!menuItem) return;
            playSound("select", isSoundEnabled);
            if (menuItem.path) {
                window.open(menuItem.path, "_blank");
            } else {
                navigate(`/${menuItem.id}`);
            }
        },
        onCancel: () => true,
    });

    // FF7 cursor memory: while on a page, park the cursor on that page's menu item
    useEffect(() => {
        if (isLanding) return;
        const index = navItems.findIndex((item) => `/${item.id}` === location.pathname);
        if (index !== -1) setPosSilently({ group: "menu", index });
    }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClose = () => {
        playSound("back", isSoundEnabled);
    }

    const handleMouseEnter = (menuItem: MenuItem) => {
        if (!isLanding) return;
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
                <a className="flex w-100" title={menuItem.title || menuItem.name} href={menuItem.path} target="_blank" data-focused={focused} onClick={() => { playSound("select", isSoundEnabled) }} onMouseEnter={() => handleMouseEnter(menuItem)}>
                    {textToSprite(menuItem.name)}
                    <span className="font-glyph ml-2" data-sprite="external-link-icon"></span>
                </a>
            )
        }

        return (
            <>
                <Link to={`/${menuItem.id}`} className={`${(location.pathname === `/${menuItem.id}`) ? styles.active : ""} w-100`} data-focused={focused && isLanding}><span onClick={() => handleOnClick()} onMouseEnter={() => handleMouseEnter(menuItem)}>{textToSprite(menuItem.name)}</span></Link>
                {!isLanding && <Link to={"/"} data-label="close" onClick={handleClose} onMouseEnter={() => playSound("select", isSoundEnabled)}><ContentBox className="absolute" data-label="close" >{textToSprite("X")}</ContentBox></Link>}
            </>
        )
    }

    return (
        <ContentBox className={`m-auto w-[270px] absolute right-0 ${(!isLanding) ? "h-[84px]" : "h-[530px]"}`} data-label="menu" data-animated={isLanding} >
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
