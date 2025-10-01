import styles from "./ProgressBar.module.scss"

interface progressBarProps {
    accentColor?: string,
    percentage?: number,
    "data-limit"?: string,
}

const ProgressBar: React.FC<progressBarProps> = ({ accentColor = "#f5c4d0", percentage = 0, ...props }) => {
    return (
        <div className={styles.progressBar} {...props}>
            <div>
                <div style={{ width: percentage + "%", backgroundColor: accentColor }} data-limit={(props["data-limit"] === "true" && percentage === 100) ? "true" : null}></div>
            </div>
        </div>
    );
}

export default ProgressBar;