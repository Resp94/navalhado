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
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      {/* Botão de Sininho */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
        style={{
          background: 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          padding: '10px',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.background = 'color-mix(in srgb, var(--color-bg-secondary) 95%, transparent)';
          e.currentTarget.style.borderColor = 'var(--color-brand-primary)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.background = 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)';
          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-border) 60%, transparent)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
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
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: 'var(--color-brand-primary)',
              color: 'var(--color-brand-lightest)',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--color-bg-primary)',
              animation: 'dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Liquid Glass Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 12px)',
            width: '380px',
            maxWidth: '90vw',
            background: 'color-mix(in srgb, var(--color-bg-secondary) 82%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid color-mix(in srgb, var(--color-border) 45%, transparent)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 50,
            overflow: 'hidden',
            animation: 'dropdownFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top right',
          }}
        >
          {/* Header do Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid color-mix(in srgb, var(--color-border) 30%, transparent)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family-base)',
              }}
            >
              Notificações
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                aria-label="Marcar todas como lidas"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-brand-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-brand-hover)';
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand-lightest) 60%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-brand-primary)';
                  e.currentTarget.style.background = 'none';
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              // Empty State Elegante
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-full)',
                    background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
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
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    Nenhuma notificação por aqui
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Você está em dia com as suas novidades.
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid color-mix(in srgb, var(--color-border) 20%, transparent)',
                    display: 'flex',
                    gap: '12px',
                    position: 'relative',
                    background: notification.read
                      ? 'transparent'
                      : 'color-mix(in srgb, var(--color-brand-primary) 4%, transparent)',
                    borderLeft: notification.read
                      ? '3px solid transparent'
                      : '3px solid var(--color-brand-primary)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--color-bg-primary) 50%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.read
                      ? 'transparent'
                      : 'color-mix(in srgb, var(--color-brand-primary) 4%, transparent)';
                  }}
                >
                  {/* Conteúdo da Notificação */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: notification.read ? 500 : 600,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {notification.title}
                      </h4>
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-text-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '6px 0 0 0',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {notification.message}
                    </p>
                  </div>

                  {/* Ação Individual (Marcar como lida) */}
                  {!notification.read && (
                    <button
                      onClick={() => onMarkAsRead(notification.id)}
                      aria-label="Marcar como lida"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-brand-primary)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-full)',
                        alignSelf: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-brand-hover)';
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand-lightest) 80%, transparent)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-brand-primary)';
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
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

      <style>{`
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
