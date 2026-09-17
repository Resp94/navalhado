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

const BTN_SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-[0.65rem] py-[0.35rem] text-xs',
  md: 'px-[0.85rem] py-2 text-xs',
};

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
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center bg-bg-primary shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-md p-[3px] gap-[3px] box-border select-none ${fullWidth ? 'flex w-full' : ''} ${size === 'sm' ? 'min-h-9' : 'min-h-[42px]'} ${className}`}
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
            className={`flex-1 min-w-0 inline-flex items-center justify-center gap-[0.45rem] border-none outline-none cursor-pointer font-base font-bold rounded-sm transition-[background-color,color,box-shadow] duration-150 ease-in box-border whitespace-nowrap h-full disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-1 ${BTN_SIZE_CLASSES[size]} ${
              isActive
                ? 'bg-bg-secondary text-brand-deep shadow-[0_0_0_0.5px_var(--color-brand-primary),0_1px_3px_rgba(217,108,0,0.14)]'
                : 'bg-transparent text-text-secondary'
            }`}
          >
            {option.icon && (
              <span className={`inline-flex items-center justify-center leading-none shrink-0 ${isActive ? 'text-brand-primary' : ''}`}>{option.icon}</span>
            )}
            <span className="leading-none truncate min-w-0">{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`px-[6px] py-px rounded-full text-[11px] font-extrabold leading-tight border-none shrink-0 ${
                  isActive ? 'bg-brand-primary-solid text-white' : 'bg-text-primary/8 text-text-secondary'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
