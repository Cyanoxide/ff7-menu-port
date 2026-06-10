import { useState } from "react";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import MateriaSlotPreview from "../../components/MateriaSlotPreview/MateriaSlotPreview";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { getEquipmentById, getDerivedStats, slotCount, resizeMateriaRow } from "../../util/equipment";
import equipmentJSON from "../../data/equipment.json";
import type { EquipmentItemType, EquipmentStats } from "../../context/types";

import styles from "./Equip.module.scss";

type EquipmentCategory = "weapon" | "armor" | "accessory";

const CATEGORIES: { key: EquipmentCategory; label: string }[] = [
    { key: "weapon", label: "Wpn." },
    { key: "armor", label: "Arm." },
    { key: "accessory", label: "Acc." },
];

const STAT_ROWS: { key: keyof EquipmentStats; label: string }[] = [
    { key: "attack", label: "Attack" },
    { key: "attackPct", label: "Attack%" },
    { key: "defense", label: "Defense" },
    { key: "defensePct", label: "Defense%" },
    { key: "magicAtk", label: "Magic atk" },
    { key: "magicDefPct", label: "Magic def%" },
];

function Equip() {
    const { isSoundEnabled, currentMateria, currentEquipment, dispatch } = useContext();

    const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | null>(null);
    const [hoveredCategory, setHoveredCategory] = useState<EquipmentCategory | null>(null);
    const [hoveredItem, setHoveredItem] = useState<EquipmentItemType | null>(null);
    const [lastEquipped, setLastEquipped] = useState<EquipmentItemType | null>(null);

    const activeCategory = hoveredCategory ?? selectedCategory;
    const equippedItem = activeCategory ? getEquipmentById(currentEquipment[activeCategory]) : undefined;
    const previewItem = hoveredItem ?? equippedItem;
    const stickyPreview = previewItem ?? lastEquipped;
    const slotItem = (stickyPreview?.type === "accessory") ? null : stickyPreview;
    const currentStats = getDerivedStats(currentEquipment);
    const newStats = hoveredItem ? getDerivedStats({ ...currentEquipment, [hoveredItem.type]: hoveredItem.id }) : currentStats;

    const categoryItems = activeCategory ? (equipmentJSON as EquipmentItemType[]).filter(item => item.type === activeCategory) : [];

    const handleCategoryEnter = (category: EquipmentCategory) => {
        playSound("select", isSoundEnabled);
        setHoveredCategory(category);
        setHoveredItem(null);
        setLastEquipped(getEquipmentById(currentEquipment[category]) ?? null);
    };

    const handleCategoryClick = (category: EquipmentCategory) => {
        playSound("select", isSoundEnabled);
        setSelectedCategory(category);
        setHoveredItem(null);
    };

    const handleItemEnter = (item: EquipmentItemType) => {
        playSound("select", isSoundEnabled);
        setHoveredItem(item);
    };

    const handleEquip = (item: EquipmentItemType) => {
        if (currentEquipment[item.type] === item.id) {
            playSound("error", isSoundEnabled);
            return;
        }

        if (item.type !== "accessory") {
            const rowIndex = (item.type === "weapon") ? 0 : 1;
            const nextMateria = currentMateria.map(row => [...row]);
            nextMateria[rowIndex] = resizeMateriaRow(nextMateria[rowIndex], slotCount(item));
            dispatch({ type: "SET_CURRENT_MATERIA", payload: nextMateria });
        }

        dispatch({ type: "SET_CURRENT_EQUIPMENT", payload: { ...currentEquipment, [item.type]: item.id } });
        playSound("materia", isSoundEnabled);
        setSelectedCategory(null);
        setHoveredItem(null);
        setLastEquipped(item);
    };

    return (
        <>
            <ContentBox data-label="equipHeader" className="h-[225px] absolute top-0">
                <div className="flex items-start">
                    <div className="w-[447px] mb-2 ml-2 shrink-0">
                        <PartyMember memberId={1} />
                    </div>
                    <ul className="grow mt-2 ml-6 mr-[270px]" onMouseLeave={() => setHoveredCategory(null)}>
                        {CATEGORIES.map(({ key, label }) => {
                            const equipped = getEquipmentById(currentEquipment[key]);
                            return (
                                <li key={key} onMouseEnter={() => handleCategoryEnter(key)} onClick={() => handleCategoryClick(key)} className={`${styles.equipRow} flex mb-[26px]`} data-active={key === selectedCategory}>
                                    <span className="w-[90px] mr-3 shrink-0">{textToSprite(label, false, "blue")}</span>
                                    <span className="flex">{textToSprite(equipped?.name ?? "")}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </ContentBox>
            <ContentBox data-label="equipDescription" className="h-[79px] absolute top-[234px]"><p>{textToSprite(previewItem?.description ?? "")}</p></ContentBox>
            <ContentBox data-label="equipSlots" className="h-[158px] absolute top-[323px]">
                {slotItem && (
                    <>
                        <div className="flex items-center">
                            <span className="w-[150px]">{textToSprite("Slot", false, "blue")}</span>
                            <div className="grow">
                                <MateriaSlotPreview multiSlots={slotItem.slots?.multiSlots ?? 0} singleSlots={slotItem.slots?.singleSlots ?? 0} />
                            </div>
                        </div>
                        <div className="flex items-center mt-6">
                            <span className="w-[150px]">{textToSprite("Growth", false, "blue")}</span>
                            <span className="ml-24">{textToSprite((slotItem.slots && slotCount(slotItem) > 0) ? "Normal" : "Nothing")}</span>
                        </div>
                    </>
                )}
            </ContentBox>
            <ContentBox data-label="equipStats" className="absolute top-[490px] bottom-0">
                <ul>
                    {STAT_ROWS.map(({ key, label }) => (
                        <li key={key} className="flex items-center mb-1.5">
                            <span className="w-[230px]">{textToSprite(label, false, "blue")}</span>
                            <span className="w-[80px] flex justify-end">{textToSprite(String(currentStats[key]), true)}</span>
                            {hoveredItem && (
                                <>
                                    <span className="mx-6">{textToSprite(">", false, "blue")}</span>
                                    <span className="w-[80px] flex justify-end">{textToSprite(String(newStats[key]), true, (newStats[key] > currentStats[key]) ? "yellow" : (newStats[key] < currentStats[key]) ? "red" : "white")}</span>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </ContentBox>
            <ContentBox data-label="equipContentRight" className="absolute top-[323px] right-0 bottom-0">
                <ul onMouseLeave={() => setHoveredItem(null)}>
                    {categoryItems.map((item) => (
                        <li key={item.id} onMouseEnter={() => handleItemEnter(item)} onClick={() => handleEquip(item)} className="mb-3">
                            <span className={`${styles.equipmentItem} flex`}>{textToSprite(item.name)}</span>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default Equip;
