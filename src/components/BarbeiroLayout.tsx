import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { useRealtimeNotifications } from '../lib/useRealtimeNotifications';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  Money01Icon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';
import { MobileBottomNav, type MobileNavItem } from './mobile/MobileBottomNav';
import { MobileHeader } from './mobile/MobileHeader';
import { GlassSidebar, type NavItemConfig } from './GlassSidebar';
import type { TenantContextType } from './GerenteLayout';
import { normalizeBusinessHours } from '../lib/schedule';

/** O que as páginas do barbeiro recebem pelo Outlet: a barbearia e o cadastro de profissional dele. */
export interface BarbeiroContextType extends TenantContextType {
  /** Cadastro de profissional vinculado ao usuário logado; vazio quando o vínculo não existe. */
  professionalId: string;
  /** Nome do usuário barbeiro, para os títulos das telas dele. */
  professionalName: string;
}

const BARBEIRO_NAV_ITEMS: NavItemConfig[] = [
  {
    path: '/minha-agenda',
    label: 'Agenda',
    renderIcon: ({ size }) => <HugeiconsIcon icon={Calendar03Icon} size={size} />,
  },
  {
    path: '/minhas-comissoes',
    label: 'Comissões',
    renderIcon: ({ size }) => <HugeiconsIcon icon={Money01Icon} size={size} />,
  },
];

export const BarbeiroLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [barberName, setBarberName] = useState('Barbeiro');
  const [tenantInfo, setTenantInfo] = useState<TenantContextType | null>(null);
  const [profissionalId, setProfissionalId] = useState('');
  const tenantId = tenantInfo?.tenantId ?? '';
  const tenantName = tenantInfo?.tenantName ?? '';

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
        }

        // A barbearia vem do vínculo do usuário, nunca de URL ou de estado do navegador.
        if (!profile.tenant_id) {
          throw new Error('Esta conta não está vinculada a nenhuma barbearia.');
        }

        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, slug, logo_url, timezone, business_hours, slot_interval_minutes, min_booking_lead_time_minutes, min_cancellation_lead_time_minutes')
          .eq('id', profile.tenant_id)
          .single();

        if (tenantError || !tenant) {
          throw new Error('Não foi possível carregar os dados da barbearia.');
        }

        // Cadastro de profissional associado ao usuário. Sem ele, a agenda mostra o aviso de vínculo.
        const { data: profData } = await supabase
          .from('professionals')
          .select('id')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (isMounted) {
          setProfissionalId(profData?.id ?? '');
          setTenantInfo({
            tenantId: tenant.id,
            tenantName: tenant.name,
            slug: tenant.slug || undefined,
            logoUrl: tenant.logo_url,
            timezone: tenant.timezone || 'America/Sao_Paulo',
            onboardingCompleted: true,
            businessHours: normalizeBusinessHours(tenant.business_hours),
            slotIntervalMinutes: tenant.slot_interval_minutes ?? 30,
            minBookingLeadTimeMinutes: tenant.min_booking_lead_time_minutes ?? 15,
            minCancellationLeadTimeMinutes: tenant.min_cancellation_lead_time_minutes ?? 120,
          });
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

  if (loading || !tenantInfo) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="min-h-screen bg-bg-primary text-text-primary p-8 flex flex-col gap-8">
          <header className="flex h-[60px] w-full border-b border-border" />
          <div className="grid grid-cols-1 gap-6 mt-8">
            <div className="h-[100px] rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            <div className="h-[300px] rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
          </div>
        </div>
      </>
    );
  }

  const mobileNavItems: MobileNavItem[] = [
    { id: 'agenda', label: 'Agenda', icon: Calendar03Icon, path: '/minha-agenda' },
    { id: 'comissoes', label: 'Comissões', icon: Money01Icon, path: '/minhas-comissoes' },
    { id: 'perfil', label: 'Sair', icon: Logout01Icon, onClick: handleLogout },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-row max-md:flex-col relative">
        {/* HEADER MOBILE (<= 768px) */}
        <MobileHeader
          tenantName={tenantName || 'Barbeiro'}
          logoUrl={tenantInfo.logoUrl}
          homePath="/minha-agenda"
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
        />

        {/* SIDEBAR RETRÁTIL DESKTOP (> 768px) */}
        <GlassSidebar
          items={BARBEIRO_NAV_ITEMS}
          homePath="/minha-agenda"
          tenantName={tenantName || 'Barbeiro'}
          logoUrl={tenantInfo.logoUrl}
          userName={barberName}
          userRole="Barbeiro"
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
          onLogout={handleLogout}
        />

        {/* ÁREA DE CONTEÚDO PRINCIPAL COM ANIMAÇÃO DE ENTRADA SUAVE */}
        <main className="flex-1 w-full min-w-0 max-w-[1440px] mx-auto px-4 py-6 md:px-8 md:py-6 flex flex-col max-md:px-[0.875rem] max-md:py-4 max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
          <div key={location.pathname} className="w-full animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <Outlet context={{ ...tenantInfo, professionalId: profissionalId, professionalName: barberName } satisfies BarbeiroContextType} />
          </div>
        </main>

        {/* NAVEGAÇÃO INFERIOR FIXA MOBILE (<= 768px) */}
        <MobileBottomNav items={mobileNavItems} />
      </div>
    </>
  );
};
