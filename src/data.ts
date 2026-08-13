export type Member = {
    id: string;
    name: string;
    savingsBalance: number;
};

const members: Record<string, Member> = {
    "12345": {
        id: "12345",
        name: "Jordan Lee",
        savingsBalance: 5432.1,
    },
};

export function findMember(memberId: string): Member | undefined {
    return members[memberId];
}