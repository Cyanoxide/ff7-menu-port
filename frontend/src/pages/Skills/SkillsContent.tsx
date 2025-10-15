import { useState } from "react";
import { useContext } from "../../context/context";

import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import EquipmentSlots from "../../components/EquipmentSlots/EquipmentSlots";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import skillsJSON from "../../data/skills.json";
import type { SkillType } from "../../context/types";

import styles from "./SkillsContent.module.scss";

function SkillsContent() {
    const { isSoundEnabled } = useContext();
    const skillPlaceholder = {
        id: 0,
        name: "",
        color: null,
        description: "",
        additionalInfo: "",
        score: 0
    }


    const [skill, setSkill] = useState<SkillType>(skillPlaceholder);
    // const [materiaPositions, setMateriaPositions] = useState([[1, null, 2, 3, 4, 9, null, 10], [5, 6, 7, 8, null]]);
    const [selectedMateria, setSelectedMateria] = useState<number | null>(null);

    const handleMouseEnter = (skill: string) => {
        playSound("select", isSoundEnabled);
        const skillObj = (skillsJSON as SkillType[]).find(item => item.name === skill);
        if (!selectedMateria && skillObj) {
            setSkill(skillObj);
        }
    }

    const handleOnClick = (id?: number) => {
        if (!id) {
            playSound("error", isSoundEnabled);
            return;
        }

        const value = (id !== selectedMateria) ? id : null;
        setSelectedMateria(value);
        playSound("select", isSoundEnabled);
    }

    return (
        <>
            <ContentBox data-label="skillsHeader" className="h-[300] absolute top-0">
                <div className="flex justify-between items-end">
                    <div className="w-[447px] mb-2 ml-2">
                        <PartyMember memberId={1} />
                    </div>
                    <div className="mt-9 mr-2">
                        <EquipmentSlots type="Wpn." name="Mouse" multiSlots={3} singleSlots={2} materia={skillsJSON as SkillType[]} setSkill={setSkill} selectedMateria={selectedMateria} setSelectedMateria={setSelectedMateria} />
                        <EquipmentSlots type="Arm." name="Keyboard" multiSlots={2} singleSlots={2} materia={skillsJSON as SkillType[]} setSkill={setSkill} selectedMateria={selectedMateria} setSelectedMateria={setSelectedMateria} />
                    </div>
                </div>
            </ContentBox>
            <ContentBox data-label="skillsDescription" className="h-[79px] absolute top-[270px]"><p>{textToSprite(skill.description)}</p></ContentBox>
            <ContentBox data-label="skillsContentLeft" className="absolute top-[359px] bottom-0">
                <div className="flex justify-between items-center">
                    <p className={`${styles.skill} flex`} data-color={skill.color}>{textToSprite(skill.name)}</p>
                    {skill.id !== 0 && <ul className="flex">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <li key={index} className={styles.star} data-color={skill.color} data-star={index < skill.score}></li>
                        ))}
                    </ul>}
                </div>
            </ContentBox>
            <ContentBox data-label="skillsContentRight" className="absolute top-[359px] right-0 bottom-0">
                <ul>
                    {skillsJSON.map((skill) => (
                        <li key={skill.id} onMouseEnter={() => handleMouseEnter(skill.name)} onClick={() => handleOnClick(skill.id)} className="mb-1.5">
                            <span className={`${styles.skill} flex`} data-color={skill.color} data-active={skill.id === selectedMateria}>{textToSprite(skill.name)}</span>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default SkillsContent;