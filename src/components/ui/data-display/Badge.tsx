import React from 'react';

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeType = 'subtle' | 'solid' | 'outline';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  badgeType?: BadgeType;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'px-[6px] py-[2px] text-[10px]',
  sm: 'px-2 py-[3px] text-[11px]',
  md: 'px-[10px] py-1 text-xs',
};

const SUBTLE_CLASSES: Record<BadgeVariant, string> = {
  brand: 'bg-brand-lightest text-brand-deep border border-brand-soft',
  success: 'bg-success-bg text-success border border-success/25',
  warning: 'bg-warning-bg text-warning border border-warning/25',
  error: 'bg-error-bg text-error border border-error/25',
  info: 'bg-info-bg text-info border border-info/25',
  neutral: 'bg-bg-primary text-text-secondary border border-border',
};

const SOLID_CLASSES: Record<BadgeVariant, string> = {
  brand: 'bg-brand-primary text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  error: 'bg-error text-white',
  info: 'bg-info text-white',
  neutral: 'bg-text-primary text-white',
};

// warning/info não têm variante "outline" definida no design original —
// mantido apenas o fundo transparente para preservar o comportamento anterior.
const OUTLINE_CLASSES: Record<BadgeVariant, string> = {
  brand: 'bg-transparent text-brand-primary border border-brand-primary',
  success: 'bg-transparent text-success border border-success',
  warning: 'bg-transparent',
  error: 'bg-transparent text-error border border-error',
  info: 'bg-transparent',
  neutral: 'bg-transparent text-text-secondary border border-border',
};

const TYPE_CLASSES: Record<BadgeType, Record<BadgeVariant, string>> = {
  subtle: SUBTLE_CLASSES,
  solid: SOLID_CLASSES,
  outline: OUTLINE_CLASSES,
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  badgeType = 'subtle',
  size = 'sm',
  dot = false,
  icon,
  className = '',
  style,
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center gap-[0.35rem] rounded-full font-base font-bold tracking-wide leading-none whitespace-nowrap box-border select-none ${SIZE_CLASSES[size]} ${TYPE_CLASSES[badgeType][variant]} ${className}`}
      style={style}
      {...props}
    >
      {dot && <span className="w-[6px] h-[6px] rounded-full bg-current shrink-0" aria-hidden="true" />}
      {icon && <span className="inline-flex items-center justify-center leading-none">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
