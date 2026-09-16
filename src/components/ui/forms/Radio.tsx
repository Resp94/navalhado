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
      <label
        htmlFor={radioId}
        className={`inline-flex items-start gap-[0.65rem] cursor-pointer select-none box-border ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        style={style}
      >
        <div className="relative inline-flex items-center justify-center shrink-0 mt-px">
          <input
            ref={ref}
            id={radioId}
            type="radio"
            checked={checked}
            disabled={disabled}
            className="absolute opacity-0 w-0 h-0 m-0 p-0 peer"
            {...props}
          />
          <span
            className={`w-[18px] h-[18px] rounded-full bg-bg-secondary flex items-center justify-center transition-[background-color,box-shadow] duration-150 ease-in box-border peer-focus-visible:outline-2 peer-focus-visible:outline-brand-primary peer-focus-visible:outline-offset-2 ${
              checked ? 'shadow-[0_0_0_1.5px_var(--color-brand-primary)]!' : 'shadow-[0_0_0_0.8px_var(--color-text-primary)]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full bg-brand-primary transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${checked ? 'scale-100' : 'scale-0'}`}
            />
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

Radio.displayName = 'Radio';
