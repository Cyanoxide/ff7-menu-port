interface PartyMember {
    id: number;
    name: string;
    level: number;
    hp: number;
    mp: number;
    limit_level: number;
    image_path: string
}

export async function fetchPartyMember({ signal, memberId }: { signal: AbortSignal, memberId: number }): Promise<PartyMember> {
    const response = await fetch(`http://localhost:8000/partymember/${memberId}`, { signal: signal });

    console.log(response, memberId)

    if (!response.ok) {
        const error = new Error('An error occurred while fetching party Member');
        throw error;
    }

    const partyMemberData = await response.json();
    console.log(partyMemberData)
    return partyMemberData;
}
