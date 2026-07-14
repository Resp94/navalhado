import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { NotificationBell } from './NotificationBell';
import { useToast } from './Toast';
import { ScissorsIcon } from './Icons';

// Interface do Contexto do Tenant a ser compartilhado com as sub-telas
export interface TenantContextType {
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
}

// SVGs de Ícones de Navegação Inline
const CalendarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const CoinsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ListIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </svg>
);

const MessageCircleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

export const GerenteLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<TenantContextType | null>(null);
  const [managerName, setManagerName] = useState('Gerente');

  const { notifications, unreadCount, markAllAsRead, markAsRead } = useRealtimeNotifications({
    tenantId: tenantInfo?.tenantId || '',
  });

  useEffect(() => {
    let isMounted = true;

    const fetchTenantData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/');
          return;
        }

        // 1. Buscar perfil para capturar o tenant_id e o nome do gerente
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('name, tenant_id, role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          throw new Error('Não foi possível carregar as informações do seu perfil.');
        }

        if (profile.role !== 'gerente') {
          addToast('Área restrita para gerentes.', 'warning');
          navigate('/');
          return;
        }

        if (isMounted) {
          setManagerName(profile.name);
        }

        // 2. Se possuir tenant_id, carregar os dados da barbearia
        if (profile.tenant_id) {
          const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id, name, logo_url')
            .eq('id', profile.tenant_id)
            .single();

          if (tenantError || !tenant) {
            throw new Error('Não foi possível carregar os dados da barbearia.');
          }

          if (isMounted) {
            setTenantInfo({
              tenantId: tenant.id,
              tenantName: tenant.name,
              logoUrl: tenant.logo_url
            });
          }
        } else {
          addToast('Esta conta não está vinculada a nenhuma barbearia.', 'error');
          navigate('/');
        }
      } catch (error: any) {
        console.error('Error fetching tenant layout data:', error);
        addToast(error.message || 'Erro ao carregar painel do gerente.', 'error');
        navigate('/');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTenantData();

    return () => {
      isMounted = false;
    };
  }, [navigate, addToast]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      addToast('Logout realizado.', 'success');
      navigate('/');
    } catch (error: any) {
      addToast('Erro ao sair da conta.', 'error');
    }
  };

  if (loading || !tenantInfo) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="skeleton-container" style={{ padding: '2rem' }}>
          <header className="skeleton-header" style={{ height: '60px', borderBottom: '1px solid var(--color-border)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '2rem' }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '120px' }} />)}
          </div>
          <div className="skeleton" style={{ height: '350px', marginTop: '2rem' }} />
        </div>
      </>
    );
  }

  // Lista dos links de navegação para a Navbar
  const navLinks = [
    { path: '/dashboard', label: 'Agenda', icon: <CalendarIcon size={18} /> },
    { path: '/profissionais', label: 'Equipe', icon: <UsersIcon size={18} /> },
    { path: '/servicos/cadastro', label: 'Serviços', icon: <ListIcon size={18} /> },
    { path: '/financeiro', label: 'Financeiro', icon: <CoinsIcon size={18} /> },
    { path: '/whatsapp', label: 'WhatsApp', icon: <MessageCircleIcon size={18} /> },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="gerente-layout">
        {/* NAVBAR SUPERIOR HORIZONTAL */}
        <header className="gerente-header">
          {/* Logo e Nome da Barbearia */}
          <div className="gerente-header__brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            {tenantInfo.logoUrl ? (
              <img 
                src={tenantInfo.logoUrl} 
                alt={tenantInfo.tenantName} 
                className="gerente-header__logo-img" 
              />
            ) : (
              <div className="gerente-header__logo">
                <ScissorsIcon size={20} />
              </div>
            )}
            <div>
              <span className="gerente-header__eyebrow">Painel Barbearia</span>
              <h1 className="gerente-header__title">{tenantInfo.tenantName}</h1>
            </div>
          </div>

          {/* Links Centrais Coesos */}
          <nav className="gerente-header__nav">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/profissionais' && location.pathname.startsWith('/profissionais/'));
              return (
                <Link 
                  key={link.path}
                  to={link.path}
                  className={`gerente-header__nav-link ${isActive ? 'gerente-header__nav-link--active' : ''}`}
                >
                  <span className="gerente-header__nav-icon">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Usuário Logado e Logout */}
          <div className="gerente-header__user">
            {/* Sininho de Notificações */}
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
            />

            <div className="gerente-header__user-info">
              <span className="gerente-header__user-name">{managerName}</span>
              <span className="gerente-header__user-role">Gerente</span>
            </div>
            <button onClick={handleLogout} className="btn btn--outline-danger btn--sm">
              Sair
            </button>
          </div>
        </header>

        {/* CONTAINER DO CONTEÚDO DA PÁGINA */}
        <main className="gerente-container">
          <Outlet context={tenantInfo} />
        </main>
      </div>

      <style>{`
        .gerente-layout {
          min-height: 100vh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
        }

        .gerente-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 2rem;
          /* Liquid glass background — gradient-tinted, refractive */
          background: 
            radial-gradient(ellipse 40% 60% at 15% 50%, rgba(217, 108, 0, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 85% 50%, rgba(217, 108, 0, 0.03) 0%, transparent 55%),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.78) 0%,
              rgba(255, 241, 230, 0.5) 45%,
              rgba(255, 255, 255, 0.72) 100%
            );
          backdrop-filter: blur(28px) saturate(200%);
          -webkit-backdrop-filter: blur(28px) saturate(200%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.15),
            0 8px 40px -8px rgba(45, 35, 30, 0.1),
            0 1px 4px rgba(45, 35, 30, 0.04);
          position: sticky;
          top: 0;
          z-index: 100;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gerente-header__brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gerente-header__brand:hover {
          transform: scale(1.02);
        }

        .gerente-header__logo-img {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          object-fit: cover;
          border: 1px solid var(--color-border);
        }

        .gerente-header__logo {
          background-color: rgba(219, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 0.5rem;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(219, 108, 0, 0.15);
        }

        .gerente-header__logo svg {
          transform: rotate(-45deg);
        }

        .gerente-header__eyebrow {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-brand-primary);
          font-weight: 600;
          display: block;
        }

        .gerente-header__title {
          font-size: var(--font-size-base);
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
          color: var(--color-text-primary);
        }

        .gerente-header__nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: 
            radial-gradient(ellipse 50% 100% at 30% 50%, rgba(217, 108, 0, 0.04) 0%, transparent 70%),
            rgba(255, 255, 255, 0.45);
          padding: 0.25rem;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(12px) saturate(160%);
          -webkit-backdrop-filter: blur(12px) saturate(160%);
        }

        .gerente-header__nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          padding: 0.45rem 1rem;
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gerente-header__nav-link:hover {
          color: var(--color-brand-primary);
          background-color: rgba(255, 255, 255, 0.5);
          border-color: rgba(234, 222, 214, 0.6);
        }

        .gerente-header__nav-link--active {
          color: var(--color-brand-primary);
          background-color: var(--color-bg-secondary);
          border-color: rgba(234, 222, 214, 0.8);
          font-weight: 600;
          box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .gerente-header__nav-link:active {
          transform: scale(0.97);
        }

        .gerente-header__nav-icon {
          display: flex;
          align-items: center;
          color: inherit;
        }

        .gerente-header__user {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .gerente-header__user-info {
          display: flex;
          flex-direction: column;
          text-align: right;
        }

        .gerente-header__user-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
        }

        .gerente-header__user-role {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .gerente-container {
          flex: 1;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .btn--outline-danger {
          border: 1px solid var(--color-error);
          background: transparent;
          color: var(--color-error);
          transition: all 0.2s ease;
        }

        .btn--outline-danger:hover {
          background-color: var(--color-error-bg);
        }

        .btn--sm {
          padding: 0.4rem 0.875rem;
          font-size: var(--font-size-xs);
        }

        @media (max-width: 900px) {
          .gerente-header {
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }
          .gerente-header__nav {
            width: 100%;
            justify-content: space-around;
            overflow-x: auto;
            padding-bottom: 0.25rem;
          }
          .gerente-header__user {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </>
  );
};
