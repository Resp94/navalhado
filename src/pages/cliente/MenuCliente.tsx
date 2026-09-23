import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { LegalModal } from '../../components/legal/LegalModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  WhatsappIcon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';

import { useCanalCliente } from '../../modules/canal-cliente/useCanalCliente';
import type { PerfilClienteCanal, AgendamentoCanal } from '../../modules/canal-cliente/types';
import { AgendamentoRegraCancelamentoError } from '../../modules/canal-cliente/errors';
import { formatLeadTime } from '../../lib/timezone';

// Componentes modulares
import { BannerNovoAgendamento } from '../../components/cliente/BannerNovoAgendamento';
import { CardAgendamentoAtivo } from '../../components/cliente/CardAgendamentoAtivo';
import { TimelineHistoricoAgendamentos } from '../../components/cliente/TimelineHistoricoAgendamentos';
import { ModalCancelamentoAgendamento } from '../../components/cliente/ModalCancelamentoAgendamento';
import { ClienteBottomNav } from '../../components/cliente/ClienteBottomNav';

const PUBLIC_TOKEN_STORAGE_PREFIX = 'navalhado_canal_cliente_v1_token_';
const publicTokenStorageKey = (slug: string): string =>
  `${PUBLIC_TOKEN_STORAGE_PREFIX}${encodeURIComponent(slug.trim().toLowerCase())}`;

