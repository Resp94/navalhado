import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SignOut,
  User,
  Bell,
  Check,
  ArrowRight,
  ArrowLeft,
} from '@phosphor-icons/react';
import type { Notification } from '../lib/useRealtimeNotifications';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 250;

/* Glassmorphism "Vidro Líquido" Navalhado — preservado do GlassSidebar.css original.
   Combinação de gradientes que valor Tailwind padrão não expressa: usa arbitrário. */
const GLASS_SURFACE_CLASSES =
  'bg-[radial-gradient(ellipse_70%_50%_at_20%_10%,rgba(217,108,0,0.06)_0%,transparent_70%),radial-gradient(ellipse_60%_40%_at_80%_90%,rgba(217,108,0,0.04)_0%,transparent_60%),linear-gradient(155deg,rgba(255,255,255,0.82)_0%,rgba(255,246,240,0.72)_50%,rgba(255,255,255,0.78)_100%)] backdrop-blur-[28px] backdrop-saturate-[190%] border border-[rgba(255,255,255,0.85)] shadow-[0_12px_36px_-6px_rgba(45,35,30,0.09),0_2px_8px_rgba(45,35,30,0.04),inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_-1px_1px_rgba(234,222,214,0.5)] transition-[border-color,box-shadow] duration-200 ease-in';

export interface NavItemConfig {
  path: string;
  label: string;
  /** Mantém o item ativo também nas subrotas (`path/...`). */
  matchPrefix?: boolean;
  renderIcon: (props: { size: number; isBold: boolean }) => React.ReactNode;
}

