import React, { forwardRef, useId } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      description,
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
    const radioId = id || generatedId;

    return (
      <>
        <label
          htmlFor={radioId}
          className={`ui-radio-container ${disabled ? 'ui-radio-container--disabled' : ''} ${className}`}
          style={style}
        >
          <div className="ui-radio-control-wrapper">
            <input
              ref={ref}
              id={radioId}
              type="radio"
              checked={checked}
              disabled={disabled}
              className="ui-radio-input"
              {...props}
            />
            <span className={`ui-radio-custom ${checked ? 'ui-radio-custom--checked' : ''}`}>
              <span className="ui-radio-inner-dot" />
            </span>
          </div>

          {(label || description) && (
            <div className="ui-radio-text-group">
              {label && <span className="ui-radio-label">{label}</span>}
              {description && <span className="ui-radio-desc">{description}</span>}
            </div>
          )}
        </label>

        <style>{`
          .ui-radio-container {
            display: inline-flex;
            align-items: flex-start;
            gap: 0.65rem;
            cursor: pointer;
            user-select: none;
            box-sizing: border-box;
          }

          .ui-radio-container--disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .ui-radio-control-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
          }

          .ui-radio-input {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            margin: 0;
            padding: 0;
          }

          .ui-radio-custom {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.15s ease, box-shadow 0.15s ease;
            box-sizing: border-box;
          }

          .dark-theme .ui-radio-custom {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-radio-input:focus-visible + .ui-radio-custom {
            outline: 2px solid var(--color-brand-primary, #D96C00);
            outline-offset: 2px;
          }

          .ui-radio-custom--checked {
            box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00) !important;
          }

          .ui-radio-inner-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--color-brand-primary, #D96C00);
            transform: scale(0);
            transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .ui-radio-custom--checked .ui-radio-inner-dot {
            transform: scale(1);
          }

          .ui-radio-text-group {
            display: flex;
            flex-direction: column;
            gap: 0.1rem;
          }

          .ui-radio-label {
            font-size: var(--font-size-sm, 0.875rem);
            font-weight: 600;
            color: var(--color-text-primary, #2D231E);
            line-height: 1.3;
          }

          .dark-theme .ui-radio-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-radio-desc {
            font-size: var(--font-size-xs, 0.75rem);
            color: var(--color-text-secondary, #70625B);
            line-height: 1.35;
          }
        `}</style>
      </>
    );
  }
);

Radio.displayName = 'Radio';
