
import { Link } from "react-router-dom";
// import styles from "./MemCardSelector.module.scss";
import MemCardLoadingBar from "../../components/MemCardLoadingBar/MemCardLoadingBar";
import History from "../../pages/History/History";

import ContentBox from "../ContentBox/ContentBox";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import { useEffect, useState } from "react";


const MemCardSelector = () => {
    const { isSoundEnabled } = useContext();
    const [memoryCardLoaded, setMemoryCardLoaded] = useState(false);
    const [optionSelected, setOptionSelected] = useState(false);
    const [selectedHistoryType, setSelectedHistoryType] = useState("work");
    const [memoryCardProgress, setMemoryCardProgress] = useState(0);

    const onClickHandler = (historyType: string) => {
        playSound("select", isSoundEnabled);
        setOptionSelected(true);
        setSelectedHistoryType(historyType)

    }

    const onMouseEnterHandler = () => {
        if (!memoryCardLoaded) return;
        playSound("select", isSoundEnabled);
    }

    useEffect(() => {
        setTimeout(() => {
            setMemoryCardLoaded(true);
        }, 800);
    }, []);

    return (
        <>
            {!optionSelected && <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="MemCardHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Checking Save Data File.")}</ContentBox>
            </div>}
            {!optionSelected && <ContentBox data-label="memCardSelector" className={`w-[30rem] h-[5.5rem] absolute z-1 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <div className="flex justify-around">
                    <p onClick={onClickHandler}>{textToSprite("Work", undefined, memoryCardLoaded ? "white" : "grey")}</p>
                    <p onClick={onClickHandler}>{textToSprite("Education", undefined, memoryCardLoaded ? "white" : "grey")}</p>
                </div>
            </ContentBox>}

            {optionSelected && memoryCardProgress <= 100 && <MemCardLoadingBar memoryCardProgress={memoryCardProgress} setMemoryCardProgress={setMemoryCardProgress} />}
            {optionSelected && memoryCardProgress > 100 && <History />}
        </>
    );
};

export default MemCardSelector;
