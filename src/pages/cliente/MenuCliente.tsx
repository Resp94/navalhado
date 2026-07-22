import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';

import { HugeiconsIcon } from '@hugeicons/react';
import { useCanalCliente } from '../../modules/canal-cliente/useCanalCliente';
import { 
  Calendar02Icon, 
  Time01Icon, 
  UserIcon,
  CancelCircleIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  InformationCircleIcon
} from '@hugeicons/core-free-icons';


interface Appointment {
  appointment_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  cancellation_reason: string | null;
  professional_name: string;
  professional_id: string;
  service_name: string;
  service_id: string;
  service_price: number;
  service_duration: number;
  tenant_name: string;
  tenant_id: string;
  tenant_phone: string;
  customer_name: string;
}

interface CustomerDetails {
  customer_id: string;
  customer_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
}

export const MenuCliente: React.FC = () => {

  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const canalClienteRepository = useCanalCliente();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de Cancelamento
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  // Controle de Abas (Ativos vs Histórico/Cancelados)
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');

  const filteredAppointments = appointments.filter(app => 
    activeTab === 'ativos'
      ? (app.status !== 'canceled' && app.status !== 'completed')
      : (app.status === 'canceled' || app.status === 'completed')
  );

  useEffect(() => {
    const init = async () => {
      try {
        const token = searchParams.get('token') || routeToken;
        if (token) {
          canalClienteRepository.definirTokenAcesso(token);
          navigate('/cliente/menu', { replace: true });
          return;
        }

        const customer = await canalClienteRepository.obterPerfil();
        setCustomerDetails(customer as any);

        localStorage.setItem('navalhado_tenant_name', customer.tenant_name);
        localStorage.setItem('navalhado_tenant_phone', customer.tenant_phone);

        await fetchAppointments();
      } catch (err) {
        console.error('Erro geral no menu do cliente:', err);
        navigate('/cliente/acesso-expirado');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [searchParams, routeToken, navigate, canalClienteRepository]);

  const fetchAppointments = async () => {
    try {
      const { todos } = await canalClienteRepository.obterAgendamentosSeparados();
      setAppointments(todos as any[]);
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
      await canalClienteRepository.cancelarAgendamento(activeAppointmentId, cancelReason.trim() || undefined);

      addToast('Agendamento cancelado com sucesso.', 'success');
      setIsCancelModalOpen(false);
      await fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao cancelar agendamento:', err);
      addToast(err.message || 'Erro ao cancelar o agendamento.', 'error');
    } finally {
      setCanceling(false);
    }
  };


  const handleReschedule = (app: Appointment) => {
    navigate('/cliente/agendar', {
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

  const getStatusBadge = (status: Appointment['status']) => {
    const styles: Record<Appointment['status'], React.CSSProperties> = {
      pending: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid rgba(217, 119, 6, 0.15)' },
      confirmed: { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(14, 159, 110, 0.15)' },
      completed: { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid rgba(63, 131, 248, 0.15)' },
      canceled: { backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid rgba(240, 82, 82, 0.15)' }
    };

    const labels: Record<Appointment['status'], string> = {
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
              Painel do Cliente
            </h1>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Olá, {customerDetails?.customer_name.split(' ')[0]}
              <HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={2} color="var(--color-brand-primary)" />
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
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
            onClick={() => navigate('/cliente/agendar')}
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
            <span>Agendar Novo Horário</span>
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
            <span>Seus Agendamentos</span>
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
              <span>Histórico</span>
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
                    : 'Nenhum histórico de agendamento disponível.'}
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
                              Data e Hora
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
                            Motivo do Cancelamento
                          </div>
                          {app.cancellation_reason}
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
      </main>

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Agendamento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
            Tem certeza de que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
          </p>

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

    </div>
  );
};
