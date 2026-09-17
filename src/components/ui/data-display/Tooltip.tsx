import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const POSITION_CLASSES: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
  right: 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-[1000] whitespace-nowrap rounded-sm px-[0.65rem] py-[0.35rem] font-base text-[11px] font-bold text-white bg-[rgba(20,17,15,0.94)] backdrop-blur-md shadow-[0_4px_12px_rgba(45,35,30,0.25)] pointer-events-none animate-tooltip-in ${POSITION_CLASSES[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
