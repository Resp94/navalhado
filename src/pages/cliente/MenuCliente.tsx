import '../../components/cliente/cliente.css';
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

  const activeAppointments = useMemo(() => {
    return appointments
      .filter((app) => app.status !== 'canceled' && app.status !== 'completed')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [appointments]);

  const historicAppointments = useMemo(() => {
    return appointments
      .filter((app) => app.status === 'canceled' || app.status === 'completed')
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [appointments]);

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

  return (
    <div className="cliente-screen">
      {/* Topo do Painel */}
      <header className="cliente-container painel-cliente-header">
        <div className="flex flex-col">
          <span className="painel-cliente-header__tag">
            {customerDetails?.tenant_name || 'Barbearia Navalhado'}
          </span>
          <h1 className="painel-cliente-header__name">
            Olá, {customerDetails?.customer_name || 'Cliente'}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="btn-logout"
          title="Encerrar sessão"
        >
          <HugeiconsIcon icon={Logout01Icon} size={14} />
          <span>Sair</span>
        </button>
      </header>

      <main className="cliente-container">
        {/* Banner Destaque Oficial: Novo Agendamento */}
        <BannerNovoAgendamento onNewBooking={handleNewBooking} />

        {/* Abas: Próximos horários vs Anteriores */}
        <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-[#EADED6]">
          <button
            type="button"
            onClick={() => setActiveTab('ativos')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'ativos'
                ? 'bg-[#D96C00] text-[#FFF1E6] shadow-xs'
                : 'text-[#70625B] hover:text-[#2D231E]'
            }`}
          >
            Próximos horários ({activeAppointments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-[#D96C00] text-[#FFF1E6] shadow-xs'
                : 'text-[#70625B] hover:text-[#2D231E]'
            }`}
          >
            Anteriores ({historicAppointments.length})
          </button>
        </div>

        {/* Conteúdo da Aba Ativos */}
        {activeTab === 'ativos' && (
          <div className="flex flex-col gap-1">
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
                  onReschedule={handleReschedule}
                  onCancel={handleCancelClick}
                />
              ))
            )}
          </div>
        )}

        {/* Conteúdo da Aba Histórico (Linha do Tempo) */}
        {activeTab === 'historico' && (
          <TimelineHistoricoAgendamentos appointments={historicAppointments} />
        )}
      </main>

      {/* Modal de Cancelamento de Agendamento */}
      <ModalCancelamentoAgendamento
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        appointment={activeAppToCancel}
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
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mx-auto">
            <HugeiconsIcon icon={AlertCircleIcon} size={24} />
          </div>

          <p className="text-xs text-[#2D231E] leading-relaxed">
            O cancelamento ou reagendamento online é permitido com no mínimo{' '}
            <strong>{formatLeadTime(customerDetails?.min_booking_lead_time_minutes ?? 120)}</strong> de antecedência.
          </p>

          <p className="text-xs text-[#70625B]">
            Para solicitar alterações de última hora, por favor entre em contato diretamente com o estabelecimento:
          </p>

          {customerDetails?.tenant_phone ? (
            <a
              href={`https://wa.me/${customerDetails.tenant_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Olá! Gostaria de remarcar/cancelar meu horário de ${expiredAppointment?.service_name || 'atendimento'}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-full bg-[#0E9F6E] hover:bg-[#0E9F6E]/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors inline-block"
            >
              <HugeiconsIcon icon={WhatsappIcon} size={16} />
              <span>Falar no WhatsApp</span>
            </a>
          ) : (
            <p className="text-xs text-[#70625B] italic">
              Número de WhatsApp não informado pelo estabelecimento.
            </p>
          )}

          <button
            type="button"
            onClick={() => setIsDeadlineModalOpen(false)}
            className="w-full py-2.5 px-4 rounded-full border border-[#EADED6] text-xs font-bold text-[#70625B] hover:bg-[#FFF1E6] transition-colors cursor-pointer"
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
