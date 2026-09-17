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
        <div className="min-h-screen bg-bg-primary text-text-primary p-8 flex flex-col gap-8">
          <header className="flex h-[60px] w-full border-b border-border" />
          <div className="grid grid-cols-4 gap-6 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[120px] rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            ))}
          </div>
          <div className="h-[350px] mt-8 rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
        </div>
      </>
    );
  }

  if (location.pathname === '/onboarding') {
    return (
      <div className="min-h-screen bg-[#09090b] text-[#f4f4f5]">
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

  const isAgenda = location.pathname.startsWith('/agenda');

  return (
    <>
      <div className="noise-overlay" />

      <div
        className={`min-h-screen bg-bg-primary text-text-primary flex flex-row max-md:flex-col ${
          isAgenda ? 'h-dvh max-h-dvh overflow-hidden max-md:h-auto max-md:max-h-none max-md:overflow-visible' : ''
        }`}
      >
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
        <main
          className={
            isAgenda
              ? 'flex-1 w-full mx-auto flex flex-col min-w-0 box-border h-dvh max-h-dvh max-w-full m-0 pt-4 pr-6 pb-4 pl-4 overflow-hidden gap-0 static top-0 left-0 max-md:h-auto max-md:max-h-none max-md:overflow-visible max-md:px-[0.875rem] max-md:pt-4 max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] max-md:gap-4'
              : 'flex-1 w-full mx-auto flex flex-col min-w-0 box-border max-w-[1440px] px-8 py-6 gap-6 max-lg:relative max-lg:top-[-8px] max-md:static max-md:top-0 max-md:px-[0.875rem] max-md:pt-4 max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] max-md:gap-4'
          }
        >
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
    </>
  );
};

