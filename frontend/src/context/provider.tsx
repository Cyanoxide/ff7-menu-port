import { useReducer, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import { Context } from "./context";
import { resolvePortrait } from "../data/portraits";
import playSound from "../util/sounds";

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [initialized, setInitialized] = useState(false);
    const prevPortraitKey = useRef<number | "default" | null>(null);

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

        const userName = localStorage.getItem("userName");
        if (userName) {
            dispatch({ type: "SET_USER_NAME", payload: userName });
        }

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

        const secondsLimit = 360_000;
        if (state.seconds >= secondsLimit) {
            dispatch({ type: "SET_SECONDS", payload: 0 });
        }

        localStorage.setItem("seconds", JSON.stringify(state.seconds));
    }, [state.seconds, initialized]);

    useEffect(() => {
        if (state.isCRTEnabled) {
            document.body.classList.add("crt-effect");
        } else {
            document.body.classList.remove("crt-effect");
        }
    }, [state.isCRTEnabled])

    // Easter egg: play a cue whenever the resolved portrait changes (e.g. renaming
    // the profile to an FF7 character). Skips the initial load so it stays silent
    // on refresh.
    useEffect(() => {
        if (!initialized) return;
        const key = resolvePortrait(state.userName)?.index ?? "default";
        if (prevPortraitKey.current !== null && prevPortraitKey.current !== key) {
            playSound("save", state.isSoundEnabled);
        }
        prevPortraitKey.current = key;
    }, [state.userName, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Context value={{ ...state, dispatch }}>
            {children}
        </Context>
    );
};
