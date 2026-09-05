import React, { forwardRef, useId } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  selectSize?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      selectSize = 'md',
      id,
      disabled,
      children,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <>
        <div className={`ui-select-group ${disabled ? 'ui-select-group--disabled' : ''} ${className}`} style={style}>
          {label && (
            <label htmlFor={selectId} className="ui-select-label">
              {label}
            </label>
          )}

          <div
            className={`ui-select-wrapper ui-select-wrapper--${selectSize} ${error ? 'ui-select-wrapper--error' : ''}`}
          >
            <select
              ref={ref}
              id={selectId}
              disabled={disabled}
              className="ui-select-field"
              aria-invalid={!!error}
              aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
              {...props}
            >
              {placeholder && (
                <option value="" disabled hidden>
                  {placeholder}
                </option>
              )}
              {options
                ? options.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))
                : children}
            </select>

            <span className="ui-select-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>

          {error ? (
            <p id={`${selectId}-error`} className="ui-select-feedback ui-select-feedback--error" role="alert">
              {error}
            </p>
          ) : helperText ? (
            <p id={`${selectId}-helper`} className="ui-select-feedback ui-select-feedback--helper">
              {helperText}
            </p>
          ) : null}
        </div>

        <style>{`
          .ui-select-group {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            width: 100%;
            text-align: left;
            box-sizing: border-box;
          }

          .ui-select-group--disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ui-select-label {
            font-size: var(--font-size-xs, 0.75rem);
            font-weight: 700;
            color: var(--color-text-primary, #2D231E);
            letter-spacing: 0.02em;
            line-height: 1.2;
            user-select: none;
          }

          .dark-theme .ui-select-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-select-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
            border-radius: var(--radius-md, 8px);
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            transition: box-shadow 0.15s ease, background-color 0.15s ease;
            box-sizing: border-box;
          }

          .dark-theme .ui-select-wrapper {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-select-wrapper:focus-within {
            box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00);
          }

          .ui-select-wrapper--error {
            box-shadow: 0 0 0 1.5px var(--color-error, #F05252) !important;
          }

          /* ALTURAS */
          .ui-select-wrapper--sm {
            min-height: 36px;
          }

          .ui-select-wrapper--md {
            min-height: 42px;
          }

          .ui-select-wrapper--lg {
            min-height: 48px;
          }

          .ui-select-field {
            width: 100%;
            height: 100%;
            padding: 0.55rem 2.2rem 0.55rem 0.85rem;
            border: none;
            outline: none;
            background: transparent;
            color: var(--color-text-primary, #2D231E);
            font-family: var(--font-family-base, 'Outfit', sans-serif);
            font-size: var(--font-size-sm, 0.875rem);
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            box-sizing: border-box;
          }

          .dark-theme .ui-select-field {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-select-field:disabled {
            cursor: not-allowed;
          }

          .ui-select-chevron {
            position: absolute;
            right: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            color: var(--color-text-secondary, #70625B);
            transition: color 0.15s ease;
          }

          .ui-select-wrapper:focus-within .ui-select-chevron {
            color: var(--color-brand-primary, #D96C00);
          }

          .ui-select-feedback {
            margin: 0;
            font-size: 0.75rem;
            line-height: 1.35;
          }

          .ui-select-feedback--error {
            color: var(--color-error, #F05252);
            font-weight: 600;
          }

          .ui-select-feedback--helper {
            color: var(--color-text-secondary, #70625B);
          }
        `}</style>
      </>
    );
  }
);

Select.displayName = 'Select';
