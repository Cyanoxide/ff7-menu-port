import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import MateriaSlotPreview from "../../components/MateriaSlotPreview/MateriaSlotPreview";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { getEquipmentById, getDerivedStats, slotCount, resizeMateriaRow } from "../../util/equipment";
import { useCursorNav, markKeyboardNavigation } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";
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

const itemsOfCategory = (category: EquipmentCategory) =>
    (equipmentJSON as EquipmentItemType[]).filter(item => item.type === category);

function Equip() {
    const { isSoundEnabled, currentMateria, currentEquipment, dispatch } = useContext();
    const navigate = useNavigate();

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

    const categoryItems = activeCategory ? itemsOfCategory(activeCategory) : [];
    const itemListInteractive = selectedCategory !== null && activeCategory === selectedCategory;

    const parkCursorOnCategory = (category: EquipmentCategory) => {
        const index = Math.max(0, CATEGORIES.findIndex(c => c.key === category));
        setPosSilently({ group: "categories", index });
        setHoveredCategory(category);
        setHoveredItem(null);
    };

    const handleEquip = (item: EquipmentItemType, source: "mouse" | "keyboard" = "mouse") => {
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
        setLastEquipped(item);

        if (source === "keyboard") {
            // FF7: the cursor returns to the equip row of what was just equipped
            parkCursorOnCategory(item.type);
        } else {
            setHoveredCategory(null);
            setHoveredItem(null);
            setPosSilently(null);
        }
    };

    const selectCategory = (category: EquipmentCategory) => {
        playSound("select", isSoundEnabled);
        setSelectedCategory(category);
        setHoveredItem(null);
    };

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [
            { id: "categories", size: CATEGORIES.length },
            { id: "items", size: categoryItems.length },
            { id: "close", size: 1 },
        ],
        initial: null,
        fallback: { group: "categories", index: 0 },
        enabled: true,
        resolveMove: (current, dir, { wrap }) => {
            if (dir !== "up" && dir !== "down") return null;
            if (current.group === "close") {
                return { group: "categories", index: (dir === "down") ? 0 : CATEGORIES.length - 1 };
            }
            if (current.group === "categories") {
                if (dir === "up" && current.index === 0) return { group: "close", index: 0 };
                if (dir === "down" && current.index === CATEGORIES.length - 1) return { group: "close", index: 0 };
                return { group: "categories", index: current.index + ((dir === "down") ? 1 : -1) };
            }
            if (categoryItems.length === 0) return null;
            return { group: "items", index: wrap(current.index, (dir === "down") ? 1 : -1, categoryItems.length) };
        },
        resolvePageJump: (current, dir) => {
            if (current.group !== "items" || categoryItems.length === 0) return null;
            return { group: "items", index: (dir === "pageUp") ? 0 : categoryItems.length - 1 };
        },
        onFocus: (current) => {
            closeNav.setFocus(current.group === "close");
            if (current.group === "categories") {
                const category = CATEGORIES[current.index].key;
                setHoveredCategory(category);
                setHoveredItem(null);
                setLastEquipped(getEquipmentById(currentEquipment[category]) ?? null);
            } else if (current.group === "items") {
                const item = categoryItems[current.index];
                if (item) setHoveredItem(item);
            }
        },
        onConfirm: (current) => {
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                setPosSilently(null);
                markKeyboardNavigation();
                navigate("/");
                return;
            }
            if (current.group === "categories") {
                const category = CATEGORIES[current.index].key;
                selectCategory(category);
                // FF7: the cursor dives into the list, landing on the currently equipped item
                const items = itemsOfCategory(category);
                const equippedIndex = Math.max(0, items.findIndex(item => item.id === currentEquipment[category]));
                setPosSilently({ group: "items", index: equippedIndex });
                setHoveredItem(items[equippedIndex] ?? null);
            } else {
                const item = categoryItems[current.index];
                if (item) handleEquip(item, "keyboard");
            }
        },
        onCancel: () => {
            if (pos?.group === "items") {
                const category = selectedCategory ?? "weapon";
                setSelectedCategory(null);
                playSound("back", isSoundEnabled);
                parkCursorOnCategory(category);
                return true;
            }
            return false;
        },
        onSwitch: () => navigate("/skills"),
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    return (
        <>
            <ContentBox data-label="equipHeader" className="h-[225px] absolute top-0">
                <div className="flex items-start">
                    <div className="w-[447px] mb-2 ml-2 shrink-0">
                        <PartyMember memberId={1} />
                    </div>
                    <ul className="grow mt-2 ml-6 mr-[270px]">
                        {CATEGORIES.map(({ key, label }, index) => {
                            const equipped = getEquipmentById(currentEquipment[key]);
                            return (
                                <li key={key} onMouseEnter={() => focus({ group: "categories", index })} onClick={() => selectCategory(key)} className={`${styles.equipRow} flex mb-[26px]`} data-active={key === selectedCategory} data-focused={isFocused("categories", index)}>
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
                <ul>
                    {categoryItems.map((item, index) => (
                        <li key={item.id} onMouseEnter={() => { if (itemListInteractive) focus({ group: "items", index }); }} onClick={() => { if (itemListInteractive) handleEquip(item); }} className="mb-3">
                            <span className={`${styles.equipmentItem} flex`} data-focused={isFocused("items", index)}>{textToSprite(item.name)}</span>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default Equip;