export const MenuCliente: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const canalClienteRepository = useCanalCliente();

  const [appointments, setAppointments] = useState<AgendamentoCanal[]>([]);
  const [customerDetails, setCustomerDetails] = useState<PerfilClienteCanal | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingPublicSession, setUsingPublicSession] = useState(false);

  // Estados de Cancelamento
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [legalModalMode, setLegalModalMode] = useState<'privacy' | 'terms' | null>(null);

  // Estados de Prazo Expirado / Redirecionamento WhatsApp
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [expiredAppointment, setExpiredAppointment] = useState<AgendamentoCanal | null>(null);

  // Abas: Próximos horários vs Anteriores
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');

  const timezone = customerDetails?.tenant_timezone || 'America/Sao_Paulo';

  // "Próximo" é só o que ainda está por vir: pendente ou confirmado, com o horário ainda à frente.
  // Cancelado, concluído, não compareceu, ou um pendente/confirmado cujo horário já passou (a recepção
  // ainda não atualizou o status) vão para o histórico — nada disso é mais coisa a fazer para o cliente.
  const activeAppointments = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((app) => (app.status === 'pending' || app.status === 'confirmed') && new Date(app.start_time).getTime() >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [appointments]);

  const historicAppointments = useMemo(() => {
    const activeIds = new Set(activeAppointments.map((app) => app.appointment_id));
    return appointments
      .filter((app) => !activeIds.has(app.appointment_id))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [appointments, activeAppointments]);

  useEffect(() => {
    const init = async () => {
      try {
        const explicitToken = searchParams.get('token') || routeToken;
        if (explicitToken) {
          canalClienteRepository.definirTokenAcesso(explicitToken);
          navigate('/cliente/menu', { replace: true });
          return;
        }

        const publicSessionCustomer = await canalClienteRepository.obterPerfilPublicoSessao();
        if (publicSessionCustomer) {
          setUsingPublicSession(true);
          setCustomerDetails(publicSessionCustomer);
          await fetchAppointments(true);
          return;
        }

        const storedToken = canalClienteRepository.obterTokenAcesso();
        if (!storedToken) {
          navigate('/cliente/acesso-expirado');
          return;
        }

        const customer = await canalClienteRepository.obterPerfil(storedToken);
        if (!customer) {
          navigate('/cliente/acesso-expirado');
          return;
        }

        if (!customer.cadastro_completo) {
          navigate('/cliente/agendar', { replace: true });
          return;
        }

        setCustomerDetails(customer);
        await fetchAppointments(false);
      } catch (err) {
        console.error('Erro geral no menu do cliente:', err);
        navigate('/cliente/acesso-expirado');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [searchParams, routeToken, navigate, canalClienteRepository]);

  const fetchAppointments = async (publicSession = usingPublicSession) => {
    try {
      const todos = publicSession
        ? await canalClienteRepository.obterAgendamentosPublicoSessao()
        : (await canalClienteRepository.obterAgendamentosSeparados()).todos;
      setAppointments(todos);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      addToast('Erro ao carregar seus agendamentos.', 'error');
    }
  };

  const handleCancelClick = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!activeAppointmentId) return;

    setCanceling(true);
    try {
      if (usingPublicSession) {
        await canalClienteRepository.cancelarAgendamentoPublicoSessao(activeAppointmentId, cancelReason.trim() || undefined);
      } else {
        await canalClienteRepository.cancelarAgendamento(activeAppointmentId, cancelReason.trim() || undefined);
      }

      addToast('Agendamento cancelado com sucesso.', 'success');
      setIsCancelModalOpen(false);
      await fetchAppointments();
    } catch (err: unknown) {
      console.error('Erro ao cancelar agendamento:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isDeadlineError =
        err instanceof AgendamentoRegraCancelamentoError ||
        errorMessage.includes('APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED') ||
        errorMessage.includes('prazo') ||
        errorMessage.includes('expirou');

      if (isDeadlineError) {
        const app = appointments.find((a) => a.appointment_id === activeAppointmentId);
        setExpiredAppointment(app || null);
        setIsCancelModalOpen(false);
        setIsDeadlineModalOpen(true);
      } else {
        addToast(errorMessage || 'Erro ao cancelar o agendamento.', 'error');
      }
    } finally {
      setCanceling(false);
    }
  };

  const handleReschedule = (app: AgendamentoCanal) => {
    const leadTime = customerDetails?.min_booking_lead_time_minutes ?? 120;
    const appTime = new Date(app.start_time).getTime();
    const now = new Date().getTime();
    const diffMinutes = (appTime - now) / 60000;

    if (diffMinutes < leadTime) {
      setExpiredAppointment(app);
      setIsDeadlineModalOpen(true);
      return;
    }

    const tenantRoute = customerDetails?.tenant_slug ? `/${customerDetails.tenant_slug}` : '/cliente/agendar';
    navigate(tenantRoute, {
      state: {
        fromMenu: true,
        serviceId: app.service_id,
        serviceName: app.service_name,
        servicePrice: app.service_price,
        serviceDuration: app.service_duration,
        professionalId: app.professional_id,
        professionalName: app.professional_name,
        rescheduleAppointmentId: app.appointment_id,
      },
    });
  };

  const handleNewBooking = () => {
    const tenantRoute = customerDetails?.tenant_slug ? `/${customerDetails.tenant_slug}` : '/cliente/agendar';
    navigate(tenantRoute, {
      state: { fromMenu: true },
    });
  };

  const handleLogout = async () => {
    const tenantRoute = customerDetails?.tenant_slug ? `/${customerDetails.tenant_slug}` : '/cliente/agendar';
    try {
      if (usingPublicSession) {
        await canalClienteRepository.encerrarSessaoPublica();
      }
      if (customerDetails?.tenant_slug && typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(publicTokenStorageKey(customerDetails.tenant_slug));
      }
      canalClienteRepository.limparTokenAcesso();
      navigate(tenantRoute, { replace: true });
    } catch (err) {
      console.error('Erro ao sair:', err);
      navigate(tenantRoute, { replace: true });
    }
  };

  const activeAppToCancel = appointments.find((a) => a.appointment_id === activeAppointmentId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#FFF1E6] text-[#D96C00]">
        <div className="w-11 h-11 border-3 border-[#EADED6] border-t-[#D96C00] rounded-full animate-spin" />
      </div>
    );
  }

  const tabBaseClass =
    'flex-1 min-h-9 py-2 px-3 rounded-xl bg-transparent text-xs font-extrabold leading-[1.1] cursor-pointer transition-colors duration-200';
  const tabActiveClass = 'bg-brand-primary text-brand-lightest shadow-xs';
  const tabInactiveClass = 'text-text-secondary hover:bg-brand-lightest hover:text-text-primary';

  return (
    <div className="min-h-dvh bg-brand-lightest text-text-primary font-base pb-28 box-border">
      {/* Topo do Painel */}
      <header className="w-full max-w-[420px] mx-auto px-4 box-border flex items-center justify-between pt-4 pb-2">
        <div className="flex flex-col">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-text-secondary">
            {customerDetails?.tenant_name || 'Barbearia Navalhado'}
          </span>
          <h1 className="text-base font-extrabold text-text-primary m-0 tracking-[-0.02em]">
            Olá, {customerDetails?.customer_name || 'Cliente'}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white border border-border text-text-secondary text-xs font-bold cursor-pointer transition-all duration-200 hover:bg-brand-lightest hover:border-brand-primary hover:text-text-primary"
          title="Encerrar sessão"
        >
          <HugeiconsIcon icon={Logout01Icon} size={14} />
          <span>Sair</span>
        </button>
      </header>

      <main className="w-full max-w-[420px] mx-auto px-4 box-border">
        {/* Banner Destaque Oficial: Novo Agendamento */}
        <BannerNovoAgendamento onNewBooking={handleNewBooking} />

        {/* Abas: Próximos horários vs Anteriores */}
        <div
          className="flex items-center gap-1 p-1 mt-2 mb-2 border border-border rounded-2xl bg-white"
          role="tablist"
          aria-label="Agendamentos"
        >
          <button
            type="button"
            onClick={() => setActiveTab('ativos')}
            className={`${tabBaseClass} ${activeTab === 'ativos' ? tabActiveClass : tabInactiveClass}`}
          >
            Próximos horários ({activeAppointments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`${tabBaseClass} ${activeTab === 'historico' ? tabActiveClass : tabInactiveClass}`}
          >
            Anteriores ({historicAppointments.length})
          </button>
        </div>

        {/* Conteúdo da Aba Ativos */}
        {activeTab === 'ativos' && (
          <div className="flex flex-col gap-2">
            {activeAppointments.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white rounded-2xl border border-[#EADED6] flex flex-col items-center gap-2">
                <p className="text-xs font-semibold text-[#70625B] m-0">
                  Você não tem nenhum horário agendado no momento.
                </p>
                <button
                  type="button"
                  onClick={handleNewBooking}
                  className="mt-1 py-2 px-4 rounded-full bg-[#D96C00] text-white text-xs font-bold shadow-xs hover:bg-[#9C3F00] transition-colors cursor-pointer"
                >
                  Agendar agora
                </button>
              </div>
            ) : (
              activeAppointments.map((app) => (
                <CardAgendamentoAtivo
                  key={app.appointment_id}
                  appointment={app}
                  timezone={timezone}
                  onReschedule={handleReschedule}
                  onCancel={handleCancelClick}
                />
              ))
            )}
          </div>
        )}

        {/* Conteúdo da Aba Histórico (Linha do Tempo) */}
        {activeTab === 'historico' && (
          <TimelineHistoricoAgendamentos appointments={historicAppointments} timezone={timezone} />
        )}
      </main>

      {/* Modal de Cancelamento de Agendamento */}
      <ModalCancelamentoAgendamento
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        appointment={activeAppToCancel}
        timezone={timezone}
        cancelReason={cancelReason}
        onChangeReason={setCancelReason}
        onConfirmCancel={handleCancelConfirm}
        canceling={canceling}
      />

      {/* Modal de Prazo Expirado / Contato WhatsApp */}
      <Modal
        isOpen={isDeadlineModalOpen}
        onClose={() => setIsDeadlineModalOpen(false)}
        title="Prazo de alteração expirado"
      >
        <div className="flex flex-col items-stretch gap-3 text-center">
          <div className="w-12 h-12 mx-auto mb-0.5 rounded-full flex items-center justify-center bg-warning-bg text-warning">
            <HugeiconsIcon icon={AlertCircleIcon} size={24} />
          </div>

          <p className="m-0 text-xs leading-[1.5] text-text-primary">
            O cancelamento ou reagendamento online é permitido com no mínimo{' '}
            <strong>{formatLeadTime(customerDetails?.min_booking_lead_time_minutes ?? 120)}</strong> de antecedência.
          </p>

          <p className="m-0 text-xs leading-[1.5] text-text-secondary">
            Para solicitar alterações de última hora, por favor entre em contato diretamente com o estabelecimento:
          </p>

          {customerDetails?.tenant_phone ? (
            <a
              href={`https://wa.me/${customerDetails.tenant_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Olá! Gostaria de remarcar/cancelar meu horário de ${expiredAppointment?.service_name || 'atendimento'}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-11 py-3 px-4 rounded-full inline-flex items-center justify-center gap-2 text-xs font-extrabold cursor-pointer box-border transition-all duration-200 bg-success border border-success text-white no-underline shadow-[0_4px_12px_rgba(14,159,110,0.18)] hover:bg-[#087A54]"
            >
              <HugeiconsIcon icon={WhatsappIcon} size={16} />
              <span>Falar no WhatsApp</span>
            </a>
          ) : (
            <p className="m-0 text-xs leading-[1.5] text-text-secondary italic">
              Número de WhatsApp não informado pelo estabelecimento.
            </p>
          )}

          <button
            type="button"
            onClick={() => setIsDeadlineModalOpen(false)}
            className="w-full min-h-11 py-3 px-4 rounded-full inline-flex items-center justify-center gap-2 text-xs font-extrabold cursor-pointer box-border transition-all duration-200 bg-white border border-border text-text-secondary hover:bg-brand-lightest hover:border-brand-primary hover:text-text-primary"
          >
            Entendido
          </button>
        </div>
      </Modal>

      {/* Modal de Termos / Privacidade */}
      {legalModalMode && (
        <LegalModal
          isOpen={true}
          onClose={() => setLegalModalMode(null)}
          mode={legalModalMode}
        />
      )}

      {/* Floating Bottom Nav */}
      <ClienteBottomNav
        activeTab="meus-agendamentos"
        onTabChange={(tab) => {
          if (tab === 'agendar') {
            handleNewBooking();
          }
        }}
      />
    </div>
  );
};
