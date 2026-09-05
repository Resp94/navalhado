import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
  style,
}) => {
  return (
    <>
      <div className={`ui-empty-state ${compact ? 'ui-empty-state--compact' : ''} ${className}`} style={style}>
        {icon && <div className="ui-empty-state__icon">{icon}</div>}
        <h3 className="ui-empty-state__title">{title}</h3>
        {description && <p className="ui-empty-state__desc">{description}</p>}
        {action && <div className="ui-empty-state__action">{action}</div>}
      </div>

      <style>{`
        .ui-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 3.5rem 1.5rem;
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          width: 100%;
        }

        .ui-empty-state--compact {
          padding: 2rem 1rem;
        }

        .ui-empty-state__icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-primary, #D96C00);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
          flex-shrink: 0;
        }

        .dark-theme .ui-empty-state__icon {
          background-color: rgba(217, 108, 0, 0.15);
        }

        .ui-empty-state--compact .ui-empty-state__icon {
          width: 44px;
          height: 44px;
          margin-bottom: 0.75rem;
        }

        .ui-empty-state__title {
          font-size: var(--font-size-base, 1rem);
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0 0 0.35rem 0;
          letter-spacing: -0.01em;
        }

        .dark-theme .ui-empty-state__title {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-empty-state__desc {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
          max-width: 380px;
          margin: 0;
          line-height: 1.45;
        }

        .ui-empty-state__action {
          margin-top: 1.25rem;
        }
      `}</style>
    </>
  );
};
