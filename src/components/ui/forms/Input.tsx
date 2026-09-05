import React, { forwardRef, useId, useState } from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefixText?: string;
  suffixText?: string;
  inputSize?: InputSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      prefixText,
      suffixText,
      inputSize = 'md',
      type = 'text',
      id,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);

    const activeType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <>
        <div className={`ui-input-group ${disabled ? 'ui-input-group--disabled' : ''} ${className}`} style={style}>
          {label && (
            <label htmlFor={inputId} className="ui-input-label">
              {label}
            </label>
          )}

          <div
            className={`ui-input-wrapper ui-input-wrapper--${inputSize} ${error ? 'ui-input-wrapper--error' : ''}`}
          >
            {leftIcon && <span className="ui-input-affix ui-input-affix--icon-left">{leftIcon}</span>}
            {prefixText && <span className="ui-input-affix ui-input-affix--prefix">{prefixText}</span>}

            <input
              ref={ref}
              id={inputId}
              type={activeType}
              disabled={disabled}
              className="ui-input-field"
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
              {...props}
            />

            {suffixText && <span className="ui-input-affix ui-input-affix--suffix">{suffixText}</span>}

            {isPassword ? (
              <button
                type="button"
                className="ui-input-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            ) : (
              rightIcon && <span className="ui-input-affix ui-input-affix--icon-right">{rightIcon}</span>
            )}
          </div>

          {error ? (
            <p id={`${inputId}-error`} className="ui-input-feedback ui-input-feedback--error" role="alert">
              {error}
            </p>
          ) : helperText ? (
            <p id={`${inputId}-helper`} className="ui-input-feedback ui-input-feedback--helper">
              {helperText}
            </p>
          ) : null}
        </div>

        <style>{`
          .ui-input-group {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            width: 100%;
            text-align: left;
            box-sizing: border-box;
          }

          .ui-input-group--disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ui-input-label {
            font-size: var(--font-size-xs, 0.75rem);
            font-weight: 700;
            color: var(--color-text-primary, #2D231E);
            letter-spacing: 0.02em;
            line-height: 1.2;
            user-select: none;
          }

          .dark-theme .ui-input-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-input-wrapper {
            display: flex;
            align-items: center;
            width: 100%;
            border-radius: var(--radius-md, 8px);
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            transition: box-shadow 0.15s ease, background-color 0.15s ease;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
          }

          .dark-theme .ui-input-wrapper {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-input-wrapper:focus-within {
            box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00);
          }

          .ui-input-wrapper--error {
            box-shadow: 0 0 0 1.5px var(--color-error, #F05252) !important;
          }

          /* ALTURAS E PADDINGS */
          .ui-input-wrapper--sm {
            min-height: 36px;
            padding: 0 0.65rem;
          }

          .ui-input-wrapper--md {
            min-height: 42px;
            padding: 0 0.85rem;
          }

          .ui-input-wrapper--lg {
            min-height: 48px;
            padding: 0 1rem;
          }

          .ui-input-field {
            flex: 1;
            width: 100%;
            min-width: 0;
            border: none;
            outline: none;
            background: transparent;
            color: var(--color-text-primary, #2D231E);
            font-family: var(--font-family-base, 'Outfit', sans-serif);
            font-size: var(--font-size-sm, 0.875rem);
            padding: 0.5rem 0;
            box-sizing: border-box;
          }

          .dark-theme .ui-input-field {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-input-field::placeholder {
            color: var(--color-text-secondary, #70625B);
            opacity: 0.65;
          }

          .ui-input-field:disabled {
            cursor: not-allowed;
          }

          .ui-input-affix {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--color-text-secondary, #70625B);
            font-size: var(--font-size-sm, 0.875rem);
            user-select: none;
            flex-shrink: 0;
          }

          .ui-input-affix--prefix {
            margin-right: 0.45rem;
            font-weight: 700;
          }

          .ui-input-affix--suffix {
            margin-left: 0.45rem;
            font-weight: 600;
          }

          .ui-input-affix--icon-left {
            margin-right: 0.5rem;
          }

          .ui-input-affix--icon-right {
            margin-left: 0.5rem;
          }

          .ui-input-password-toggle {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            margin-left: 0.4rem;
            color: var(--color-text-secondary, #70625B);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.15s ease;
            outline: none;
            border-radius: var(--radius-sm, 4px);
          }

          .ui-input-password-toggle:hover {
            color: var(--color-text-primary, #2D231E);
          }

          .dark-theme .ui-input-password-toggle:hover {
            color: #FFFFFF;
          }

          .ui-input-feedback {
            margin: 0;
            font-size: 0.75rem;
            line-height: 1.35;
          }

          .ui-input-feedback--error {
            color: var(--color-error, #F05252);
            font-weight: 600;
          }

          .ui-input-feedback--helper {
            color: var(--color-text-secondary, #70625B);
          }
        `}</style>
      </>
    );
  }
);

Input.displayName = 'Input';
