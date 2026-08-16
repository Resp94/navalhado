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
  shiftCalendarDate,
} from '../../lib/timezone';
import { ClienteRepository } from '../../modules/clientes/ClienteRepository';
import { SupabaseClienteAdapter } from '../../modules/clientes/adapters/SupabaseClienteAdapter';
import { ComandaCheckoutModal } from '../../components/comandas/ComandaCheckoutModal';
import { BloqueioModal } from '../../components/bloqueios/BloqueioModal';
import { ListaEsperaDrawer } from '../../components/espera/ListaEsperaDrawer';
import { EsperaRepository } from '../../modules/espera/EsperaRepository';
import { SupabaseEsperaAdapter } from '../../modules/espera/adapters/SupabaseEsperaAdapter';
import type { WaitingListEntry } from '../../modules/espera/types';
import type { BlockedSlot } from '../../modules/bloqueios/types';
import type { Comanda } from '../../modules/comandas/types';
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
  UnavailableIcon,
  UserGroupIcon,
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

interface CardLayout {
  topPx: number;
  heightPx: number;
  left: string;
  width: string;
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

  const esperaRepository = useMemo(
    () => new EsperaRepository(new SupabaseEsperaAdapter(supabase)),
    []
  );

  // Estados de Controle de Escopo Temporal (Dia vs Semana)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedWeekProfId, setSelectedWeekProfId] = useState<string>('');

