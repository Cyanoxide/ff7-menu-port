import React from 'react';
import type { ReactNode } from 'react';
import { useContext } from "../../context/context";

import styles from './contentBox.module.scss';

interface contentBoxProps {
    children?: ReactNode;
    className?: string,
    style?: object,
}

const ContentBox: React.FC<contentBoxProps> = ({ children, className, style, ...props }) => {
    const { windowColor } = useContext();
    return (
        <div className={`${styles.contentBox} ${className}`} style={style || {
            backgroundImage: `linear-gradient(135deg, rgb(${windowColor.topLeft[0]},${windowColor.topLeft[1]},${windowColor.topLeft[2]}) 0%, transparent 50%, rgb(${windowColor.bottomRight[0]}, ${windowColor.bottomRight[1]}, ${windowColor.bottomRight[2]}) 100%), linear-gradient(45deg, rgb(${windowColor.bottomLeft[0]},${windowColor.bottomLeft[1]},${windowColor.bottomLeft[2]}) 0%, rgb(${windowColor.topRight[0]},${windowColor.topRight[1]},${windowColor.topRight[2]}) 100%)`
        }} {...props}>
            {children}
        </div>
    );
};

export default ContentBox;