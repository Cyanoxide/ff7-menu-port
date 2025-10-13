import styles from "./EquipmentSlots.module.scss";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import type { SkillType } from "../../context/types";
import skillsJSON from "../../data/skills.json";

interface equipmentSlotsProps {
    type?: string,
    name?: string,
    multiSlots?: number,
    singleSlots?: number,
    materia?: SkillType[],
    materiaPositions?: (number | null)[][];
    setSkill: (skill: SkillType) => void;
    selectedMateria: number | null;
    setSelectedMateria: (id: number | null) => void;
    setMateriaPositions: (positions: (number | null)[][]) => void;
}


const EquipmentSlots: React.FC<equipmentSlotsProps> = ({ type = "Wpn.", name = "Buster Sword", multiSlots = 0, singleSlots = 0, materia = [], materiaPositions = [], setSkill, selectedMateria, setSelectedMateria, setMateriaPositions, ...props }) => {
    const { isSoundEnabled } = useContext();
    let counter = 0;

    const MateriaSlot = (i: number, materia: SkillType[]) => {
        const arrIndex = (type === "Arm.") ? 1 : 0;
        const matchedMateria = materia.find(item => item.id === materiaPositions[arrIndex][i]);


        const handleMouseEnter = (materia?: SkillType) => {
            playSound("select", isSoundEnabled);

            if (matchedMateria && materia && setSkill) {
                setSkill(materia);
            }
        }

        const handleOnClick = (index: number) => {
            const previousValue = materiaPositions[arrIndex][index];

            if (!selectedMateria && !materiaPositions[arrIndex][index]) {
                playSound("error", isSoundEnabled);
            } else {
                playSound("materia", isSoundEnabled);
            }
            for (let i = 0; i < materiaPositions.length; i++) {
                for (let j = 0; j < materiaPositions[i].length; j++) {
                    if (selectedMateria === materiaPositions[i][j]) {
                        materiaPositions[i][j] = null;
                    }
                }
            }
            materiaPositions[arrIndex][index] = selectedMateria;
            setMateriaPositions(materiaPositions);
            setSelectedMateria(previousValue);

            const skillObj = (skillsJSON as SkillType[]).find(skill => skill.id === selectedMateria);
            if (skillObj) {
                setSkill(skillObj);
            }
        }

        return (
            <div key={i} onMouseEnter={() => handleMouseEnter(matchedMateria)} onClick={() => handleOnClick(i)} className={styles.materiaSlot} data-value={i}>
                <div className={styles.skill} data-color={matchedMateria?.color || null}>
                    {matchedMateria ? matchedMateria.name : materiaPositions[arrIndex][i]}
                </div>
            </div>
        )
    };


    return (
        <div className="w-[550px]" {...props}>
            <p className="flex mt-1">
                <span className="mr-3">{textToSprite(type, false, true)}</span>
                <span>{textToSprite(name)}</span>
            </p>
            <div className={`${styles.equipmentContainer} flex`}>
                {Array.from({ length: multiSlots + singleSlots }).map((_, index) => {
                    const slots = [];


                    if (index < multiSlots) {
                        slots.push(MateriaSlot(counter++, materia));
                        slots.push(MateriaSlot(counter++, materia));
                    } else {
                        slots.push(MateriaSlot(counter++, materia));
                    }

                    return <div key={index} className="flex relative">{slots}</div>
                })}
            </div>
        </div>
    );
};

export default EquipmentSlots;
