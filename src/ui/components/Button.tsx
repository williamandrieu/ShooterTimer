import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  variant?: ButtonVariant;
  children: ReactNode;
  to?: string;
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  onPointerDown?: ButtonHTMLAttributes<HTMLButtonElement>['onPointerDown'];
  disabled?: boolean;
  'data-testid'?: string;
};

export function Button({
  variant = 'primary',
  children,
  to,
  className,
  type = 'button',
  onClick,
  onPointerDown,
  disabled = false,
  'data-testid': testId,
}: ButtonProps) {
  const classNames = [styles.btn, variant !== 'primary' ? styles[variant] : undefined, className]
    .filter(Boolean)
    .join(' ');
  if (to) {
    return (
      <Link className={classNames} to={to} data-testid={testId}>
        {children}
      </Link>
    );
  }
  return (
    <button
      className={classNames}
      type={type}
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
