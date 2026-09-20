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
import type { TenantContextType } from './GerenteLayout';
import { normalizeBusinessHours } from '../lib/schedule';

/** O que as páginas do barbeiro recebem pelo Outlet: a barbearia e o cadastro de profissional dele. */
export interface BarbeiroContextType extends TenantContextType {
  /** Cadastro de profissional vinculado ao usuário logado; vazio quando o vínculo não existe. */
  professionalId: string;
}

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

  const navLinks = [
    { path: '/minha-agenda', label: 'Agenda', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} /> },
    { path: '/minhas-comissoes', label: 'Comissões', icon: <HugeiconsIcon icon={Money01Icon} size={18} /> },
  ];

  const mobileNavItems: MobileNavItem[] = [
    { id: 'agenda', label: 'Agenda', icon: Calendar03Icon, path: '/minha-agenda' },
    { id: 'comissoes', label: 'Comissões', icon: Money01Icon, path: '/minhas-comissoes' },
    { id: 'perfil', label: 'Sair', icon: Logout01Icon, onClick: handleLogout },
  ];

  return (
    <>
      <div className="noise-overlay" />

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col relative">
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

        {/* CABEÇALHO SUPERIOR DESKTOP (> 768px) */}
        <header className="max-md:hidden flex justify-between items-center px-6 py-3 lg:px-12 bg-[radial-gradient(ellipse_40%_60%_at_15%_50%,rgba(217,108,0,0.05)_0%,transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_50%,rgba(217,108,0,0.03)_0%,transparent_55%),linear-gradient(145deg,rgba(255,255,255,0.78)_0%,rgba(255,241,230,0.5)_45%,rgba(255,255,255,0.72)_100%)] backdrop-blur-[28px] backdrop-saturate-[200%] border-b border-[rgba(255,255,255,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(255,255,255,0.15),0_8px_40px_-8px_rgba(45,35,30,0.1),0_1px_4px_rgba(45,35,30,0.04)] sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <div
            className="flex items-center gap-[0.65rem] shrink-0 cursor-pointer hover:opacity-90"
            onClick={() => navigate('/minha-agenda')}
          >
            <div className="flex items-center justify-center shrink-0">
              <img src="/simbolo.svg" alt="Navalhado" className="w-[34px] h-[34px] block" />
            </div>
            <div className="max-w-[140px] flex items-center">
              <h1 className="text-[0.8125rem] font-bold m-0 leading-[1.15] text-text-primary [text-wrap:balance] line-clamp-2">{tenantName || 'Colaborador'}</h1>
            </div>
          </div>

          {/* Navegação Horizontal - Visível apenas no Desktop */}
          <nav className="flex items-center gap-[0.35rem] bg-[radial-gradient(ellipse_50%_100%_at_30%_50%,rgba(217,108,0,0.04)_0%,transparent_70%),rgba(255,255,255,0.45)] p-1 rounded-lg border border-[rgba(255,255,255,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[12px] backdrop-saturate-[160%]">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 text-sm font-medium px-[1.15rem] py-[0.45rem] rounded-md no-underline border border-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isActive
                      ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.85)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                      : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.55)] hover:border-[rgba(234,222,214,0.6)]'
                  }`}
                >
                  <span className="flex items-center">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Informações do Barbeiro e Botão de Logout */}
          <div className="flex items-center gap-4">
            {/* Sininho de Notificações */}
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
            />

            <div className="flex items-center gap-[0.65rem]">
              <div className="w-[34px] h-[34px] rounded-full bg-brand-soft text-brand-deep flex items-center justify-center font-bold text-sm border-[1.5px] border-[rgba(255,255,255,0.8)] shadow-sm">
                {barberName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text-primary leading-[1.2]">{barberName}</span>
                <span className="text-xs text-text-secondary leading-[1.1]">Barbeiro</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-[0.35rem] bg-transparent border border-error text-error px-[0.8rem] py-[0.4rem] text-xs font-semibold rounded-md cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-error-bg hover:-translate-y-px active:scale-[0.97]"
              title="Sair da conta"
            >
              <HugeiconsIcon icon={Logout01Icon} size={16} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO PRINCIPAL COM ANIMAÇÃO DE ENTRADA SUAVE */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 py-6 md:px-10 md:py-8 flex flex-col max-md:px-[0.875rem] max-md:py-4 max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
          <div key={location.pathname} className="w-full animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <Outlet context={{ ...tenantInfo, professionalId: profissionalId } satisfies BarbeiroContextType} />
          </div>
        </main>

        {/* NAVEGAÇÃO INFERIOR FIXA MOBILE (<= 768px) */}
        <MobileBottomNav items={mobileNavItems} />
      </div>
    </>
  );
};
