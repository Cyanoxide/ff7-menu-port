import { useContext } from "../../context/context";
import { type LookDirection } from "../../hooks/useLookDirection";
import LookingPortrait from "./LookingPortrait";
import {
    resolvePortrait,
    PORTRAIT_SHEET,
    PORTRAIT_WIDTH,
    PORTRAIT_HEIGHT,
} from "../../data/portraits";

interface PortraitProps {
    /** The default portrait image (used when the name isn't an FF7 character) */
    src: string;
    /**
     * Forces a look frame, overriding the pointer, for as long as it is set.
     * Ignored by the character portraits, which have only the one frame.
     */
    look?: LookDirection | null;
    /**
     * Shuts his eyes while true. Only has a frame for the centre pose, so a
     * blink is invisible while he is glancing anywhere else.
     */
    blink?: boolean;
    width?: number;
    className?: string;
    /** Override the name used to resolve the portrait; defaults to the saved user name */
    name?: string;
    alt?: string;
}

// Renders the party member's portrait, swapping to an FF7 character's face from
// the shared spritesheet when the (case-insensitive) name matches one.
const Portrait: React.FC<PortraitProps> = ({ src, width = 145, className, name, alt = "Party Member Portrait", look, blink }) => {
    const { userName } = useContext();
    const sprite = resolvePortrait(name ?? userName);

    if (!sprite) {
        return <LookingPortrait src={src} width={width} className={className} alt={alt} look={look} blink={blink} />;
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
