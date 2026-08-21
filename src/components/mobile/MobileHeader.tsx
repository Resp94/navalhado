import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '../NotificationBell';
import type { RealtimeNotification } from '../../lib/useRealtimeNotifications';

interface MobileHeaderProps {
  tenantName: string;
  logoUrl?: string | null;
  notifications: RealtimeNotification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  tenantName,
  logoUrl,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();

  return (
    <>
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-header__brand"
          onClick={() => navigate('/agenda')}
          aria-label={`Página inicial da barbearia ${tenantName}`}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName} className="mobile-header__logo-img" />
          ) : (
            <div className="mobile-header__logo">
              <img src="/simbolo.svg" alt="Navalhado" style={{ width: '28px', height: '28px', display: 'block' }} />
            </div>
          )}
          <h1 className="mobile-header__title">{tenantName}</h1>
        </button>

        <div className="mobile-header__actions">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllAsRead={onMarkAllAsRead}
            onMarkAsRead={onMarkAsRead}
          />
        </div>
      </header>

      <style>{`
        .mobile-header {
          display: none;
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          z-index: 890;
          background: var(--color-bg-secondary);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border-bottom: 1px solid var(--color-border);
          padding: 0.625rem 1rem;
          padding-top: max(0.625rem, env(safe-area-inset-top, 0.625rem));
          align-items: center;
          justify-content: space-between;
        }

        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
          }
        }

        .mobile-header__brand {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          cursor: pointer;
          min-width: 0;
          background: transparent;
          border: none;
          padding: 0;
          font: inherit;
          color: inherit;
          text-align: left;
        }

        .mobile-header__logo-img {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-md);
          object-fit: cover;
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .mobile-header__logo {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-header__title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .mobile-header__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </>
  );
};
