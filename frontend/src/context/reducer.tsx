import type { State, Action } from "./types";

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case "SET_WINDOW_COLOR":
            return { ...state, windowColor: action.payload };
        case "SET_SECONDS":
            return { ...state, seconds: action.payload };
        case "SET_IS_SOUND_ENABLED":
            return { ...state, isSoundEnabled: action.payload };
        case "SET_IS_CRT_ENABLED":
            return { ...state, isCRTEnabled: action.payload };
        case "SET_CURRENT_HEALTH":
            return { ...state, currentHealth: action.payload };
        case "SET_CURRENT_MANA":
            return { ...state, currentMana: action.payload };
        case "SET_CURRENT_MATERIA":
            return { ...state, currentMateria: action.payload };
        case "INCREMENT_SECONDS":
            return { ...state, seconds: state.seconds + 1 };
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
    },
    windowCorner: null,
    seconds: 0,
    isSoundEnabled: false,
    isCRTEnabled: true,
    currentHealth: null,
    currentMana: null,
    currentMateria: [[1, null, 2, 3, 4, 9, null, 10], [5, 6, 7, 8, null]]
};