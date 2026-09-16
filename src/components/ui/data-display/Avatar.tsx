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
    <>
      <div
        className={`ui-avatar ui-avatar--${size} ui-avatar--${shape} ${className}`}
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
            className="ui-avatar__img"
            onError={(e) => {
              // Se a imagem falhar, remove o src para exibir as iniciais
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="ui-avatar__initials">{initials}</span>
        )}
      </div>

      <style>{`
        .ui-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          font-weight: 800;
          user-select: none;
          box-sizing: border-box;
          overflow: hidden;
          line-height: 1;
        }

        .ui-avatar--circle {
          border-radius: var(--radius-full, 9999px);
        }

        .ui-avatar--rounded {
          border-radius: var(--radius-md, 8px);
        }

        /* TAMANHOS */
        .ui-avatar--xs {
          width: 24px;
          height: 24px;
          font-size: 10px;
        }

        .ui-avatar--sm {
          width: 32px;
          height: 32px;
          font-size: 12px;
        }

        .ui-avatar--md {
          width: 40px;
          height: 40px;
          font-size: 14px;
        }

        .ui-avatar--lg {
          width: 48px;
          height: 48px;
          font-size: 16px;
        }

        .ui-avatar--xl {
          width: 56px;
          height: 56px;
          font-size: 18px;
        }

        .ui-avatar__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ui-avatar__initials {
          letter-spacing: -0.02em;
        }
      `}</style>
    </>
  );
};
