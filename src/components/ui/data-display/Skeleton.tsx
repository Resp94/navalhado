import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  shape?: 'rect' | 'circle' | 'text';
  className?: string;
  style?: React.CSSProperties;
}

const SHAPE_CLASSES: Record<NonNullable<SkeletonProps['shape']>, string> = {
  rect: 'rounded-md',
  circle: 'rounded-full',
  text: 'rounded-sm h-[14px]',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  shape = 'rect',
  className = '',
  style,
}) => {
  return (
    <div
      className={`bg-[linear-gradient(90deg,rgba(45,35,30,0.05)_25%,rgba(45,35,30,0.1)_50%,rgba(45,35,30,0.05)_75%)] bg-[length:200%_100%] animate-shimmer box-border ${SHAPE_CLASSES[shape]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};
