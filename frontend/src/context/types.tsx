
export type PartyMemberType = { id: number; name: string; limit_level: number; age_epoch: number; hp: number; mp: number; image_path: string; };
/**
 * Four corner colours in the same order the FF7 config screen names them:
 * top-left, top-right, bottom-left, bottom-right. A plain array rather than
 * WindowColor's named corners, because these are written by hand in the data
 * files and never edited through the picker.
 *
 * A null corner keeps whatever the config screen is set to, so an entry can
 * tint one edge and let the rest follow the player's own colours.
 */
export type CornerColors = [
    [number, number, number] | null,
    [number, number, number] | null,
    [number, number, number] | null,
    [number, number, number] | null,
];

/** A window colour with any corner left to the player's setting */
export type PartialWindowColor = { [K in keyof WindowColor]?: WindowColor[K] | null };

export type HistoryType = { id: number; name: string; link: string; user: string; level: number; role: string; year: string; image_path: string; windowColor?: CornerColors; };
export type SkillType = { id: number; name: string; color: "green" | "red" | "yellow" | "blue" | "pink" | null; description: string; score: number; ap: number; toNextLevel: number; abilities: string[]; };
export type EquipmentStats = { attack?: number; attackPct?: number; magicAtk?: number; defense?: number; defensePct?: number; magicDefPct?: number; };
export type EquipmentItemType = { id: number; name: string; type: "weapon" | "armor" | "accessory"; description: string; stats: EquipmentStats; slots?: { multiSlots: number; singleSlots: number; growth?: "Normal" | "Double" | "Triple" }; };
export type CurrentEquipment = { weapon: number; armor: number; accessory: number | null; };
export type MenuItem = { id: string; name: string; title?: string; path?: string; position?: number; };

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
    currentHealth: number | null;
    currentMana: number | null;
    currentMateria: (number | null)[][]
    currentEquipment: CurrentEquipment;
    isSoundEnabled: boolean;
    isCRTEnabled: boolean;
    userName: string;
}

export type Action =
    | { type: "SET_WINDOW_COLOR"; payload: WindowColor }
    | { type: "SET_SECONDS"; payload: number }
    | { type: "INCREMENT_SECONDS"; }
    | { type: "SET_CURRENT_HEALTH"; payload: number | null }
    | { type: "SET_CURRENT_MANA"; payload: number | null }
    | { type: "SET_CURRENT_MATERIA"; payload: (number | null)[][] }
    | { type: "SET_CURRENT_EQUIPMENT"; payload: CurrentEquipment }
    | { type: "SET_IS_SOUND_ENABLED"; payload: boolean }
    | { type: "SET_IS_CRT_ENABLED"; payload: boolean }
    | { type: "SET_USER_NAME"; payload: string }

export interface ContextType extends State {
    dispatch: React.Dispatch<Action>;
}