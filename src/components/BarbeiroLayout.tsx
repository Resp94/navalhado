import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { NotificationBell } from './NotificationBell';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  Money01Icon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';
import { MobileBottomNav, type MobileNavItem } from './mobile/MobileBottomNav';
import { MobileHeader } from './mobile/MobileHeader';

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
    { path: '/minha-agenda', label: 'Agenda', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} /> },
    { path: '/minhas-comissoes', label: 'Comissões', icon: <HugeiconsIcon icon={Money01Icon} size={18} /> },
  ];

  const mobileNavItems: MobileNavItem[] = [
    { id: 'agenda', label: 'Minha Agenda', icon: Calendar03Icon, path: '/minha-agenda' },
    { id: 'comissoes', label: 'Comissões', icon: Money01Icon, path: '/minhas-comissoes' },
    { id: 'perfil', label: 'Sair', icon: Logout01Icon, onClick: handleLogout },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="barbeiro-layout">
        {/* HEADER MOBILE (<= 768px) */}
        <MobileHeader
          tenantName={tenantName || 'Barbeiro'}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
        />

        {/* CABEÇALHO SUPERIOR DESKTOP (> 768px) */}
        <header className="barbeiro-header">
          <div className="barbeiro-header__brand" onClick={() => navigate('/minha-agenda')} style={{ cursor: 'pointer' }}>
            <div className="barbeiro-header__logo">
              <img src="/simbolo.svg" alt="Navalhado" style={{ width: '34px', height: '34px', display: 'block' }} />
            </div>
            <div className="barbeiro-header__title-container">
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
              <HugeiconsIcon icon={Logout01Icon} size={16} />
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

        {/* NAVEGAÇÃO INFERIOR FIXA MOBILE (<= 768px) */}
        <MobileBottomNav items={mobileNavItems} />
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
          flex-shrink: 0;
        }

        .barbeiro-header__brand:hover {
          opacity: 0.9;
        }

        .barbeiro-header__logo {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .barbeiro-header__title-container {
          max-width: 140px;
          display: flex;
          align-items: center;
        }

        .barbeiro-header__title {
          font-size: 0.8125rem;
          font-weight: 700;
          margin: 0;
          line-height: 1.15;
          color: var(--color-text-primary);
          text-wrap: balance;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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
          .barbeiro-header {
            display: none !important;
          }
          .barbeiro-main {
            padding: 1rem 0.875rem calc(4.5rem + env(safe-area-inset-bottom, 0px)) 0.875rem;
          }
        }
      `}</style>
    </>
  );
};
