import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import EquipmentSlots from "../../components/EquipmentSlots/EquipmentSlots";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import skillsJSON from "../../data/skills.json";
import type { SkillType } from "../../context/types";
import { getEquipmentById, slotCount } from "../../util/equipment";
import { useCursorNav } from "../../hooks/useCursorNav";
import { closeNav } from "../../hooks/closeNav";

import styles from "./SkillsContent.module.scss";

function SkillsContent() {
    const { isSoundEnabled, isCRTEnabled, currentEquipment, currentMateria, dispatch } = useContext();
    const navigate = useNavigate();
    const weapon = getEquipmentById(currentEquipment.weapon);
    const armor = getEquipmentById(currentEquipment.armor);
    const skills = skillsJSON as SkillType[];

    const skillPlaceholder = {
        id: 0,
        name: "",
        color: null,
        description: "",
        additionalInfo: "",
        score: 0
    }

    const [skill, setSkill] = useState<SkillType>(skillPlaceholder);
    const [selectedMateria, setSelectedMateria] = useState<number | null>(null);
    const [targetSlot, setTargetSlot] = useState<{ arrIndex: 0 | 1; slotIndex: number } | null>(null);

    const weaponSlotCount = weapon ? slotCount(weapon) : 0;
    const armorSlotCount = armor ? slotCount(armor) : 0;

    const groupCycle = [
        { id: "wpnSlots", size: weaponSlotCount },
        { id: "armSlots", size: armorSlotCount },
        { id: "materia", size: skills.length },
    ].filter(group => group.size > 0);

    const handleSlotFocus = (arrIndex: 0 | 1, slotIndex: number) => {
        const matchedMateria = skills.find(item => item.id === currentMateria[arrIndex]?.[slotIndex]);
        if (matchedMateria) setSkill(matchedMateria);
    };

    const handleSlotConfirm = (arrIndex: 0 | 1, slotIndex: number) => {
        if (selectedMateria) {
            // A materia picked from the list is being placed into this slot
            const nextMateria = currentMateria.map(row => [...row]);
            const previousValue = nextMateria[arrIndex][slotIndex] ?? null;

            playSound("materia", isSoundEnabled);

            for (let i = 0; i < nextMateria.length; i++) {
                for (let j = 0; j < nextMateria[i].length; j++) {
                    if (selectedMateria === nextMateria[i][j]) {
                        nextMateria[i][j] = null;
                    }
                }
            }
            nextMateria[arrIndex][slotIndex] = selectedMateria;
            dispatch({ type: "SET_CURRENT_MATERIA", payload: nextMateria });
            setSelectedMateria(previousValue);

            const skillObj = skills.find(item => item.id === selectedMateria);
            if (skillObj) {
                setSkill(skillObj);
            }
            return;
        }

        // FF7 flow: choose the slot first, then pick its materia from the list
        playSound("select", isSoundEnabled);
        setTargetSlot({ arrIndex, slotIndex });
        const slottedId = currentMateria[arrIndex]?.[slotIndex];
        const listIndex = Math.max(0, skills.findIndex(item => item.id === slottedId));
        setPosSilently({ group: "materia", index: listIndex });
        const skillObj = skills[listIndex];
        if (skillObj) setSkill(skillObj);
    };

    const handleMateriaFocus = (index: number) => {
        const skillObj = skills[index];
        if (!selectedMateria && skillObj) {
            setSkill(skillObj);
        }
    };

    const handleMateriaConfirm = (id?: number) => {
        if (!id) {
            playSound("error", isSoundEnabled);
            return;
        }

        if (targetSlot) {
            // Socket the chosen materia into the slot picked earlier
            const nextMateria = currentMateria.map(row => [...row]);
            for (let i = 0; i < nextMateria.length; i++) {
                for (let j = 0; j < nextMateria[i].length; j++) {
                    if (nextMateria[i][j] === id) {
                        nextMateria[i][j] = null;
                    }
                }
            }
            nextMateria[targetSlot.arrIndex][targetSlot.slotIndex] = id;
            dispatch({ type: "SET_CURRENT_MATERIA", payload: nextMateria });
            playSound("materia", isSoundEnabled);
            setPosSilently({ group: (targetSlot.arrIndex === 0) ? "wpnSlots" : "armSlots", index: targetSlot.slotIndex });
            setTargetSlot(null);
            return;
        }

        const value = (id !== selectedMateria) ? id : null;
        setSelectedMateria(value);
        playSound("select", isSoundEnabled);
    };

    const { pos, focus, setPosSilently, isFocused } = useCursorNav({
        groups: [...groupCycle, { id: "close", size: 1 }],
        initial: null,
        fallback: { group: groupCycle[0].id, index: 0 },
        enabled: true,
        resolveMove: (current, dir, { wrap }) => {
            // The close "X" sits at the seam of the vertical cycle, between the
            // end of the materia list and the first slot row
            if (current.group === "close") {
                if (dir === "down") return { group: groupCycle[0].id, index: 0 };
                if (dir === "up") return { group: "materia", index: skills.length - 1 };
                return null;
            }

            const cycleIndex = groupCycle.findIndex(group => group.id === current.group);
            if (cycleIndex === -1) return { group: "materia", index: 0 };
            const group = groupCycle[cycleIndex];

            const enterGroup = (offset: 1 | -1) => {
                const nextGroup = groupCycle[(cycleIndex + offset + groupCycle.length) % groupCycle.length];
                // Slot rows keep the same slot number, clamped to the row's size
                const index = (nextGroup.id === "materia")
                    ? ((offset === 1) ? 0 : nextGroup.size - 1)
                    : Math.min(current.index, nextGroup.size - 1);
                return { group: nextGroup.id, index };
            };

            if (current.group === "materia") {
                if (dir === "up") return (current.index === 0) ? enterGroup(-1) : { group: "materia", index: current.index - 1 };
                if (dir === "down") return (current.index === group.size - 1) ? { group: "close", index: 0 } : { group: "materia", index: current.index + 1 };
                return null;
            }

            if (dir === "left") return { group: current.group, index: wrap(current.index, -1, group.size) };
            if (dir === "right") return { group: current.group, index: wrap(current.index, 1, group.size) };
            if (dir === "up") return (cycleIndex === 0) ? { group: "close", index: 0 } : enterGroup(-1);
            return enterGroup(1);
        },
        resolvePageJump: (current, dir) => {
            if (current.group !== "materia") return null;
            return { group: "materia", index: (dir === "pageUp") ? 0 : skills.length - 1 };
        },
        onFocus: (current) => {
            closeNav.setFocus(current.group === "close");
            if (current.group === "close") return;
            if (current.group === "materia") handleMateriaFocus(current.index);
            else handleSlotFocus(current.group === "wpnSlots" ? 0 : 1, current.index);
        },
        onConfirm: (current) => {
            if (current.group === "close") {
                playSound("back", isSoundEnabled);
                closeNav.setFocus(false);
                setPosSilently(null);
                navigate("/");
                return;
            }
            if (current.group === "materia") handleMateriaConfirm(skills[current.index]?.id);
            else handleSlotConfirm(current.group === "wpnSlots" ? 0 : 1, current.index);
        },
        onCancel: () => {
            if (targetSlot) {
                // Back out of materia selection, returning the cursor to the slot
                playSound("back", isSoundEnabled);
                setPosSilently({ group: (targetSlot.arrIndex === 0) ? "wpnSlots" : "armSlots", index: targetSlot.slotIndex });
                setTargetSlot(null);
                return true;
            }
            if (selectedMateria !== null) {
                // FF7 drops the held materia on cancel
                setSelectedMateria(null);
                playSound("back", isSoundEnabled);
                return true;
            }
            return false;
        },
        onSwitch: () => navigate("/equip"),
    });

    useEffect(() => () => closeNav.setFocus(false), []);

    return (
        <>
            <ContentBox data-label="skillsHeader" className="h-[261px] absolute top-0">
                <div className="flex justify-between items-end">
                    <div className="w-[447px] mb-2 ml-2">
                        <PartyMember memberId={1} />
                    </div>
                    <div className="mt-9 mr-2">
                        <EquipmentSlots type="Wpn." name={weapon?.name} multiSlots={weapon?.slots?.multiSlots} singleSlots={weapon?.slots?.singleSlots} materia={skills} focusedSlot={pos?.group === "wpnSlots" ? pos.index : null} activeSlot={targetSlot?.arrIndex === 0 ? targetSlot.slotIndex : null} onSlotEnter={(index) => focus({ group: "wpnSlots", index })} onSlotClick={(index) => handleSlotConfirm(0, index)} />
                        <EquipmentSlots type="Arm." name={armor?.name} multiSlots={armor?.slots?.multiSlots} singleSlots={armor?.slots?.singleSlots} materia={skills} focusedSlot={pos?.group === "armSlots" ? pos.index : null} activeSlot={targetSlot?.arrIndex === 1 ? targetSlot.slotIndex : null} onSlotEnter={(index) => focus({ group: "armSlots", index })} onSlotClick={(index) => handleSlotConfirm(1, index)} />
                    </div>
                </div>
            </ContentBox>
            <ContentBox data-label="skillsDescription" className="h-[79px] absolute top-[270px]"><p>{textToSprite(skill.description)}</p></ContentBox>
            <ContentBox data-label="skillsContentLeft" className="absolute top-[359px] bottom-0">
                <div className="flex justify-between items-center">
                    <p className={`${styles.skill} flex`} data-color={skill.color}>{textToSprite(skill.name)}</p>
                    {skill.id !== 0 && <ul className="flex">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <li key={index} className={styles.star} data-color={skill.color} data-star={index < skill.score} data-crt={isCRTEnabled}></li>
                        ))}
                    </ul>}
                </div>
            </ContentBox>
            <ContentBox data-label="skillsContentRight" className="absolute top-[359px] right-0 bottom-0">
                <ul>
                    {skills.map((skillItem, index) => (
                        <li key={skillItem.id} onMouseEnter={() => focus({ group: "materia", index })} onClick={() => handleMateriaConfirm(skillItem.id)} className="mb-1.5">
                            <span className={`${styles.skill} flex`} data-color={skillItem.color} data-active={skillItem.id === selectedMateria} data-focused={isFocused("materia", index)}>{textToSprite(skillItem.name)}</span>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default SkillsContent;
