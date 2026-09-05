import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <>
      <div
        className={`ui-tooltip-container ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
        {isVisible && (
          <div role="tooltip" className={`ui-tooltip ui-tooltip--${position}`}>
            {content}
          </div>
        )}
      </div>

      <style>{`
        .ui-tooltip-container {
          position: relative;
          display: inline-flex;
        }

        .ui-tooltip {
          position: absolute;
          z-index: 1000;
          white-space: nowrap;
          border-radius: var(--radius-sm, 6px);
          padding: 0.35rem 0.65rem;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          font-size: 11px;
          font-weight: 700;
          color: #FFFFFF;
          background-color: rgba(20, 17, 15, 0.94);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          pointer-events: none;
          animation: uiTooltipFade 0.15s ease-out;
        }

        .dark-theme .ui-tooltip {
          background-color: rgba(255, 255, 255, 0.95);
          color: #14110F;
        }

        .ui-tooltip--top {
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
        }

        .ui-tooltip--bottom {
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
        }

        .ui-tooltip--left {
          right: calc(100% + 6px);
          top: 50%;
          transform: translateY(-50%);
        }

        .ui-tooltip--right {
          left: calc(100% + 6px);
          top: 50%;
          transform: translateY(-50%);
        }

        @keyframes uiTooltipFade {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};
