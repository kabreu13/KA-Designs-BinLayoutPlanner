import React from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
  error?: string;
}
export function Input({
  className,
  icon,
  label,
  error,
  ...props
}: InputProps) {
  return (
    <div className={styles.root}>
      {label && (
        <label className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.wrap}>
        {icon && (
          <div className={styles.icon}>
            {icon}
          </div>
        )}
        <input
          className={clsx(
            styles.input,
            icon && styles.withIcon,
            error && styles.error,
            className
          )}
          {...props}
        />
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
