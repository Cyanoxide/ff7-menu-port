import styles from "./Menu.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../contentBox/ContentBox";

interface MenuProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const Menu = ({ activePage, setActivePage }: MenuProps) => {
    const menuItems: Record<string, string> = {
        "skills": "Skills",
        "projects": "Projects",
        "history": "History",
        // "config": "Config",
        // "resume": "Resume",
        // "about": "About",
        // "contact": "Contact",
        // "github": "Github",
        // "donate": "Donate",
        // "quit": "Quit"
    }

    const handleClose = () => {
        setActivePage("home");
    }

    return (
        <ContentBox className={`m-auto w-[270px] absolute right-0 ${(activePage !== "home") ? "h-[84px]" : "h-[530px]"}`} data-label="menu">
            <ul className={styles.menu}>
                {Object.keys(menuItems).map((menuItem) => (
                    <li key={menuItem} className={`${["home", menuItem].includes(activePage) ? "h-[29px] mb-4" : "h-0 invisible"} flex justify-between`}>
                        <span onClick={() => setActivePage(menuItem)} className={(activePage === menuItem) ? styles.active : ""}>{textToSprite(menuItems[menuItem])}</span>
                        {activePage !== "home" && <ContentBox className="absolute" data-label="close"><span onClick={handleClose}>{textToSprite("X")}</span></ContentBox>}
                    </li>
                ))}
            </ul>
        </ContentBox>
    );
}

export default Menu;
