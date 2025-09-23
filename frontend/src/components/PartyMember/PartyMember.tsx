import { useQuery } from '@tanstack/react-query';
import { fetchPartyMember } from '../../util/http.ts';

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
        content = <p>Loading</p>;
    }

    if (isError) {
        content = (
            <>
                <p>An error occurred</p>
                <p>{error.message}</p>
            </>
        );
    }

    if (data) {
        const { name: memberName, level, hp, mp, limit_level, image_path } = data;

        content = (
            <div className="flex">
                <img src={image_path} alt="Party Member Portrait" />
                <div>
                    <p>{memberName}</p>
                    <p>{level}</p>
                    <p>{hp}</p>
                    <p>{mp}</p>
                </div>
                <div>
                    <p>{level}</p>
                    <p>{limit_level}</p>
                </div>
            </div>
        );
    }

    return content;
}

export default PartyMember;