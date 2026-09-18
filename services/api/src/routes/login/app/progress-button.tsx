// @jsxImportSource react
import type { ReactNode } from 'react';

import styles from './progress-button.module.css';

type AnimatedProgressButtonProps = {
  children: ReactNode;
  complete: boolean;
  message: string;
  progress: number;
};

export function AnimatedProgressButton({
  children,
  complete,
  message,
  progress,
}: AnimatedProgressButtonProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={styles['progress-button']}
      data-complete={String(complete)}
      data-progress-zero={clamped <= 0 ? true : undefined}
      style={{ ['--progress' as string]: `${clamped * 100}` }}
    >
      <svg aria-hidden="true" className={styles['progress-button__border']}>
        <defs>
          <linearGradient id="progress-button-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop className={styles['progress-button__gradient-start']} offset="0%" />
            <stop className={styles['progress-button__gradient-end']} offset="100%" />
          </linearGradient>
        </defs>
        <rect className={styles['progress-button__track']} />
        <rect className={styles['progress-button__progress']} pathLength="100" />
      </svg>
      <span className={styles['progress-button__helper']}>
        <span
          aria-hidden="true"
          className={styles['progress-button__arrow']}
          hidden={clamped === 0}
        >
          ↑
        </span>
        <span>{message}</span>
      </span>
      <div className={styles['progress-button__action']}>{children}</div>
    </div>
  );
}
