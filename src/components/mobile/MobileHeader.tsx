import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '../NotificationBell';
import type { RealtimeNotification } from '../../lib/useRealtimeNotifications';

interface MobileHeaderProps {
  tenantName: string;
  logoUrl?: string | null;
  /** Rota da página inicial do papel (o gestor volta para a agenda dele, o barbeiro para a dele). */
  homePath?: string;
  notifications: RealtimeNotification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  tenantName,
  logoUrl,
  homePath = '/agenda',
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();

  return (
    <header className="hidden max-md:flex sticky top-0 inset-x-0 z-[890] bg-bg-secondary backdrop-blur-[16px] backdrop-saturate-[180%] border-b border-border px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top,0.625rem))] items-center justify-between">
      <button
        type="button"
        className="flex items-center gap-2.5 cursor-pointer min-w-0 bg-transparent border-none p-0 text-left"
        onClick={() => navigate(homePath)}
        aria-label={`Página inicial da barbearia ${tenantName}`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={tenantName} className="w-[30px] h-[30px] rounded-md object-cover border border-border shrink-0" />
        ) : (
          <div className="flex items-center justify-center shrink-0">
            <img src="/simbolo.svg" alt="Navalhado" className="w-[28px] h-[28px] block" />
          </div>
        )}
        <h1 className="text-[0.9375rem] font-bold text-text-primary m-0 tracking-[-0.02em] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
          {tenantName}
        </h1>
      </button>

      <div className="flex items-center gap-2">
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={onMarkAllAsRead}
          onMarkAsRead={onMarkAsRead}
        />
      </div>
    </header>
  );
};
