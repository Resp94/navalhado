import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'ghost' | 'warning' | 'soft';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      icon,
      rightIcon,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const actualLeftIcon = leftIcon || icon;

    return (
      <>
        <button
          ref={ref}
          type="button"
          disabled={isDisabled}
          className={`ui-btn ui-btn--${variant} ui-btn--${size} ${fullWidth ? 'ui-btn--full' : ''} ${className}`}
          style={style}
          {...props}
        >
          {loading ? (
            <span className="ui-btn__spinner" aria-hidden="true" />
          ) : (
            actualLeftIcon && <span className="ui-btn__icon ui-btn__icon--left">{actualLeftIcon}</span>
          )}
          <span className="ui-btn__text">{children}</span>
          {!loading && rightIcon && (
            <span className="ui-btn__icon ui-btn__icon--right">{rightIcon}</span>
          )}
        </button>

        <style>{`
          .ui-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-family-base, 'Outfit', sans-serif);
            font-weight: 700;
            cursor: pointer;
            border-radius: var(--radius-md, 8px);
            border: none;
            outline: none;
            transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease, color 0.15s ease;
            box-sizing: border-box;
            white-space: nowrap;
            user-select: none;
            text-decoration: none;
            position: relative;
          }

          .ui-btn:active:not(:disabled) {
            transform: scale(0.98);
          }

          .ui-btn:focus-visible {
            outline: 2px solid var(--color-brand-primary, #D96C00);
            outline-offset: 2px;
          }

          .ui-btn--full {
            width: 100%;
          }

          /* TAMANHOS */
          .ui-btn--xs {
            height: 32px;
            padding: 0 0.65rem;
            font-size: var(--font-size-xs, 0.75rem);
            gap: 0.35rem;
          }

          .ui-btn--sm {
            height: 36px;
            padding: 0 0.85rem;
            font-size: var(--font-size-xs, 0.75rem);
            gap: 0.4rem;
          }

          .ui-btn--md {
            height: 42px;
            padding: 0 1.25rem;
            font-size: var(--font-size-sm, 0.875rem);
            gap: 0.5rem;
          }

          .ui-btn--lg {
            height: 48px;
            padding: 0 1.5rem;
            font-size: var(--font-size-base, 1rem);
            gap: 0.6rem;
          }

          /* VARIANTES */
          .ui-btn--primary {
            background-color: var(--color-brand-primary, #D96C00);
            color: #FFFFFF;
            box-shadow: 0 1px 3px rgba(217, 108, 0, 0.25);
          }

          .ui-btn--primary:hover:not(:disabled) {
            background-color: var(--color-brand-hover, #9C3F00);
            box-shadow: 0 4px 12px rgba(217, 108, 0, 0.3);
          }

          .ui-btn--secondary {
            background-color: var(--color-bg-secondary, #FFFFFF);
            color: var(--color-text-primary, #2D231E);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
          }

          .ui-btn--secondary:hover:not(:disabled) {
            background-color: rgba(0, 0, 0, 0.03);
          }

          .dark-theme .ui-btn--secondary {
            background-color: var(--color-bg-secondary, #1E1B18);
            color: var(--color-text-primary, #FFF1E6);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .dark-theme .ui-btn--secondary:hover:not(:disabled) {
            background-color: rgba(255, 255, 255, 0.05);
          }

          .ui-btn--outline {
            background-color: transparent;
            color: var(--color-text-primary, #2D231E);
            border: 1px solid var(--color-border, #EADED6);
          }

          .ui-btn--outline:hover:not(:disabled) {
            border-color: var(--color-brand-primary, #D96C00);
            color: var(--color-brand-primary, #D96C00);
            background-color: rgba(217, 108, 0, 0.04);
          }

          .dark-theme .ui-btn--outline {
            color: var(--color-text-primary, #FFF1E6);
            border-color: var(--color-border, #332D29);
          }

          .ui-btn--danger {
            background-color: var(--color-error, #F05252);
            color: #FFFFFF;
          }

          .ui-btn--danger:hover:not(:disabled) {
            background-color: #dc2626;
          }

          .ui-btn--danger-outline {
            background-color: transparent;
            color: var(--color-error, #F05252);
            border: 1px solid var(--color-error, #F05252);
          }

          .ui-btn--danger-outline:hover:not(:disabled) {
            background-color: var(--color-error-bg, #FDE8E8);
          }

          .ui-btn--ghost {
            background-color: transparent;
            color: var(--color-text-secondary, #70625B);
          }

          .ui-btn--ghost:hover:not(:disabled) {
            background-color: rgba(45, 35, 30, 0.05);
            color: var(--color-text-primary, #2D231E);
          }

          .dark-theme .ui-btn--ghost:hover:not(:disabled) {
            background-color: rgba(255, 255, 255, 0.06);
            color: #FFFFFF;
          }

          .ui-btn--warning {
            background-color: var(--color-warning, #D97706);
            color: var(--color-text-primary, #2D231E);
            box-shadow: 0 0 0 1px var(--color-text-primary, #2D231E);
          }

          .ui-btn--warning:hover:not(:disabled) {
            background-color: #B45309;
            box-shadow: 0 0 0 1px var(--color-text-primary, #2D231E);
            transform: translateY(-1px);
          }

          .ui-btn--soft {
            background-color: var(--color-brand-lightest, #FFF1E6);
            color: var(--color-text-primary, #2D231E);
            box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
            border: none;
          }

          .ui-btn--soft:hover:not(:disabled) {
            background-color: #f2b277;
            box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
            transform: translateY(-1px);
          }

          .dark-theme .ui-btn--soft {
            background-color: rgba(217, 108, 0, 0.15);
            color: var(--color-text-primary, #FFF1E6);
            box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
          }

          .dark-theme .ui-btn--soft:hover:not(:disabled) {
            background-color: rgba(217, 108, 0, 0.25);
            box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
          }

          /* ESTADO DESABILITADO */
          .ui-btn:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            transform: none !important;
            box-shadow: none !important;
          }

          /* SPINNER DE CARREGAMENTO */
          .ui-btn__spinner {
            width: 16px;
            height: 16px;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: uiBtnSpin 0.75s linear infinite;
            flex-shrink: 0;
          }

          @keyframes uiBtnSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .ui-btn__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            line-height: 1;
          }

          .ui-btn__text {
            line-height: 1;
          }
        `}</style>
      </>
    );
  }
);

Button.displayName = 'Button';
