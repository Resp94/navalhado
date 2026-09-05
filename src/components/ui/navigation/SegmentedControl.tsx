import React from 'react';

export interface SegmentedOption<T extends string | number = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string | number = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  className = '',
  style,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`ui-segmented ${fullWidth ? 'ui-segmented--full' : ''} ui-segmented--${size} ${className}`}
        style={style}
      >
        {options.map((option) => {
          const isActive = option.id === value;
          return (
            <button
              key={String(option.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={option.disabled}
              onClick={() => !option.disabled && onChange(option.id)}
              className={`ui-segmented-btn ${isActive ? 'ui-segmented-btn--active' : ''}`}
            >
              {option.icon && <span className="ui-segmented-icon">{option.icon}</span>}
              <span className="ui-segmented-label">{option.label}</span>
              {option.count !== undefined && (
                <span className={`ui-segmented-count ${isActive ? 'ui-segmented-count--active' : ''}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        .ui-segmented {
          display: inline-flex;
          align-items: center;
          background-color: var(--color-bg-primary, #FFF1E6);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          padding: 3px;
          gap: 3px;
          box-sizing: border-box;
          user-select: none;
        }

        .dark-theme .ui-segmented {
          background-color: #14110F;
          border-color: var(--color-border, #332D29);
        }

        .ui-segmented--full {
          display: flex;
          width: 100%;
        }

        /* TAMANHOS */
        .ui-segmented--sm {
          min-height: 36px;
        }

        .ui-segmented--sm .ui-segmented-btn {
          padding: 0.35rem 0.65rem;
          font-size: var(--font-size-xs, 0.75rem);
        }

        .ui-segmented--md {
          min-height: 42px;
        }

        .ui-segmented--md .ui-segmented-btn {
          padding: 0.5rem 0.85rem;
          font-size: var(--font-size-xs, 0.75rem);
        }

        .ui-segmented-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          background: transparent;
          border: none;
          outline: none;
          cursor: pointer;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          font-weight: 700;
          color: var(--color-text-secondary, #70625B);
          border-radius: var(--radius-sm, 6px);
          transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
          white-space: nowrap;
          height: 100%;
        }

        .ui-segmented-btn:hover:not(:disabled) {
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .ui-segmented-btn:hover:not(:disabled) {
          color: #FFFFFF;
        }

        .ui-segmented-btn--active {
          background-color: var(--color-bg-secondary, #FFFFFF) !important;
          color: var(--color-text-primary, #2D231E) !important;
          box-shadow: 0 0 0 1px #000000, 0 1px 3px rgba(45, 35, 30, 0.08) !important;
        }

        .dark-theme .ui-segmented-btn--active {
          background-color: var(--color-bg-secondary, #1E1B18) !important;
          color: var(--color-text-primary, #FFF1E6) !important;
          box-shadow: 0 0 0 1px #FFFFFF, 0 2px 6px rgba(0, 0, 0, 0.4) !important;
        }

        .ui-segmented-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ui-segmented-btn:focus-visible {
          outline: 2px solid var(--color-brand-primary, #D96C00);
          outline-offset: 1px;
        }

        .ui-segmented-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .ui-segmented-count {
          padding: 1px 6px;
          border-radius: var(--radius-full, 9999px);
          background-color: rgba(45, 35, 30, 0.08);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
        }

        .ui-segmented-count--active {
          background-color: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-primary, #D96C00);
        }

        .dark-theme .ui-segmented-count--active {
          background-color: rgba(217, 108, 0, 0.18);
          color: #F2B277;
        }
      `}</style>
    </>
  );
}
