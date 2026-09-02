import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { normalizeBusinessHours } from '../lib/schedule';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { useToast } from './Toast';
import { GlassSidebar } from './GlassSidebar';

// Interface do Contexto do Tenant a ser compartilhado com as sub-telas
export interface TenantContextType {
  tenantId: string;
  tenantName: string;
  slug?: string;
  logoUrl: string | null;
  timezone: string;
  onboardingCompleted?: boolean;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  slotIntervalMinutes?: number;
  minBookingLeadTimeMinutes?: number;
  minCancellationLeadTimeMinutes?: number;
  refreshTenant?: () => Promise<void>;
}

import {
  Calendar03Icon,
  UserIcon,
  Money01Icon,
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
          .select('id, name, slug, logo_url, timezone, onboarding_completed, business_hours, slot_interval_minutes, min_booking_lead_time_minutes, min_cancellation_lead_time_minutes')
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
          slug: tenant.slug || undefined,
          logoUrl: tenant.logo_url,
          timezone: tenant.timezone || 'America/Sao_Paulo',
          onboardingCompleted: isOnboardingCompleted,
          businessHours: normalizeBusinessHours(tenant.business_hours),
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

        {/* SIDEBAR RETRÁTIL DESKTOP (> 768px) */}
        <GlassSidebar
          tenantInfo={tenantInfo}
          managerName={managerName}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
          onLogout={handleLogout}
        />

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
          tenantSlug={tenantInfo.slug}
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
          flex-direction: row;
        }

        .gerente-container {
          flex: 1;
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          min-width: 0;
          box-sizing: border-box;
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
          .gerente-layout {
            flex-direction: column;
          }
          .gerente-container {
            padding: 1rem 0.875rem calc(4.5rem + env(safe-area-inset-bottom, 0px)) 0.875rem;
            gap: 1rem;
          }
        }
      `}</style>
    </>
  );
};

