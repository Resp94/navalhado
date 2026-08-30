import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { LegalModal } from '../../components/legal/LegalModal';

import { HugeiconsIcon } from '@hugeicons/react';
import { useCanalCliente } from '../../modules/canal-cliente/useCanalCliente';
import type { PerfilClienteCanal, AgendamentoCanal } from '../../modules/canal-cliente/types';
import { AgendamentoRegraCancelamentoError } from '../../modules/canal-cliente/errors';
import { formatLeadTime } from '../../lib/timezone';
import {
  Calendar02Icon, 
  Time01Icon, 
  UserIcon,
  CancelCircleIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  InformationCircleIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons';

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

// Controle de abas do gerenciamento (agendamentos ativos vs finalizados)
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');

  const filteredAppointments = appointments.filter(app => 
    activeTab === 'ativos'
      ? (app.status !== 'canceled' && app.status !== 'completed')
      : (app.status === 'canceled' || app.status === 'completed')
  );

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

        // Se o cliente ainda não possui cadastro completo, direciona para o catálogo de serviços
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
        setIsCancelModalOpen(false);
        const app = appointments.find(a => a.appointment_id === activeAppointmentId);
        if (app) {
          setExpiredAppointment(app);
          setIsDeadlineModalOpen(true);
        } else {
          addToast(errorMessage || 'Prazo para cancelamento online expirado.', 'warning');
        }
      } else {
        addToast(errorMessage || 'Erro ao cancelar o agendamento.', 'error');
      }
    } finally {
      setCanceling(false);
    }
  };

  const handleReschedule = (app: AgendamentoCanal) => {
    const leadMinutes = app.min_cancellation_lead_time_minutes ?? customerDetails?.min_cancellation_lead_time_minutes ?? 120;
    const startTimeMs = new Date(app.start_time).getTime();
    const isExpired = startTimeMs - Date.now() < leadMinutes * 60 * 1000;

    if (isExpired) {
      setExpiredAppointment(app);
      setIsDeadlineModalOpen(true);
      return;
    }

    const publicBookingPath = usingPublicSession && customerDetails?.tenant_slug
      ? `/${customerDetails.tenant_slug}`
      : '/cliente/agendar';

    navigate(publicBookingPath, {
      state: {
        serviceId: app.service_id,
        serviceName: app.service_name,
        servicePrice: app.service_price,
        serviceDuration: app.service_duration,
        professionalId: app.professional_id,
        professionalName: app.professional_name,
        rescheduleAppointmentId: app.appointment_id
      }
    });
  };

  const handleLogout = async () => {
    const tenantSlug = customerDetails?.tenant_slug;
    try {
      if (usingPublicSession) {
        await canalClienteRepository.encerrarSessaoPublica();
      } else {
        canalClienteRepository.limparTokenAcesso();
      }
    } catch (error) {
      console.warn('Não foi possível encerrar a sessão remota do cliente:', error);
    } finally {
      canalClienteRepository.limparTokenAcesso();
      if (tenantSlug && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(publicTokenStorageKey(tenantSlug));
      }

      if (tenantSlug) {
        navigate(`/${tenantSlug}`, { replace: true });
      } else {
        navigate('/cliente/acesso-expirado', { replace: true });
      }
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { fullString: '', dateString: '', timeString: '' };
    const date = new Date(dateStr);
    
    const weekdays = [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 
      'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];
    
    const months = [
      'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 
      'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'
    ];

    const formattedWeekday = weekdays[date.getDay()];
    const dayAndMonth = `${date.getDate()} de ${months[date.getMonth()]}`;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;

    return {
      fullString: `${formattedWeekday}, ${dayAndMonth} às ${time}`,
      dateString: `${formattedWeekday}, ${dayAndMonth}`,
      timeString: time
    };
  };

  const getStatusBadge = (status: AgendamentoCanal['status']) => {
    const styles: Record<AgendamentoCanal['status'], React.CSSProperties> = {
      pending: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid rgba(217, 119, 6, 0.15)' },
      confirmed: { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(14, 159, 110, 0.15)' },
      completed: { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid rgba(63, 131, 248, 0.15)' },
      canceled: { backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid rgba(240, 82, 82, 0.15)' }
    };

    const labels: Record<AgendamentoCanal['status'], string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      completed: 'Concluído',
      canceled: 'Cancelado'
    };

    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        ...styles[status]
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor'
        }} />
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-brand-primary)'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-brand-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s cubic-bezier(0.32, 0.72, 0, 1) infinite'
        }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-family-base)',
      paddingBottom: '6rem',
      background: 'radial-gradient(circle at top, rgba(217, 108, 0, 0.06) 0%, var(--color-bg-primary) 50%)'
    }}>
      {/* Header Premium (Floating Glass Pill on Desktop/Header on mobile) */}
      <header style={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '1.25rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 30px rgba(45, 35, 30, 0.03)'
      }}>
        <div style={{
          maxWidth: '640px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-text-secondary)', margin: '0 0 4px 0' }}>
              Painel do cliente
            </h1>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Olá, {customerDetails?.customer_name.split(' ')[0]}
              <HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={2} color="var(--color-brand-primary)" />
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px',
                color: 'var(--color-brand-primary)',
                fontWeight: 800,
                backgroundColor: 'var(--color-brand-lightest)',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '1px solid rgba(217, 108, 0, 0.15)'
              }}>
                {customerDetails?.tenant_name}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main style={{
        maxWidth: '640px',
        margin: '2rem auto 0 auto',
        padding: '0 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Banner de Agendamento Rápido */}
        <div style={{
          background: 'linear-gradient(135deg, #1A120F 0%, #2E2018 50%, var(--color-brand-primary) 100%)',
          color: '#FFFFFF',
          borderRadius: '24px',
          padding: '2rem 1.75rem',
          boxShadow: '0 16px 32px -10px rgba(45, 35, 30, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(217, 108, 0, 0.15)'
        }}>
          {/* Decorative mesh circle */}
          <div style={{
            position: 'absolute',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            top: '-50px',
            right: '-30px',
            pointerEvents: 'none'
          }} />

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Precisa de um novo horário?
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, opacity: 0.9, lineHeight: 1.5 }}>
            Agende com facilidade. Escolha o serviço, selecione o barbeiro de sua preferência e confirme o seu horário em segundos.
          </p>

          <button
            onClick={() => navigate(
              usingPublicSession && customerDetails?.tenant_slug
                ? `/${customerDetails.tenant_slug}`
                : '/cliente/agendar',
              { state: { fromMenu: true } },
            )}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#FFFFFF',
              color: 'var(--color-brand-primary)',
              border: 'none',
              padding: '10px 10px 10px 20px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(45, 35, 30, 0.08)',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-brand-lightest)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <span>Agendar novo horário</span>
            <div 
              className="btn-circle-small"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(217, 108, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2.5} color="var(--color-brand-primary)" />
            </div>
          </button>
        </div>

        {/* Lista de Agendamentos */}
        <div>
          <h3 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            letterSpacing: '-0.01em'
          }}>
            <span>Seus agendamentos</span>
          </h3>

          {/* Alternador de Abas (Glassmorphic Tray) */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(234, 222, 214, 0.25)',
            border: '1px solid rgba(217, 108, 0, 0.12)',
            borderRadius: '9999px',
            padding: '4px',
            marginBottom: '1.5rem',
            width: '100%',
            maxWidth: '340px',
            boxShadow: 'inset 0 2px 4px rgba(45, 35, 30, 0.04)'
          }}>
            <button
              onClick={() => setActiveTab('ativos')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '9999px',
                border: activeTab === 'ativos' ? '1px solid rgba(217, 108, 0, 0.15)' : '1px solid transparent',
                backgroundColor: activeTab === 'ativos' ? 'var(--color-bg-secondary)' : 'transparent',
                color: activeTab === 'ativos' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === 'ativos' ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'ativos' ? '0 2px 6px rgba(45, 35, 30, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Ativos</span>
              <span style={{
                fontSize: '10px',
                backgroundColor: activeTab === 'ativos' ? 'var(--color-brand-lightest)' : 'rgba(234, 222, 214, 0.4)',
                color: activeTab === 'ativos' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontWeight: 700,
                border: activeTab === 'ativos' ? '1px solid rgba(217, 108, 0, 0.12)' : '1px solid rgba(45, 35, 30, 0.05)'
              }}>
                {appointments.filter(a => a.status !== 'canceled' && a.status !== 'completed').length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '9999px',
                border: activeTab === 'historico' ? '1px solid rgba(217, 108, 0, 0.15)' : '1px solid transparent',
                backgroundColor: activeTab === 'historico' ? 'var(--color-bg-secondary)' : 'transparent',
                color: activeTab === 'historico' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === 'historico' ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'historico' ? '0 2px 6px rgba(45, 35, 30, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Finalizados</span>
              <span style={{
                fontSize: '10px',
                backgroundColor: activeTab === 'historico' ? 'var(--color-brand-lightest)' : 'rgba(234, 222, 214, 0.4)',
                color: activeTab === 'historico' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontWeight: 700,
                border: activeTab === 'historico' ? '1px solid rgba(217, 108, 0, 0.12)' : '1px solid rgba(45, 35, 30, 0.05)'
              }}>
                {appointments.filter(a => a.status === 'canceled' || a.status === 'completed').length}
              </span>
            </button>
          </div>

          {filteredAppointments.length === 0 ? (
            /* Empty State: Double-Bezel */
            <div style={{
              backgroundColor: 'rgba(234, 222, 214, 0.15)',
              padding: '6px',
              borderRadius: '24px',
              border: '1px dashed var(--color-border)',
            }}>
              <div style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'calc(24px - 6px)',
                padding: '3.5rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-brand-lightest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-brand-primary)'
                }}>
                  <HugeiconsIcon icon={Calendar02Icon} size={28} strokeWidth={1.5} />
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', margin: 0, fontWeight: 500 }}>
                  {activeTab === 'ativos' 
                    ? 'Você não possui nenhum agendamento ativo no momento.' 
                    : 'Nenhum agendamento finalizado disponível.'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredAppointments.map((app) => {
                const isCanceled = app.status === 'canceled';
                const dateInfo = formatDateTime(app.start_time);

                return (
                  /* DOUBLE-BEZEL CONTAINER FOR APPOINTMENTS */
                  <div
                    key={app.appointment_id}
                    style={{
                      backgroundColor: 'rgba(234, 222, 214, 0.2)',
                      padding: '6px',
                      borderRadius: '24px',
                      border: '1px solid var(--color-border)',
                      opacity: isCanceled ? 0.75 : 1
                    }}
                  >
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'calc(24px - 6px)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(255,255,255,0.7)'
                    }}>
                      {/* Top Row: Service details and Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px 0', letterSpacing: '-0.01em' }}>
                            {app.service_name}
                          </h4>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <HugeiconsIcon icon={Time01Icon} size={14} color="var(--color-text-secondary)" />
                            {app.service_duration} min • R$ {Number(app.service_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: 'var(--color-border)', width: '100%' }} />

                      {/* Dynamic Bento Box for Details */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1.25rem',
                        fontSize: 'var(--font-size-sm)'
                      }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(234, 222, 214, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)'
                          }}>
                            <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.5} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
                              Profissional
                            </span>
                            <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                              {app.professional_name}
                            </strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(234, 222, 214, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)'
                          }}>
                            <HugeiconsIcon icon={Calendar02Icon} size={18} strokeWidth={1.5} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
                              Data e hora
                            </span>
                            <strong style={{ color: 'var(--color-brand-primary)', fontWeight: 800 }}>
                              {dateInfo.fullString}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Cancellation reason if canceled */}
                      {isCanceled && app.cancellation_reason && (
                        <div style={{
                          backgroundColor: 'var(--color-error-bg)',
                          border: '1px solid rgba(240, 82, 82, 0.15)',
                          borderRadius: '12px',
                          padding: '1rem',
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-error)',
                          lineHeight: '1.4'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                            <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={2.5} />
                            Motivo do cancelamento
                          </div>
                          {app.cancellation_reason}
                        </div>
                      )}

                      {/* Policy notice on active appointment */}
                      {app.status !== 'canceled' && app.status !== 'completed' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '0.625rem 0.875rem',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)'
                        }}>
                          <HugeiconsIcon icon={Time01Icon} size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0 }} />
                          <span>
                            Cancelamento online permitido <strong>{formatLeadTime(app.min_cancellation_lead_time_minutes ?? customerDetails?.min_cancellation_lead_time_minutes ?? 120)}</strong>. Em caso de imprevisto próximo ao horário, fale no WhatsApp da barbearia.
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      {app.status !== 'canceled' && app.status !== 'completed' && new Date(app.start_time) > new Date() && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '0.75rem',
                          marginTop: '0.5rem'
                        }}>
                          <button
                            onClick={() => handleCancelClick(app.appointment_id)}
                            style={{
                              backgroundColor: 'transparent',
                              color: 'var(--color-error)',
                              border: '1px solid rgba(240, 82, 82, 0.3)',
                              padding: '8px 18px',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-error-bg)';
                              e.currentTarget.style.borderColor = 'var(--color-error)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.borderColor = 'rgba(240, 82, 82, 0.3)';
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleReschedule(app)}
                            style={{
                              backgroundColor: 'var(--color-brand-primary)',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '8px 20px',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(217, 108, 0, 0.15)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-brand-primary)';
                            }}
                          >
                            Reagendar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé Legal / LGPD */}
        <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => setLegalModalMode('terms')}
          >
            Termos de uso
          </button>
          <span>•</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => setLegalModalMode('privacy')}
          >
            Privacidade (LGPD)
          </button>
        </div>
      </main>

      {/* ─── MODAL LGPD / TERMOS ─── */}
      {legalModalMode && (
        <LegalModal
          isOpen={!!legalModalMode}
          onClose={() => setLegalModalMode(null)}
          mode={legalModalMode}
        />
      )}

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar agendamento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
            Tem certeza de que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
          </p>

          {/* Aviso do Prazo da Política */}
          <div style={{
            fontSize: '12px',
            color: 'var(--color-brand-primary)',
            backgroundColor: 'var(--color-brand-lightest)',
            padding: '8px 12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <HugeiconsIcon icon={InformationCircleIcon} size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Regra da barbearia:</strong> Cancelamento online permitido <strong>{formatLeadTime(appointments.find(a => a.appointment_id === activeAppointmentId)?.min_cancellation_lead_time_minutes ?? customerDetails?.min_cancellation_lead_time_minutes ?? 120)}</strong>.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Informe o motivo do cancelamento (opcional):
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Imprevisto pessoal"
              rows={3}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-brand-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem'
          }}>
            <button
              onClick={() => setIsCancelModalOpen(false)}
              disabled={canceling}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                padding: '10px 20px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Voltar
            </button>
            <button
              onClick={handleCancelConfirm}
              disabled={canceling}
              style={{
                backgroundColor: 'var(--color-error)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(240, 82, 82, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <HugeiconsIcon icon={CancelCircleIcon} size={16} strokeWidth={2.5} />
              {canceling ? 'Processando...' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Prazo de Cancelamento Expirado - Redirecionamento WhatsApp */}
      <Modal
        isOpen={isDeadlineModalOpen}
        onClose={() => setIsDeadlineModalOpen(false)}
        title="Prazo de cancelamento expirado"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            color: 'var(--color-warning)'
          }}>
            <HugeiconsIcon icon={AlertCircleIcon} size={24} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', lineHeight: 1.4 }}>
              O prazo para cancelamento automático pelo aplicativo ({formatLeadTime(expiredAppointment?.min_cancellation_lead_time_minutes ?? customerDetails?.min_cancellation_lead_time_minutes ?? 120)}) expirou. Para não deixar o horário ocioso, por favor, entre em contato diretamente com a barbearia pelo WhatsApp!
            </span>
          </div>

          {expiredAppointment && (
            <div style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '13px'
            }}>
              <div><strong>Profissional:</strong> {expiredAppointment.professional_name}</div>
              <div><strong>Serviço:</strong> {expiredAppointment.service_name}</div>
              <div><strong>Horário:</strong> {formatDateTime(expiredAppointment.start_time).fullString}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              onClick={() => setIsDeadlineModalOpen(false)}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                padding: '10px 20px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Fechar
            </button>

            {expiredAppointment && (
              <a
                href={`https://wa.me/${(() => {
                  const raw = (expiredAppointment.tenant_phone || customerDetails?.tenant_phone || expiredAppointment.professional_phone || '').replace(/\D/g, '');
                  return raw.startsWith('55') ? raw : `55${raw}`;
                })()}?text=${encodeURIComponent(`Olá! Sou o(a) ${customerDetails?.customer_name || 'cliente'} e tive um imprevisto com o meu agendamento de ${expiredAppointment.service_name} com ${expiredAppointment.professional_name} em ${formatDateTime(expiredAppointment.start_time).fullString}. Poderiam me ajudar a remarcar/cancelar?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <HugeiconsIcon icon={WhatsappIcon} size={18} strokeWidth={2} />
                Falar com a barbearia no WhatsApp
              </a>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
};
