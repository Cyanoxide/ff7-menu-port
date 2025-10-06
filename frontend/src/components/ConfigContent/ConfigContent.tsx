import ContentBox from "../contentBox/ContentBox";
import textToSprite from "../../util/textToSprite";

function ConfigContent() {

    return (
        <>
            <div className="relative h-[84px] mb-[10px]">
                <ContentBox data-label="configHeader" className="h-full absolute top-0 left-0 right-0">{textToSprite("Placeholder.")}</ContentBox>
            </div>
            <ContentBox data-label="configBody" className="h-[45.1rem]">{textToSprite("Placeholder.")}</ContentBox>
        </>
    );
}

export default ConfigContent;