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
    <>
      <div className={`ui-stat-card ${className}`} style={style}>
        <div className="ui-stat-card__header">
          <span className="ui-stat-card__title">{title}</span>
          {icon && <div className="ui-stat-card__icon-badge">{icon}</div>}
        </div>

        <div className="ui-stat-card__body">
          {loading ? (
            <div className="ui-stat-card__skeleton" />
          ) : (
            <span className="ui-stat-card__value">{value}</span>
          )}

          {(trend || displaySubtext) && (
            <div className="ui-stat-card__footer">
              {trend && (
                <span
                  className={`ui-stat-card__trend ${
                    trend.isPositive !== undefined
                      ? trend.isPositive
                        ? 'ui-stat-card__trend--pos'
                        : 'ui-stat-card__trend--neg'
                      : ''
                  }`}
                >
                  {trend.isPositive !== undefined && (
                    <span className="ui-stat-card__trend-arrow">
                      {trend.isPositive ? '↑' : '↓'}
                    </span>
                  )}
                  {trend.value}
                </span>
              )}
              {trend?.label && <span className="ui-stat-card__trend-label">{trend.label}</span>}
              {displaySubtext && <span className="ui-stat-card__subtext">{displaySubtext}</span>}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ui-stat-card {
          background-color: var(--color-bg-secondary, #FFFFFF);
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E), var(--shadow-sm);
          padding: 1.25rem 1.35rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 0.75rem;
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .dark-theme .ui-stat-card {
          background-color: var(--color-bg-secondary, #1E1B18);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
        }

        .ui-stat-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .ui-stat-card__title {
          font-size: var(--font-size-xs, 0.75rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary, #70625B);
          line-height: 1.2;
        }

        .ui-stat-card__icon-badge {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md, 8px);
          background-color: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-primary, #D96C00);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dark-theme .ui-stat-card__icon-badge {
          background-color: rgba(217, 108, 0, 0.15);
        }

        .ui-stat-card__body {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .ui-stat-card__value {
          font-size: 1.625rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .dark-theme .ui-stat-card__value {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-stat-card__skeleton {
          width: 60%;
          height: 28px;
          border-radius: var(--radius-sm, 4px);
          background: linear-gradient(90deg, rgba(45,35,30,0.06) 25%, rgba(45,35,30,0.12) 50%, rgba(45,35,30,0.06) 75%);
          background-size: 200% 100%;
          animation: uiStatCardShimmer 1.5s infinite;
        }

        @keyframes uiStatCardShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .ui-stat-card__footer {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.4rem;
          font-size: var(--font-size-xs, 0.75rem);
          line-height: 1.2;
        }

        .ui-stat-card__trend {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 1px 6px;
          border-radius: var(--radius-sm, 4px);
          font-weight: 700;
          font-size: 11px;
        }

        .ui-stat-card__trend--pos {
          background-color: var(--color-success-bg, #E6F4EA);
          color: var(--color-success, #0E9F6E);
        }

        .ui-stat-card__trend--neg {
          background-color: var(--color-error-bg, #FDE8E8);
          color: var(--color-error, #F05252);
        }

        .ui-stat-card__trend-label,
        .ui-stat-card__subtext {
          color: var(--color-text-secondary, #70625B);
        }
      `}</style>
    </>
  );
};
