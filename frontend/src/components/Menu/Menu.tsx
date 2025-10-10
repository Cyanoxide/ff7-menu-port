import { useContext } from "../../context/context";
import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../contentBox/ContentBox";
import playSound from "../../util/sounds";

interface MenuProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const Menu = ({ activePage, setActivePage }: MenuProps) => {
    const { isSoundEnabled } = useContext();

    const menuItems: Record<string, string> = {
        "projects": "Projects",
        "skills": "Skills",
        "history": "History",
        "config": "Config",
        // "about": "About",
        // "contact": "Contact",
        // "quit": "Quit"
    }

    const menuLinks: Record<string, { name: string; path: string; download?: boolean }> = {
        "resume": {
            name: "Résumé",
            path: "/Jamie_Pates_Resume_2025.pdf",
        },
        "github": {
            name: "Github",
            path: "https://github.com/Cyanoxide",
        },
        "donate": {
            name: "Donate",
            path: "https://ko-fi.com/cyanoxide",

        }
    }

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

    return (
        <ContentBox className={`m-auto w-[270px] absolute right-0 ${(activePage !== "home") ? "h-[84px]" : "h-[530px]"}`} data-label="menu" >
            <ul className={styles.menu}>
                {Object.keys(menuItems).map((menuItem) => (
                    <li key={menuItem} className={`${["home", menuItem].includes(activePage) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                        <span onClick={() => handleOnClick(menuItem)} onMouseEnter={handleMouseEnter} className={(activePage === menuItem) ? styles.active : ""}>{textToSprite(menuItems[menuItem])}</span>
                        {activePage !== "home" && <ContentBox className="absolute" data-label="close"><span onClick={handleClose} onMouseEnter={() => playSound("select", isSoundEnabled)}>{textToSprite("X")}</span></ContentBox>}
                    </li>
                ))}
                {Object.keys(menuLinks).map((menuItem) => (
                    <li key={menuItem} className={`${["home", menuItem].includes(activePage) ? "h-[29px] mb-4" : "h-0 invisible"} h-[29px] mb-4 flex justify-between`}>
                        <a title={menuLinks[menuItem].name} href={menuLinks[menuItem].path} target="_blank" onClick={() => { playSound("select", isSoundEnabled) }} onMouseEnter={() => playSound("select", isSoundEnabled)}>{textToSprite(menuLinks[menuItem].name)}</a>
                    </li>
                ))}
            </ul>
        </ContentBox >
    );
}

export default Menu;
