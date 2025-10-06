import { useState } from "react";

import ContentBox from "../contentBox/ContentBox";
import PartyMember from "../PartyMember/PartyMember";
import EquipmentSlots from "../EquipmentSlots/EquipmentSlots";
import textToSprite from "../../util/textToSprite";

import styles from "./SkillsContent.module.scss";

type Materia = {
    id: number;
    name: string;
    color: string;
    description: string;
    additionalInfo: string;
    score: number;
};

function SkillsContent() {
    const skillPlaceholder = {
        id: 0,
        name: "",
        color: "",
        description: "",
        additionalInfo: "",
        score: 0
    }
    const skills = [
        {
            id: 1,
            name: "React",
            color: "green",
            description: "A JavaScript library for building interactive user interfaces.",
            additionalInfo: "",
            score: 4
        },
        {
            id: 2,
            name: "Typescript",
            color: "yellow",
            description: "A superset of JavaScript that adds static typing.",
            additionalInfo: "",
            score: 3
        },
        {
            id: 3,
            name: "Javascript",
            color: "yellow",
            description: "A programming language for creating dynamic content.",
            additionalInfo: "",
            score: 5
        },
        {
            id: 4,
            name: "Python",
            color: "blue",
            description: "A general-purpose, readable programming language.",
            additionalInfo: "",
            score: 4
        },
        {
            id: 5,
            name: "Django",
            color: "blue",
            description: "A Python framework for web apps.",
            additionalInfo: "",
            score: 4
        },
        {
            id: 6,
            name: "SQL",
            color: "yellow",
            description: "A language for managing relational databases.",
            additionalInfo: "",
            score: 3
        },
        {
            id: 7,
            name: "PHP",
            color: "yellow",
            description: "A server-side language for building dynamic web pages.",
            additionalInfo: "",
            score: 2
        },
        {
            id: 8,
            name: "Git",
            color: "pink",
            description: "A version control system for managing code changes.",
            additionalInfo: "",
            score: 4
        },
        {
            id: 9,
            name: "Photoshop",
            color: "red",
            description: "A graphics editor used for image manipulation and design.",
            additionalInfo: "",
            score: 5
        },
        {
            id: 10,
            name: "Docker",
            color: "pink",
            description: "A platform for packaging, and running containerized apps.",
            additionalInfo: "",
            score: 2
        },
    ]

    const [skill, setSkill] = useState<Materia>(skillPlaceholder);
    const [materiaPositionsTop, setMateriaPositionsTop] = useState([1, null, 2, 3, 4, 9, null, 10]);
    const [materiaPositionsBottom, setMateriaPositionsBottom] = useState([5, 6, 7, 8, null]);

    const handleMouseEnter = (skill: string) => {
        const skillObj = skills.find(item => item.name === skill);
        if (skillObj) {
            setSkill(skillObj);
        }
    }

    return (
        <>
            <ContentBox data-label="skillsHeader" className="h-[300] absolute top-0">
                <div className="flex justify-between items-end">
                    <div className="w-[447px] mb-2 ml-2">
                        <PartyMember memberId={1} />
                    </div>
                    <div className="mt-9 mr-2">
                        <EquipmentSlots type="Wpn." name="Mouse" multiSlots={3} singleSlots={2} materia={skills} materiaPositions={materiaPositionsTop} setSkill={setSkill} />
                        <EquipmentSlots type="Arm." name="Keyboard" multiSlots={2} singleSlots={2} materia={skills} materiaPositions={materiaPositionsBottom} setSkill={setSkill} />
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
                    {skills.map((skill) => (
                        <li key={skill.id} onMouseEnter={() => handleMouseEnter(skill.name)} className="mb-1.5">
                            <span className={`${styles.skill} flex`} data-color={skill.color}>{textToSprite(skill.name)}</span>
                        </li>
                    ))}
                </ul>
            </ContentBox>
        </>
    );
}

export default SkillsContent;