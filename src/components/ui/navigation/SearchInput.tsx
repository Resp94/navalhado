import React, { forwardRef, useId } from 'react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Buscar...',
      inputSize = 'md',
      id,
      className = '',
      style,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const searchId = id || generatedId;

    const handleClear = () => {
      onChange('');
      if (onClear) onClear();
    };

    return (
      <>
        <div className={`ui-search-wrapper ui-search-wrapper--${inputSize} ${disabled ? 'ui-search-wrapper--disabled' : ''} ${className}`} style={style}>
          <span className="ui-search-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>

          <input
            ref={ref}
            id={searchId}
            type="search"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="ui-search-input"
            {...props}
          />

          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ui-search-clear-btn"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <style>{`
          .ui-search-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
            border-radius: var(--radius-md, 8px);
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            transition: box-shadow 0.15s ease, background-color 0.15s ease;
            box-sizing: border-box;
            padding: 0 0.75rem;
          }

          .dark-theme .ui-search-wrapper {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-search-wrapper:focus-within {
            box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00);
          }

          .ui-search-wrapper--disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ui-search-wrapper--sm {
            min-height: 36px;
          }

          .ui-search-wrapper--md {
            min-height: 42px;
          }

          .ui-search-wrapper--lg {
            min-height: 48px;
          }

          .ui-search-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--color-text-secondary, #70625B);
            margin-right: 0.5rem;
            flex-shrink: 0;
            pointer-events: none;
          }

          .ui-search-wrapper:focus-within .ui-search-icon {
            color: var(--color-brand-primary, #D96C00);
          }

          .ui-search-input {
            flex: 1;
            width: 100%;
            border: none;
            outline: none;
            background: transparent;
            color: var(--color-text-primary, #2D231E);
            font-family: var(--font-family-base, 'Outfit', sans-serif);
            font-size: var(--font-size-sm, 0.875rem);
            padding: 0.5rem 0;
            box-sizing: border-box;
          }

          .dark-theme .ui-search-input {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-search-input::placeholder {
            color: var(--color-text-secondary, #70625B);
            opacity: 0.65;
          }

          /* Remove o botão nativo feio de clear do WebKit */
          .ui-search-input::-webkit-search-decoration,
          .ui-search-input::-webkit-search-cancel-button,
          .ui-search-input::-webkit-search-results-button,
          .ui-search-input::-webkit-search-results-decoration {
            display: none;
          }

          .ui-search-clear-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: none;
            background-color: rgba(45, 35, 30, 0.08);
            color: var(--color-text-secondary, #70625B);
            cursor: pointer;
            padding: 0;
            margin-left: 0.4rem;
            flex-shrink: 0;
            transition: background-color 0.15s ease, color 0.15s ease;
          }

          .ui-search-clear-btn:hover {
            background-color: var(--color-text-primary, #2D231E);
            color: #FFFFFF;
          }

          .dark-theme .ui-search-clear-btn {
            background-color: rgba(255, 255, 255, 0.12);
            color: #FFF1E6;
          }

          .dark-theme .ui-search-clear-btn:hover {
            background-color: #FFFFFF;
            color: #14110F;
          }
        `}</style>
      </>
    );
  }
);

SearchInput.displayName = 'SearchInput';
