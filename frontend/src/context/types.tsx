
export type WindowCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type WindowColor = {
    topLeft: [number, number, number];
    topRight: [number, number, number];
    bottomLeft: [number, number, number];
    bottomRight: [number, number, number];
};

export interface State {
    windowCorner: WindowCorner;
    windowColor: WindowColor;
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}