import { createContext, use, useReducer, useEffect } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import type { ContextType } from "./types";

const Context = createContext<ContextType | undefined>(undefined);

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const timer = setInterval(() => {
            dispatch({ type: 'INCREMENT_SECONDS' });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const windowColorJSON = localStorage.getItem("windowColor");
        if (windowColorJSON) {
            try {
                const windowColor = JSON.parse(windowColorJSON);
                console.log(windowColor)
                dispatch({ type: "SET_WINDOW_COLOR", payload: windowColor });
            } catch (error) {
                console.error("Failed to parse windowColor from localStorage", error);
            }
        }
    }, []);

    return (
        <Context value={{ ...state, dispatch }}>
            {children}
        </Context>
    );
};

export const useContext = () => {
    const context = use(Context);
    if (!context) {
        throw new Error("useContext must be used within a Provider");
    }
    return context;
};