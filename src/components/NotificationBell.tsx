import React, { useState, useRef, useEffect } from 'react';

import type { Notification } from '../lib/useRealtimeNotifications';

export interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Formata o tempo relativo de forma limpa
  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'agora mesmo';
      
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `há ${diffInMinutes} min`;

      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `há ${diffInHours}h`;

      const diffInDays = Math.floor(diffInHours / 24);
      return `há ${diffInDays} ${diffInDays === 1 ? 'dia' : 'dias'}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Botão de Sininho */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
        className="relative flex items-center justify-center p-2.5 rounded-full text-text-primary cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_80%,transparent)] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] [backdrop-filter:blur(10px)] shadow-sm hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--color-bg-secondary)_95%,transparent)] hover:border-brand-primary hover:shadow-md"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {/* Badge Numérico */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-brand-primary text-brand-lightest text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-bg-primary animate-tooltip-in">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Liquid Glass Panel */}
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+12px)] w-[380px] max-w-[90vw] bg-[color-mix(in_srgb,var(--color-bg-secondary)_82%,transparent)] [backdrop-filter:blur(20px)] border border-[color-mix(in_srgb,var(--color-border)_45%,transparent)] rounded-xl shadow-xl z-50 overflow-hidden animate-dialog-in [transform-origin:top_right]">
          {/* Header do Dropdown */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color-mix(in_srgb,var(--color-border)_30%,transparent)]">
            <h3 className="m-0 text-base font-semibold text-text-primary font-base">
              Notificações
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                aria-label="Marcar todas como lidas"
                className="bg-none border-none text-brand-primary text-xs font-semibold cursor-pointer px-3 py-2 min-h-11 inline-flex items-center rounded-sm transition-all duration-200 ease-in [touch-action:manipulation] hover:text-brand-hover hover:bg-[color-mix(in_srgb,var(--color-brand-lightest)_60%,transparent)]"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              // Empty State Elegante
              <div className="py-10 px-5 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-brand-primary)_10%,transparent)] flex items-center justify-center text-brand-primary">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <p className="m-0 font-semibold text-text-primary text-sm">
                    Nenhuma notificação por aqui
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Você está em dia com as suas novidades.
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-5 py-4 border-b border-[color-mix(in_srgb,var(--color-border)_20%,transparent)] flex gap-3 relative transition-all duration-200 ease-in hover:bg-[color-mix(in_srgb,var(--color-bg-primary)_50%,transparent)] ${
                    notification.read
                      ? 'bg-transparent border-l-[3px] border-l-transparent'
                      : 'bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,transparent)] border-l-[3px] border-l-brand-primary'
                  }`}
                >
                  {/* Conteúdo da Notificação */}
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className={`m-0 text-sm text-text-primary ${notification.read ? 'font-medium' : 'font-semibold'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-[10px] text-text-secondary whitespace-nowrap">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary leading-[1.4]">
                      {notification.message}
                    </p>
                  </div>

                  {/* Ação Individual (Marcar como lida) */}
                  {!notification.read && (
                    <button
                      onClick={() => onMarkAsRead(notification.id)}
                      aria-label="Marcar como lida"
                      className="bg-none border-none text-brand-primary cursor-pointer p-2.5 min-w-11 min-h-11 flex items-center justify-center rounded-full self-center transition-all duration-200 ease-in [touch-action:manipulation] hover:text-brand-hover hover:bg-[color-mix(in_srgb,var(--color-brand-lightest)_80%,transparent)] hover:scale-110"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
