
export type PartyMemberType = { id: number; name: string; limit_level: number; age_epoch: number; hp: number; mp: number; image_path: string; };
export type HistoryType = { id: number; name: string; link: string; user: string; level: number; role: string; year: string; image_path: string; };
export type SkillType = { id: number; name: string; color: "green" | "red" | "yellow" | "blue" | "pink" | null; description: string; score: number; };
export type MenuItem = { id: string; name: string; title?: string; path?: string; position?: number; };

export type WindowCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | null;
export type WindowColor = {
    topLeft: [number, number, number];
    topRight: [number, number, number];
    bottomLeft: [number, number, number];
    bottomRight: [number, number, number];
};

export interface State {
    windowCorner: WindowCorner;
    windowColor: WindowColor;
    seconds: number;
    currentHealth: number | null;
    currentMana: number | null;
    currentMateria: (number | null)[][]
    isSoundEnabled: boolean;
    isCRTEnabled: boolean;
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }
    | { type: "SET_SECONDS"; payload: number }
    | { type: "INCREMENT_SECONDS"; }
    | { type: "SET_CURRENT_HEALTH"; payload: number | null }
    | { type: "SET_CURRENT_MANA"; payload: number | null }
    | { type: "SET_CURRENT_MATERIA"; payload: (number | null)[][] }
    | { type: "SET_IS_SOUND_ENABLED"; payload: boolean }
    | { type: "SET_IS_CRT_ENABLED"; payload: boolean }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}