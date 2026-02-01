import React from 'react';
import { Loader2 } from 'lucide-react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
  'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#14476B]/20 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
  const variants = {
    primary:
    'bg-[#14476B] hover:bg-[#1a5a8a] text-white shadow-md hover:shadow-lg border border-transparent bg-gradient-to-b from-[#14476B] to-[#103a58]',
    secondary:
    'bg-white text-[#0B0B0C] border border-slate-900/[0.08] hover:bg-slate-50 hover:border-slate-900/[0.15] shadow-sm',
    ghost: 'bg-transparent text-[#0B0B0C] hover:bg-slate-100',
    outline:
    'bg-transparent border border-[#14476B] text-[#14476B] hover:bg-[#14476B]/5'
  };
  const sizes = {
    sm: 'h-8 px-4 text-xs rounded-full',
    md: 'h-10 px-6 text-sm rounded-full',
    lg: 'h-12 px-8 text-base rounded-full',
    icon: 'h-10 w-10 p-0 rounded-full'
  };
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}>

      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>);

}