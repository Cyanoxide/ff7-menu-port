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
    selectedMateria: number | null;
    setSelectedMateria: (id: number | null) => void;
    setSkill: (skill: SkillType) => void;
}


const EquipmentSlots: React.FC<equipmentSlotsProps> = ({ type = "Wpn.", name = "Buster Sword", multiSlots = 0, singleSlots = 0, materia = [], setSkill, selectedMateria, setSelectedMateria,  ...props }) => {
    const { isSoundEnabled, currentMateria, dispatch } = useContext();
    const currentMateriaPositions = currentMateria;
    let counter = 0;

    const MateriaSlot = (i: number, materia: SkillType[]) => {
        const arrIndex = (type === "Arm.") ? 1 : 0;
        const matchedMateria = materia.find(item => item.id === currentMateriaPositions[arrIndex][i]);


        const handleMouseEnter = (materia?: SkillType) => {
            playSound("select", isSoundEnabled);

            if (matchedMateria && materia && setSkill) {
                setSkill(materia);
            }
        }

        const handleOnClick = (index: number) => {
            const previousValue = currentMateriaPositions[arrIndex][index];

            if (!selectedMateria && !currentMateriaPositions[arrIndex][index]) {
                playSound("error", isSoundEnabled);
            } else {
                playSound("materia", isSoundEnabled);
            }
            for (let i = 0; i < currentMateriaPositions.length; i++) {
                for (let j = 0; j < currentMateriaPositions[i].length; j++) {
                    if (selectedMateria === currentMateriaPositions[i][j]) {
                        currentMateriaPositions[i][j] = null;
                    }
                }
            }
            currentMateriaPositions[arrIndex][index] = selectedMateria;
            dispatch({ type: "SET_CURRENT_MATERIA", payload: currentMateriaPositions})
            setSelectedMateria(previousValue);

            const skillObj = (skillsJSON as SkillType[]).find(skill => skill.id === selectedMateria);
            if (skillObj) {
                setSkill(skillObj);
            }
        }

        return (
            <div key={i} onMouseEnter={() => handleMouseEnter(matchedMateria)} onClick={() => handleOnClick(i)} className={styles.materiaSlot} data-value={i}>
                <div className={styles.skill} data-color={matchedMateria?.color || null}>
                    {matchedMateria ? matchedMateria.name : currentMateriaPositions[arrIndex][i]}
                </div>
            </div>
        )
    };


    return (
        <div className="w-[550px]" {...props}>
            <p className="flex mt-1">
                <span className="mr-3">{textToSprite(type, false, "blue")}</span>
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
