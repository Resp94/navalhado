import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  shape?: 'rect' | 'circle' | 'text';
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  shape = 'rect',
  className = '',
  style,
}) => {
  return (
    <>
      <div
        className={`ui-skeleton ui-skeleton--${shape} ${className}`}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        aria-hidden="true"
      />

      <style>{`
        .ui-skeleton {
          background: linear-gradient(
            90deg,
            rgba(45, 35, 30, 0.05) 25%,
            rgba(45, 35, 30, 0.1) 50%,
            rgba(45, 35, 30, 0.05) 75%
          );
          background-size: 200% 100%;
          animation: uiSkeletonShimmer 1.5s infinite ease-in-out;
          box-sizing: border-box;
        }

        .dark-theme .ui-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04) 25%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.04) 75%
          );
          background-size: 200% 100%;
        }

        .ui-skeleton--rect {
          border-radius: var(--radius-md, 8px);
        }

        .ui-skeleton--circle {
          border-radius: var(--radius-full, 9999px);
        }

        .ui-skeleton--text {
          border-radius: var(--radius-sm, 4px);
          height: 14px;
        }

        @keyframes uiSkeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
};
