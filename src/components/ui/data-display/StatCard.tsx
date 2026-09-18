import React from 'react';

export interface StatCardTrend {
  value: string | number;
  isPositive?: boolean;
  label?: string;
}

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: StatCardTrend;
  subtext?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtext,
  subtitle,
  loading = false,
  className = '',
  style,
}) => {
  const displaySubtext = subtext || subtitle;
  return (
    <div
      className={`bg-bg-secondary rounded-lg shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] px-[1.35rem] py-5 flex flex-col justify-between gap-3 box-border font-base transition-[transform,box-shadow] duration-150 ease-in ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-text-primary leading-tight">{title}</span>
        {icon && (
          <div className="w-9 h-9 rounded-md bg-brand-lightest text-brand-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[0.35rem]">
        {loading ? (
          <div className="w-3/5 h-7 rounded-sm bg-[linear-gradient(90deg,rgba(45,35,30,0.06)_25%,rgba(45,35,30,0.12)_50%,rgba(45,35,30,0.06)_75%)] bg-[length:200%_100%] animate-shimmer" />
        ) : (
          <span className="text-[1.625rem] font-extrabold text-text-primary leading-[1.15] tracking-tight">{value}</span>
        )}

        <div className="flex items-center flex-wrap gap-[0.4rem] text-xs leading-tight min-h-[1.15rem]">
          {trend && (
            <span
              className={`inline-flex items-center gap-[2px] px-[6px] py-px rounded-sm font-bold text-[11px] ${
                trend.isPositive !== undefined
                  ? trend.isPositive
                    ? 'bg-success-bg text-success'
                    : 'bg-error-bg text-error'
                  : ''
              }`}
            >
              {trend.isPositive !== undefined && (
                <span>{trend.isPositive ? '↑' : '↓'}</span>
              )}
              {trend.value}
            </span>
          )}
          {trend?.label && <span className="text-text-secondary">{trend.label}</span>}
          {displaySubtext && <span className="text-text-primary">{displaySubtext}</span>}
        </div>
      </div>
    </div>
  );
};
