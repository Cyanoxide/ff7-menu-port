import styles from "./MateriaSlotPreview.module.scss";

interface materiaSlotPreviewProps {
    multiSlots?: number,
    singleSlots?: number,
}

const MateriaSlotPreview: React.FC<materiaSlotPreviewProps> = ({ multiSlots = 0, singleSlots = 0 }) => {
    return (
        <div className={`${styles.equipmentContainer} flex`}>
            {Array.from({ length: multiSlots + singleSlots }).map((_, index) => (
                <div key={index} className="flex relative">
                    <div className={styles.materiaSlot}></div>
                    {index < multiSlots && <div className={styles.materiaSlot}></div>}
                </div>
            ))}
        </div>
    );
};

export default MateriaSlotPreview;
