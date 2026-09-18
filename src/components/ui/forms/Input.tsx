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

const WRAPPER_SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'min-h-9 px-[0.65rem]',
  md: 'min-h-[42px] px-[0.85rem]',
  lg: 'min-h-12 px-4',
};

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
      <div
        className={`flex flex-col gap-[0.35rem] w-full text-left box-border ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        style={style}
      >
        {label && (
          <label htmlFor={inputId} className="text-xs font-extrabold text-text-primary tracking-wide uppercase leading-tight select-none">
            {label}
          </label>
        )}

        <div
          className={`flex items-center w-full rounded-md bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[box-shadow,background-color] duration-150 ease-in box-border relative overflow-hidden focus-within:shadow-[0_0_0_1.5px_var(--color-brand-primary)] ${error ? 'shadow-[0_0_0_1.5px_var(--color-error)]!' : ''} ${WRAPPER_SIZE_CLASSES[inputSize]}`}
        >
          {leftIcon && <span className="inline-flex items-center justify-center text-text-secondary text-sm select-none shrink-0 mr-2">{leftIcon}</span>}
          {prefixText && <span className="inline-flex items-center justify-center text-text-secondary text-sm select-none shrink-0 mr-[0.45rem] font-bold">{prefixText}</span>}

          <input
            ref={ref}
            id={inputId}
            type={activeType}
            disabled={disabled}
            className="flex-1 w-full min-w-0 border-none outline-none bg-transparent text-text-primary font-base text-sm py-2 box-border placeholder:text-text-secondary placeholder:opacity-65 disabled:cursor-not-allowed"
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />

          {suffixText && <span className="inline-flex items-center justify-center text-text-secondary text-sm select-none shrink-0 ml-[0.45rem] font-semibold">{suffixText}</span>}

          {isPassword ? (
            <button
              type="button"
              className="bg-transparent border-none cursor-pointer p-1 ml-[0.4rem] text-text-secondary inline-flex items-center justify-center transition-colors duration-150 ease-in outline-none rounded-sm hover:text-text-primary"
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
            rightIcon && <span className="inline-flex items-center justify-center text-text-secondary text-sm select-none shrink-0 ml-2">{rightIcon}</span>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="m-0 text-xs leading-snug text-error font-semibold" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="m-0 text-xs leading-snug text-text-secondary">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
