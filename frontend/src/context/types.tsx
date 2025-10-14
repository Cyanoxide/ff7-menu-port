
export type PartyMemberType = { id: number; name: string; limit_level: number; age_epoch: number; hp: number; mp: number; image_path: string; };
export type HistoryType = { id: number; name: string; link: string; user: string; level: number; role: string; year: string; image_path: string; };
export type SkillType = { id: number; name: string; color: "green" | "red" | "yellow" | "blue" | "pink" | null; description: string; score: number; };

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
    isSoundEnabled: boolean;
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }
    | { type: "SET_SECONDS"; payload: number }
    | { type: "INCREMENT_SECONDS"; }
    | { type: "SET_CURRENT_HEALTH"; payload: number | null }
    | { type: "SET_IS_SOUND_ENABLED"; payload: boolean }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}