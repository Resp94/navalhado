import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outline';
}

const VARIANT_CLASSES: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)]',
  outline: 'border border-border shadow-none',
  flat: 'bg-bg-primary border border-border',
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`rounded-lg bg-bg-secondary box-border font-base overflow-hidden transition-[border-color,box-shadow] duration-200 ease-in ${VARIANT_CLASSES[variant]} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`px-6 pt-5 pb-2 flex flex-col gap-1 ${className}`}
    style={style}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <h3
    className={`m-0 text-base font-extrabold text-text-primary tracking-tight ${className}`}
    style={style}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <p
    className={`m-0 text-xs text-text-secondary leading-normal ${className}`}
    style={style}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`px-6 py-4 box-border ${className}`}
    style={style}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`px-6 pt-3 pb-5 flex items-center justify-end gap-3 border-t border-border ${className}`}
    style={style}
    {...props}
  >
    {children}
  </div>
);
