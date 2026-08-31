import React from 'react';
import type { ReactNode } from 'react';
import { useContext } from "../../context/context";
import type { WindowColor, PartialWindowColor } from "../../context/types";

import styles from './contentBox.module.scss';

interface contentBoxProps {
    children?: ReactNode;
    className?: string,
    style?: object,
    /**
     * Paint this box in its own colours rather than the ones the config screen
     * set. The history saves use it so each employer's save carries its own
     * background, the way each FF7 save file does.
     *
     * Per corner: one left out or set to null keeps the player's colour for
     * that corner, so a box can tint one edge without restating the other
     * three, and stays in step with the config screen where it has no opinion.
     */
    windowColor?: PartialWindowColor,
}

/**
 * The FF7 window: two crossed gradients, one corner colour at each end.
 *
 * Built here rather than in a stylesheet because all four corners are user
 * data. `style` still wins outright, so a caller that wants no gradient at all
 * can still say so.
 */
const windowGradient = (color: WindowColor) => {
    const rgb = (channel: [number, number, number]) => `rgb(${channel[0]},${channel[1]},${channel[2]})`;
    return `linear-gradient(135deg, ${rgb(color.topLeft)} 0%, transparent 50%, ${rgb(color.bottomRight)} 100%), `
        + `linear-gradient(45deg, ${rgb(color.bottomLeft)} 0%, ${rgb(color.topRight)} 100%)`;
};

const ContentBox: React.FC<contentBoxProps> = ({ children, className, style, windowColor, ...props }) => {
    const { windowColor: configuredColor } = useContext();

    // Corner by corner rather than box by box, so a partly-specified colour
    // fills its gaps from the config screen instead of falling back wholesale.
    const color: WindowColor = {
        topLeft: windowColor?.topLeft ?? configuredColor.topLeft,
        topRight: windowColor?.topRight ?? configuredColor.topRight,
        bottomLeft: windowColor?.bottomLeft ?? configuredColor.bottomLeft,
        bottomRight: windowColor?.bottomRight ?? configuredColor.bottomRight,
    };

    return (
        <div className={`${styles.contentBox} ${className}`} style={style || {
            backgroundImage: windowGradient(color)
        }} {...props}>
            {children}
        </div>
    );
};

export default ContentBox;
