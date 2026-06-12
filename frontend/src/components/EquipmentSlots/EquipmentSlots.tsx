import styles from "./EquipmentSlots.module.scss";
import textToSprite from "../../util/textToSprite";
import { useContext } from "../../context/context";
import type { SkillType } from "../../context/types";

interface equipmentSlotsProps {
    type?: string,
    name?: string,
    multiSlots?: number,
    singleSlots?: number,
    materia?: SkillType[],
    focusedSlot?: number | null;
    activeSlot?: number | null;
    onSlotEnter?: (index: number) => void;
    onSlotClick?: (index: number) => void;
}

const EquipmentSlots: React.FC<equipmentSlotsProps> = ({ type = "Wpn.", name = "Buster Sword", multiSlots = 0, singleSlots = 0, materia = [], focusedSlot = null, activeSlot = null, onSlotEnter, onSlotClick, ...props }) => {
    const { currentMateria } = useContext();
    const arrIndex = (type === "Arm.") ? 1 : 0;
    let counter = 0;

    const MateriaSlot = (i: number) => {
        const matchedMateria = materia.find(item => item.id === currentMateria[arrIndex][i]);

        return (
            <div key={i} onMouseEnter={() => onSlotEnter?.(i)} onClick={() => onSlotClick?.(i)} className={styles.materiaSlot} data-value={i} data-focused={focusedSlot === i} data-active={activeSlot === i}>
                <div className={styles.skill} data-color={matchedMateria?.color || null}>
                    {matchedMateria ? matchedMateria.name : currentMateria[arrIndex][i]}
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
                        slots.push(MateriaSlot(counter++));
                        slots.push(MateriaSlot(counter++));
                    } else {
                        slots.push(MateriaSlot(counter++));
                    }

                    return <div key={index} className="flex relative">{slots}</div>
                })}
            </div>
        </div>
    );
};

export default EquipmentSlots;
