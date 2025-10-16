import { useContext } from "../../context/context";
import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../ContentBox/ContentBox";
import playSound from "../../util/sounds";
import { Link, useLocation } from "react-router-dom";
import menuJSON from "../../data/menu.json";
import type { MenuItem } from "../../context/types";

interface MenuProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const Menu = ({ activePage, setActivePage }: MenuProps) => {
    const location = useLocation();
    const { isSoundEnabled } = useContext();
    const menuItems = (menuJSON as MenuItem[]);

    const handleClose = () => {
        setActivePage("home");
        playSound("back", isSoundEnabled);
    }

    const handleMouseEnter = () => {
        if (activePage !== "home") return;
        playSound("select", isSoundEnabled)
    }

    const handleOnClick = (menuItem: string) => {
        if (activePage !== "home") return;
        setActivePage(menuItem);
        playSound("select", isSoundEnabled);
    }

    const menuItemContent = (menuItem?: MenuItem) => {
        if (!menuItem) return;

        if (menuItem.path) {
            return (
                <a className="flex" title={menuItem.title || menuItem.name} href={menuItem.path} target="_blank" onClick={() => { playSound("select", isSoundEnabled) }} onMouseEnter={() => playSound("select", isSoundEnabled)}>
                    {textToSprite(menuItem.name)}
                    <span className="font-glyph ml-2" data-sprite="external-link-icon"></span>
                </a>
            )
        }

        return (
            <>
                <Link to={`/${menuItem.id}`} className={`${(activePage === menuItem.id) ? styles.active : ""} w-100`}><span onClick={() => handleOnClick(menuItem.id)} onMouseEnter={handleMouseEnter}>{textToSprite(menuItem.name)}</span></Link>
                {location.pathname !== "/" && <Link to={"/"} data-label="close"><ContentBox className="absolute" data-label="close"><span onClick={handleClose} onMouseEnter={() => playSound("select", isSoundEnabled)}>{textToSprite("X")}</span ></ContentBox></Link>}
            </>
        )
    }

    return (
        <ContentBox className={`m-auto w-[270px] absolute right-0 ${(location.pathname !== "/") ? "h-[84px]" : "h-[530px]"}`} data-label="menu" data-animated={location.pathname === "/"} >
            <ul className={styles.menu}>
                {Array.from({ length: 11 }).map((_, position) => {
                    const menuItem = menuItems.find((item) => item.position === position);
                    return (
                        <li key={position} className={`${["/", `/${menuItem}`].includes(location.pathname) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                            {menuItemContent(menuItem)}
                        </li>
                    )
                })}
            </ul >
        </ContentBox >
    );
}

export default Menu;
