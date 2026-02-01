import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
  error?: string;
}
export function Input({
  className = '',
  icon,
  label,
  error,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label &&
      <label className="block text-xs font-semibold text-[#0B0B0C] mb-1.5 uppercase tracking-wide">
          {label}
        </label>
      }
      <div className="relative">
        {icon &&
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        }
        <input
          className={`
            w-full bg-white border border-slate-900/[0.08] rounded-xl
            px-4 py-2.5 text-sm text-[#0B0B0C] placeholder:text-slate-400
            transition-all duration-200
            focus:outline-none focus:border-[#14476B] focus:ring-4 focus:ring-[#14476B]/10
            disabled:opacity-50 disabled:bg-slate-50
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}
            ${className}
          `}
          {...props} />

      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>);

}
