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

const TRACK_SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'w-9 h-5',
  md: 'w-11 h-6',
};

const THUMB_SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

const THUMB_TRANSLATE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'translate-x-4',
  md: 'translate-x-5',
};

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
      <div
        className={`flex items-center justify-between gap-4 cursor-pointer select-none box-border ${disabled ? 'opacity-55 cursor-not-allowed' : ''} ${className}`}
        style={style}
        onClick={handleToggle}
      >
        <div className="flex flex-col gap-[0.15rem] min-w-0 flex-1">
          {label && (
            <span id={`${switchId}-label`} className="text-sm font-bold text-text-primary leading-snug">
              {label}
            </span>
          )}
          {description && (
            <span id={`${switchId}-desc`} className="text-xs text-text-secondary leading-snug">
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
          className={`relative inline-flex items-center shrink-0 border-none outline-none rounded-full cursor-pointer p-0.5 box-border transition-[background-color,box-shadow] duration-200 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${
            checked
              ? 'bg-brand-primary shadow-[0_0_0_0.8px_var(--color-brand-primary)]'
              : 'bg-text-secondary/30 shadow-[0_0_0_0.8px_var(--color-text-primary)]'
          } ${TRACK_SIZE_CLASSES[size]}`}
        >
          <span
            className={`block rounded-full bg-white shadow-[0_1px_3px_rgba(45,35,30,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${THUMB_SIZE_CLASSES[size]} ${checked ? THUMB_TRANSLATE_CLASSES[size] : ''}`}
          />
        </button>
      </div>
    );
  }
);

Switch.displayName = 'Switch';
