import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { NotificationBell } from './NotificationBell';
import { useToast } from './Toast';

// Interface do Contexto do Tenant a ser compartilhado com as sub-telas
export interface TenantContextType {
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
  timezone: string;
  onboardingCompleted?: boolean;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  slotIntervalMinutes?: number;
  minBookingLeadTimeMinutes?: number;
  minCancellationLeadTimeMinutes?: number;
  refreshTenant?: () => Promise<void>;
}

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  UserIcon,
  UserGroupIcon,
  ScissorIcon,
  PackageIcon,
  Money01Icon,
  WhatsappIcon,
  Settings02Icon,
  Invoice01Icon,
  Menu01Icon,
} from '@hugeicons/core-free-icons';
import { MobileBottomNav, type MobileNavItem } from './mobile/MobileBottomNav';
import { MobileHeader } from './mobile/MobileHeader';
import { MobileMaisDrawer } from './mobile/MobileMaisDrawer';

export const GerenteLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<TenantContextType | null>(null);
  const [managerName, setManagerName] = useState('Gerente');
  const [isMaisOpen, setIsMaisOpen] = useState(false);

  const { notifications, unreadCount, markAllAsRead, markAsRead } = useRealtimeNotifications({
    tenantId: tenantInfo?.tenantId || '',
    isGerente: true,
  });

  const fetchTenantData = React.useCallback(async () => {
    try {
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

      setManagerName(profile.name);

      // 2. Se possuir tenant_id, carregar os dados da barbearia
      if (profile.tenant_id) {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, logo_url, timezone, onboarding_completed, business_hours, slot_interval_minutes, min_booking_lead_time_minutes, min_cancellation_lead_time_minutes')
          .eq('id', profile.tenant_id)
          .single();

        if (tenantError || !tenant) {
          throw new Error('Não foi possível carregar os dados da barbearia.');
        }

        const isOnboardingCompleted = Boolean(tenant.onboarding_completed);

        if (!isOnboardingCompleted && location.pathname !== '/onboarding') {
          navigate('/onboarding');
          return;
        }

        if (isOnboardingCompleted && location.pathname === '/onboarding') {
          navigate('/agenda');
          return;
        }

        setTenantInfo({
          tenantId: tenant.id,
          tenantName: tenant.name,
          logoUrl: tenant.logo_url,
          timezone: tenant.timezone || 'America/Sao_Paulo',
          onboardingCompleted: isOnboardingCompleted,
          businessHours: tenant.business_hours || undefined,
          slotIntervalMinutes: tenant.slot_interval_minutes ?? 30,
          minBookingLeadTimeMinutes: tenant.min_booking_lead_time_minutes ?? 15,
          minCancellationLeadTimeMinutes: tenant.min_cancellation_lead_time_minutes ?? 120,
          refreshTenant: fetchTenantData,
        });
      } else {
        addToast('Esta conta não está vinculada a nenhuma barbearia.', 'error');
        navigate('/');
      }
    } catch (error: any) {
      console.error('Error fetching tenant layout data:', error);
      addToast(error.message || 'Erro ao carregar painel do gerente.', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname, addToast]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  // Realtime subscription para atualização de configurações do tenant
  useEffect(() => {
    if (!tenantInfo?.tenantId || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`tenant-updates-${tenantInfo.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantInfo.tenantId}`,
        },
        () => {
          fetchTenantData();
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [tenantInfo?.tenantId, fetchTenantData]);

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

  if (location.pathname === '/onboarding') {
    return (
      <div className="onboarding-layout" style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#f4f4f5' }}>
        <Outlet context={tenantInfo} />
      </div>
    );
  }

  // Lista dos links de navegação para a Navbar
  const navLinks = [
    { path: '/agenda', label: 'Agenda', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} /> },
    { path: '/clientes', label: 'Clientes', icon: <HugeiconsIcon icon={UserIcon} size={18} /> },
    { path: '/profissionais', label: 'Equipe', icon: <HugeiconsIcon icon={UserGroupIcon} size={18} /> },
    { path: '/servicos/cadastro', label: 'Serviços', icon: <HugeiconsIcon icon={ScissorIcon} size={18} /> },
    { path: '/produtos', label: 'Produtos', icon: <HugeiconsIcon icon={PackageIcon} size={18} /> },
    { path: '/financeiro', label: 'Financeiro', icon: <HugeiconsIcon icon={Money01Icon} size={18} /> },
    { path: '/whatsapp', label: 'WhatsApp', icon: <HugeiconsIcon icon={WhatsappIcon} size={18} /> },
    { path: '/configuracoes', label: 'Ajustes', icon: <HugeiconsIcon icon={Settings02Icon} size={18} /> },
  ];

  // 5 Abas Fixas da Bottom Navigation Bar Mobile
  const mobileNavItems: MobileNavItem[] = [
    { id: 'agenda', label: 'Agenda', icon: Calendar03Icon, path: '/agenda' },
    { id: 'comandas', label: 'Comandas', icon: Invoice01Icon, path: '/comandas' },
    { id: 'caixa', label: 'Caixa', icon: Money01Icon, path: '/financeiro' },
    { id: 'clientes', label: 'Clientes', icon: UserIcon, path: '/clientes' },
    { id: 'mais', label: 'Mais', icon: Menu01Icon, onClick: () => setIsMaisOpen(true) },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="gerente-layout">
        {/* HEADER MOBILE (<= 768px) */}
        <MobileHeader
          tenantName={tenantInfo.tenantName}
          logoUrl={tenantInfo.logoUrl}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
        />

        {/* NAVBAR SUPERIOR HORIZONTAL DESKTOP (> 768px) */}
        <header className="gerente-header">
          {/* Logo e Nome da Barbearia */}
          <div className="gerente-header__brand" onClick={() => navigate('/agenda')} style={{ cursor: 'pointer' }}>
            {tenantInfo.logoUrl ? (
              <img 
                src={tenantInfo.logoUrl} 
                alt={tenantInfo.tenantName} 
                className="gerente-header__logo-img" 
              />
            ) : (
              <div className="gerente-header__logo">
                <img src="/simbolo.svg" alt="Navalhado" style={{ width: '36px', height: '36px', display: 'block' }} />
              </div>
            )}
            <div className="gerente-header__title-container">
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

        {/* BARRA INFERIOR FIXA MOBILE (<= 768px) */}
        <MobileBottomNav items={mobileNavItems} />

        {/* GAVETA DO MENU MAIS MOBILE */}
        <MobileMaisDrawer
          isOpen={isMaisOpen}
          onClose={() => setIsMaisOpen(false)}
          tenantId={tenantInfo.tenantId}
          tenantName={tenantInfo.tenantName}
          managerName={managerName}
          businessHours={tenantInfo.businessHours}
          onLogout={handleLogout}
        />
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
          gap: 0.65rem;
          text-decoration: none;
          flex-shrink: 0;
        }

        .gerente-header__brand:hover {
          opacity: 0.9;
        }

        .gerente-header__logo-img {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          object-fit: cover;
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .gerente-header__logo {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .gerente-header__title-container {
          max-width: 140px;
          display: flex;
          align-items: center;
        }

        .gerente-header__title {
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

        @media (max-width: 768px) {
          .gerente-header {
            display: none !important;
          }
          .gerente-container {
            padding: 1rem 0.875rem calc(4.5rem + env(safe-area-inset-bottom, 0px)) 0.875rem;
            gap: 1rem;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
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
