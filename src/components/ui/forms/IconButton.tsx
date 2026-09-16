import React, { forwardRef } from 'react';

export type IconButtonVariant = 'ghost' | 'outline' | 'secondary' | 'danger-ghost' | 'brand';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconButtonShape = 'rounded' | 'circle';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  icon?: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      icon,
      variant = 'ghost',
      size = 'md',
      shape = 'rounded',
      loading = false,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <>
        <button
          ref={ref}
          type="button"
          disabled={isDisabled}
          className={`ui-icon-btn ui-icon-btn--${variant} ui-icon-btn--${size} ui-icon-btn--${shape} ${className}`}
          style={style}
          {...props}
        >
          {loading ? (
            <span className="ui-icon-btn__spinner" aria-hidden="true" />
          ) : (
            icon || children
          )}
        </button>

        <style>{`
          .ui-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: none;
            outline: none;
            padding: 0;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
          }

          .ui-icon-btn:active:not(:disabled) {
            transform: scale(0.94);
          }

          .ui-icon-btn:focus-visible {
            outline: 2px solid var(--color-brand-primary, #D96C00);
            outline-offset: 2px;
          }

          /* FORMAS */
          .ui-icon-btn--rounded {
            border-radius: var(--radius-md, 8px);
          }

          .ui-icon-btn--circle {
            border-radius: var(--radius-full, 9999px);
          }

          /* TAMANHOS */
          .ui-icon-btn--xs {
            width: 28px;
            height: 28px;
            font-size: 14px;
          }

          .ui-icon-btn--sm {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }

          .ui-icon-btn--md {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }

          .ui-icon-btn--lg {
            width: 42px;
            height: 42px;
            font-size: 20px;
          }

          /* VARIANTES */
          .ui-icon-btn--ghost {
            background-color: transparent;
            color: var(--color-text-secondary, #70625B);
          }

          .ui-icon-btn--ghost:hover:not(:disabled) {
            background-color: rgba(45, 35, 30, 0.06);
            color: var(--color-text-primary, #2D231E);
          }

          .dark-theme .ui-icon-btn--ghost:hover:not(:disabled) {
            background-color: rgba(255, 255, 255, 0.08);
            color: #FFFFFF;
          }

          .ui-icon-btn--outline {
            background-color: var(--color-bg-secondary, #FFFFFF);
            color: var(--color-text-secondary, #70625B);
            border: 1px solid var(--color-border, #EADED6);
          }

          .ui-icon-btn--outline:hover:not(:disabled) {
            border-color: var(--color-brand-primary, #D96C00);
            color: var(--color-brand-primary, #D96C00);
          }

          .dark-theme .ui-icon-btn--outline {
            background-color: var(--color-bg-secondary, #1E1B18);
            border-color: var(--color-border, #332D29);
            color: var(--color-text-secondary, #9C958F);
          }

          .ui-icon-btn--secondary {
            background-color: var(--color-bg-secondary, #FFFFFF);
            color: var(--color-text-primary, #2D231E);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
          }

          .ui-icon-btn--secondary:hover:not(:disabled) {
            background-color: rgba(0, 0, 0, 0.04);
          }

          .ui-icon-btn--danger-ghost {
            background-color: transparent;
            color: var(--color-error, #F05252);
          }

          .ui-icon-btn--danger-ghost:hover:not(:disabled) {
            background-color: var(--color-error-bg, #FDE8E8);
          }

          .ui-icon-btn--brand {
            background-color: rgba(217, 108, 0, 0.1);
            color: var(--color-brand-primary, #D96C00);
          }

          .ui-icon-btn--brand:hover:not(:disabled) {
            background-color: var(--color-brand-primary, #D96C00);
            color: #FFFFFF;
          }

          .ui-icon-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            transform: none !important;
          }

          .ui-icon-btn__spinner {
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: uiIconBtnSpin 0.75s linear infinite;
          }

          @keyframes uiIconBtnSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }
);

IconButton.displayName = 'IconButton';
