import { useContext } from "../../context/context";
import {
    resolvePortrait,
    PORTRAIT_SHEET,
    PORTRAIT_WIDTH,
    PORTRAIT_HEIGHT,
} from "../../data/portraits";

interface PortraitProps {
    /** The default portrait image (used when the name isn't an FF7 character) */
    src: string;
    width?: number;
    className?: string;
    /** Override the name used to resolve the portrait; defaults to the saved user name */
    name?: string;
    alt?: string;
}

// Renders the party member's portrait, swapping to an FF7 character's face from
// the shared spritesheet when the (case-insensitive) name matches one.
const Portrait: React.FC<PortraitProps> = ({ src, width = 145, className, name, alt = "Party Member Portrait" }) => {
    const { userName } = useContext();
    const sprite = resolvePortrait(name ?? userName);

    if (!sprite) {
        return <img src={src} alt={alt} width={width} className={`object-contain ${className ?? ""}`} />;
    }

    const scale = width / PORTRAIT_WIDTH;
    return (
        <div
            role="img"
            aria-label={alt}
            className={className}
            style={{
                width: `${width}px`,
                height: `${PORTRAIT_HEIGHT * scale}px`,
                backgroundImage: `url(${PORTRAIT_SHEET})`,
                // scale by the (constant) height so it's independent of the sheet's
                // total width — appending portraits like Cid doesn't affect the others
                backgroundSize: `auto ${PORTRAIT_HEIGHT * scale}px`,
                backgroundPosition: `-${sprite.x * scale}px 0`,
                backgroundRepeat: "no-repeat",
            }}
        />
    );
};

export default Portrait;
