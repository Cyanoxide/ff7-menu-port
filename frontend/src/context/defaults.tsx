import type { WindowColor } from "./types";

export const defaultWindowColor: WindowColor = {
    topLeft: [2, 34, 186],
    topRight: [2, 24, 145],
    bottomLeft: [0, 15, 105],
    bottomRight: [0, 3, 50],
}

export const defaultMateriaLoadout: (number | null)[][] = [
    [1, null, 2, 3, 4, 9, null, 10],
    [5, 6, 7, 8, null],
];