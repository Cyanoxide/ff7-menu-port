import React from 'react';
import type { ReactNode } from 'react';
import styles from './contentBox.module.scss';

interface contentBoxProps {
    children: ReactNode;
    top?: number | "auto",
    right?: number | "auto",
    bottom?: number | "auto",
    left?: number | "auto",
    zIndex?: number,
    className?: string,
}

const ContentBox: React.FC<contentBoxProps> = ({ children, top, right, bottom, left, zIndex, className, ...props }) => {
    return (
        <div className={`${styles.contentBox} ${className}`} style={{ top, right, bottom, left, zIndex }} {...props}>
            {children}
        </div>
    );
};

export default ContentBox;