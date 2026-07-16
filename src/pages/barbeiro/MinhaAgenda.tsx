import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { InfoIcon } from '../../components/Icons';
import { dateInZone, formatTimeInZone, localDayUtcRange, shiftCalendarDate } from '../../lib/timezone';

// Ícones SVG inline adicionais para garantir visual limpo e profissional sem emojis
const CalendarIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const PhoneIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const LightningIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const DollarIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CardIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  commission_percentage: number | null;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  professional_id: string;
  tenant_id: string;
  customer: Customer;
  service: Service;
}

interface Professional {
  id: string;
  name: string;
  tenant_id: string;
  commission_percentage: number;
  tenantName?: string;
  timezone: string;
}

type PaymentMethod = 'PIX' | 'Dinheiro' | 'Cartão';

export const MinhaAgenda: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Estados do checkout/finalização
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Estatísticas diárias
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    revenue: 0,
    commission: 0,
  });

  // Buscar dados do barbeiro logado
  const fetchProfessionalProfile = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Obter sessão autenticada
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!session) {
        navigate('/');
        return;
      }

      // 2. Buscar correspondente em public.professionals
      const { data: prof, error: profError } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          tenant_id,
          commission_percentage,
          tenant:tenants (name, timezone)
        `)
        .eq('user_id', session.user.id)
        .single();

      if (profError || !prof) {
        console.error('Professional profile not found:', profError);
        setErrorMsg('Nenhum cadastro de profissional vinculado a esta conta de usuário. Entre em contato com o gerente.');
        setLoading(false);
        return;
      }

      const tenantData = Array.isArray(prof.tenant) ? prof.tenant[0] : prof.tenant;
      
      setProfessional({
        id: prof.id,
        name: prof.name,
        tenant_id: prof.tenant_id,
        commission_percentage: Number(prof.commission_percentage || 0),
        tenantName: tenantData?.name || 'Minha Barbearia',
        timezone: tenantData?.timezone || 'America/Sao_Paulo'
      });
      setSelectedDate(dateInZone(new Date(), tenantData?.timezone || 'America/Sao_Paulo'));

    } catch (error: any) {
      console.error('Error fetching professional profile:', error);
      setErrorMsg('Falha ao carregar perfil de acesso.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar os agendamentos do profissional para o dia selecionado
  const fetchDailyAppointments = async () => {
    if (!professional) return;

    try {
      setAppointmentsLoading(true);
      
      const { start, endExclusive } = localDayUtcRange(selectedDate, professional.timezone);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          payment_status,
          professional_id,
          tenant_id,
          customer:customers (id, name, phone),
          service:services (id, name, price, commission_percentage)
        `)
        .eq('professional_id', professional.id)
        .gte('start_time', start)
        .lt('start_time', endExclusive)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Mapeamento defensivo para tratar arrays de relacionamentos retornados pelo Supabase
      const mappedAppointments: Appointment[] = (data || []).map((app: any) => {
        const customerData = Array.isArray(app.customer) ? app.customer[0] : app.customer;
        const serviceData = Array.isArray(app.service) ? app.service[0] : app.service;
        return {
          id: app.id,
          start_time: app.start_time,
          end_time: app.end_time,
          status: app.status,
          payment_status: app.payment_status,
          professional_id: app.professional_id,
          tenant_id: app.tenant_id,
          customer: customerData || { id: '', name: 'Cliente Sem Nome', phone: '' },
          service: serviceData || { id: '', name: 'Serviço Sem Nome', price: 0, commission_percentage: null }
        };
      });

      setAppointments(mappedAppointments);

      // Calcular estatísticas diárias locais baseadas nos atendimentos carregados
      const total = mappedAppointments.filter(a => a.status !== 'canceled').length;
      const completed = mappedAppointments.filter(a => a.status === 'completed').length;
      
      let revenue = 0;
      let commission = 0;

      mappedAppointments.forEach(a => {
        if (a.status === 'completed') {
          const price = Number(a.service.price || 0);
          revenue += price;

          // Se a comissão do serviço for nula, cai para a comissão do profissional
          const svcComm = a.service.commission_percentage;
          const profComm = professional.commission_percentage;
          const finalCommPercent = (svcComm !== null && svcComm !== undefined) ? Number(svcComm) : profComm;

          commission += price * (finalCommPercent / 100);
        }
      });

      setStats({
        total,
        completed,
        revenue,
        commission
      });

    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      addToast('Não foi possível carregar seus atendimentos.', 'error');
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Efeitos colaterais de carregamento
  useEffect(() => {
    fetchProfessionalProfile();
  }, []);

  useEffect(() => {
    if (professional) {
      fetchDailyAppointments();
    }
  }, [professional, selectedDate]);

  // Alterar dia (Navegação de datas)
  const handleShiftDate = (days: number) => {
    setSelectedDate(shiftCalendarDate(selectedDate, days));
  };

  const handleSetToday = () => {
    setSelectedDate(dateInZone(new Date(), professional?.timezone || 'America/Sao_Paulo'));
  };

  // Formatar data de forma amigável
  const formatFriendlyDate = (dateStr: string) => {
    const todayStr = dateInZone(new Date(), professional?.timezone || 'America/Sao_Paulo');
    if (dateStr === todayStr) return 'Hoje';

    const tomorrowStr = shiftCalendarDate(todayStr, 1);
    if (dateStr === tomorrowStr) return 'Amanhã';

    const yesterdayStr = shiftCalendarDate(todayStr, -1);
    if (dateStr === yesterdayStr) return 'Ontem';

    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short' 
    };
    const parsed = new Date(dateStr + 'T12:00:00');
    return parsed.toLocaleDateString('pt-BR', options);
  };

  // Abrir o modal de finalização do agendamento
  const handleOpenCheckout = (app: Appointment) => {
    setSelectedAppointment(app);
    setPaymentMethod('PIX');
    setShowCheckoutModal(true);
  };

  // Executar a transação de checkout na confirmação
  const handleConfirmCheckout = async () => {
    if (!selectedAppointment || !professional) return;

    try {
      setIsSubmittingCheckout(true);

      const price = Number(selectedAppointment.service.price || 0);
      const svcComm = selectedAppointment.service.commission_percentage;
      const profComm = professional.commission_percentage;
      const finalCommPercent = (svcComm !== null && svcComm !== undefined) ? Number(svcComm) : profComm;
      const calculatedCommission = price * (finalCommPercent / 100);

      // 1. Criar registro do pagamento na tabela public.payments
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          tenant_id: professional.tenant_id,
          appointment_id: selectedAppointment.id,
          method: paymentMethod,
          amount: price,
          commission_value: calculatedCommission
        });

      if (paymentError) throw paymentError;

      // 2. Atualizar o agendamento correspondente para completo e pago
      const { error: appError } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (appError) {
        // Rollback simples: tenta remover o registro de pagamento se o update falhar
        await supabase
          .from('payments')
          .delete()
          .eq('appointment_id', selectedAppointment.id);

        throw appError;
      }

      addToast('Atendimento finalizado e comissão registrada!', 'success');
      setShowCheckoutModal(false);
      setSelectedAppointment(null);
      
      // Recarregar dados imediatamente
      fetchDailyAppointments();

    } catch (error: any) {
      console.error('Error during checkout transaction:', error);
      addToast(error.message || 'Erro ao finalizar o atendimento.', 'error');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  // Formatar hora para exibição compacta (ex: 14:30)
  const formatTime = (timeStr: string) => {
    try {
      return formatTimeInZone(timeStr, professional?.timezone || 'America/Sao_Paulo');
    } catch {
      return '';
    }
  };

  // Renderização da tela de loading inicial
  if (loading) {
    return (
      <div className="minha-agenda-loading">
        <div className="noise-overlay" />
        <div className="spinner" style={{ width: '40px', height: '40px', borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
        <p>Verificando credenciais...</p>
        <style>{`
          .minha-agenda-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
          }
        `}</style>
      </div>
    );
  }

  // Renderização de erro de vínculo do perfil
  if (errorMsg) {
    return (
      <div className="minha-agenda-error-page">
        <div className="noise-overlay" />
        <div className="error-card card">
          <svg className="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Acesso Não Vinculado</h3>
          <p>{errorMsg}</p>
          <button onClick={handleLogout} className="btn btn--primary">Voltar para Login</button>
        </div>
        <style>{`
          .minha-agenda-error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background-color: var(--color-bg-primary);
          }
          .error-card {
            max-width: 420px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 1.25rem;
            padding: 2.5rem 2rem;
            background-color: var(--color-bg-secondary);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--color-border);
          }
          .error-icon {
            color: var(--color-error);
          }
          .error-card p {
            color: var(--color-text-secondary);
            font-size: var(--font-size-sm);
            line-height: 1.5;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="minha-agenda-layout">
      <div className="noise-overlay" />
      
      {/* Conteúdo Principal (Mobile-First / Compacto) */}
      <main className="agenda-main">
        {/* Controle e Navegação de Data */}
        <section className="date-picker-section card">
          <div className="date-picker-controls">
            <button 
              onClick={() => handleShiftDate(-1)} 
              className="btn-date-nav" 
              aria-label="Dia Anterior"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="date-info">
              <span className="friendly-date">{formatFriendlyDate(selectedDate)}</span>
              <span className="numerical-date">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
            <button 
              onClick={() => handleShiftDate(1)} 
              className="btn-date-nav" 
              aria-label="Próximo Dia"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          
          {/* Atalho Hoje */}
          <div className="today-shortcut-wrapper">
            {selectedDate !== dateInZone(new Date(), professional?.timezone || 'America/Sao_Paulo') && (
              <button onClick={handleSetToday} className="btn-today-shortcut">
                Voltar para Hoje
              </button>
            )}
          </div>
        </section>

        {/* Resumo/Cards de Estatísticas do Dia */}
        <section className="dashboard-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Cortes Hoje</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Concluídos</span>
            <span className="stat-value text-success">{stats.completed}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Faturamento</span>
            <span className="stat-value">
              {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Minha Comissão</span>
            <span className="stat-value">
              {stats.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </section>

        {/* Lista de Atendimentos */}
        <section className="appointments-section">
          <h2 className="section-title">Atendimentos Agendados</h2>

          {appointmentsLoading ? (
            <div className="skeleton-list">
              <div className="skeleton-card-item skeleton" />
              <div className="skeleton-card-item skeleton" />
              <div className="skeleton-card-item skeleton" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="empty-appointments card">
              <span className="empty-icon" style={{ display: 'flex', justifyContent: 'center', opacity: 0.5, color: 'var(--color-text-secondary)' }}>
                <CalendarIcon size={36} />
              </span>
              <h3>Nenhum horário</h3>
              <p>Você não tem horários marcados para esta data.</p>
            </div>
          ) : (
            <div className="appointments-list">
              {appointments.map((app) => (
                <div 
                  key={app.id} 
                  className={`appointment-card card status-${app.status}`}
                >
                  <div className="appointment-time-badge">
                    <span className="time-text">{formatTime(app.start_time)}</span>
                  </div>

                  <div className="appointment-details">
                    <div className="customer-info">
                      <h4 className="customer-name">{app.customer.name}</h4>
                      {app.customer.phone && (
                        <a 
                          href={`tel:${app.customer.phone}`} 
                          className="customer-phone"
                          title="Ligar para cliente"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <PhoneIcon size={12} />
                          <span>{app.customer.phone}</span>
                        </a>
                      )}
                    </div>

                    <div className="service-info">
                      <span className="service-name">{app.service.name}</span>
                      <span className="service-price">
                        {Number(app.service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <div className="card-footer">
                      {/* Status Badges */}
                      <span className={`status-badge badge-${app.status}`}>
                        {app.status === 'pending' && 'Pendente'}
                        {app.status === 'confirmed' && 'Confirmado'}
                        {app.status === 'completed' && 'Concluído'}
                        {app.status === 'canceled' && 'Cancelado'}
                      </span>

                      {/* Botão de Finalizar */}
                      {(app.status === 'pending' || app.status === 'confirmed') && (
                        <button
                          onClick={() => handleOpenCheckout(app)}
                          className="btn btn-finish"
                        >
                          Finalizar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Checkout Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => !isSubmittingCheckout && setShowCheckoutModal(false)}
        title="Finalizar Atendimento"
      >
        {selectedAppointment && (
          <div className="checkout-flow-container">
            <div className="checkout-summary-card">
              <div className="summary-row">
                <span className="row-label">Cliente</span>
                <span className="row-value">{selectedAppointment.customer.name}</span>
              </div>
              <div className="summary-row">
                <span className="row-label">Serviço</span>
                <span className="row-value">{selectedAppointment.service.name}</span>
              </div>
              <div className="summary-row price-row">
                <span className="row-label">Valor a Pagar</span>
                <span className="row-value highlight">
                  {Number(selectedAppointment.service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              {/* Informação de Comissão */}
              <div className="commission-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                <InfoIcon size={14} style={{ color: 'var(--color-brand-primary)', flexShrink: 0 }} />
                <span>
                  Sua comissão estimada:{' '}
                  <strong>
                    {(Number(selectedAppointment.service.price) * (
                      (selectedAppointment.service.commission_percentage !== null && selectedAppointment.service.commission_percentage !== undefined 
                        ? Number(selectedAppointment.service.commission_percentage) 
                        : (professional?.commission_percentage || 0)
                      ) / 100
                    )).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </span>
                {' '}
                (
                {selectedAppointment.service.commission_percentage !== null && selectedAppointment.service.commission_percentage !== undefined
                  ? `${selectedAppointment.service.commission_percentage}% do serviço`
                  : `${professional?.commission_percentage}% do profissional`
                }
                )
              </div>
            </div>

            <div className="payment-method-selector">
              <label className="selector-title">Forma de Pagamento</label>
              <div className="methods-grid">
                {(['PIX', 'Dinheiro', 'Cartão'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`method-btn ${paymentMethod === method ? 'active' : ''}`}
                    disabled={isSubmittingCheckout}
                  >
                    <span className="method-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px' }}>
                      {method === 'PIX' && <LightningIcon size={18} />}
                      {method === 'Dinheiro' && <DollarIcon size={18} />}
                      {method === 'Cartão' && <CardIcon size={18} />}
                    </span>
                    <span className="method-label">{method}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="btn btn--secondary"
                disabled={isSubmittingCheckout}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                className="btn btn--primary"
                disabled={isSubmittingCheckout}
              >
                {isSubmittingCheckout ? (
                  <>
                    <div className="spinner spinner--sm" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar e Receber Pagamento'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Estilos CSS Locais */}
      <style>{`
        .minha-agenda-layout {
          min-height: 100vh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
          font-family: var(--font-family-base);
        }

        .agenda-main {
          flex: 1;
          padding: 1.25rem;
          max-width: 600px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
        }

        /* Date Picker Card */
        .date-picker-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
        }

        .date-picker-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .btn-date-nav {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-date-nav:hover {
          background-color: var(--color-border);
          color: var(--color-brand-primary);
        }

        .date-info {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .friendly-date {
          font-weight: 700;
          font-size: var(--font-size-base);
          color: var(--color-brand-primary);
          text-transform: capitalize;
        }

        .numerical-date {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .today-shortcut-wrapper {
          display: flex;
          justify-content: center;
        }

        .btn-today-shortcut {
          background: none;
          border: none;
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-today-shortcut:hover {
          color: var(--color-brand-hover);
        }

        /* Stats Grid — Bento cards with hover physics */
        .dashboard-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .stat-card {
          background-color: var(--color-bg-secondary);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
          transition:
            transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
            border-color 0.5s cubic-bezier(0.32, 0.72, 0, 1),
            box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .stat-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .stat-card:hover {
          transform: translateY(-2px) scale(1.01);
          border-color: rgba(217, 108, 0, 0.15);
          box-shadow:
            0 4px 16px rgba(45, 35, 30, 0.06),
            0 0 0 1px rgba(217, 108, 0, 0.06);
        }

        .stat-card:active {
          transform: translateY(0) scale(0.99);
          transition-duration: 0.15s;
        }

        .stat-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          position: relative;
          z-index: 1;
        }

        .stat-value {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          position: relative;
          z-index: 1;
        }

        .text-success {
          color: var(--color-success);
        }

        /* Appointments Section */
        .section-title {
          font-size: var(--font-size-base);
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.75rem;
        }

        .appointments-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .appointment-card {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          align-items: stretch;
          border-left: 4px solid var(--color-border);
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.2s ease;
        }

        .appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .appointment-card.status-pending {
          border-left-color: var(--color-warning);
        }

        .appointment-card.status-confirmed {
          border-left-color: var(--color-info);
        }

        .appointment-card.status-completed {
          border-left-color: var(--color-success);
          opacity: 0.85;
        }

        .appointment-card.status-canceled {
          border-left-color: var(--color-error);
          opacity: 0.6;
        }

        .appointment-time-badge {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding-right: 0.75rem;
          border-right: 1px solid var(--color-border);
          font-weight: 700;
          font-size: var(--font-size-base);
          color: var(--color-brand-primary);
          min-width: 60px;
        }

        .appointment-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .customer-info {
          display: flex;
          flex-direction: column;
        }

        .customer-name {
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .customer-phone {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          text-decoration: none;
          display: inline-block;
          margin-top: 0.125rem;
        }

        .customer-phone:hover {
          color: var(--color-brand-primary);
          text-decoration: underline;
        }

        .service-info {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .service-name {
          font-weight: 500;
        }

        .service-price {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.25rem;
        }

        /* Status badges */
        .status-badge {
          font-size: var(--font-size-xs);
          font-weight: 600;
          padding: 0.125rem 0.5rem;
          border-radius: var(--radius-full);
          text-transform: capitalize;
        }

        .badge-pending {
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .badge-confirmed {
          background-color: var(--color-info-bg);
          color: var(--color-info);
        }

        .badge-completed {
          background-color: var(--color-success-bg);
          color: var(--color-success);
        }

        .badge-canceled {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .btn-finish {
          background-color: var(--color-success);
          color: #FFF1E6;
          font-weight: 600;
          font-size: var(--font-size-xs);
          padding: 0.375rem 0.875rem;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .btn-finish:hover {
          background-color: #0c825a;
          transform: translateY(-1px);
        }

        /* Empty / Skeleton */
        .empty-appointments {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem 1.5rem;
          text-align: center;
          gap: 0.5rem;
        }

        .empty-icon {
          font-size: 2rem;
        }

        .empty-appointments h3 {
          font-size: var(--font-size-base);
          font-weight: 600;
        }

        .empty-appointments p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .skeleton-card-item {
          height: 100px;
          width: 100%;
          border-radius: var(--radius-lg);
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
        }

        /* Checkout Modal Content */
        .checkout-flow-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .checkout-summary-card {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
        }

        .row-label {
          color: var(--color-text-secondary);
        }

        .row-value {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .price-row {
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
        }

        .price-row .row-value.highlight {
          color: var(--color-brand-primary);
          font-size: var(--font-size-lg);
          font-weight: 700;
        }

        .commission-hint {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin-top: 0.25rem;
          padding: 0.5rem;
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-sm);
          border: 1px dashed var(--color-border);
        }

        .payment-method-selector {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .selector-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .methods-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .method-btn {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.75rem 0.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .method-btn:hover:not(:disabled) {
          border-color: var(--color-brand-soft);
          background-color: var(--color-brand-lightest);
        }

        .method-btn.active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          box-shadow: 0 0 0 1px var(--color-brand-primary);
        }

        .method-icon {
          font-size: 1.25rem;
        }

        .method-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
        }

        .modal-actions-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn--secondary {
          background-color: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn--secondary:hover:not(:disabled) {
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
};
