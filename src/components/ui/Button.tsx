import React from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const buttonClassName = cva(styles.button, {
  variants: {
    variant: {
      primary: styles.variantPrimary,
      secondary: styles.variantSecondary,
      ghost: styles.variantGhost,
      outline: styles.variantOutline
    },
    size: {
      sm: styles.sizeSm,
      md: styles.sizeMd,
      lg: styles.sizeLg,
      icon: styles.sizeIcon
    }
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md'
  }
});

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(buttonClassName({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className={styles.iconLoader} />}
      {!isLoading && leftIcon && <span className={styles.iconLeft}>{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className={styles.iconRight}>{rightIcon}</span>}
    </button>
  );
}
