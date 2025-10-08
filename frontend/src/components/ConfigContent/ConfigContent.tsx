import ContentBox from "../contentBox/ContentBox";
import BGColorPicker from "../BGColorPicker/BGColorPicker";
import textToSprite from "../../util/textToSprite";

function ConfigContent() {
    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="configHeader" className="h-full absolute top-0 left-0 right-0"></ContentBox>
            </div>
            <ContentBox data-label="configBody" className="h-[45.1rem]">
                <ul>
                    <li className="ml-24 mb-5 flex">
                        <div className="w-[24rem]">{textToSprite("Window Color", false, true)}</div>
                        <BGColorPicker />
                    </li>
                    <li className="ml-24 mb-5 flex">
                        <div className="w-[24rem]">{textToSprite("Sound", false, true)}</div>
                        <div className="w-[18rem] flex justify-between">
                            <span>{textToSprite("On")}</span>
                            <span>{textToSprite("Off")}</span>
                        </div>
                    </li>
                </ul>
            </ContentBox>
        </>
    );
}

export default ConfigContent;