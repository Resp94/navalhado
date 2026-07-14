import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { NotificationBell } from './NotificationBell';

// SVGs de Ícones Inline para garantir que o componente seja autossuficiente e estilizado
const CalendarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </svg>
);

const AwardIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

const LogOutIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);

const ScissorsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="9.8" x2="20" y1="8.2" y2="18.4" />
    <line x1="9.8" x2="20" y1="15.8" y2="5.6" />
  </svg>
);

export const BarbeiroLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [barberName, setBarberName] = useState('Barbeiro');
  const [tenantName, setTenantName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [profissionalId, setProfissionalId] = useState('');

  const { notifications, unreadCount, markAllAsRead, markAsRead } = useRealtimeNotifications({
    tenantId,
    profissionalId,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchBarberData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate('/');
          return;
        }

        // Buscar dados do perfil do barbeiro logado a partir da tabela 'users'
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('name, role, tenant_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          throw new Error('Não foi possível carregar as informações do seu perfil.');
        }

        if (profile.role !== 'barbeiro') {
          addToast('Acesso restrito para colaboradores da barbearia.', 'warning');
          navigate('/');
          return;
        }

        if (isMounted) {
          setBarberName(profile.name);
          if (profile.tenant_id) {
            setTenantId(profile.tenant_id);
          }
        }

        // Se o barbeiro estiver associado a uma barbearia (tenant), buscar o nome dela
        if (profile.tenant_id) {
          const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', profile.tenant_id)
            .single();

          if (!tenantError && tenant && isMounted) {
            setTenantName(tenant.name);
          }
        }

        // Buscar também o ID do profissional associado na tabela professionals
        const { data: profData, error: profError } = await supabase
          .from('professionals')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profError && profData && isMounted) {
          setProfissionalId(profData.id);
        }
      } catch (error: any) {
        console.error('Error fetching barber data:', error);
        addToast(error.message || 'Erro ao obter dados do colaborador.', 'error');
        navigate('/');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBarberData();

    return () => {
      isMounted = false;
    };
  }, [navigate, addToast]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      addToast('Logout realizado com sucesso.', 'success');
      navigate('/');
    } catch (error: any) {
      addToast('Erro ao realizar o logout.', 'error');
    }
  };

  if (loading) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="skeleton-container" style={{ padding: '2rem' }}>
          <header className="skeleton-header" style={{ height: '60px', borderBottom: '1px solid var(--color-border)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginTop: '2rem' }}>
            <div className="skeleton" style={{ height: '100px' }} />
            <div className="skeleton" style={{ height: '300px' }} />
          </div>
        </div>
        <style>{`
          .skeleton-container {
            min-height: 100vh;
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
          }
          .skeleton-header {
            display: flex;
            height: 60px;
            border-bottom: 1px solid var(--color-border);
            width: 100%;
          }
          .skeleton {
            background: linear-gradient(
              90deg,
              var(--color-bg-secondary) 25%,
              var(--color-border) 37%,
              var(--color-bg-secondary) 63%
            );
            background-size: 400% 100%;
            animation: skeleton-loading 1.4s ease infinite;
            border-radius: var(--radius-md);
          }
          @keyframes skeleton-loading {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </>
    );
  }

  const navLinks = [
    { path: '/minha-agenda', label: 'Agenda', icon: <CalendarIcon size={20} /> },
    { path: '/minhas-comissoes', label: 'Comissões', icon: <AwardIcon size={20} /> },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="barbeiro-layout">
        {/* CABEÇALHO SUPERIOR (HEADER) */}
        <header className="barbeiro-header">
          <div className="barbeiro-header__brand" onClick={() => navigate('/minha-agenda')} style={{ cursor: 'pointer' }}>
            <div className="barbeiro-header__logo">
              <ScissorsIcon size={18} />
            </div>
            <div>
              <span className="barbeiro-header__eyebrow">Navalhado</span>
              <h1 className="barbeiro-header__title">{tenantName || 'Colaborador'}</h1>
            </div>
          </div>

          {/* Navegação Horizontal - Visível apenas no Desktop */}
          <nav className="barbeiro-header__nav-desktop">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`barbeiro-header__nav-link ${isActive ? 'barbeiro-header__nav-link--active' : ''}`}
                >
                  <span className="barbeiro-header__nav-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Informações do Barbeiro e Botão de Logout */}
          <div className="barbeiro-header__user-section">
            {/* Sininho de Notificações */}
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
            />

            <div className="barbeiro-header__user-profile">
              <div className="barbeiro-header__avatar">
                {barberName.charAt(0).toUpperCase()}
              </div>
              <div className="barbeiro-header__profile-meta">
                <span className="barbeiro-header__profile-name">{barberName}</span>
                <span className="barbeiro-header__profile-role">Barbeiro</span>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout" title="Sair da conta">
              <LogOutIcon size={18} />
              <span className="logout-text">Sair</span>
            </button>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO PRINCIPAL COM ANIMAÇÃO DE ENTRADA SUAVE */}
        <main className="barbeiro-main">
          <div key={location.pathname} className="barbeiro-route-wrapper">
            <Outlet />
          </div>
        </main>

        {/* NAVEGAÇÃO INFERIOR (BOTTOM NAV) - Visível apenas no Mobile */}
        <nav className="barbeiro-bottom-nav">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`barbeiro-bottom-nav__item ${isActive ? 'barbeiro-bottom-nav__item--active' : ''}`}
              >
                <div className="barbeiro-bottom-nav__icon-box">
                  {link.icon}
                </div>
                <span className="barbeiro-bottom-nav__text">{link.label}</span>
                {isActive && <span className="barbeiro-bottom-nav__dot" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <style>{`
        .barbeiro-layout {
          min-height: 100vh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
          position: relative;
          padding-bottom: 84px; /* Espaço para não sobrepor a Bottom Nav mobile */
        }

        /* Removendo padding do bottom no Desktop */
        @media (min-width: 769px) {
          .barbeiro-layout {
            padding-bottom: 0;
          }
        }

        /* HEADER */
        .barbeiro-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
          /* Liquid glass — gradient-tinted to match GerenteLayout */
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

        @media (min-width: 1024px) {
          .barbeiro-header {
            padding: 0.75rem 3rem;
          }
        }

        .barbeiro-header__brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          transition: transform 0.2s ease;
        }

        .barbeiro-header__brand:hover {
          transform: scale(1.01);
        }

        .barbeiro-header__logo {
          background-color: rgba(219, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 0.5rem;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(219, 108, 0, 0.15);
        }

        .barbeiro-header__logo svg {
          transform: rotate(-45deg);
        }

        .barbeiro-header__eyebrow {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--color-brand-primary);
          font-weight: 700;
          display: block;
        }

        .barbeiro-header__title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
          color: var(--color-text-primary);
        }

        @media (min-width: 640px) {
          .barbeiro-header__title {
            font-size: var(--font-size-base);
          }
        }

        /* NAVEGAÇÃO DESKTOP */
        .barbeiro-header__nav-desktop {
          display: flex;
          align-items: center;
          gap: 0.35rem;
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

        .barbeiro-header__nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          padding: 0.45rem 1.15rem;
          border-radius: var(--radius-md);
          text-decoration: none;
          border: 1px solid transparent;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .barbeiro-header__nav-link:hover {
          color: var(--color-brand-primary);
          background-color: rgba(255, 255, 255, 0.55);
          border-color: rgba(234, 222, 214, 0.6);
        }

        .barbeiro-header__nav-link--active {
          color: var(--color-brand-primary);
          background-color: var(--color-bg-secondary);
          border-color: rgba(234, 222, 214, 0.85);
          font-weight: 600;
          box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .barbeiro-header__nav-icon {
          display: flex;
          align-items: center;
        }

        /* SEÇÃO USUÁRIO E LOGOUT */
        .barbeiro-header__user-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .barbeiro-header__user-profile {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .barbeiro-header__avatar {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--font-size-sm);
          border: 1.5px solid rgba(255, 255, 255, 0.8);
          box-shadow: var(--shadow-sm);
        }

        .barbeiro-header__profile-meta {
          display: flex;
          flex-direction: column;
        }

        .barbeiro-header__profile-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          line-height: 1.2;
        }

        .barbeiro-header__profile-role {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          line-height: 1.1;
        }

        .btn-logout {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: transparent;
          border: 1px solid var(--color-error);
          color: var(--color-error);
          padding: 0.4rem 0.8rem;
          font-size: var(--font-size-xs);
          font-weight: 600;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-logout:hover {
          background-color: var(--color-error-bg);
          transform: translateY(-1px);
        }

        .btn-logout:active {
          transform: scale(0.97);
        }

        /* CONTEÚDO PRINCIPAL */
        .barbeiro-main {
          flex: 1;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 769px) {
          .barbeiro-main {
            padding: 2rem 2.5rem;
          }
        }

        /* TRANSITION/ANIMATION DA ROTA */
        .barbeiro-route-wrapper {
          width: 100%;
          animation: springUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* NAVEGAÇÃO INFERIOR PARA MOBILE */
        .barbeiro-bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .barbeiro-header__nav-desktop {
            display: none; /* Oculta no Mobile */
          }
          
          .barbeiro-header__profile-meta {
            display: none; /* Oculta texto de perfil no mobile */
          }

          .logout-text {
            display: none; /* Oculta texto de logout no mobile */
          }

          .btn-logout {
            padding: 0.45rem;
          }

          .barbeiro-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 68px;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background-color: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px) saturate(140%);
            -webkit-backdrop-filter: blur(20px) saturate(140%);
            border-top: 1px solid rgba(234, 222, 214, 0.7);
            z-index: 1000;
            box-shadow: 0 -4px 20px rgba(45, 35, 30, 0.05);
            justify-content: space-around;
            align-items: center;
          }

          .barbeiro-bottom-nav__item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            height: 100%;
            color: var(--color-text-secondary);
            text-decoration: none;
            position: relative;
            gap: 0.15rem;
            transition: color 0.25s ease;
          }

          .barbeiro-bottom-nav__icon-box {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }

          .barbeiro-bottom-nav__item:active .barbeiro-bottom-nav__icon-box {
            transform: scale(0.85);
          }

          .barbeiro-bottom-nav__item--active {
            color: var(--color-brand-primary);
          }

          .barbeiro-bottom-nav__item--active .barbeiro-bottom-nav__icon-box {
            transform: translateY(-2px) scale(1.1);
          }

          .barbeiro-bottom-nav__text {
            font-size: var(--font-size-xs);
            font-weight: 500;
          }

          .barbeiro-bottom-nav__item--active .barbeiro-bottom-nav__text {
            font-weight: 700;
          }

          .barbeiro-bottom-nav__dot {
            position: absolute;
            bottom: 4px;
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background-color: var(--color-brand-primary);
            box-shadow: 0 0 6px var(--color-brand-soft);
          }
        }
      `}</style>
    </>
  );
};
