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

    const isChecked = checked || indeterminate;

    return (
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-start gap-[0.65rem] cursor-pointer select-none box-border ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        style={style}
      >
        <div className="relative inline-flex items-center justify-center shrink-0 mt-px">
          <input
            ref={ref || internalRef}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="absolute opacity-0 w-0 h-0 m-0 p-0 peer"
            {...props}
          />
          <span
            className={`w-[18px] h-[18px] rounded-sm flex items-center justify-center text-white transition-[background-color,box-shadow] duration-150 ease-in box-border peer-focus-visible:outline-2 peer-focus-visible:outline-brand-primary peer-focus-visible:outline-offset-2 ${
              isChecked
                ? 'bg-brand-primary shadow-[0_0_0_0.8px_var(--color-brand-primary)]'
                : 'bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)]'
            }`}
          >
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
          <div className="flex flex-col gap-[0.1rem]">
            {label && <span className="text-sm font-semibold text-text-primary leading-snug">{label}</span>}
            {description && <span className="text-xs text-text-secondary leading-snug">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
