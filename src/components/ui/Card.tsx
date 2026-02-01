import React from 'react';
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, hoverable = false, noPadding = false, ...props }, ref) => (
    <div
      ref={ref}
      className={`
        bg-white rounded-xl border border-slate-900/[0.06] shadow-sm
        ${hoverable ? 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-900/[0.1]' : ''}
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';
