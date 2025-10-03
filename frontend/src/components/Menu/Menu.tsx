import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../contentBox/ContentBox";
import { useState, useEffect } from "react";

interface MenuProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const Menu = ({ activePage, setActivePage }: MenuProps) => {
    const menuItems: Record<string, string> = {
        "item": "Item",
        "magic": "Magic",
        "materia": "Materia",
        "equip": "Equip",
        "status": "Status",
        "order": "Order",
        "limit": "Limit",
        "config": "Config",
        "phs": "PHS",
        "save": "Save",
        "quit": "Quit",
    }

    const handleClose = () => {
        setActivePage("home");
    }

    return (
        <ContentBox className={`m-auto w-[270px] ${(activePage !== "home") ? "h-[84px]" : "h-[530px]"}`} right={0} data-label="menu">
            <ul className={styles.menu}>
                {Object.keys(menuItems).map((menuItem) => (
                    <li key={menuItem} className={`${["home", menuItem].includes(activePage) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                        <span onClick={() => setActivePage(menuItem)} className={(activePage === menuItem) ? styles.active : ""}>{textToSprite(menuItems[menuItem])}</span>
                        {activePage !== "home" && <ContentBox data-label="close"><span onClick={handleClose}>{textToSprite("X")}</span></ContentBox>}
                    </li>
                ))}
            </ul>
        </ContentBox>
    );
}

export default Menu;
