import styles from "./ResourceCounter.module.scss";
import textToSprite from "../../util/textToSprite.tsx";

interface resourceCounterProps {
    label: string,
    currentValue?: number,
    maxValue?: number,
    accentColor?: string,
}

const ProgressBar: React.FC<resourceCounterProps> = ({ maxValue = 302, currentValue = 152, label = "hp", accentColor = "#4f8fd4", ...props }) => {
    return (
        <div className={`${styles.resourceCounter} flex`} {...props}>
            <span className="font-glyph mr-2" data-sprite={label}>{label}</span>
            <div className="flex flex-col">
                <div className="flex">
                    <span className="w-[92px] flex justify-end">{textToSprite(currentValue.toString(), true)}</span>
                    <span>{textToSprite("/", true)}</span>
                    <span className="w-[92px] flex justify-end">{textToSprite(maxValue.toString(), true)}</span>
                </div>
                <div className={styles.resourceBar}>
                    <div style={{ width: `${currentValue / maxValue * 100}%`, backgroundImage: `linear-gradient(90deg, ${accentColor}, #c6cded)` }}></div>
                </div>
            </div>
        </div>
    );
}

export default ProgressBar;