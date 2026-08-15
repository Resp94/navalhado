import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import {
  dateInZone,
  formatTimeInZone,
  localDateTimeToIso,
  localDayUtcRange,
  shiftCalendarDate
} from '../../lib/timezone';
import { ClienteRepository } from '../../modules/clientes/ClienteRepository';
import { SupabaseClienteAdapter } from '../../modules/clientes/adapters/SupabaseClienteAdapter';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  Clock01Icon,
  Money01Icon,
  Cancel01Icon,
  PlusSignIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  WhatsappIcon,
  FilterIcon,
  CheckmarkCircle02Icon,
  Note01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

// --- Interfaces de Domínio ---
interface Professional {
  id: string;
  name: string;
  is_active: boolean;
  phone?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'no_show';

export type PaymentStatus = 'pending' | 'paid';

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  is_fitting: boolean;
  notes?: string | null;
  origin?: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  service: {
    id: string;
    name: string;
    price: number;
  };
  professional_id: string;
}

// Configurações da Grade Temporal
const SLOT_DURATION_MINUTES = 30;
const SLOT_HEIGHT_PX = 52; // Altura em pixels de cada bloco de 30 min

export const Agenda: React.FC = () => {
  // Contexto do Tenant / Barbearia
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const clienteRepository = useMemo(
    () => new ClienteRepository(new SupabaseClienteAdapter(supabase)),
    []
  );

  // Estados de Controle de Data e Filtro
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    dateInZone(new Date(), tenant.timezone)
  );

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Estados do Formulário de Agendamento / Encaixe
  const [formProfessionalId, setFormProfessionalId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formIsFitting, setFormIsFitting] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [savingAppointment, setSavingAppointment] = useState(false);

  // Estados do Cancelamento
  const [targetAppointment, setTargetAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelingAppointment, setCancelingAppointment] = useState(false);

  // Estados do Pagamento
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'PIX' | 'Cartão'>('PIX');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Linha Vermelha de Tempo Real (Red Line)
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Horários de Início e Término da Grade (Padrão 08:00 às 20:00)
  const gridStartHour = 8;
  const gridEndHour = 20;
  const totalGridMinutes = (gridEndHour - gridStartHour) * 60;

  // Gerar Slots de Horário da Régua
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = gridStartHour; hour < gridEndHour; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  }, [gridStartHour, gridEndHour]);

  // Data formatada por extenso em PT-BR
  const formattedDateTitle = useMemo(() => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(dateObj);
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(dateObj);
      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return `${capitalizedWeekday}, ${formatted}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const isToday = useMemo(() => {
    const todayStr = dateInZone(new Date(), tenant.timezone);
    return selectedDate === todayStr;
  }, [selectedDate, tenant.timezone]);

  // Carregar dados de Apoio (Profissionais, Serviços, Clientes)
  const loadInitialData = useCallback(async () => {
    try {
      if (!tenant.tenantId) return;

      const [profsRes, servsRes, custsRes] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, name, is_active, phone')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('tenant_id', tenant.tenantId)
          .order('name')
      ]);

      if (profsRes.error) throw profsRes.error;
      if (servsRes.error) throw servsRes.error;
      if (custsRes.error) throw custsRes.error;

      const activeProfs = profsRes.data || [];
      setProfessionals(activeProfs);
      setSelectedProfessionalIds(activeProfs.map((p) => p.id));
      setServices(servsRes.data || []);
      setCustomers(custsRes.data || []);

      if (activeProfs.length > 0) {
        setFormProfessionalId(activeProfs[0].id);
      }
      if (servsRes.data && servsRes.data.length > 0) {
        setFormServiceId(servsRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados base da agenda:', err);
      addToast('Não foi possível carregar profissionais e serviços.', 'error');
    }
  }, [tenant.tenantId, addToast]);

  // Carregar Agendamentos do Dia
  const fetchAppointments = useCallback(async () => {
    try {
      if (!tenant.tenantId) return;
      setLoading(true);

      const { start, endExclusive } = localDayUtcRange(selectedDate, tenant.timezone);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          payment_status,
          is_fitting,
          notes,
          origin,
          professional_id,
          customer:customers (
            id,
            name,
            phone
          ),
          service:services (
            id,
            name,
            price
          )
        `)
        .eq('tenant_id', tenant.tenantId)
        .gte('start_time', start)
        .lt('start_time', endExclusive)
        .neq('status', 'canceled')
        .order('start_time', { ascending: true });

      if (error) throw error;

      const mapped: Appointment[] = (data || []).map((item: any) => ({
        id: item.id,
        start_time: item.start_time,
        end_time: item.end_time,
        status: item.status,
        payment_status: item.payment_status,
        is_fitting: Boolean(item.is_fitting),
        notes: item.notes,
        origin: item.origin,
        professional_id: item.professional_id,
        customer: Array.isArray(item.customer) ? item.customer[0] : item.customer,
        service: Array.isArray(item.service) ? item.service[0] : item.service
      }));

      setAppointments(mapped);
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos:', err);
      addToast('Erro ao carregar os agendamentos do dia.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, tenant.timezone, selectedDate, addToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    fetchAppointments();

    // Subscrição Realtime
    const channel = supabase
      .channel(`appointments-agenda-${tenant.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenant.tenantId}`
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments, tenant.tenantId]);

  // Controles de Navegação de Data
  const handlePrevDay = () => {
    setSelectedDate((prev) => shiftCalendarDate(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => shiftCalendarDate(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(dateInZone(new Date(), tenant.timezone));
  };

  // Abrir Modal de Encaixe / Agendamento
  const handleOpenNewAppointment = (profId?: string, timeSlot?: string, isFitting = false) => {
    if (profId) setFormProfessionalId(profId);
    else if (professionals.length > 0) setFormProfessionalId(professionals[0].id);

    if (timeSlot) setFormTime(timeSlot);
    else setFormTime('09:00');

    setFormIsFitting(isFitting);
    setFormNotes('');
    setCustomerMode('existing');
    setSelectedCustomerId(customers.length > 0 ? customers[0].id : '');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setIsModalOpen(true);
  };

  // Salvar Novo Agendamento / Encaixe
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formProfessionalId) {
      addToast('Selecione um profissional.', 'warning');
      return;
    }
    if (!formServiceId) {
      addToast('Selecione um serviço.', 'warning');
      return;
    }

    const selectedService = services.find((s) => s.id === formServiceId);
    if (!selectedService) {
      addToast('Serviço inválido.', 'error');
      return;
    }

    setSavingAppointment(true);

    try {
      let finalCustomerId = selectedCustomerId;

      // Cadastro rápido de cliente se modo 'new'
      if (customerMode === 'new') {
        if (!newCustomerName.trim()) {
          addToast('Informe o nome do cliente.', 'warning');
          setSavingAppointment(false);
          return;
        }

        const phoneDigits = newCustomerPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          addToast('Telefone inválido (mínimo DDD + 8 dígitos).', 'warning');
          setSavingAppointment(false);
          return;
        }

        const newCust = await clienteRepository.saveProvisionalCustomer(tenant.tenantId, {
          name: newCustomerName,
          phone: newCustomerPhone
        });

        finalCustomerId = newCust.id;
        setCustomers((prev) => [...prev, { id: newCust.id, name: newCust.name, phone: newCust.phone }]);
      }

      if (!finalCustomerId) {
        addToast('Selecione ou cadastre um cliente.', 'warning');
        setSavingAppointment(false);
        return;
      }

      // Calcular timestamps com Timezone
      const startIso = localDateTimeToIso(selectedDate, formTime, tenant.timezone);
      const [sh, sm] = formTime.split(':').map(Number);
      const endTotalMinutes = sh * 60 + sm + selectedService.duration_minutes;
      const eh = Math.floor(endTotalMinutes / 60);
      const em = endTotalMinutes % 60;
      const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      const endIso = localDateTimeToIso(selectedDate, endTimeStr, tenant.timezone);

      const payload = {
        tenant_id: tenant.tenantId,
        customer_id: finalCustomerId,
        professional_id: formProfessionalId,
        service_id: formServiceId,
        start_time: startIso,
        end_time: endIso,
        status: 'confirmed' as AppointmentStatus,
        payment_status: 'pending' as PaymentStatus,
        is_fitting: formIsFitting,
        notes: formNotes.trim() || null,
        origin: 'manual'
      };

      const { error: insertErr } = await supabase.from('appointments').insert(payload);

      if (insertErr) {
        if (insertErr.code === '23P01') {
          addToast('Horário indisponível: este profissional já possui atendimento agendado neste período.', 'error');
          return;
        }
        throw insertErr;
      }

      addToast(
        formIsFitting ? 'Encaixe agendado com sucesso!' : 'Agendamento criado com sucesso!',
        'success'
      );
      setIsModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      addToast(err.message || 'Erro ao agendar horário.', 'error');
    } finally {
      setSavingAppointment(false);
    }
  };

  // Transição de Status: Iniciar Atendimento
  const handleStartService = async (app: Appointment) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', app.id);

      if (error) throw error;
      addToast(`Atendimento de ${app.customer.name} iniciado.`, 'success');
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao iniciar atendimento:', err);
      addToast('Erro ao atualizar status do atendimento.', 'error');
    }
  };

  // Abrir Modal de Pagamento
  const handleOpenPaymentModal = (app: Appointment) => {
    setTargetAppointment(app);
    setPaymentMethod('PIX');
    setIsPaymentModalOpen(true);
  };

  // Confirmar Pagamento
  const handleConfirmPayment = async () => {
    if (!targetAppointment) return;
    setProcessingPayment(true);

    try {
      // 1. Criar registro de pagamento
      const { error: payErr } = await supabase.from('payments').insert({
        tenant_id: tenant.tenantId,
        appointment_id: targetAppointment.id,
        method: paymentMethod,
        amount: targetAppointment.service.price,
        commission_value: 0,
        paid_at: new Date().toISOString()
      });

      if (payErr) throw payErr;

      // 2. Atualizar appointment para 'completed' e 'paid'
      const { error: appErr } = await supabase
        .from('appointments')
        .update({
          payment_status: 'paid',
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', targetAppointment.id);

      if (appErr) throw appErr;

      addToast('Pagamento registrado com sucesso!', 'success');
      setIsPaymentModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err);
      addToast('Erro ao processar pagamento.', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Abrir Modal de Cancelamento
  const handleOpenCancelModal = (app: Appointment) => {
    setTargetAppointment(app);
    setCancellationReason('');
    setIsCancelModalOpen(true);
  };

  // Confirmar Cancelamento
  const handleConfirmCancellation = async () => {
    if (!targetAppointment) return;
    setCancelingAppointment(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'canceled',
          cancellation_reason: cancellationReason.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetAppointment.id);

      if (error) throw error;

      addToast('Agendamento cancelado com sucesso.', 'success');
      setIsCancelModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao cancelar agendamento:', err);
      addToast('Erro ao cancelar agendamento.', 'error');
    } finally {
      setCancelingAppointment(false);
    }
  };

  // Disparar WhatsApp Direto
  const handleDirectWhatsApp = (phone: string, customerName: string, timeFormatted: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${customerName}! Confirmando seu horário de atendimento hoje às ${timeFormatted} na ${tenant.tenantName}.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  // Profissionais Visíveis Filtrados
  const visibleProfessionals = useMemo(() => {
    return professionals.filter((p) => selectedProfessionalIds.includes(p.id));
  }, [professionals, selectedProfessionalIds]);

  const toggleProfessionalFilter = (profId: string) => {
    setSelectedProfessionalIds((prev) =>
      prev.includes(profId) ? prev.filter((id) => id !== profId) : [...prev, profId]
    );
  };

  // Calcular posição do card de agendamento na grade
  const calculateCardPosition = (startTimeIso: string, endTimeIso: string) => {
    const timeStr = formatTimeInZone(startTimeIso, tenant.timezone);
    const [h, m] = timeStr.split(':').map(Number);
    const startMinutesFromGridStart = h * 60 + m - gridStartHour * 60;

    const topPx = (startMinutesFromGridStart / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX;

    // Calcular duração
    const endTimeStr = formatTimeInZone(endTimeIso, tenant.timezone);
    const [eh, em] = endTimeStr.split(':').map(Number);
    const durationMinutes = Math.max(30, eh * 60 + em - (h * 60 + m));
    const heightPx = (durationMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX - 4;

    return { topPx: Math.max(0, topPx), heightPx: Math.max(36, heightPx) };
  };

  // Posição da Linha Vermelha de Tempo Real
  const redLineTopPx = useMemo(() => {
    const minutesFromStart = currentTimeMinutes - gridStartHour * 60;
    if (minutesFromStart < 0 || minutesFromStart > totalGridMinutes) return null;
    return (minutesFromStart / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX;
  }, [currentTimeMinutes, gridStartHour, totalGridMinutes]);

  return (
    <div className="agenda-page">
      {/* 1. HEADER DE CONTROLE OPERACIONAL */}
      <header className="agenda-header-control">
        <div className="agenda-header-left">
          <div className="agenda-header-title">
            <h2>{formattedDateTitle}</h2>
            <p className="agenda-header-subtitle">
              {visibleProfessionals.length} profissional(is) em atendimento
            </p>
          </div>
        </div>

        <div className="agenda-header-actions">
          {/* Navegação de Datas */}
          <div className="agenda-date-navigator">
            <button
              type="button"
              className="btn-date-nav"
              onClick={handlePrevDay}
              title="Dia Anterior"
              aria-label="Dia Anterior"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            </button>
            <button
              type="button"
              className={`btn-date-nav btn-date-today ${isToday ? 'btn-date-today--active' : ''}`}
              onClick={handleToday}
            >
              Hoje
            </button>
            <button
              type="button"
              className="btn-date-nav"
              onClick={handleNextDay}
              title="Próximo Dia"
              aria-label="Próximo Dia"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </button>

            <label className="agenda-date-picker-label">
              <HugeiconsIcon icon={Calendar03Icon} size={16} className="date-icon" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="agenda-date-picker-input"
              />
            </label>
          </div>

          {/* Filtro de Barbeiros */}
          <div className="agenda-filter-container">
            <button
              type="button"
              className={`btn-agenda-filter ${isFilterOpen ? 'btn-agenda-filter--active' : ''}`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              title="Filtrar Equipe"
            >
              <HugeiconsIcon icon={FilterIcon} size={16} />
              <span>Equipe ({selectedProfessionalIds.length})</span>
            </button>

            {isFilterOpen && (
              <div className="agenda-filter-dropdown">
                <div className="agenda-filter-dropdown__header">
                  <strong>Exibir Barbeiros</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedProfessionalIds(professionals.map((p) => p.id))
                    }
                    className="btn-link-xs"
                  >
                    Todos
                  </button>
                </div>
                <div className="agenda-filter-dropdown__list">
                  {professionals.map((prof) => {
                    const isChecked = selectedProfessionalIds.includes(prof.id);
                    return (
                      <label key={prof.id} className="filter-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfessionalFilter(prof.id)}
                        />
                        <span>{prof.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botão Mestre + Encaixe */}
          <button
            type="button"
            className="btn-master-encaixe"
            onClick={() => handleOpenNewAppointment(undefined, undefined, true)}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={18} />
            <span>+ Encaixe</span>
          </button>
        </div>
      </header>

      {/* 2. GRADE TEMPORAL CONTÍNUA */}
      <div className="agenda-grid-wrapper">
        {loading ? (
          <div className="agenda-skeleton-loading">
            <div className="spinner-brand" />
            <p>Carregando escala do dia...</p>
          </div>
        ) : visibleProfessionals.length === 0 ? (
          <div className="agenda-empty-state">
            <HugeiconsIcon icon={AlertCircleIcon} size={48} className="empty-icon" />
            <h3>Nenhum profissional selecionado</h3>
            <p>Ative ao menos um profissional no filtro acima para visualizar a grade.</p>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => setSelectedProfessionalIds(professionals.map((p) => p.id))}
            >
              Exibir Todos
            </button>
          </div>
        ) : (
          <div className="agenda-timeline-board">
            {/* Coluna Fixa da Régua de Horários */}
            <div className="timeline-axis-column">
              <div className="timeline-axis-header">
                <HugeiconsIcon icon={Clock01Icon} size={16} />
              </div>
              <div className="timeline-axis-body">
                {timeSlots.map((slot) => (
                  <div key={slot} className="time-slot-label">
                    <span>{slot}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colunas dos Profissionais */}
            <div className="professionals-columns-container">
              {visibleProfessionals.map((prof) => {
                const profAppointments = appointments.filter(
                  (a) => a.professional_id === prof.id
                );

                return (
                  <div
                    key={prof.id}
                    className="professional-timeline-column"
                    data-testid={`prof-col-${prof.id}`}
                  >
                    {/* Cabeçalho do Barbeiro */}
                    <div className="prof-col-header">
                      <div className="prof-col-avatar">
                        {prof.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="prof-col-info">
                        <h4 title={prof.name}>{prof.name}</h4>
                        <span className="prof-col-count">
                          {profAppointments.length} atendimento(s)
                        </span>
                      </div>
                    </div>

                    {/* Corpo da Grade com Slots Clicáveis */}
                    <div className="prof-col-grid-body">
                      {/* Slots de Fundo Interativos */}
                      {timeSlots.map((slot) => (
                        <div
                          key={slot}
                          className="grid-slot-cell"
                          onClick={() => handleOpenNewAppointment(prof.id, slot, false)}
                          title={`Clique para agendar às ${slot} com ${prof.name}`}
                        >
                          <span className="slot-hover-text">+ {slot}</span>
                        </div>
                      ))}

                      {/* Linha Vermelha de Tempo Real */}
                      {isToday && redLineTopPx !== null && (
                        <div
                          className="agenda-red-line"
                          style={{ top: `${redLineTopPx}px` }}
                          title="Hora Atual"
                        />
                      )}

                      {/* Cards de Agendamento Flutuantes */}
                      {profAppointments.map((app) => {
                        const { topPx, heightPx } = calculateCardPosition(
                          app.start_time,
                          app.end_time
                        );
                        const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                        const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

                        // Classes Semânticas de Cor do AppBarber
                        let statusClass = 'card-status--pending';
                        if (app.payment_status === 'paid' || app.status === 'completed') {
                          statusClass = 'card-status--completed';
                        } else if (app.status === 'in_progress') {
                          statusClass = 'card-status--in-progress';
                        } else if (app.is_fitting) {
                          statusClass = 'card-status--fitting';
                        } else if (app.status === 'confirmed') {
                          statusClass = 'card-status--confirmed';
                        }

                        return (
                          <div
                            key={app.id}
                            className={`timeline-appointment-card ${statusClass}`}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                          >
                            <div className="card-top-row">
                              <span className="card-time-badge">
                                {timeStart} - {timeEnd}
                              </span>
                              <div className="card-badges-row">
                                {app.is_fitting && (
                                  <span className="badge-chip badge-chip--fitting" title="Encaixe">
                                    Encaixe
                                  </span>
                                )}
                                {app.status === 'in_progress' && (
                                  <span className="badge-chip badge-chip--progress" title="Em Atendimento">
                                    Atendendo
                                  </span>
                                )}
                                {app.payment_status === 'paid' && (
                                  <span className="badge-chip badge-chip--paid" title="Pago">
                                    Pago
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="card-client-row">
                              <span className="card-client-name" title={app.customer?.name}>
                                {app.customer?.name || 'Cliente'}
                              </span>
                              <span className="card-service-name" title={app.service?.name}>
                                {app.service?.name} (R$ {Number(app.service?.price || 0).toFixed(2)})
                              </span>
                              {app.notes && (
                                <p className="card-notes-snippet" title={app.notes}>
                                  <HugeiconsIcon icon={Note01Icon} size={12} /> {app.notes}
                                </p>
                              )}
                            </div>

                            {/* Ações Rápidas de 1 Clique */}
                            <div className="card-actions-toolbar">
                              {app.customer?.phone && (
                                <button
                                  type="button"
                                  className="btn-card-action btn-action-whatsapp"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDirectWhatsApp(
                                      app.customer.phone,
                                      app.customer.name,
                                      timeStart
                                    );
                                  }}
                                  title="WhatsApp"
                                >
                                  <HugeiconsIcon icon={WhatsappIcon} size={14} />
                                </button>
                              )}

                              {app.status === 'confirmed' && (
                                <button
                                  type="button"
                                  className="btn-card-action btn-action-start"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartService(app);
                                  }}
                                  title="Iniciar Atendimento"
                                >
                                  Iniciar
                                </button>
                              )}

                              {app.payment_status !== 'paid' ? (
                                <button
                                  type="button"
                                  className="btn-card-action btn-action-pay"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPaymentModal(app);
                                  }}
                                  title="Cobrar / Receber"
                                >
                                  <HugeiconsIcon icon={Money01Icon} size={14} />
                                  <span>Cobrar</span>
                                </button>
                              ) : (
                                <span className="paid-confirmed-label">
                                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                                </span>
                              )}

                              <button
                                type="button"
                                className="btn-card-action btn-action-cancel"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCancelModal(app);
                                }}
                                title="Cancelar Agendamento"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. MODAL DE NOVO AGENDAMENTO / ENCAIXE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formIsFitting ? 'Novo Encaixe Rápido' : 'Novo Agendamento'}
      >
        <form onSubmit={handleSaveAppointment} className="modal-agenda-form">
          {/* Seletor de Modo do Cliente */}
          <div className="form-group-segmented">
            <button
              type="button"
              className={`segmented-btn ${customerMode === 'existing' ? 'segmented-btn--active' : ''}`}
              onClick={() => setCustomerMode('existing')}
            >
              Cliente Cadastrado
            </button>
            <button
              type="button"
              className={`segmented-btn ${customerMode === 'new' ? 'segmented-btn--active' : ''}`}
              onClick={() => setCustomerMode('new')}
            >
              + Novo Cliente
            </button>
          </div>

          {customerMode === 'existing' ? (
            <div className="form-group">
              <label htmlFor="select-customer">Cliente</label>
              <select
                id="select-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input-select"
                required
              >
                <option value="">Selecione um cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="new-customer-name">Nome do Cliente</label>
                <input
                  id="new-customer-name"
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="input-text"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-customer-phone">WhatsApp / Celular</label>
                <input
                  id="new-customer-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="input-text"
                  required
                />
              </div>
            </div>
          )}

          {/* Seleção de Profissional e Serviço */}
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="select-professional">Profissional</label>
              <select
                id="select-professional"
                value={formProfessionalId}
                onChange={(e) => setFormProfessionalId(e.target.value)}
                className="input-select"
                required
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="select-service">Serviço</label>
              <select
                id="select-service"
                value={formServiceId}
                onChange={(e) => setFormServiceId(e.target.value)}
                className="input-select"
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - R$ {Number(s.price).toFixed(2)} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Horário e Encaixe */}
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="form-time">Horário de Início</label>
              <input
                id="form-time"
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="input-text"
                required
              />
            </div>

            <div className="form-group form-group--checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formIsFitting}
                  onChange={(e) => setFormIsFitting(e.target.checked)}
                />
                <span>Marcar como Encaixe de Balcão</span>
              </label>
            </div>
          </div>

          {/* Observações */}
          <div className="form-group">
            <label htmlFor="form-notes">Observações do Atendimento (Opcional)</label>
            <textarea
              id="form-notes"
              rows={2}
              placeholder="Ex: Cliente prefere tesoura no topo..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="input-textarea"
            />
          </div>

          <div className="modal-actions-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={savingAppointment}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={savingAppointment}>
              {savingAppointment ? 'Salvando...' : 'Confirmar Agendamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. MODAL DE PAGAMENTO / FATURAMENTO */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Receber Pagamento"
      >
        {targetAppointment && (
          <div className="payment-modal-body">
            <div className="payment-summary-card">
              <div className="summary-row">
                <span>Cliente:</span>
                <strong>{targetAppointment.customer?.name}</strong>
              </div>
              <div className="summary-row">
                <span>Serviço:</span>
                <strong>{targetAppointment.service?.name}</strong>
              </div>
              <div className="summary-row summary-row--highlight">
                <span>Valor Total:</span>
                <span className="price-val">
                  R$ {Number(targetAppointment.service?.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Forma de Pagamento</label>
              <div className="payment-methods-grid">
                {(['PIX', 'Dinheiro', 'Cartão'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`payment-method-chip ${paymentMethod === method ? 'payment-method-chip--active' : ''}`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={processingPayment}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={handleConfirmPayment}
                disabled={processingPayment}
              >
                {processingPayment ? 'Processando...' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. MODAL DE CANCELAMENTO */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Agendamento"
      >
        {targetAppointment && (
          <div className="cancel-modal-body">
            <p className="cancel-alert-text">
              Deseja realmente cancelar o agendamento de{' '}
              <strong>{targetAppointment.customer?.name}</strong> para o serviço{' '}
              <strong>{targetAppointment.service?.name}</strong>?
            </p>

            <div className="form-group">
              <label htmlFor="cancel-reason">Motivo do Cancelamento (Opcional)</label>
              <textarea
                id="cancel-reason"
                rows={2}
                placeholder="Ex: Cliente solicitou reagendamento por telefone..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="input-textarea"
              />
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={cancelingAppointment}
              >
                Não Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmCancellation}
                disabled={cancelingAppointment}
              >
                {cancelingAppointment ? 'Cancelando...' : 'Sim, Cancelar Horário'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. ESTILOS EMBUTIDOS DA AGENDA COM DESIGN SYSTEM DO NAVALHADO */}
      <style>{`
        .agenda-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          font-family: var(--font-family-base);
        }

        /* HEADER DE CONTROLE */
        .agenda-header-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.25rem 1.75rem;
          background-color: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(16px) saturate(120%);
          -webkit-backdrop-filter: blur(16px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.7);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .agenda-header-title h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .agenda-header-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin-top: 0.2rem;
        }

        .agenda-header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .agenda-date-navigator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: rgba(255, 255, 255, 0.8);
          padding: 0.25rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .btn-date-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.4rem 0.6rem;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          cursor: pointer;
          font-weight: 600;
          font-size: var(--font-size-sm);
          transition: all 0.2s ease;
        }

        .btn-date-nav:hover {
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
        }

        .btn-date-today {
          padding: 0.35rem 0.75rem;
        }

        .btn-date-today--active {
          background-color: var(--color-brand-primary);
          color: white !important;
        }

        .agenda-date-picker-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.6rem;
          border-left: 1px solid var(--color-border);
          cursor: pointer;
          position: relative;
        }

        .agenda-date-picker-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
        }

        /* FILTRO DE EQUIPE */
        .agenda-filter-container {
          position: relative;
        }

        .btn-agenda-filter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1rem;
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-agenda-filter:hover,
        .btn-agenda-filter--active {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .agenda-filter-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          width: 220px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: 0.75rem;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .agenda-filter-dropdown__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs);
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.4rem;
        }

        .btn-link-xs {
          background: none;
          border: none;
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          cursor: pointer;
          font-weight: 600;
        }

        .agenda-filter-dropdown__list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .filter-checkbox-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          cursor: pointer;
        }

        /* BOTÃO MESTRE + ENCAIXE */
        .btn-master-encaixe {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 700;
          font-size: var(--font-size-sm);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-master-encaixe:hover {
          background-color: var(--color-brand-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .btn-master-encaixe:active {
          transform: scale(0.97);
        }

        /* GRADE DA TIMELINE */
        .agenda-grid-wrapper {
          width: 100%;
          overflow-x: auto;
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.6);
          border-radius: var(--radius-lg);
          padding: 1rem;
          box-shadow: var(--shadow-sm);
        }

        .agenda-timeline-board {
          display: flex;
          min-width: 800px;
          position: relative;
        }

        /* Eixo de Horários */
        .timeline-axis-column {
          width: 65px;
          flex-shrink: 0;
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
        }

        .timeline-axis-header {
          height: 60px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
        }

        .timeline-axis-body {
          display: flex;
          flex-direction: column;
        }

        .time-slot-label {
          height: 52px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          border-bottom: 1px dashed rgba(234, 222, 214, 0.4);
        }

        /* Colunas dos Barbeiros */
        .professionals-columns-container {
          display: flex;
          flex: 1;
        }

        .professional-timeline-column {
          flex: 1;
          min-width: 240px;
          border-right: 1px solid rgba(234, 222, 214, 0.7);
          display: flex;
          flex-direction: column;
        }

        .professional-timeline-column:last-child {
          border-right: none;
        }

        .prof-col-header {
          height: 60px;
          border-bottom: 1px solid var(--color-border);
          padding: 0.5rem 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background-color: rgba(255, 255, 255, 0.4);
        }

        .prof-col-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: var(--font-size-xs);
          border: 1.5px solid rgba(255, 255, 255, 0.8);
        }

        .prof-col-info h4 {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .prof-col-count {
          font-size: 0.7rem;
          color: var(--color-text-secondary);
        }

        .prof-col-grid-body {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .grid-slot-cell {
          height: 52px;
          border-bottom: 1px dashed rgba(234, 222, 214, 0.5);
          cursor: pointer;
          position: relative;
          transition: background-color 0.15s ease;
        }

        .grid-slot-cell:hover {
          background-color: rgba(217, 108, 0, 0.06);
        }

        .slot-hover-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-brand-primary);
          opacity: 0;
          transition: opacity 0.15s ease;
          pointer-events: none;
        }

        .grid-slot-cell:hover .slot-hover-text {
          opacity: 1;
        }

        /* LINHA VERMELHA TEMPO REAL */
        .agenda-red-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background-color: var(--color-error);
          z-index: 20;
          pointer-events: none;
        }

        .agenda-red-line::before {
          content: '';
          position: absolute;
          left: -4px;
          top: -3px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--color-error);
        }

        /* CARDS DE AGENDAMENTO FLUTUANTES */
        .timeline-appointment-card {
          position: absolute;
          left: 4px;
          right: 4px;
          border-radius: var(--radius-md);
          padding: 0.45rem 0.6rem;
          z-index: 10;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .timeline-appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          z-index: 15;
        }

        /* Estados Semânticos AppBarber */
        .card-status--confirmed {
          border-left: 4px solid var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
        }

        .card-status--fitting {
          border-left: 4px solid var(--color-warning);
          background-color: var(--color-warning-bg);
        }

        .card-status--in-progress {
          border-left: 4px solid var(--color-info);
          background-color: var(--color-info-bg);
        }

        .card-status--completed {
          border-left: 4px solid var(--color-success);
          background-color: var(--color-success-bg);
        }

        .card-status--pending {
          border-left: 4px solid var(--color-text-secondary);
          background-color: var(--color-bg-secondary);
        }

        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.25rem;
        }

        .card-time-badge {
          font-size: 0.68rem;
          font-weight: 800;
          color: var(--color-text-secondary);
        }

        .card-badges-row {
          display: flex;
          gap: 0.25rem;
        }

        .badge-chip {
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .badge-chip--fitting {
          background-color: #fef3c7;
          color: #92400e;
        }

        .badge-chip--progress {
          background-color: #dbeafe;
          color: #1e40af;
        }

        .badge-chip--paid {
          background-color: #d1fae5;
          color: #065f46;
        }

        .card-client-row {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          margin: 0.2rem 0;
        }

        .card-client-name {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-service-name {
          font-size: 0.68rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-notes-snippet {
          font-size: 0.65rem;
          color: var(--color-brand-hover);
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-actions-toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.3rem;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          padding-top: 0.2rem;
        }

        .btn-card-action {
          padding: 0.2rem 0.4rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background-color: white;
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          transition: all 0.15s ease;
        }

        .btn-action-whatsapp {
          color: var(--color-success);
          border-color: var(--color-border);
        }

        .btn-action-whatsapp:hover {
          background-color: var(--color-success-bg);
        }

        .btn-action-start {
          color: var(--color-info);
          border-color: var(--color-border);
        }

        .btn-action-start:hover {
          background-color: var(--color-info-bg);
        }

        .btn-action-pay {
          background-color: var(--color-success);
          color: white;
          border-color: var(--color-success);
        }

        .btn-action-pay:hover {
          filter: brightness(0.95);
        }

        .btn-action-cancel {
          color: var(--color-error);
          border-color: var(--color-border);
        }

        .btn-action-cancel:hover {
          background-color: var(--color-error-bg);
        }

        .paid-confirmed-label {
          color: var(--color-success);
          display: flex;
          align-items: center;
        }

        /* MODAIS E FORMULÁRIOS */
        .modal-agenda-form,
        .payment-modal-body,
        .cancel-modal-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group-segmented {
          display: flex;
          background-color: rgba(0, 0, 0, 0.04);
          padding: 0.25rem;
          border-radius: var(--radius-md);
          gap: 0.25rem;
        }

        .segmented-btn {
          flex: 1;
          padding: 0.5rem;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .segmented-btn--active {
          background-color: white;
          color: var(--color-brand-primary);
          box-shadow: var(--shadow-sm);
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .input-text,
        .input-select,
        .input-textarea {
          padding: 0.6rem 0.8rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-size-sm);
          background-color: white;
          color: var(--color-text-primary);
          outline: none;
          transition: border-color 0.2s ease;
        }

        .input-text:focus,
        .input-select:focus,
        .input-textarea:focus {
          border-color: var(--color-brand-primary);
        }

        .form-group--checkbox {
          justify-content: flex-end;
          padding-bottom: 0.5rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .modal-actions-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
          border-top: 1px solid var(--color-border);
          padding-top: 0.75rem;
        }

        .btn-primary,
        .btn-secondary,
        .btn-success,
        .btn-danger {
          padding: 0.6rem 1.25rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background-color: var(--color-brand-primary);
          color: white;
        }

        .btn-primary:hover {
          background-color: var(--color-brand-hover);
        }

        .btn-secondary {
          background-color: rgba(0, 0, 0, 0.05);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .btn-success {
          background-color: var(--color-success);
          color: white;
        }

        .btn-danger {
          background-color: var(--color-error);
          color: white;
        }

        .payment-summary-card {
          background-color: var(--color-brand-lightest);
          border: 1px solid var(--color-brand-soft);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
        }

        .summary-row--highlight {
          border-top: 1px dashed var(--color-brand-soft);
          padding-top: 0.4rem;
          margin-top: 0.2rem;
          font-size: var(--font-size-base);
          font-weight: 800;
        }

        .price-val {
          color: var(--color-brand-deep);
        }

        .payment-methods-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .payment-method-chip {
          padding: 0.6rem;
          border: 1px solid var(--color-border);
          background-color: white;
          border-radius: var(--radius-md);
          font-weight: 700;
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .payment-method-chip--active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
        }

        .cancel-alert-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .agenda-skeleton-loading,
        .agenda-empty-state {
          padding: 4rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          text-align: center;
          color: var(--color-text-secondary);
        }

        .spinner-brand {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(217, 108, 0, 0.2);
          border-top-color: var(--color-brand-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @media (max-width: 768px) {
          .agenda-header-control {
            flex-direction: column;
            align-items: flex-start;
          }
          .agenda-header-actions {
            width: 100%;
            justify-content: space-between;
          }
          .form-row-2col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Agenda;
