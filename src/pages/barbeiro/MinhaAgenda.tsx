import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AgendaOperationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { dateInZone, formatTimeInZone, localDayUtcRange, shiftCalendarDate } from '../../lib/timezone';
import { HugeiconsIcon } from '@hugeicons/react';
import { WhatsappIcon } from '@hugeicons/core-free-icons';

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

const InfoIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
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
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show';
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

const APPOINTMENT_STATUS_CARD_CLASSES: Record<Appointment['status'], string> = {
  pending: 'border-[rgba(217,119,6,0.4)]',
  confirmed: 'border-[rgba(63,131,248,0.4)]',
  in_progress: 'border-border',
  completed: 'border-[rgba(14,159,110,0.4)] opacity-85',
  canceled: 'border-[rgba(240,82,82,0.4)] opacity-60',
  no_show: 'border-border',
};

const APPOINTMENT_STATUS_BADGE_CLASSES: Record<Appointment['status'], string> = {
  pending: 'bg-warning-bg text-warning',
  confirmed: 'bg-info-bg text-info',
  in_progress: 'bg-[rgba(217,108,0,0.15)] text-brand-primary',
  completed: 'bg-success-bg text-success',
  canceled: 'bg-error-bg text-error',
  no_show: '',
};

export const MinhaAgenda: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const agendaRepo = useAgenda();
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

  // Iniciar atendimento (transição para in_progress)
  const handleStartService = async (appId: string) => {
    try {
      if (!professional) return;

      await agendaRepo.iniciarAtendimento(professional.tenant_id, appId);

      // A Comanda do agendamento já existe: nasce no banco, junto com o agendamento.

      addToast('Atendimento iniciado e comanda aberta!', 'success');
      fetchDailyAppointments();
    } catch (err: any) {
      console.error('Error starting appointment:', err);
      if (err instanceof AgendaOperationError && err.kind === 'regra') {
        addToast(err.message, 'warning');
        fetchDailyAppointments();
        return;
      }
      addToast('Não foi possível iniciar o atendimento.', 'error');
    }
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg-primary text-text-primary">
        <div className="noise-overlay" />
        <div className="spinner w-10 h-10 border-brand-primary border-t-transparent" />
        <p>Verificando credenciais...</p>
      </div>
    );
  }

  // Renderização de erro de vínculo do perfil
  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
        <div className="noise-overlay" />
        <div className="max-w-[420px] w-full flex flex-col items-center text-center gap-5 py-10 px-8 bg-bg-secondary rounded-lg shadow-lg border border-border transition-colors duration-200 ease-in">
          <svg className="text-error" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Acesso Não Vinculado</h3>
          <p className="text-text-secondary text-sm leading-normal">{errorMsg}</p>
          <button onClick={handleLogout} className="btn btn--primary">Voltar para Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col font-base">
      <div className="noise-overlay" />

      {/* Conteúdo Principal (Mobile-First / Compacto) */}
      <main className="flex-1 p-5 max-w-[600px] w-full mx-auto flex flex-col gap-5">
        {/* Controle e Navegação de Data */}
        <section className="bg-bg-secondary border border-border rounded-lg shadow-sm flex flex-col gap-3 p-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => handleShiftDate(-1)}
              className="bg-bg-primary border border-border text-text-primary w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-border hover:text-brand-primary"
              aria-label="Dia Anterior"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="flex flex-col items-center">
              <span className="font-bold text-base text-brand-primary capitalize">{formatFriendlyDate(selectedDate)}</span>
              <span className="text-xs text-text-secondary">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
            <button
              onClick={() => handleShiftDate(1)}
              className="bg-bg-primary border border-border text-text-primary w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-border hover:text-brand-primary"
              aria-label="Próximo Dia"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Atalho Hoje */}
          <div className="flex justify-center">
            {selectedDate !== dateInZone(new Date(), professional?.timezone || 'America/Sao_Paulo') && (
              <button
                onClick={handleSetToday}
                className="bg-none border-none text-brand-primary text-xs font-semibold cursor-pointer underline hover:text-brand-hover"
              >
                Voltar para Hoje
              </button>
            )}
          </div>
        </section>

        {/* Resumo/Cards de Estatísticas do Dia */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-bg-secondary border-[0.5px] border-border rounded-md p-3.5 flex flex-col gap-1 shadow-sm relative overflow-hidden transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[rgba(217,108,0,0.15)] hover:shadow-[0_4px_16px_rgba(45,35,30,0.06),0_0_0_1px_rgba(217,108,0,0.06)] active:translate-y-0 active:scale-[0.99] active:duration-150">
            <span className="text-xs text-text-secondary relative z-[1]">Cortes Hoje</span>
            <span className="text-lg font-bold text-text-primary relative z-[1]">{stats.total}</span>
          </div>
          <div className="bg-bg-secondary border-[0.5px] border-border rounded-md p-3.5 flex flex-col gap-1 shadow-sm relative overflow-hidden transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[rgba(217,108,0,0.15)] hover:shadow-[0_4px_16px_rgba(45,35,30,0.06),0_0_0_1px_rgba(217,108,0,0.06)] active:translate-y-0 active:scale-[0.99] active:duration-150">
            <span className="text-xs text-text-secondary relative z-[1]">Concluídos</span>
            <span className="text-lg font-bold text-success relative z-[1]">{stats.completed}</span>
          </div>
          <div className="bg-bg-secondary border-[0.5px] border-border rounded-md p-3.5 flex flex-col gap-1 shadow-sm relative overflow-hidden transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[rgba(217,108,0,0.15)] hover:shadow-[0_4px_16px_rgba(45,35,30,0.06),0_0_0_1px_rgba(217,108,0,0.06)] active:translate-y-0 active:scale-[0.99] active:duration-150">
            <span className="text-xs text-text-secondary relative z-[1]">Faturamento</span>
            <span className="text-lg font-bold text-text-primary relative z-[1]">
              {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="bg-bg-secondary border-[0.5px] border-border rounded-md p-3.5 flex flex-col gap-1 shadow-sm relative overflow-hidden transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[rgba(217,108,0,0.15)] hover:shadow-[0_4px_16px_rgba(45,35,30,0.06),0_0_0_1px_rgba(217,108,0,0.06)] active:translate-y-0 active:scale-[0.99] active:duration-150">
            <span className="text-xs text-text-secondary relative z-[1]">Minha Comissão</span>
            <span className="text-lg font-bold text-text-primary relative z-[1]">
              {stats.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </section>

        {/* Lista de Atendimentos */}
        <section>
          <h2 className="text-base font-bold text-text-primary mb-3">Atendimentos Agendados</h2>

          {appointmentsLoading ? (
            <div className="flex flex-col gap-3">
              <div className="h-[100px] w-full rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-[100px] w-full rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-[100px] w-full rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-bg-secondary border border-border rounded-lg shadow-sm flex flex-col items-center py-12 px-6 text-center gap-2">
              <span className="flex justify-center opacity-50 text-text-secondary">
                <CalendarIcon size={36} />
              </span>
              <h3 className="text-base font-semibold">Nenhum horário</h3>
              <p className="text-sm text-text-secondary">Você não tem horários marcados para esta data.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {appointments.map((app) => (
                <div
                  key={app.id}
                  className={`bg-bg-secondary border rounded-lg shadow-sm flex gap-4 p-4 items-stretch transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-md ${APPOINTMENT_STATUS_CARD_CLASSES[app.status]}`}
                >
                  <div className="flex flex-col justify-center items-center pr-3 border-r border-border font-bold text-base text-brand-primary min-w-[60px]">
                    <span>{formatTime(app.start_time)}</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex flex-col">
                      <h4 className="text-base font-semibold text-text-primary">{app.customer.name}</h4>
                      {app.customer.phone && (
                        <div className="flex items-center gap-3 mt-1">
                          <a
                            href={`https://wa.me/55${app.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${app.customer.name}! Tudo bem?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chamar no WhatsApp"
                            className="inline-flex items-center gap-1 text-success text-xs font-semibold no-underline"
                          >
                            <HugeiconsIcon icon={WhatsappIcon} size={14} />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={`tel:${app.customer.phone}`}
                            title="Ligar para cliente"
                            className="inline-flex items-center gap-1 text-xs text-text-secondary no-underline hover:text-brand-primary hover:underline"
                          >
                            <PhoneIcon size={12} />
                            <span>{app.customer.phone}</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-sm text-text-secondary">
                      <span className="font-medium">{app.service.name}</span>
                      <span className="font-semibold text-text-primary">
                        {Number(app.service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      {/* Status Badges */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${APPOINTMENT_STATUS_BADGE_CLASSES[app.status]}`}>
                        {app.status === 'pending' && 'Pendente'}
                        {app.status === 'confirmed' && 'Confirmado'}
                        {app.status === 'in_progress' && 'Em Atendimento'}
                        {app.status === 'completed' && 'Concluído'}
                        {app.status === 'canceled' && 'Cancelado'}
                        {app.status === 'no_show' && 'Não compareceu'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Botão de Iniciar Atendimento */}
                        {(app.status === 'pending' || app.status === 'confirmed') && (
                          <button
                            type="button"
                            onClick={() => handleStartService(app.id)}
                            className="bg-info text-brand-lightest font-semibold text-xs py-1.5 px-3 rounded-full border-none cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-90 hover:-translate-y-px"
                            title="Iniciar Atendimento"
                          >
                            Iniciar
                          </button>
                        )}

                        {/* Botão de Finalizar */}
                        {(app.status === 'in_progress' || app.status === 'confirmed' || app.status === 'pending') && (
                          <button
                            type="button"
                            onClick={() => handleOpenCheckout(app)}
                            className="bg-success text-brand-lightest font-semibold text-xs py-1.5 px-3.5 rounded-full border-none cursor-pointer shadow-sm transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-90 hover:-translate-y-px"
                          >
                            Finalizar
                          </button>
                        )}
                      </div>
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
          <div className="flex flex-col gap-5">
            <div className="bg-bg-primary border border-border rounded-md p-4 flex flex-col gap-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Cliente</span>
                <span className="font-semibold text-text-primary">{selectedAppointment.customer.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Serviço</span>
                <span className="font-semibold text-text-primary">{selectedAppointment.service.name}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-text-secondary">Valor a Pagar</span>
                <span className="text-brand-primary text-lg font-bold">
                  {Number(selectedAppointment.service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              {/* Informação de Comissão */}
              <div className="text-xs text-text-secondary mt-1 p-2 bg-bg-secondary rounded-sm border border-dashed border-border flex items-center gap-1.5 flex-wrap">
                <InfoIcon size={14} className="text-brand-primary shrink-0" />
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

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-primary">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {(['PIX', 'Dinheiro', 'Cartão'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`bg-bg-secondary border rounded-md py-3 px-2 flex flex-col items-center gap-1 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] enabled:hover:border-brand-soft enabled:hover:bg-brand-lightest ${
                      paymentMethod === method
                        ? 'border-brand-primary bg-brand-lightest text-brand-primary shadow-[0_0_0_1px_var(--color-brand-primary)]'
                        : 'border-border'
                    }`}
                    disabled={isSubmittingCheckout}
                  >
                    <span className="flex items-center justify-center h-6">
                      {method === 'PIX' && <LightningIcon size={18} />}
                      {method === 'Dinheiro' && <DollarIcon size={18} />}
                      {method === 'Cartão' && <CardIcon size={18} />}
                    </span>
                    <span className="text-xs font-semibold">{method}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="bg-transparent border border-border text-text-secondary rounded-full py-3 px-6 font-semibold cursor-pointer enabled:hover:bg-bg-primary enabled:hover:text-text-primary"
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
    </div>
  );
};

