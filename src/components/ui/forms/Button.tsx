import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'ghost' | 'warning' | 'soft';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-8 px-[0.65rem] text-xs gap-[0.35rem]',
  sm: 'h-9 px-[0.85rem] text-xs gap-[0.4rem]',
  md: 'h-[42px] px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-[0.6rem]',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white shadow-[0_1px_3px_rgba(217,108,0,0.25)] hover:not-disabled:bg-brand-hover hover:not-disabled:shadow-[0_4px_12px_rgba(217,108,0,0.3)]',
  secondary:
    'bg-bg-secondary text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:not-disabled:bg-black/3',
  outline:
    'bg-transparent text-text-primary border border-border hover:not-disabled:border-brand-primary hover:not-disabled:text-brand-primary hover:not-disabled:bg-brand-primary/4',
  danger: 'bg-error text-white hover:not-disabled:bg-red-600',
  'danger-outline':
    'bg-transparent text-error border border-error hover:not-disabled:bg-error-bg',
  ghost: 'bg-transparent text-text-secondary hover:not-disabled:bg-text-primary/5 hover:not-disabled:text-text-primary',
  warning:
    'bg-warning text-text-primary shadow-[0_0_0_1px_var(--color-text-primary)] hover:not-disabled:bg-[#B45309] hover:not-disabled:-translate-y-px',
  soft: 'bg-brand-lightest text-text-primary shadow-[0_0_0_0.5px_var(--color-text-primary)] hover:not-disabled:bg-[#f2b277] hover:not-disabled:-translate-y-px',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      icon,
      rightIcon,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const actualLeftIcon = leftIcon || icon;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        data-variant={variant}
        data-size={size}
        className={`inline-flex items-center justify-center font-base font-bold cursor-pointer rounded-md border-none outline-none whitespace-nowrap select-none no-underline relative box-border transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-in active:not-disabled:scale-98 focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 disabled:opacity-55 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none ${fullWidth ? 'w-full' : ''} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
        style={style}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin-fast shrink-0"
            aria-hidden="true"
          />
        ) : (
          actualLeftIcon && <span className="inline-flex items-center justify-center shrink-0 leading-none">{actualLeftIcon}</span>
        )}
        <span className="leading-none">{children}</span>
        {!loading && rightIcon && (
          <span className="inline-flex items-center justify-center shrink-0 leading-none">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
