import React from 'react';
import type { ReactNode } from 'react';
import styles from './contentBox.module.scss';

interface contentBoxProps {
    children?: ReactNode;
    className?: string,
}

const ContentBox: React.FC<contentBoxProps> = ({ children, className, ...props }) => {
    return (
        <div className={`${styles.contentBox} ${className}`} {...props}>
            {children}
        </div>
    );
};

export default ContentBox;