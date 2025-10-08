
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
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }
    | { type: "INCREMENT_SECONDS"; }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}