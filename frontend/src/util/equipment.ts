import equipmentJSON from "../data/equipment.json";
import type { EquipmentItemType, EquipmentStats, CurrentEquipment } from "../context/types";

export const getEquipmentById = (id: number | null): EquipmentItemType | undefined =>
    (equipmentJSON as EquipmentItemType[]).find(item => item.id === id);

export const slotCount = (item: EquipmentItemType): number =>
    (item.slots?.multiSlots ?? 0) * 2 + (item.slots?.singleSlots ?? 0);

export const resizeMateriaRow = (row: (number | null)[], totalSlots: number): (number | null)[] =>
    Array.from({ length: totalSlots }, (_, i) => row[i] ?? null);

export const getDerivedStats = (equipment: CurrentEquipment): Required<EquipmentStats> => {
    const equipped = [equipment.weapon, equipment.armor, equipment.accessory].map(getEquipmentById);

    return equipped.reduce((totals, item) => {
        if (!item) return totals;
        for (const key of Object.keys(totals) as (keyof EquipmentStats)[]) {
            totals[key] += item.stats[key] ?? 0;
        }
        return totals;
    }, { attack: 0, attackPct: 0, magicAtk: 0, defense: 0, defensePct: 0, magicDefPct: 0 });
};
