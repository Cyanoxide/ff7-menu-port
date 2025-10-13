
export type PartyMember = { id: number; name: string; limit_level: number; age_epoch: number; hp: number; mp: number; image_path: string; };
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
    isSoundEnabled: boolean;
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }
    | { type: "SET_SECONDS"; payload: number }
    | { type: "INCREMENT_SECONDS"; }
    | { type: "SET_IS_SOUND_ENABLED"; payload: boolean }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}