  // Estados de Controle de Data e Filtro
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    dateInZone(new Date(), tenant.timezone)
  );

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isBloqueioModalOpen, setIsBloqueioModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isEsperaDrawerOpen, setIsEsperaDrawerOpen] = useState(false);
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);

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

  // Dias da Semana para Visão Semanal
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const dayOfWeek = curr.getDay(); // 0 domingo, 1 segunda...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - distanceToMonday);

    const days: Array<{ dateStr: string; label: string; shortWeekday: string }> = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day);
      const formatted = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(day);
      days.push({
        dateStr,
        label: formatted,
        shortWeekday: weekday.toUpperCase().replace('.', ''),
      });
    }
    return days;
  }, [selectedDate]);

  // Data formatada por extenso em PT-BR
  const formattedDateTitle = useMemo(() => {
    try {
      if (viewMode === 'week') {
        const first = weekDays[0];
        const last = weekDays[6];
        return `Semana: ${first.label} a ${last.label}`;
      }
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(dateObj);
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObj);
      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return `${capitalizedWeekday}, ${formatted}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate, viewMode, weekDays]);

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
          .order('name'),
      ]);

      if (profsRes.error) throw profsRes.error;
      if (servsRes.error) throw servsRes.error;
      if (custsRes.error) throw custsRes.error;

      const activeProfs = profsRes.data || [];
      setProfessionals(activeProfs);
      setSelectedProfessionalIds(activeProfs.map((p) => p.id));
      if (activeProfs.length > 0 && !selectedWeekProfId) {
        setSelectedWeekProfId(activeProfs[0].id);
      }
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
  }, [tenant.tenantId, addToast, selectedWeekProfId]);

  // Carregar Bloqueios de Horário
  const fetchBlockedSlots = useCallback(async () => {
    if (!tenant.tenantId) return;
    try {
      let startIso: string;
      let endIso: string;

      if (viewMode === 'week') {
        const { start } = localDayUtcRange(weekDays[0].dateStr, tenant.timezone);
        const { endExclusive } = localDayUtcRange(weekDays[6].dateStr, tenant.timezone);
        startIso = start;
        endIso = endExclusive;
      } else {
        const { start, endExclusive } = localDayUtcRange(selectedDate, tenant.timezone);
        startIso = start;
        endIso = endExclusive;
      }

      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .gte('start_time', startIso)
        .lt('start_time', endIso)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBlockedSlots((data || []) as BlockedSlot[]);
    } catch (err) {
      console.error('Erro ao buscar bloqueios:', err);
    }
  }, [tenant.tenantId, tenant.timezone, selectedDate, viewMode, weekDays]);

  // Carregar Agendamentos do Período
  const fetchAppointments = useCallback(async () => {
    try {
      if (!tenant.tenantId) return;
      setLoading(true);

      let startIso: string;
      let endIso: string;

      if (viewMode === 'week') {
        const { start } = localDayUtcRange(weekDays[0].dateStr, tenant.timezone);
        const { endExclusive } = localDayUtcRange(weekDays[6].dateStr, tenant.timezone);
        startIso = start;
        endIso = endExclusive;
      } else {
        const { start, endExclusive } = localDayUtcRange(selectedDate, tenant.timezone);
        startIso = start;
        endIso = endExclusive;
      }

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
        .gte('start_time', startIso)
        .lt('start_time', endIso)
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
        service: Array.isArray(item.service) ? item.service[0] : item.service,
      }));

      setAppointments(mapped);
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos:', err);
      addToast('Erro ao carregar os agendamentos do dia.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, tenant.timezone, selectedDate, viewMode, weekDays, addToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    fetchAppointments();
    fetchBlockedSlots();

    // Subscrição Realtime
    const channel = supabase
      .channel(`agenda-realtime-${tenant.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenant.tenantId}`,
        },
        () => {
          fetchAppointments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_slots',
          filter: `tenant_id=eq.${tenant.tenantId}`,
        },
        () => {
          fetchBlockedSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments, fetchBlockedSlots, tenant.tenantId]);

  // Controles de Navegação de Data
  const handlePrevDay = () => {
    const shift = viewMode === 'week' ? -7 : -1;
    setSelectedDate((prev) => shiftCalendarDate(prev, shift));
  };

  const handleNextDay = () => {
    const shift = viewMode === 'week' ? 7 : 1;
    setSelectedDate((prev) => shiftCalendarDate(prev, shift));
  };

  const handleToday = () => {
    setSelectedDate(dateInZone(new Date(), tenant.timezone));
  };

  // Abrir Modal de Encaixe / Agendamento
  const handleOpenNewAppointment = (profId?: string, timeSlot?: string, isFitting = false) => {
    if (profId) {
      setFormProfessionalId(profId);
    } else if (professionals.length > 0) {
      if (isFitting) {
        // Algoritmo de balanceamento de rodízio de balcão
        const counts: Record<string, number> = {};
        for (const app of appointments) {
          counts[app.professional_id] = (counts[app.professional_id] || 0) + 1;
        }
        const suggested = esperaRepository.suggestRotationProfessional(professionals, counts);
        setFormProfessionalId(suggested?.id || professionals[0].id);
      } else {
        setFormProfessionalId(professionals[0].id);
      }
    }

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

  // Encaixe Rápido a partir da Lista de Espera
  const handleEncaixarFromWaitingList = (entry: WaitingListEntry) => {
    setIsEsperaDrawerOpen(false);

    let targetProfId = entry.professional_id;
    if (!targetProfId && professionals.length > 0) {
      const counts: Record<string, number> = {};
      for (const app of appointments) {
        counts[app.professional_id] = (counts[app.professional_id] || 0) + 1;
      }
      const suggested = esperaRepository.suggestRotationProfessional(professionals, counts);
      targetProfId = suggested?.id || professionals[0].id;
    }

    setFormProfessionalId(targetProfId || professionals[0]?.id || '');
    if (entry.service_id) setFormServiceId(entry.service_id);
    setCustomerMode('new');
    setNewCustomerName(entry.customer_name);
    setNewCustomerPhone(entry.customer_phone || '');
    setFormNotes(
      entry.notes ? `[Fila de Espera] ${entry.notes}` : '[Fila de Espera]'
    );
    setFormIsFitting(true);
    setIsModalOpen(true);

    esperaRepository.setStatus(entry.id, 'atendido').catch(console.error);
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
          phone: newCustomerPhone,
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
        origin: 'manual',
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

  // Abrir Modal de Checkout de Comanda
  const handleOpenCheckout = (app: Appointment) => {
    setCheckoutAppointment(app);
    setIsCheckoutModalOpen(true);
  };

  // Remover Bloqueio de Horário
  const handleRemoveBlock = async (blk: BlockedSlot) => {
    if (window.confirm(`Deseja remover o bloqueio "${blk.reason}"?`)) {
      try {
        const { error } = await supabase
          .from('blocked_slots')
          .delete()
          .eq('id', blk.id)
          .eq('tenant_id', tenant.tenantId);

        if (error) throw error;
        addToast('Bloqueio removido com sucesso!', 'success');
        fetchBlockedSlots();
      } catch (err: any) {
        addToast('Erro ao remover bloqueio.', 'error');
      }
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
          updated_at: new Date().toISOString(),
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

  // Algoritmo de posicionamento com detecção de colisões para Split Grid 50%/50%
  const calculateAppointmentsLayout = (
    appointmentsList: Appointment[]
  ): Map<string, CardLayout> => {
    const layoutMap = new Map<string, CardLayout>();

    const sorted = [...appointmentsList].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const app = sorted[i];
      const pos = calculateCardPosition(app.start_time, app.end_time);
      const appStart = new Date(app.start_time).getTime();
      const appEnd = new Date(app.end_time).getTime();

      let hasOverlap = false;
      let isSecondSlot = false;

      for (let j = 0; j < sorted.length; j++) {
        if (i !== j) {
          const other = sorted[j];
          const otherStart = new Date(other.start_time).getTime();
          const otherEnd = new Date(other.end_time).getTime();

          if (appStart < otherEnd && appEnd > otherStart) {
            hasOverlap = true;
            if (app.is_fitting || appStart > otherStart || (appStart === otherStart && i > j)) {
              isSecondSlot = true;
            }
            break;
          }
        }
      }

      if (hasOverlap) {
        layoutMap.set(app.id, {
          topPx: pos.topPx,
          heightPx: pos.heightPx,
          left: isSecondSlot ? 'calc(50% + 2px)' : '4px',
          width: 'calc(50% - 6px)',
        });
      } else {
        layoutMap.set(app.id, {
          topPx: pos.topPx,
          heightPx: pos.heightPx,
          left: '4px',
          width: 'calc(100% - 8px)',
        });
      }
    }

    return layoutMap;
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
              {viewMode === 'week'
                ? `Visão semanal do profissional ${professionals.find((p) => p.id === selectedWeekProfId)?.name || ''}`
                : `${visibleProfessionals.length} profissional(is) em atendimento`}
            </p>
          </div>
        </div>

        <div className="agenda-header-actions">
          {/* Seletor de Escopo Temporal: Dia vs Semana */}
          <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'day'
                  ? 'bg-[var(--color-brand-primary,#D4AF37)] text-black shadow-sm'
                  : 'text-[var(--color-text-secondary,#A1A1AA)] hover:text-white'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'week'
                  ? 'bg-[var(--color-brand-primary,#D4AF37)] text-black shadow-sm'
                  : 'text-[var(--color-text-secondary,#A1A1AA)] hover:text-white'
              }`}
            >
              Semana
            </button>
          </div>

          {/* Navegação de Datas */}
          <div className="agenda-date-navigator">
            <button
              type="button"
              className="btn-date-nav"
              onClick={handlePrevDay}
              title={viewMode === 'week' ? 'Semana Anterior' : 'Dia Anterior'}
              aria-label={viewMode === 'week' ? 'Semana Anterior' : 'Dia Anterior'}
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
              title={viewMode === 'week' ? 'Próxima Semana' : 'Próximo Dia'}
              aria-label={viewMode === 'week' ? 'Próxima Semana' : 'Próximo Dia'}
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

          {/* Filtro de Barbeiros na Visão Dia / Seletor de Barbeiro na Visão Semana */}
          {viewMode === 'day' ? (
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
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedWeekProfId}
                onChange={(e) => setSelectedWeekProfId(e.target.value)}
                className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)]"
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão Fila de Espera */}
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-[var(--color-text-primary,#fff)]"
            onClick={() => setIsEsperaDrawerOpen(true)}
            title="Lista de Espera Diária"
          >
            <HugeiconsIcon icon={UserGroupIcon} size={16} />
            <span>Espera</span>
          </button>

          {/* Botão + Bloquear Horário */}
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--color-error,#EF4444)] border border-[var(--color-error,#EF4444)]/30 rounded-xl hover:bg-[var(--color-error,#EF4444)]/10 transition-colors"
            onClick={() => setIsBloqueioModalOpen(true)}
          >
            <HugeiconsIcon icon={UnavailableIcon} size={16} />
            <span>+ Bloquear</span>
          </button>

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
            <p>Carregando escala...</p>
          </div>
        ) : viewMode === 'day' && visibleProfessionals.length === 0 ? (
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

            {/* Colunas: Visão Dia (por Barbeiro) vs Visão Semana (7 dias para o Barbeiro) */}
            <div className="professionals-columns-container">
              {viewMode === 'day'
                ? visibleProfessionals.map((prof) => {
                    const profAppointments = appointments.filter(
                      (a) => a.professional_id === prof.id
                    );
                    const profBlocked = blockedSlots.filter(
                      (b) => b.professional_id === prof.id
                    );
                    const layoutMap = calculateAppointmentsLayout(profAppointments);

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

                          {/* Bloqueios de Horário */}
                          {profBlocked.map((blk) => {
                            const { topPx, heightPx } = calculateCardPosition(
                              blk.start_time,
                              blk.end_time
                            );
                            const tStart = formatTimeInZone(blk.start_time, tenant.timezone);
                            const tEnd = formatTimeInZone(blk.end_time, tenant.timezone);

                            return (
                              <div
                                key={blk.id}
                                className="timeline-blocked-card"
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                onClick={() => handleRemoveBlock(blk)}
                                title={`Bloqueio: ${blk.reason} (${tStart} - ${tEnd}). Clique para remover.`}
                              >
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="flex items-center gap-1">
                                    <HugeiconsIcon icon={UnavailableIcon} size={14} />
                                    {blk.reason}
                                  </span>
                                  <span className="text-[10px] opacity-75">
                                    {tStart} - {tEnd}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Cards de Agendamento Flutuantes (Split Grid 50%/50%) */}
                          {profAppointments.map((app) => {
                            const layout = layoutMap.get(app.id) || {
                              topPx: 0,
                              heightPx: 36,
                              left: '4px',
                              width: 'calc(100% - 8px)',
                            };

                            const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                            const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

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
                                style={{
                                  top: `${layout.topPx}px`,
                                  height: `${layout.heightPx}px`,
                                  left: layout.left,
                                  width: layout.width,
                                }}
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
                                        handleOpenCheckout(app);
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
                  })
                : weekDays.map((day) => {
                    const dayAppointments = appointments.filter((a) => {
                      const aDate = dateInZone(new Date(a.start_time), tenant.timezone);
                      return aDate === day.dateStr && a.professional_id === selectedWeekProfId;
                    });
                    const dayBlocked = blockedSlots.filter((b) => {
                      const bDate = dateInZone(new Date(b.start_time), tenant.timezone);
                      return bDate === day.dateStr && b.professional_id === selectedWeekProfId;
                    });
                    const layoutMap = calculateAppointmentsLayout(dayAppointments);

                    return (
                      <div
                        key={day.dateStr}
                        className="professional-timeline-column"
                        data-testid={`week-col-${day.dateStr}`}
                      >
                        <div className="prof-col-header">
                          <div className="prof-col-info">
                            <h4 title={day.label}>
                              {day.shortWeekday} • {day.label}
                            </h4>
                            <span className="prof-col-count">
                              {dayAppointments.length} atendimento(s)
                            </span>
                          </div>
                        </div>

                        <div className="prof-col-grid-body">
                          {timeSlots.map((slot) => (
                            <div
                              key={slot}
                              className="grid-slot-cell"
                              onClick={() => {
                                setSelectedDate(day.dateStr);
                                handleOpenNewAppointment(selectedWeekProfId, slot, false);
                              }}
                              title={`Clique para agendar às ${slot} em ${day.label}`}
                            >
                              <span className="slot-hover-text">+ {slot}</span>
                            </div>
                          ))}

                          {/* Bloqueios do Dia */}
                          {dayBlocked.map((blk) => {
                            const { topPx, heightPx } = calculateCardPosition(
                              blk.start_time,
                              blk.end_time
                            );
                            const tStart = formatTimeInZone(blk.start_time, tenant.timezone);
                            const tEnd = formatTimeInZone(blk.end_time, tenant.timezone);

                            return (
                              <div
                                key={blk.id}
                                className="timeline-blocked-card"
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                onClick={() => handleRemoveBlock(blk)}
                                title={`Bloqueio: ${blk.reason} (${tStart} - ${tEnd})`}
                              >
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="flex items-center gap-1">
                                    <HugeiconsIcon icon={UnavailableIcon} size={14} />
                                    {blk.reason}
                                  </span>
                                  <span className="text-[10px] opacity-75">
                                    {tStart} - {tEnd}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Cards do Dia */}
                          {dayAppointments.map((app) => {
                            const layout = layoutMap.get(app.id) || {
                              topPx: 0,
                              heightPx: 36,
                              left: '4px',
                              width: 'calc(100% - 8px)',
                            };

                            const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                            const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

                            return (
                              <div
                                key={app.id}
                                className="timeline-appointment-card card-status--confirmed"
                                style={{
                                  top: `${layout.topPx}px`,
                                  height: `${layout.heightPx}px`,
                                  left: layout.left,
                                  width: layout.width,
                                }}
                              >
                                <div className="card-top-row">
                                  <span className="card-time-badge">
                                    {timeStart} - {timeEnd}
                                  </span>
                                </div>
                                <div className="card-client-row">
                                  <span className="card-client-name">{app.customer?.name}</span>
                                  <span className="card-service-name">{app.service?.name}</span>
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

      {/* 4. MODAL DE CHECKOUT DE COMANDA */}
      {checkoutAppointment && (
        <ComandaCheckoutModal
          isOpen={isCheckoutModalOpen}
          tenantId={tenant.tenantId}
          appointmentId={checkoutAppointment.id}
          customerId={checkoutAppointment.customer?.id}
          customerName={checkoutAppointment.customer?.name || 'Cliente'}
          customerPhone={checkoutAppointment.customer?.phone}
          initialServices={[
            {
              service_id: checkoutAppointment.service.id,
              name: checkoutAppointment.service.name,
              price: checkoutAppointment.service.price,
              professional_id: checkoutAppointment.professional_id,
            },
          ]}
          availableServices={services}
          availableProfessionals={professionals}
          onClose={() => {
            setIsCheckoutModalOpen(false);
            setCheckoutAppointment(null);
          }}
          onFinalizado={(_comanda: Comanda) => {
            addToast('Comanda liquidada e recebimento registrado com sucesso!', 'success');
            fetchAppointments();
          }}
        />
      )}

      {/* 5. MODAL DE BLOQUEIO DE HORÁRIOS */}
      <BloqueioModal
        isOpen={isBloqueioModalOpen}
        tenantId={tenant.tenantId}
        professionals={professionals}
        defaultDateIso={selectedDate}
        defaultProfessionalId={selectedProfessionalIds[0] || professionals[0]?.id}
        onClose={() => setIsBloqueioModalOpen(false)}
        onBloqueioCriado={(_blk) => {
          addToast('Bloqueio criado com sucesso!', 'success');
          fetchBlockedSlots();
        }}
      />

      {/* 6. MODAL DE CANCELAMENTO */}
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

      {/* 7. GAVETA DE LISTA DE ESPERA */}
      <ListaEsperaDrawer
        isOpen={isEsperaDrawerOpen}
        tenantId={tenant.tenantId}
        currentDateIso={selectedDate}
        professionals={professionals}
        services={services}
        onClose={() => setIsEsperaDrawerOpen(false)}
        onEncaixar={handleEncaixarFromWaitingList}
        esperaRepo={esperaRepository}
      />

      {/* 8. ESTILOS EMBUTIDOS DA AGENDA */}
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
        }

        .agenda-header-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        /* NAVEGADOR DE DATAS */
        .agenda-date-navigator {
          display: flex;
          align-items: center;
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .btn-date-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.55rem 0.75rem;
          background: none;
          border: none;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .btn-date-nav:hover {
          background-color: rgba(217, 108, 0, 0.08);
          color: var(--color-brand-primary);
        }

        .btn-date-today {
          font-size: var(--font-size-xs);
          font-weight: 700;
          padding: 0.55rem 0.9rem;
          border-left: 1px solid var(--color-border);
          border-right: 1px solid var(--color-border);
        }

        .btn-date-today--active {
          color: var(--color-brand-primary);
          background-color: rgba(217, 108, 0, 0.06);
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

        /* CARDS DE BLOQUEIO NA GRADE */
        .timeline-blocked-card {
          position: absolute;
          left: 4px;
          right: 4px;
          border-radius: var(--radius-md);
          padding: 0.45rem 0.6rem;
          z-index: 5;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          background: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.05),
            rgba(0, 0, 0, 0.05) 10px,
            rgba(0, 0, 0, 0.1) 10px,
            rgba(0, 0, 0, 0.1) 20px
          );
          background-color: rgba(60, 60, 65, 0.15);
          border: 1px dashed var(--color-text-secondary);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .timeline-blocked-card:hover {
          background-color: rgba(239, 68, 68, 0.1);
          border-color: var(--color-error);
        }

        /* CARDS DE AGENDAMENTO FLUTUANTES */
        .timeline-appointment-card {
          position: absolute;
          border-radius: var(--radius-md);
          padding: 0.45rem 0.6rem;
          z-index: 10;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          background-color: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border-left-width: 4px;
          border-left-style: solid;
        }

        .timeline-appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          z-index: 15;
        }

        /* Status Visual Semântico */
        .card-status--pending {
          border-left-color: var(--color-warning);
          background-color: var(--color-warning-bg);
        }

        .card-status--confirmed {
          border-left-color: var(--color-brand-primary);
          background-color: var(--color-bg-secondary);
        }

        .card-status--fitting {
          border-left-color: var(--color-brand-deep);
          background-color: rgba(242, 178, 119, 0.2);
        }

        .card-status--in-progress {
          border-left-color: var(--color-info);
          background-color: var(--color-info-bg);
        }

        .card-status--completed {
          border-left-color: var(--color-success);
          background-color: var(--color-success-bg);
        }

        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.25rem;
        }

        .card-time-badge {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .card-badges-row {
          display: flex;
          align-items: center;
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
          background-color: var(--color-brand-deep);
          color: white;
        }

        .badge-chip--progress {
          background-color: var(--color-info);
          color: white;
        }

        .badge-chip--paid {
          background-color: var(--color-success);
          color: white;
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
          font-size: 0.7rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-notes-snippet {
          font-size: 0.65rem;
          color: var(--color-brand-primary);
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Toolbar de Ações Rápidas */
        .card-actions-toolbar {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: auto;
          padding-top: 0.2rem;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
        }

        .btn-card-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          border: none;
          border-radius: var(--radius-sm);
          padding: 0.2rem 0.4rem;
          font-size: 0.65rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-whatsapp {
          background-color: #25D366;
          color: white;
        }

        .btn-action-whatsapp:hover {
          background-color: #128C7E;
        }

        .btn-action-start {
          background-color: var(--color-info);
          color: white;
        }

        .btn-action-start:hover {
          background-color: #1A56DB;
        }

        .btn-action-pay {
          background-color: var(--color-brand-primary);
          color: white;
        }

        .btn-action-pay:hover {
          background-color: var(--color-brand-hover);
        }

        .btn-action-cancel {
          background-color: transparent;
          color: var(--color-text-secondary);
          margin-left: auto;
        }

        .btn-action-cancel:hover {
          color: var(--color-error);
          background-color: var(--color-error-bg);
        }

        .paid-confirmed-label {
          color: var(--color-success);
          display: flex;
          align-items: center;
        }

        /* FORMULÁRIO DO MODAL */
        .modal-agenda-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group-segmented {
          display: flex;
          background-color: rgba(0, 0, 0, 0.05);
          padding: 0.25rem;
          border-radius: var(--radius-md);
          gap: 0.25rem;
        }

        .segmented-btn {
          flex: 1;
          border: none;
          padding: 0.45rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border-radius: var(--radius-sm);
          background: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .segmented-btn--active {
          background-color: var(--color-bg-secondary);
          color: var(--color-brand-primary);
          box-shadow: var(--shadow-sm);
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
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .input-text,
        .input-select,
        .input-textarea {
          width: 100%;
          padding: 0.6rem 0.8rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-family: inherit;
        }

        .input-text:focus,
        .input-select:focus,
        .input-textarea:focus {
          outline: none;
          border-color: var(--color-brand-primary);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          cursor: pointer;
          margin-top: 1.5rem;
        }

        .modal-actions-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn-secondary {
          background: none;
          border: 1px solid var(--color-border);
          padding: 0.6rem 1.25rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .btn-primary {
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          padding: 0.6rem 1.5rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
        }

        .btn-primary:hover {
          background-color: var(--color-brand-hover);
        }

        .btn-danger {
          background-color: var(--color-error);
          color: white;
          border: none;
          padding: 0.6rem 1.5rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
        }

        .cancel-alert-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        /* EMPTY STATE E SKELETON */
        .agenda-skeleton-loading,
        .agenda-empty-state {
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          text-align: center;
        }

        .spinner-brand {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(217, 108, 0, 0.2);
          border-top-color: var(--color-brand-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .empty-icon {
          color: var(--color-brand-soft);
        }

        .btn-primary-sm {
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
