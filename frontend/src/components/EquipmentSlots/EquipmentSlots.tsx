import styles from "./EquipmentSlots.module.scss";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";

type Materia = {
    id: number;
    name: string;
    color: string;
    description: string;
    additionalInfo: string;
    score: number;
};

interface equipmentSlotsProps {
    type?: string,
    name?: string,
    multiSlots?: number,
    singleSlots?: number,
    materia?: Materia[],
    materiaPositions?: (number | null)[]
    setSkill?: (skill: Materia) => void;
}


const EquipmentSlots: React.FC<equipmentSlotsProps> = ({ type = "Wpn.", name = "Buster Sword", multiSlots = 0, singleSlots = 0, materia = [], materiaPositions = [], setSkill, ...props }) => {
    const {isSoundEnabled} = useContext();
    let counter = 0;

    const MateriaSlot = (i: number, materia: Materia[]) => {
        const matchedMateria = materia.find(item => item.id === materiaPositions[i]);

        const handleMouseEnter = (materia?: Materia) => {
            playSound("select", isSoundEnabled);

            if (matchedMateria && materia && setSkill) {
                setSkill(materia);
            }
        }

        return (
            <div key={i} onMouseEnter={() => handleMouseEnter(matchedMateria)} onClick={() => playSound("error", isSoundEnabled)} className={styles.materiaSlot} data-value={i}>
                <div className={styles.skill} data-color={matchedMateria?.color || null}>
                    {matchedMateria ? matchedMateria.name : materiaPositions[i]}
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
