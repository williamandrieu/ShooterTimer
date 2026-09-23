import type { ReactNode } from 'react';
import styles from '../styles/ui.module.css';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      {label}
      {children}
    </label>
  );
}
