import { createContext, use, useReducer, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import type { ContextType } from "./types";

const Context = createContext<ContextType | undefined>(undefined);

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const windowColorJSON = localStorage.getItem("windowColor");
        if (windowColorJSON) {
            try {
                const windowColor = JSON.parse(windowColorJSON);
                dispatch({ type: "SET_WINDOW_COLOR", payload: windowColor });
            } catch (error) {
                console.error("Failed to parse windowColor from localStorage", error);
            }
        }

        const secondsJSON = localStorage.getItem("seconds");
        if (secondsJSON) {
            try {
                const seconds = JSON.parse(secondsJSON);
                dispatch({ type: "SET_SECONDS", payload: seconds });
            } catch (error) {
                console.error("Failed to parse seconds from localStorage", error);
            }
        }
        setInitialized(true);
    }, []);

    useEffect(() => {
        if (!initialized) return;

        const timer = setInterval(() => {
            dispatch({ type: "INCREMENT_SECONDS" });
        }, 1000);

        return () => clearInterval(timer);
    }, [initialized]);

    useEffect(() => {
        if (!initialized) return;
        localStorage.setItem("seconds", JSON.stringify(state.seconds));
    }, [state.seconds, initialized]);

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