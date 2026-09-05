import React, { forwardRef, useId } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onChange,
      label,
      description,
      disabled = false,
      size = 'md',
      id,
      className = '',
      style,
    },
    ref
  ) => {
    const generatedId = useId();
    const switchId = id || generatedId;

    const handleToggle = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
    };

    return (
      <>
        <div
          className={`ui-switch-container ${disabled ? 'ui-switch-container--disabled' : ''} ${className}`}
          style={style}
          onClick={handleToggle}
        >
          <div className="ui-switch-text-group">
            {label && (
              <span id={`${switchId}-label`} className="ui-switch-label">
                {label}
              </span>
            )}
            {description && (
              <span id={`${switchId}-desc`} className="ui-switch-desc">
                {description}
              </span>
            )}
          </div>

          <button
            ref={ref}
            id={switchId}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={label ? `${switchId}-label` : undefined}
            aria-describedby={description ? `${switchId}-desc` : undefined}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            className={`ui-switch-track ui-switch-track--${size} ${checked ? 'ui-switch-track--checked' : ''}`}
          >
            <span className="ui-switch-thumb" />
          </button>
        </div>

        <style>{`
          .ui-switch-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            cursor: pointer;
            user-select: none;
            box-sizing: border-box;
          }

          .ui-switch-container--disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .ui-switch-text-group {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            min-width: 0;
            flex: 1;
          }

          .ui-switch-label {
            font-size: var(--font-size-sm, 0.875rem);
            font-weight: 700;
            color: var(--color-text-primary, #2D231E);
            line-height: 1.25;
          }

          .dark-theme .ui-switch-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-switch-desc {
            font-size: var(--font-size-xs, 0.75rem);
            color: var(--color-text-secondary, #70625B);
            line-height: 1.35;
          }

          .ui-switch-track {
            position: relative;
            display: inline-flex;
            align-items: center;
            flex-shrink: 0;
            border: none;
            outline: none;
            border-radius: var(--radius-full, 9999px);
            background-color: #D1D5DB;
            cursor: pointer;
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            transition: background-color 0.2s ease, box-shadow 0.2s ease;
            padding: 2px;
            box-sizing: border-box;
          }

          .dark-theme .ui-switch-track {
            background-color: #3F3F46;
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-switch-track--checked {
            background-color: var(--color-brand-primary, #D96C00) !important;
            box-shadow: 0 0 0 0.8px var(--color-brand-primary, #D96C00) !important;
          }

          .ui-switch-track:focus-visible {
            outline: 2px solid var(--color-brand-primary, #D96C00);
            outline-offset: 2px;
          }

          /* TAMANHOS */
          .ui-switch-track--sm {
            width: 36px;
            height: 20px;
          }

          .ui-switch-track--sm .ui-switch-thumb {
            width: 16px;
            height: 16px;
          }

          .ui-switch-track--sm.ui-switch-track--checked .ui-switch-thumb {
            transform: translateX(16px);
          }

          .ui-switch-track--md {
            width: 44px;
            height: 24px;
          }

          .ui-switch-track--md .ui-switch-thumb {
            width: 20px;
            height: 20px;
          }

          .ui-switch-track--md.ui-switch-track--checked .ui-switch-thumb {
            transform: translateX(20px);
          }

          .ui-switch-thumb {
            display: block;
            border-radius: 50%;
            background-color: #FFFFFF;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
          }
        `}</style>
      </>
    );
  }
);

Switch.displayName = 'Switch';
