import React, { forwardRef, useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCount = false,
      maxLength,
      value,
      id,
      disabled,
      className = '',
      style,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <>
        <div className={`ui-textarea-group ${disabled ? 'ui-textarea-group--disabled' : ''} ${className}`} style={style}>
          <div className="ui-textarea-header">
            {label && (
              <label htmlFor={textareaId} className="ui-textarea-label">
                {label}
              </label>
            )}
            {showCount && maxLength && (
              <span className="ui-textarea-count">
                {currentLength}/{maxLength}
              </span>
            )}
          </div>

          <div className={`ui-textarea-wrapper ${error ? 'ui-textarea-wrapper--error' : ''}`}>
            <textarea
              ref={ref}
              id={textareaId}
              rows={rows}
              value={value}
              maxLength={maxLength}
              disabled={disabled}
              className="ui-textarea-field"
              aria-invalid={!!error}
              aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
              {...props}
            />
          </div>

          {error ? (
            <p id={`${textareaId}-error`} className="ui-textarea-feedback ui-textarea-feedback--error" role="alert">
              {error}
            </p>
          ) : helperText ? (
            <p id={`${textareaId}-helper`} className="ui-textarea-feedback ui-textarea-feedback--helper">
              {helperText}
            </p>
          ) : null}
        </div>

        <style>{`
          .ui-textarea-group {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            width: 100%;
            text-align: left;
            box-sizing: border-box;
          }

          .ui-textarea-group--disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ui-textarea-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          }

          .ui-textarea-label {
            font-size: var(--font-size-xs, 0.75rem);
            font-weight: 800;
            color: var(--color-text-primary, #2D231E);
            letter-spacing: 0.04em;
            text-transform: uppercase;
            line-height: 1.2;
            user-select: none;
          }

          .dark-theme .ui-textarea-label {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-textarea-count {
            font-size: 11px;
            color: var(--color-text-secondary, #70625B);
            font-weight: 600;
          }

          .ui-textarea-wrapper {
            display: flex;
            width: 100%;
            border-radius: var(--radius-md, 8px);
            background-color: var(--color-bg-secondary, #FFFFFF);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
            transition: box-shadow 0.15s ease, background-color 0.15s ease;
            box-sizing: border-box;
            padding: 0.65rem 0.85rem;
          }

          .dark-theme .ui-textarea-wrapper {
            background-color: var(--color-bg-secondary, #1E1B18);
            box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
          }

          .ui-textarea-wrapper:focus-within {
            box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00);
          }

          .ui-textarea-wrapper--error {
            box-shadow: 0 0 0 1.5px var(--color-error, #F05252) !important;
          }

          .ui-textarea-field {
            width: 100%;
            border: none;
            outline: none;
            background: transparent;
            color: var(--color-text-primary, #2D231E);
            font-family: var(--font-family-base, 'Outfit', sans-serif);
            font-size: var(--font-size-sm, 0.875rem);
            resize: vertical;
            min-height: 60px;
            box-sizing: border-box;
            line-height: 1.45;
          }

          .dark-theme .ui-textarea-field {
            color: var(--color-text-primary, #FFF1E6);
          }

          .ui-textarea-field::placeholder {
            color: var(--color-text-secondary, #70625B);
            opacity: 0.65;
          }

          .ui-textarea-field:disabled {
            cursor: not-allowed;
          }

          .ui-textarea-feedback {
            margin: 0;
            font-size: 0.75rem;
            line-height: 1.35;
          }

          .ui-textarea-feedback--error {
            color: var(--color-error, #F05252);
            font-weight: 600;
          }

          .ui-textarea-feedback--helper {
            color: var(--color-text-secondary, #70625B);
          }
        `}</style>
      </>
    );
  }
);

Textarea.displayName = 'Textarea';
