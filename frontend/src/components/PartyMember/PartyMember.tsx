import { useQuery } from "@tanstack/react-query";
import { fetchPartyMember } from "../../util/http.ts";
import textToSprite from "../../util/textToSprite.tsx";
import styles from "./PartyMember.module.scss"

import ProgressBar from "../ProgressBar/ProgressBar.tsx";
import ResourceCounter from "../ResourceCounter/ResourceCounter.tsx";

interface partyMemberProps {
    memberId: number
}

const PartyMember: React.FC<partyMemberProps> = ({ memberId }) => {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["partyMemberData", memberId],
        queryFn: ({ signal }) => fetchPartyMember({ signal, memberId }),
        staleTime: 5000,
        // gcTime: 1000,
        enabled: memberId !== undefined,
    });


    let content;

    if (isLoading) {
        content = <p>{textToSprite("Loading...")}</p>;
    }

    if (isError) {
        content = (
            <>
                <p>{textToSprite("An error occurred")}</p>
                <p>{textToSprite(error.message)}</p>
            </>
        );
    }

    if (data) {
        const { name: memberName, level, hp, mp, limit_level, image_path } = data;

        content = (
            <div className={`${styles.partyMember} flex justify-between`}>
                <img src={image_path} alt="Party Member Portrait" width={145} className="object-contain" />
                <div className="mt-2 ml-8">
                    <p className="mb-2">{textToSprite(memberName)}</p>
                    <p className="flex">
                        <span className="font-glyph" data-sprite="lv">lv</span>
                        {textToSprite(level.toString(), true)}
                    </p>
                    <ResourceCounter label="hp" maxValue={hp} currentValue={hp} accentColor="#4f8fd4" />
                    <ResourceCounter label="mp" maxValue={mp} currentValue={mp} accentColor="#63d9c1" />
                </div>
                <div className="mt-12">
                    <p>{textToSprite("next level")}</p>
                    <div className="ml-7">
                        <ProgressBar percentage={50} />
                    </div>
                    <p>{textToSprite(`Limit level ${limit_level.toString()}`)}</p>
                    <div className="ml-7">
                        <ProgressBar percentage={100} accentColor="#dfbddd" data-limit="true" />
                    </div>
                </div>
            </div>
        );
    }

    return content;
}

export default PartyMember;