
import styles from "./MemCardLoadingBar.module.scss";
import ContentBox from "../ContentBox/ContentBox";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { useEffect } from "react";

interface MemCardLoadingBarProps {
    memoryCardProgress: number,
    setMemoryCardProgress: (progress: number) => void,
}


const MemCardLoadingBar: React.FC<MemCardLoadingBarProps> = ({ memoryCardProgress, setMemoryCardProgress }) => {
    const { isSoundEnabled } = useContext();

    useEffect(() => {
        if (memoryCardProgress >= 110) return;

        if (memoryCardProgress == 100) {
            playSound("save", isSoundEnabled);
        }

        setTimeout(() => {
            setMemoryCardProgress(memoryCardProgress + 10);
        }, 80);
    }, [isSoundEnabled, memoryCardProgress, setMemoryCardProgress]);

    return (
        <>
            <ContentBox data-label="memCardLoadingBar" className={`w-[27rem] h-[6rem] absolute z-2 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <div className={`${styles.memCardLoadingBar} h-[3rem]`} style={{ width: memoryCardProgress + "%" }} data-progress={memoryCardProgress} />
            </ContentBox>
        </>
    );
};

export default MemCardLoadingBar;
