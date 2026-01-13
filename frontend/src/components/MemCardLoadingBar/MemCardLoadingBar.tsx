
import styles from "./MemCardLoadingBar.module.scss";
import ContentBox from "../ContentBox/ContentBox";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { useEffect } from "react";
import textToSprite from "../../util/textToSprite";

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
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="MemCardHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Checking Save Data File.")}</ContentBox>
            </div>
            <ContentBox data-label="memCardLoadingBar" className={`w-[27rem] h-[6rem] absolute z-2 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <div className={`${memoryCardProgress < 100 ? "bg-blue-500" : "bg-red-500"} h-[3rem]`} style={{ width: memoryCardProgress + "%" }} />
            </ContentBox>
        </>
    );
};

export default MemCardLoadingBar;
