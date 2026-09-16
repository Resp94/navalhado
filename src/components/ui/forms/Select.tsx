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

const WRAPPER_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-9',
  md: 'min-h-[42px]',
  lg: 'min-h-12',
};

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
      <div
        className={`flex flex-col gap-[0.35rem] w-full text-left box-border ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        style={style}
      >
        {label && (
          <label htmlFor={selectId} className="text-xs font-extrabold text-text-primary tracking-wide uppercase leading-tight select-none">
            {label}
          </label>
        )}

        <div
          className={`relative flex items-center w-full rounded-md bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[box-shadow,background-color] duration-150 ease-in box-border focus-within:shadow-[0_0_0_1.5px_var(--color-brand-primary)] [&:focus-within_.select-chevron]:text-brand-primary ${error ? 'shadow-[0_0_0_1.5px_var(--color-error)]!' : ''} ${WRAPPER_SIZE_CLASSES[selectSize]}`}
        >
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className="w-full h-full py-[0.55rem] pr-9 pl-[0.85rem] border-none outline-none bg-transparent text-text-primary font-base text-sm cursor-pointer appearance-none box-border disabled:cursor-not-allowed"
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

          <span className="select-chevron absolute right-[0.85rem] flex items-center justify-center pointer-events-none text-text-secondary transition-colors duration-150 ease-in" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {error ? (
          <p id={`${selectId}-error`} className="m-0 text-xs leading-snug text-error font-semibold" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${selectId}-helper`} className="m-0 text-xs leading-snug text-text-secondary">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
