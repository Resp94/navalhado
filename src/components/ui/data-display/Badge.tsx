import React from 'react';

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeType = 'subtle' | 'solid' | 'outline';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  badgeType?: BadgeType;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  badgeType = 'subtle',
  size = 'sm',
  dot = false,
  icon,
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <span
        className={`ui-badge ui-badge--${variant} ui-badge--${badgeType} ui-badge--${size} ${className}`}
        style={style}
        {...props}
      >
        {dot && <span className="ui-badge__dot" aria-hidden="true" />}
        {icon && <span className="ui-badge__icon">{icon}</span>}
        <span className="ui-badge__text">{children}</span>
      </span>

      <style>{`
        .ui-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border-radius: var(--radius-full, 9999px);
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1;
          white-space: nowrap;
          box-sizing: border-box;
          user-select: none;
        }

        /* TAMANHOS */
        .ui-badge--xs {
          padding: 2px 6px;
          font-size: 10px;
        }

        .ui-badge--sm {
          padding: 3px 8px;
          font-size: 11px;
        }

        .ui-badge--md {
          padding: 4px 10px;
          font-size: 12px;
        }

        .ui-badge__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
          flex-shrink: 0;
        }

        .ui-badge__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        /* VARIANTES SUBTLE */
        .ui-badge--brand.ui-badge--subtle {
          background-color: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-deep, #6A2E00);
          border: 1px solid var(--color-brand-soft, #F2B277);
        }

        .ui-badge--success.ui-badge--subtle {
          background-color: var(--color-success-bg, #E6F4EA);
          color: var(--color-success, #0E9F6E);
          border: 1px solid rgba(14, 159, 110, 0.25);
        }

        .ui-badge--warning.ui-badge--subtle {
          background-color: var(--color-warning-bg, #FEF3C7);
          color: var(--color-warning, #D97706);
          border: 1px solid rgba(217, 119, 6, 0.25);
        }

        .ui-badge--error.ui-badge--subtle {
          background-color: var(--color-error-bg, #FDE8E8);
          color: var(--color-error, #F05252);
          border: 1px solid rgba(240, 82, 82, 0.25);
        }

        .ui-badge--info.ui-badge--subtle {
          background-color: var(--color-info-bg, #EBF5FF);
          color: var(--color-info, #3F83F8);
          border: 1px solid rgba(63, 131, 248, 0.25);
        }

        .ui-badge--neutral.ui-badge--subtle {
          background-color: var(--color-bg-primary, #FFF1E6);
          color: var(--color-text-secondary, #70625B);
          border: 1px solid var(--color-border, #EADED6);
        }

        .dark-theme .ui-badge--neutral.ui-badge--subtle {
          background-color: #1F1F23;
          color: #D4D4D8;
          border-color: #3F3F46;
        }

        /* VARIANTES SOLID */
        .ui-badge--brand.ui-badge--solid {
          background-color: var(--color-brand-primary, #D96C00);
          color: #FFFFFF;
        }

        .ui-badge--success.ui-badge--solid {
          background-color: var(--color-success, #0E9F6E);
          color: #FFFFFF;
        }

        .ui-badge--warning.ui-badge--solid {
          background-color: var(--color-warning, #D97706);
          color: #FFFFFF;
        }

        .ui-badge--error.ui-badge--solid {
          background-color: var(--color-error, #F05252);
          color: #FFFFFF;
        }

        .ui-badge--info.ui-badge--solid {
          background-color: var(--color-info, #3F83F8);
          color: #FFFFFF;
        }

        .ui-badge--neutral.ui-badge--solid {
          background-color: var(--color-text-primary, #2D231E);
          color: #FFFFFF;
        }

        .dark-theme .ui-badge--neutral.ui-badge--solid {
          background-color: #3F3F46;
          color: #FFFFFF;
        }

        /* VARIANTES OUTLINE */
        .ui-badge--outline {
          background-color: transparent;
        }

        .ui-badge--brand.ui-badge--outline {
          color: var(--color-brand-primary, #D96C00);
          border: 1px solid var(--color-brand-primary, #D96C00);
        }

        .ui-badge--success.ui-badge--outline {
          color: var(--color-success, #0E9F6E);
          border: 1px solid var(--color-success, #0E9F6E);
        }

        .ui-badge--error.ui-badge--outline {
          color: var(--color-error, #F05252);
          border: 1px solid var(--color-error, #F05252);
        }

        .ui-badge--neutral.ui-badge--outline {
          color: var(--color-text-secondary, #70625B);
          border: 1px solid var(--color-border, #EADED6);
        }
      `}</style>
    </>
  );
};
