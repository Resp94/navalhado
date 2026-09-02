import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UsersFour,
  Scissors,
  Package,
  CurrencyDollar,
  WhatsappLogo,
  Gear,
  SignOut,
  User,
  Bell,
  Check,
  ArrowRight,
  ArrowLeft,
} from '@phosphor-icons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalendarUserIcon } from '@hugeicons/core-free-icons';
import type { TenantContextType } from './GerenteLayout';
import type { Notification } from '../lib/useRealtimeNotifications';
import './GlassSidebar.css';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 250;

interface NavItemConfig {
  path: string;
  label: string;
  renderIcon: (props: { size: number; isBold: boolean }) => React.ReactNode;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    path: '/agenda',
    label: 'Agenda',
    renderIcon: ({ size, isBold }) => (
      <HugeiconsIcon
        icon={CalendarUserIcon}
        size={size}
        color="currentColor"
        strokeWidth={isBold ? 2.2 : 1.7}
      />
    ),
  },
  {
    path: '/clientes',
    label: 'Clientes',
    renderIcon: ({ size, isBold }) => (
      <Users size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/profissionais',
    label: 'Equipe',
    renderIcon: ({ size, isBold }) => (
      <UsersFour size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/servicos/cadastro',
    label: 'Serviços',
    renderIcon: ({ size, isBold }) => (
      <Scissors size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/produtos',
    label: 'Produtos',
    renderIcon: ({ size, isBold }) => (
      <Package size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    renderIcon: ({ size, isBold }) => (
      <CurrencyDollar size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/whatsapp',
    label: 'WhatsApp',
    renderIcon: ({ size, isBold }) => (
      <WhatsappLogo size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/configuracoes',
    label: 'Ajustes',
    renderIcon: ({ size, isBold }) => (
      <Gear size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
];

export interface GlassSidebarProps {
  tenantInfo: TenantContextType;
  managerName: string;
  notifications: Notification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onLogout: () => void;
}

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

function NavItemRow({
  item,
  isActive,
  isOpen,
  onClick,
}: {
  item: NavItemConfig;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHovered(false);
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  return (
    <div className="glass-sidebar__item">
      {/* Tooltip flutuante quando recolhido */}
      <AnimatePresence>
        {!isOpen && hovered && coords && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="glass-sidebar__tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateY(-50%)',
            }}
          >
            {item.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão do Item */}
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`glass-sidebar__button ${isActive ? 'glass-sidebar__button--active' : ''}`}
        aria-label={item.label}
      >
        <div className="glass-sidebar__tile">
          {item.renderIcon({
            size: 22,
            isBold: isActive,
          })}
        </div>

        {/* Rótulo animado ao expandir - sem delay, resposta instantânea */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.span
              key="label"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className={`glass-sidebar__label ${isActive ? 'glass-sidebar__label--active' : ''}`}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Ponto Circular Laranja: posicionado ao lado do ícone no estado recolhido (right: 4px) e na borda no estado expandido (right: 16px) */}
        {isActive && (
          <motion.div
            layoutId="activeSidebarDot"
            className="glass-sidebar__active-dot"
            animate={{ right: isOpen ? 16 : 4 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          />
        )}
      </button>
    </div>
  );
}

function NotificationsFooterItem({
  isOpen,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
}: {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  return (
    <div className="glass-sidebar__item" ref={dropdownRef}>
      {/* Tooltip flutuante quando recolhido */}
      <AnimatePresence>
        {!isOpen && hovered && !dropdownOpen && coords && (
          <motion.div
            key="notif-tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="glass-sidebar__tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateY(-50%)',
            }}
          >
            Notificações {unreadCount > 0 ? `(${unreadCount})` : ''}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`glass-sidebar__button ${dropdownOpen ? 'glass-sidebar__button--active' : ''}`}
        aria-label="Notificações"
      >
        <div className="glass-sidebar__tile">
          <Bell size={22} weight={dropdownOpen ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
          {unreadCount > 0 && (
            <span className="glass-sidebar__badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.span
              key="notif-label"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="glass-sidebar__label"
            >
              Notificações
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown de Notificações */}
      {dropdownOpen && (
        <div className="glass-sidebar__notif-dropdown">
          <div className="glass-sidebar__notif-header">
            <h3 className="glass-sidebar__notif-title">Notificações</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="glass-sidebar__notif-mark-all"
                aria-label="Marcar todas como lidas"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="glass-sidebar__notif-list">
            {notifications.length === 0 ? (
              <div className="glass-sidebar__notif-empty">
                <div className="glass-sidebar__notif-empty-icon">
                  <Bell size={22} weight="regular" />
                </div>
                <div>
                  <p className="glass-sidebar__notif-empty-title">Nenhuma notificação por aqui</p>
                  <p className="glass-sidebar__notif-empty-desc">Você está em dia com as suas novidades.</p>
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`glass-sidebar__notif-item ${!n.read ? 'glass-sidebar__notif-item--unread' : ''}`}
                >
                  <div className="glass-sidebar__notif-content">
                    <div className="glass-sidebar__notif-item-header">
                      <h4 className="glass-sidebar__notif-item-title">{n.title}</h4>
                      <span className="glass-sidebar__notif-item-time">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="glass-sidebar__notif-item-msg">{n.message}</p>
                  </div>

                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead(n.id)}
                      className="glass-sidebar__notif-read-btn"
                      title="Marcar como lida"
                      aria-label="Marcar como lida"
                    >
                      <Check size={16} weight="bold" />
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
}

function UserFooterItem({
  isOpen,
  managerName,
}: {
  isOpen: boolean;
  managerName: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!isOpen && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  return (
    <div
      ref={rowRef}
      className="glass-sidebar__item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Tooltip flutuante quando recolhido com o nome do usuário */}
      <AnimatePresence>
        {!isOpen && hovered && coords && (
          <motion.div
            key="user-tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="glass-sidebar__tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateY(-50%)',
            }}
          >
            {managerName}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-sidebar__user-row">
        <div className="glass-sidebar__tile">
          <User size={22} weight="regular" style={{ color: 'currentColor' }} />
        </div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="user-name"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="glass-sidebar__user-info"
            >
              <span className="glass-sidebar__user-name" title={managerName}>
                {managerName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const GlassSidebar: React.FC<GlassSidebarProps> = ({
  tenantInfo,
  managerName,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('navalhado_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [logoutHovered, setLogoutHovered] = useState(false);
  const [logoutCoords, setLogoutCoords] = useState<{ top: number; left: number } | null>(null);
  const logoutBtnRef = useRef<HTMLButtonElement>(null);

  const toggleSidebar = () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      localStorage.setItem('navalhado_sidebar_open', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleLogoutMouseEnter = () => {
    if (!isOpen && logoutBtnRef.current) {
      const rect = logoutBtnRef.current.getBoundingClientRect();
      setLogoutCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setLogoutHovered(true);
    }
  };

  const handleLogoutMouseLeave = () => {
    setLogoutHovered(false);
  };

  return (
    <aside className="glass-sidebar-wrapper" aria-label="Navegação Principal do Gerente">
      <motion.div
        className={`glass-sidebar ${isOpen ? 'glass-sidebar--expanded' : 'glass-sidebar--collapsed'}`}
        animate={{ width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        initial={false}
      >
        {/* Marca / Barbearia: Apenas a Logo e Nome da Barbearia sem container branco */}
        <button
          type="button"
          onClick={() => navigate('/agenda')}
          className="glass-sidebar__brand"
          title={tenantInfo.tenantName}
          aria-label={`Página inicial de ${tenantInfo.tenantName}`}
        >
          {tenantInfo.logoUrl ? (
            <img
              src={tenantInfo.logoUrl}
              alt={tenantInfo.tenantName}
              className="glass-sidebar__logo-img"
            />
          ) : (
            <img
              src="/simbolo.svg"
              alt="Navalhado"
              className="glass-sidebar__logo-fallback"
            />
          )}

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                key="brand-info"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4, transition: { duration: 0.08 } }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="glass-sidebar__brand-info"
              >
                <span className="glass-sidebar__brand-name">{tenantInfo.tenantName}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Links de Navegação */}
        <nav className="glass-sidebar__nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/profissionais' && location.pathname.startsWith('/profissionais/'));

            return (
              <NavItemRow
                key={item.path}
                item={item}
                isActive={isActive}
                isOpen={isOpen}
                onClick={() => navigate(item.path)}
              />
            );
          })}
        </nav>

        {/* Divisor */}
        <div className="glass-sidebar__divider" />

        {/* Rodapé: Notificações, Perfil, Logout e Toggle perfeitamente alinhados */}
        <div className="glass-sidebar__footer">
          {/* Notificações */}
          <NotificationsFooterItem
            isOpen={isOpen}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllAsRead={onMarkAllAsRead}
            onMarkAsRead={onMarkAsRead}
          />

          {/* Dados do Usuário (Apenas Nome) */}
          <UserFooterItem
            isOpen={isOpen}
            managerName={managerName}
          />

          {/* Botão de Sair (Logout) */}
          <div className="glass-sidebar__item">
            <AnimatePresence>
              {!isOpen && logoutHovered && logoutCoords && (
                <motion.div
                  key="logout-tooltip"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.1 }}
                  className="glass-sidebar__tooltip"
                  style={{
                    top: logoutCoords.top,
                    left: logoutCoords.left,
                    transform: 'translateY(-50%)',
                    color: 'var(--color-error, #F05252)',
                  }}
                >
                  Sair da Conta
                </motion.div>
              )}
            </AnimatePresence>

            <button
              ref={logoutBtnRef}
              type="button"
              onClick={onLogout}
              onMouseEnter={handleLogoutMouseEnter}
              onMouseLeave={handleLogoutMouseLeave}
              className="glass-sidebar__button glass-sidebar__button--logout"
              aria-label="Sair da Conta"
            >
              <div className="glass-sidebar__tile">
                <SignOut size={22} weight="regular" style={{ color: 'currentColor' }} />
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.span
                    key="logout-label"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4, transition: { duration: 0.08 } }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="glass-sidebar__label"
                  >
                    Sair
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Botão Toggle (Recolher/Expandir) */}
          <div
            className={`glass-sidebar__toggle-wrapper ${
              isOpen ? 'glass-sidebar__toggle-wrapper--start' : 'glass-sidebar__toggle-wrapper--center'
            }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className="glass-sidebar__toggle"
              aria-label={isOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              title={isOpen ? 'Recolher menu' : 'Expandir menu'}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isOpen ? (
                  <motion.span
                    key="arrow-left"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.14 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowLeft size={18} weight="bold" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="arrow-right"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.14 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowRight size={18} weight="bold" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.div>
    </aside>
  );
};
