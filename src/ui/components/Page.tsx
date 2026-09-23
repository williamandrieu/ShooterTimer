import type { ReactNode } from 'react';
import styles from '../styles/ui.module.css';

export function Page({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className={styles.page}>
      {title ? <h1 className={styles.title}>{title}</h1> : null}
      {children}
    </div>
  );
}
