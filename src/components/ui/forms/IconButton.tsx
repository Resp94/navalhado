import React, { forwardRef } from 'react';

export type IconButtonVariant = 'ghost' | 'outline' | 'secondary' | 'danger-ghost' | 'brand';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconButtonShape = 'rounded' | 'circle';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  icon?: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  loading?: boolean;
}

const SHAPE_CLASSES: Record<IconButtonShape, string> = {
  rounded: 'rounded-md',
  circle: 'rounded-full',
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  xs: 'w-7 h-7 text-sm',
  sm: 'w-8 h-8 text-base',
  md: 'w-9 h-9 text-lg',
  lg: 'w-[42px] h-[42px] text-xl',
};

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent text-text-secondary hover:not-disabled:bg-text-primary/6 hover:not-disabled:text-text-primary',
  outline:
    'bg-bg-secondary text-text-secondary border border-border hover:not-disabled:border-brand-primary hover:not-disabled:text-brand-primary',
  secondary:
    'bg-bg-secondary text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:not-disabled:bg-black/4',
  'danger-ghost': 'bg-transparent text-error hover:not-disabled:bg-error-bg',
  brand: 'bg-brand-primary/10 text-brand-primary hover:not-disabled:bg-brand-primary hover:not-disabled:text-white',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      icon,
      variant = 'ghost',
      size = 'md',
      shape = 'rounded',
      loading = false,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        data-variant={variant}
        data-size={size}
        className={`inline-flex items-center justify-center cursor-pointer border-none outline-none p-0 shrink-0 box-border transition-[background-color,border-color,color,transform] duration-150 ease-in active:not-disabled:scale-94 focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none ${SHAPE_CLASSES[shape]} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
        style={style}
        {...props}
      >
        {loading ? (
          <span
            className="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin-fast"
            aria-hidden="true"
          />
        ) : (
          icon || children
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
