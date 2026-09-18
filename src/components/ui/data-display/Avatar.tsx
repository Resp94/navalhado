import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  style?: React.CSSProperties;
}

// Cores determinísticas para iniciais com bom contraste no tema
const PALETTE = [
  { bg: '#EAA96B', color: '#1E1B18' },
  { bg: '#3B82F6', color: '#FFFFFF' },
  { bg: '#10B981', color: '#FFFFFF' },
  { bg: '#F59E0B', color: '#1E1B18' },
  { bg: '#EC4899', color: '#FFFFFF' },
  { bg: '#8B5CF6', color: '#FFFFFF' },
  { bg: '#06B6D4', color: '#FFFFFF' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

function getInitials(name: string): string {
  if (!name) return 'BA';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-md',
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-14 h-14 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  shape = 'circle',
  className = '',
  style,
}) => {
  const initials = getInitials(name);
  const colorPair = getAvatarColor(name);

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 font-base font-extrabold select-none box-border overflow-hidden leading-none ${SHAPE_CLASSES[shape]} ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: !src ? colorPair.bg : undefined,
        color: !src ? colorPair.color : undefined,
        ...style,
      }}
      title={name}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Se a imagem falhar, remove o src para exibir as iniciais
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="tracking-tight">{initials}</span>
      )}
    </div>
  );
};
