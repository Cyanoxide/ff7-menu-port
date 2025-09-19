import React from 'react';
import type { ReactNode } from 'react';
import styles from './contentBox.module.scss';

interface contentBoxProps {
    children: ReactNode;
}

const ContentBox: React.FC<contentBoxProps> = ({ children, ...props }) => {
    return (
        <div className={styles.simpleDialog} {...props}>
            {children}
        </div>
    );
};

export default ContentBox;