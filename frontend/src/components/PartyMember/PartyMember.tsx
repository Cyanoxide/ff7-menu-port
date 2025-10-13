import textToSprite from "../../util/textToSprite.tsx";

import ProgressBar from "../ProgressBar/ProgressBar.tsx";
import ResourceCounter from "../ResourceCounter/ResourceCounter.tsx";

interface partyMemberProps {
    memberId?: number,
    showProgressBars?: boolean
}

const PartyMember: React.FC<partyMemberProps> = ({ memberId, showProgressBars = false }) => {
    if (!memberId) return;
    // const { data, isLoading, isError, error } = useQuery({
    //     queryKey: ["partyMemberData", memberId],
    //     queryFn: ({ signal }) => fetchPartyMember({ signal, memberId }),
    //     staleTime: 5000,
    //     // gcTime: 1000,
    //     enabled: memberId !== undefined,
    // });

    const partyMemberData = {
        id: 1,
        name: "Jamie Pates",
        limit_level: 3,
        age_epoch: 667785600,
        hp: 1342,
        mp: 540,
        image_path: "/portrait.png"
    };

    function epochToDate(epoch: number): Date {
        return new Date(epoch < 1e12 ? epoch * 1000 : epoch);
    }

    function convertAgeEpochToLevel(epoch: number) {
        const date = epochToDate(epoch);
        const now = new Date();

        let years = now.getFullYear() - date.getFullYear();

        const hasHadBirthday =
            now.getMonth() > date.getMonth() ||
            (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());

        if (!hasHadBirthday) years--;

        return years;
    }

    function getDaysUntilLevel(epoch: number) {
        const date = epochToDate(epoch);
        const now = new Date();

        const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());

        if (next < now) {
            next.setFullYear(next.getFullYear() + 1);
        }

        const diff = next.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }


    let content;

    // if (isLoading) {
    //     content = <p>{textToSprite("Loading...")}</p>;
    // }

    // if (isError) {
    //     content = (
    //         <>
    //             <p>{textToSprite("An error occurred")}</p>
    //             <p>{textToSprite(error.message)}</p>
    //         </>
    //     );
    // }

    if (partyMemberData) {
        const { name: memberName, hp, mp, limit_level, image_path, age_epoch } = partyMemberData;

        content = (
            <div className={`flex justify-between`}>
                <img src={image_path} alt="Party Member Portrait" width={145} className="object-contain" />
                <div className="mt-2 ml-8">
                    <p className="mb-2">{textToSprite(memberName)}</p>
                    <p className="flex">
                        <span className="font-glyph" data-sprite="lv">lv</span>
                        {textToSprite(convertAgeEpochToLevel(new Date(age_epoch).getTime()).toFixed(0), true)}
                    </p>
                    <ResourceCounter label="hp" maxValue={hp} currentValue={hp} accentColor="#4f8fd4" />
                    <ResourceCounter label="mp" maxValue={mp} currentValue={mp} accentColor="#63d9c1" />
                </div>
                {showProgressBars && (
                    <div className="mt-12">
                        <p>{textToSprite("next level")}</p>
                        <div className="ml-7">
                            <ProgressBar percentage={(getDaysUntilLevel(age_epoch) / 365) * 100} />
                        </div>
                        <p>{textToSprite(`Limit level ${limit_level.toString()}`)}</p>
                        <div className="ml-7">
                            <ProgressBar percentage={100} accentColor="#dfbddd" data-limit="true" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return content;
}

export default PartyMember;