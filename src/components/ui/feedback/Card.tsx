import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outline';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <div className={`ui-card ui-card--${variant} ${className}`} style={style} {...props}>
        {children}
      </div>

      <style>{`
        .ui-card {
          border-radius: var(--radius-lg, 12px);
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .dark-theme .ui-card {
          background-color: var(--color-bg-secondary, #1E1B18);
        }

        .ui-card--default {
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E), var(--shadow-sm);
        }

        .dark-theme .ui-card--default {
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
        }

        .ui-card--outline {
          border: 1px solid var(--color-border, #EADED6);
          box-shadow: none;
        }

        .dark-theme .ui-card--outline {
          border-color: var(--color-border, #332D29);
        }

        .ui-card--flat {
          background-color: var(--color-bg-primary, #FFF1E6);
          border: 1px solid var(--color-border, #EADED6);
        }

        .dark-theme .ui-card--flat {
          background-color: #14110F;
          border-color: #332D29;
        }
      `}</style>
    </>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`ui-card-header ${className}`}
    style={{
      padding: '1.25rem 1.5rem 0.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      ...style,
    }}
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
    className={`ui-card-title ${className}`}
    style={{
      margin: 0,
      fontSize: 'var(--font-size-base, 1rem)',
      fontWeight: 800,
      color: 'var(--color-text-primary)',
      letterSpacing: '-0.01em',
      ...style,
    }}
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
    className={`ui-card-description ${className}`}
    style={{
      margin: 0,
      fontSize: 'var(--font-size-xs, 0.75rem)',
      color: 'var(--color-text-secondary)',
      lineHeight: 1.4,
      ...style,
    }}
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
    className={`ui-card-content ${className}`}
    style={{
      padding: '1rem 1.5rem',
      boxSizing: 'border-box',
      ...style,
    }}
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
    className={`ui-card-footer ${className}`}
    style={{
      padding: '0.75rem 1.5rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      borderTop: '1px solid var(--color-border)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
