import { createContext, use, useReducer } from "react";
import type { ReactNode } from "react";
import { reducer, initialState } from "./reducer";
import type { ContextType } from "./types";

const Context = createContext<ContextType | undefined>(undefined);

export const Provider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

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