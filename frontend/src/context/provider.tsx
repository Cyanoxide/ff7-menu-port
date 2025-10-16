import { useReducer, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import { Context } from "./context";

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

        const isSoundEnabledJSON = localStorage.getItem("isSoundEnabled");
        if (isSoundEnabledJSON) {
            try {
                const isSoundEnabled = JSON.parse(isSoundEnabledJSON);
                dispatch({ type: "SET_IS_SOUND_ENABLED", payload: isSoundEnabled });
            } catch (error) {
                console.error("Failed to parse isSoundEnabled from localStorage", error);
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

        const isCRTEnabledJSON = localStorage.getItem("isCRTEnabled");
        if (isCRTEnabledJSON) {
            try {
                const isCRTEnabled = JSON.parse(isCRTEnabledJSON);
                dispatch({ type: "SET_IS_CRT_ENABLED", payload: isCRTEnabled });
            } catch (error) {
                console.error("Failed to parse isCRTEnabled from localStorage", error);
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

    useEffect(() => {
        if (state.isCRTEnabled) {
            document.body.classList.add("crt-effect");
        } else {
            document.body.classList.remove("crt-effect");
        }
    }, [state.isCRTEnabled])

    return (
        <Context value={{ ...state, dispatch }}>
            {children}
        </Context>
    );
};
