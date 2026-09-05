import React, { forwardRef, useId, useEffect, useRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      indeterminate = false,
      checked,
      disabled = false,
      id,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const internalRef = useRef<HTMLInputElement>(null);

    // Conectar ref externa e interna
    useEffect(() => {
      const target = (ref as React.MutableRefObject<HTMLInputElement>)?.current || internalRef.current;
      if (target) {
        target.indeterminate = indeterminate;
      }
    }, [indeterminate, ref]);

    return (
      <>
        <label
          htmlFor={checkboxId}
          className={`ui-checkbox-container ${disabled ? 'ui-checkbox-container--disabled' : ''} ${className}`}
          style={style}
        >
          <div className="ui-checkbox-control-wrapper">
            <input
              ref={ref || internalRef}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              className="ui-checkbox-input"
              {...props}
            />
            <span className={`ui-checkbox-custom ${checked || indeterminate ? 'ui-checkbox-custom--checked' : ''}`}>
              {indeterminate ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : checked ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </span>
          </div>

          {(label || description) && (
            <div className="ui-checkbox-text-group">
              {label && <span className="ui-checkbox-label">{label}</span>}
              {description && <span className="ui-checkbox-desc">{description}</span>}
            </div>
          )}
        </label>

        <style>{`
          .ui-checkbox-container {
            display: inline-flex;
            align-items: flex-start;
            gap: 0.65rem;
            cursor: pointer;
            user-select: none;
            box-sizing: border-box;
          }

          .ui-checkbox-container--disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .ui-checkbox-control-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
          }

          .ui-checkbox-input {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            margin: 0;
            padding: 0;
          }

          .ui-checkbox-custom {
            width: 18px;
            height: 18px;
            border-radius: var(--radius-sm, 4px);
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            transition: background-color 0.15s ease, box-shadow 0.15s ease;
            box-sizing: border-box;
          }

          .dark-theme .ui-checkbox-custom {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-checkbox-input:focus-visible + .ui-checkbox-custom {
            outline: 2px solid var(--color-brand-primary, #D96C00);
            outline-offset: 2px;
          }

          .ui-checkbox-custom--checked {
            background-color: var(--color-brand-primary, #D96C00) !important;
            box-shadow: 0 0 0 0.8px var(--color-brand-primary, #D96C00) !important;
          }

          .ui-checkbox-text-group {
            display: flex;
            flex-direction: column;
            gap: 0.1rem;
          }

          .ui-checkbox-label {
            font-size: var(--font-size-sm, 0.875rem);
            font-weight: 600;
            color: var(--color-text-primary, #2D231E);
            line-height: 1.3;
          }

          .dark-theme .ui-checkbox-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-checkbox-desc {
            font-size: var(--font-size-xs, 0.75rem);
            color: var(--color-text-secondary, #70625B);
            line-height: 1.35;
          }
        `}</style>
      </>
    );
  }
);

Checkbox.displayName = 'Checkbox';
