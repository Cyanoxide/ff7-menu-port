import { useContext } from "../../context/context";

import styles from "./BGColorPicker.module.scss";
import textToSprite from "../../util/textToSprite";
import ContentBox from "../contentBox/ContentBox";

const BGColorPicker = () => {
    const { windowColor, dispatch } = useContext();

    const onClickHandler = (corner: "topLeft" | "topRight" | "bottomLeft" | "bottomRight") => {
        console.log(windowColor)

        const index = (["topLeft", "bottomRight"].includes(corner)) ? 0 : 2;

        windowColor[corner][index] = windowColor[corner][index] + 10


        dispatch({ type: "SET_WINDOW_COLOR", payload: windowColor });
    }

    return (
        <>
            <ContentBox data-label="configColorPreview" className="w-[14rem] h-[5rem] relative">
                <div className="flex justify-between absolute left-0 top-0 right-0 h-1/2">
                    <button onClick={() => onClickHandler("topLeft")} className="w-1/2">{windowColor.topLeft}</button>
                    <button onClick={() => onClickHandler("topRight")} className="w-1/2">{windowColor.topRight}</button>
                </div>
                <div className="flex justify-between absolute left-0 bottom-0 right-0 h-1/2">
                    <button onClick={() => onClickHandler("bottomLeft")} className="w-1/2">{windowColor.bottomLeft}</button>
                    <button onClick={() => onClickHandler("bottomRight")} className="w-1/2">{windowColor.bottomRight}</button>
                </div>
            </ContentBox>
        </>
    );
};

export default BGColorPicker;
