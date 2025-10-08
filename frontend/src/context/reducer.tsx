import type { State, Action } from "./types";

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case "SET_WINDOW_COLOR":
            return { ...state, windowColor: action.payload };
        default:
            return state;
    }
};

export const initialState: State = {
    windowColor: {
        topLeft: [2, 34, 186],
        topRight: [2, 24, 145],
        bottomLeft: [0, 15, 105],
        bottomRight: [0, 3, 50],
    }
};