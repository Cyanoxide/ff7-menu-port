interface PartyMember {
    id: number;
    name: string;
    level: number;
    hp: number;
    mp: number;
    limit_level: number;
    image_path: string
}

const ENDPOINT_URL = "http://localhost:8000";

export async function fetchPartyMember({ signal, memberId }: { signal: AbortSignal, memberId: number }): Promise<PartyMember> {
    const response = await fetch(`${ENDPOINT_URL}/partymember/${memberId}`, { signal: signal });

    if (!response.ok) {
        const error = new Error('An error occurred while fetching party Member');
        throw error;
    }

    const partyMemberData = await response.json();
    return partyMemberData;
}
