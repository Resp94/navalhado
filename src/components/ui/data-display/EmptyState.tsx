import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  illustration,
  children,
  compact = false,
  className = '',
  style,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center box-border font-base w-full ${compact ? 'py-8 px-4' : 'py-14 px-6'} ${className}`}
      style={style}
    >
      {icon && (
        <div
          className={`rounded-full bg-brand-lightest text-brand-primary flex items-center justify-center shrink-0 ${compact ? 'w-11 h-11 mb-3' : 'w-14 h-14 mb-4'}`}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-extrabold text-text-primary m-0 mb-[0.35rem] tracking-tight">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-[380px] m-0 leading-relaxed">{description}</p>}
      {illustration && <div className="mt-6 flex items-center justify-center">{illustration}</div>}
      {children}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
