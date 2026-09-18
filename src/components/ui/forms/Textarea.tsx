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
      <div
        className={`flex flex-col gap-[0.35rem] w-full text-left box-border ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        style={style}
      >
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={textareaId} className="text-xs font-extrabold text-text-primary tracking-wide uppercase leading-tight select-none">
              {label}
            </label>
          )}
          {showCount && maxLength && (
            <span className="text-[11px] text-text-secondary font-semibold">
              {currentLength}/{maxLength}
            </span>
          )}
        </div>

        <div
          className={`flex w-full rounded-md bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[box-shadow,background-color] duration-150 ease-in box-border p-[0.65rem_0.85rem] focus-within:shadow-[0_0_0_1.5px_var(--color-brand-primary)] ${error ? 'shadow-[0_0_0_1.5px_var(--color-error)]!' : ''}`}
        >
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            className="w-full border-none outline-none bg-transparent text-text-primary font-base text-sm resize-y min-h-[60px] box-border leading-relaxed placeholder:text-text-secondary placeholder:opacity-65 disabled:cursor-not-allowed"
            aria-invalid={!!error}
            aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
            {...props}
          />
        </div>

        {error ? (
          <p id={`${textareaId}-error`} className="m-0 text-xs leading-snug text-error font-semibold" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${textareaId}-helper`} className="m-0 text-xs leading-snug text-text-secondary">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