export interface GlassSidebarProps {
  items: NavItemConfig[];
  homePath: string;
  tenantName: string;
  logoUrl?: string | null;
  userName: string;
  userRole: string;
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
    <div className="relative flex w-full h-10 min-h-10 max-h-10 items-center box-border shrink-0">
      {/* Tooltip flutuante quando recolhido */}
      <AnimatePresence>
        {!isOpen && hovered && coords && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md px-3 py-[0.4rem] text-xs font-semibold text-text-primary font-base bg-[rgba(255,255,255,0.94)] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[rgba(234,222,214,0.9)] shadow-[0_8px_24px_rgba(45,35,30,0.12),0_2px_6px_rgba(45,35,30,0.04)]"
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
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center gap-2.5 w-full h-10 min-h-10 max-h-10 bg-transparent border-none outline-none cursor-pointer p-0 text-text-secondary no-underline font-base box-border transition-colors duration-100 ease-in relative overflow-hidden hover:text-text-primary ${isActive ? 'text-black' : ''}`}
        aria-label={item.label}
      >
        <div className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 rounded-lg flex items-center justify-center shrink-0 box-border bg-transparent border-none shadow-none relative text-inherit self-center">
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
              className={`text-sm font-normal text-inherit whitespace-nowrap overflow-hidden text-ellipsis leading-none font-base shrink-0 ${isActive ? 'font-semibold' : ''}`}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Ponto Circular Laranja: posicionado ao lado do ícone no estado recolhido (right: 4px) e na borda no estado expandido (right: 16px) */}
        {isActive && (
          <motion.div
            layoutId="activeSidebarDot"
            className="absolute right-4 top-[17px] w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_6px_rgba(217,108,0,0.45)] pointer-events-none shrink-0"
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
    <div className="relative flex w-full h-10 min-h-10 max-h-10 items-center box-border shrink-0" ref={dropdownRef}>
      {/* Tooltip flutuante quando recolhido */}
      <AnimatePresence>
        {!isOpen && hovered && !dropdownOpen && coords && (
          <motion.div
            key="notif-tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md px-3 py-[0.4rem] text-xs font-semibold text-text-primary font-base bg-[rgba(255,255,255,0.94)] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[rgba(234,222,214,0.9)] shadow-[0_8px_24px_rgba(45,35,30,0.12),0_2px_6px_rgba(45,35,30,0.04)]"
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
        className={`flex items-center gap-2.5 w-full h-10 min-h-10 max-h-10 bg-transparent border-none outline-none cursor-pointer p-0 text-text-secondary no-underline font-base box-border transition-colors duration-100 ease-in relative overflow-hidden hover:text-text-primary ${dropdownOpen ? 'text-black' : ''}`}
        aria-label="Notificações"
      >
        <div className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 rounded-lg flex items-center justify-center shrink-0 box-border bg-transparent border-none shadow-none relative text-inherit self-center">
          <Bell size={22} weight={dropdownOpen ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
          {unreadCount > 0 && (
            <span className="absolute top-[3px] right-[3px] bg-brand-primary text-white text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-[3px] border-2 border-[rgba(255,255,255,0.95)] shadow-[0_1px_4px_rgba(217,108,0,0.35)] leading-none box-border">
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
              className="text-sm font-normal text-inherit whitespace-nowrap overflow-hidden text-ellipsis leading-none font-base shrink-0"
            >
              Notificações
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown de Notificações */}
      {dropdownOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute left-[calc(100%+12px)] bottom-0 w-[360px] max-w-[90vw] bg-[rgba(255,255,255,0.96)] backdrop-blur-[24px] backdrop-saturate-[180%] border border-[rgba(234,222,214,0.9)] rounded-xl shadow-[0_16px_40px_rgba(45,35,30,0.15),0_4px_12px_rgba(45,35,30,0.06)] z-[9999] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-b-[rgba(45,35,30,0.08)]">
            <h3 className="m-0 text-base font-semibold text-text-primary font-base">Notificações</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="bg-none border-none text-brand-primary text-xs font-semibold cursor-pointer px-2 py-1 rounded-sm transition-colors duration-150 ease-in hover:text-brand-hover hover:bg-[rgba(217,108,0,0.08)]"
                aria-label="Marcar todas como lidas"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-9 px-5 text-center flex flex-col items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[rgba(217,108,0,0.08)] flex items-center justify-center text-brand-primary">
                  <Bell size={22} weight="regular" />
                </div>
                <div>
                  <p className="m-0 font-semibold text-text-primary text-sm">Nenhuma notificação por aqui</p>
                  <p className="mt-1 text-xs text-text-secondary">Você está em dia com as suas novidades.</p>
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4.5 py-3 border-b border-b-[rgba(45,35,30,0.06)] flex gap-2.5 relative transition-colors duration-150 ease-in hover:bg-[rgba(45,35,30,0.03)] ${!n.read ? 'bg-[rgba(217,108,0,0.04)] border-l-[3px] border-l-brand-primary' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="m-0 text-sm font-semibold text-text-primary">{n.title}</h4>
                      <span className="text-[10px] text-text-secondary whitespace-nowrap">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">{n.message}</p>
                  </div>

                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead(n.id)}
                      className="bg-none border-none text-brand-primary cursor-pointer p-1.5 flex items-center justify-center rounded-full self-center transition-colors duration-150 ease-in hover:bg-[rgba(217,108,0,0.1)] hover:text-brand-hover"
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
        </motion.div>
      )}
    </div>
  );
}

function UserFooterItem({
  isOpen,
  userName,
}: {
  isOpen: boolean;
  userName: string;
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
      className="relative flex w-full h-10 min-h-10 max-h-10 items-center box-border shrink-0"
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
            className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md px-3 py-[0.4rem] text-xs font-semibold text-text-primary font-base bg-[rgba(255,255,255,0.94)] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[rgba(234,222,214,0.9)] shadow-[0_8px_24px_rgba(45,35,30,0.12),0_2px_6px_rgba(45,35,30,0.04)]"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateY(-50%)',
            }}
          >
            {userName}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2.5 w-full h-10 min-h-10 max-h-10 p-0 box-border text-text-secondary overflow-hidden">
        <div className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 rounded-lg flex items-center justify-center shrink-0 box-border bg-transparent border-none shadow-none relative text-inherit self-center">
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
              className="flex flex-col justify-center min-w-0 overflow-hidden whitespace-nowrap"
            >
              <span
                className="text-sm font-semibold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2]"
                title={userName}
              >
                {userName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const GlassSidebar: React.FC<GlassSidebarProps> = ({
  items,
  homePath,
  tenantName,
  logoUrl,
  userName,
  userRole,
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
    <aside
      className="sticky top-0 h-dvh z-[90] pt-4 pb-4 pl-4 flex flex-col shrink-0 box-border max-[768px]:hidden"
      aria-label={`Navegação Principal do ${userRole}`}
    >
      <motion.div
        className={`relative h-full max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl py-3.5 px-2 box-border overflow-visible ${GLASS_SURFACE_CLASSES}`}
        animate={{ width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        initial={false}
      >
        {/* Marca / Barbearia: Apenas a Logo e Nome da Barbearia sem container branco */}
        <button
          type="button"
          onClick={() => navigate(homePath)}
          className="flex items-center gap-2.5 bg-transparent border-none border-b border-b-[rgba(45,35,30,0.06)] p-0 h-15 min-h-15 max-h-15 cursor-pointer text-left w-full text-text-primary font-base mb-2 box-border overflow-hidden shrink-0"
          title={tenantName}
          aria-label={`Página inicial de ${tenantName}`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={tenantName}
              className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 rounded-md object-cover shrink-0 self-center"
            />
          ) : (
            <img
              src="/simbolo.svg"
              alt="Navalhado"
              className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 object-contain shrink-0 p-0.5 box-border self-center"
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
                className="flex flex-col justify-center flex-1 min-w-0 overflow-hidden"
              >
                <span className="text-sm font-bold text-text-primary whitespace-normal [overflow-wrap:break-word] leading-[1.25] line-clamp-3 overflow-hidden">
                  {tenantName}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Links de Navegação */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden py-0.5 box-border [scrollbar-width:thin] [scrollbar-color:transparent_transparent] transition-[scrollbar-color] duration-200 ease-in hover:[scrollbar-color:rgba(45,35,30,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[4px] [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(45,35,30,0.2)]">
          {items.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (!!item.matchPrefix && location.pathname.startsWith(`${item.path}/`));

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
        <div className="w-full h-px min-h-px max-h-px bg-[rgba(45,35,30,0.08)] my-2 shrink-0" />

        {/* Rodapé: Notificações, Perfil, Logout e Toggle perfeitamente alinhados */}
        <div className="flex flex-col gap-1 shrink-0 mt-auto pt-1 box-border">
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
            userName={userName}
          />

          {/* Botão de Sair (Logout) */}
          <div className="relative flex w-full h-10 min-h-10 max-h-10 items-center box-border shrink-0">
            <AnimatePresence>
              {!isOpen && logoutHovered && logoutCoords && (
                <motion.div
                  key="logout-tooltip"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.1 }}
                  className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md px-3 py-[0.4rem] text-xs font-semibold text-error font-base bg-[rgba(255,255,255,0.94)] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[rgba(234,222,214,0.9)] shadow-[0_8px_24px_rgba(45,35,30,0.12),0_2px_6px_rgba(45,35,30,0.04)]"
                  style={{
                    top: logoutCoords.top,
                    left: logoutCoords.left,
                    transform: 'translateY(-50%)',
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
              className="flex items-center gap-2.5 w-full h-10 min-h-10 max-h-10 bg-transparent border-none outline-none cursor-pointer p-0 text-text-secondary no-underline font-base box-border transition-colors duration-100 ease-in relative overflow-hidden hover:text-error"
              aria-label="Sair da Conta"
            >
              <div className="w-10 h-10 min-w-10 max-w-10 min-h-10 max-h-10 rounded-lg flex items-center justify-center shrink-0 box-border bg-transparent border-none shadow-none relative text-inherit self-center">
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
                    className="text-sm font-normal text-inherit whitespace-nowrap overflow-hidden text-ellipsis leading-none font-base shrink-0"
                  >
                    Sair
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Botão Toggle (Recolher/Expandir) */}
          <div
            className={`flex items-center w-full h-9 min-h-9 max-h-9 mt-1 shrink-0 ${
              isOpen ? 'justify-start' : 'justify-center'
            }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center justify-center w-10 h-9 min-w-10 max-w-10 min-h-9 max-h-9 rounded-lg bg-[rgba(45,35,30,0.05)] border border-[rgba(45,35,30,0.08)] text-text-secondary cursor-pointer outline-none transition-colors duration-150 ease-in shrink-0 hover:bg-[rgba(217,108,0,0.12)] hover:border-[rgba(217,108,0,0.3)] hover:text-brand-primary"
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
                    className="flex items-center justify-center"
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
                    className="flex items-center justify-center"
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
