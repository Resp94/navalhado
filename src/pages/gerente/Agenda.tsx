import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
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
import { MobileAgendaView } from './mobile/MobileAgendaView';

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

// Mapeamento e auxílio de horários de funcionamento por dia da semana
const DAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export const getDayBusinessHours = (
  dateStr: string,
  businessHours?: Record<string, { active: boolean; open: string; close: string }>
) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay();
  const key = DAY_KEYS[dayIndex];

  const defaultBh: Record<string, { active: boolean; open: string; close: string }> = {
    segunda: { active: true, open: '09:00', close: '18:00' },
    terca: { active: true, open: '09:00', close: '18:00' },
    quarta: { active: true, open: '09:00', close: '18:00' },
    quinta: { active: true, open: '09:00', close: '18:00' },
    sexta: { active: true, open: '09:00', close: '18:00' },
    sabado: { active: true, open: '09:00', close: '15:00' },
    domingo: { active: false, open: '09:00', close: '12:00' },
  };

  if (businessHours && businessHours[key]) {
    return {
      active: businessHours[key].active !== false,
      open: businessHours[key].open || '09:00',
      close: businessHours[key].close || '18:00',
      dayLabel: key,
    };
  }

  return {
    ...defaultBh[key],
    dayLabel: key,
  };
};

// Configurações Padrão da Grade Temporal
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_SLOT_HEIGHT_PX = 104;

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

  const location = useLocation();

  useEffect(() => {
    const locState = location.state as {
      openNewAppointment?: boolean;
      customerId?: string;
      customerName?: string;
      isComanda?: boolean;
    } | null;

    if (locState?.openNewAppointment || locState?.customerId) {
      if (locState.customerId) {
        setCustomerMode('existing');
        setSelectedCustomerId(locState.customerId);
      }
      setIsModalOpen(true);
    }
  }, [location.state]);

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

  // Intervalo e Altura Dinâmicos da Grade Conforme Configurações da Barbearia
  const slotIntervalMinutes =
    tenant.slotIntervalMinutes && tenant.slotIntervalMinutes > 0
      ? tenant.slotIntervalMinutes
      : DEFAULT_SLOT_DURATION_MINUTES;
  const slotHeightPx = Math.max(50, Math.round((slotIntervalMinutes / 30) * DEFAULT_SLOT_HEIGHT_PX));
  const pxPerMinute = slotHeightPx / slotIntervalMinutes;

  // Gerar Slots de Horário da Régua Dinamicamente
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const startTotalMin = gridStartHour * 60;
    const endTotalMin = gridEndHour * 60;
    for (let m = startTotalMin; m < endTotalMin; m += slotIntervalMinutes) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
  }, [gridStartHour, gridEndHour, slotIntervalMinutes]);

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

  // Fechar dropdown de filtro ao clicar fora
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.agenda-filter-container')) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

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
  const handleOpenNewAppointment = (
    profId?: string,
    timeSlot?: string,
    isFitting = false,
    dateToCheck: string = selectedDate
  ) => {
    const nowInstant = new Date();
    const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);

    const dayBh = getDayBusinessHours(dateToCheck, tenant.businessHours);
    if (!dayBh.active) {
      addToast('A barbearia não abre neste dia conforme as configurações de funcionamento.', 'warning');
      return;
    }

    if (timeSlot) {
      const isPast =
        dateToCheck < currentLocalDate ||
        (dateToCheck === currentLocalDate && timeSlot < currentLocalTime);
      if (isPast) {
        addToast('Horário já decorrido. Não é possível agendar no passado.', 'warning');
        return;
      }

      const isOutsideHours =
        timeSlot < dayBh.open ||
        timeSlot >= dayBh.close;
      if (isOutsideHours) {
        addToast(`Horário fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
        return;
      }
    }

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

    if (timeSlot) {
      setFormTime(timeSlot);
    } else {
      // Se não especificou slot, sugerir o próximo horário válido
      if (dateToCheck === currentLocalDate && currentLocalTime > dayBh.open) {
        const nextSlot = timeSlots.find((s) => s >= currentLocalTime && s >= dayBh.open && s < dayBh.close);
        setFormTime(nextSlot || dayBh.open);
      } else {
        setFormTime(dayBh.open);
      }
    }

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

      // Bloqueio de agendamento em horário decorrido
      const nowInstant = new Date();
      const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
      const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);

      if (
        selectedDate < currentLocalDate ||
        (selectedDate === currentLocalDate && formTime < currentLocalTime)
      ) {
        addToast('Não é permitido criar agendamentos em horários já decorridos.', 'warning');
        setSavingAppointment(false);
        return;
      }

      const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);
      if (!dayBh.active) {
        addToast('A barbearia não abre nesta data conforme as configurações.', 'warning');
        setSavingAppointment(false);
        return;
      }

      // Bloqueio fora do expediente
      if (
        formTime < dayBh.open ||
        formTime >= dayBh.close
      ) {
        addToast(`Horário selecionado está fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
        setSavingAppointment(false);
        return;
      }

      // Validação de limite de 1 encaixe por horário/profissional
      if (formIsFitting) {
        const existingFittings = appointments.filter((a) => {
          return (
            a.professional_id === formProfessionalId &&
            a.is_fitting &&
            ['pending', 'confirmed', 'in_progress'].includes(a.status) &&
            formatTimeInZone(a.start_time, tenant.timezone) === formTime
          );
        });

        if (existingFittings.length >= 1) {
          addToast('Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.', 'warning');
          setSavingAppointment(false);
          return;
        }
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

    const topPx = startMinutesFromGridStart * pxPerMinute;

    // Calcular duração
    const endTimeStr = formatTimeInZone(endTimeIso, tenant.timezone);
    const [eh, em] = endTimeStr.split(':').map(Number);
    const durationMinutes = Math.max(slotIntervalMinutes, eh * 60 + em - (h * 60 + m));
    const heightPx = durationMinutes * pxPerMinute - 4;

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
            if (app.is_fitting && !other.is_fitting) {
              isSecondSlot = true;
            } else if (!app.is_fitting && other.is_fitting) {
              isSecondSlot = false;
            } else if (appStart > otherStart || (appStart === otherStart && i > j)) {
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
    return minutesFromStart * pxPerMinute;
  }, [currentTimeMinutes, gridStartHour, totalGridMinutes, pxPerMinute]);

  return (
    <div className="agenda-page">
      {/* ─── VISÃO MOBILE (<= 768px) ─── */}
      <div className="agenda-mobile-view">
        <MobileAgendaView
          timezone={tenant.timezone}
          businessHours={tenant.businessHours}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          professionals={professionals}
          appointments={appointments}
          blockedSlots={blockedSlots}
          timeSlots={timeSlots}
          onOpenNewAppointment={(profId, slot, isFitting) =>
            handleOpenNewAppointment(profId, slot, isFitting ?? false, selectedDate)
          }
          onOpenCheckout={handleOpenCheckout}
          onOpenCancel={handleOpenCancelModal}
          onStartService={handleStartService}
          onDirectWhatsApp={handleDirectWhatsApp}
          onRemoveBlock={handleRemoveBlock}
          onOpenBloqueio={() => setIsBloqueioModalOpen(true)}
          onOpenEspera={() => setIsEsperaDrawerOpen(true)}
        />
      </div>

      {/* ─── VISÃO DESKTOP (> 768px) ─── */}
      <div className="agenda-desktop-view">
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
          <div className="agenda-view-mode-selector">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`btn-view-mode ${viewMode === 'day' ? 'btn-view-mode--active' : ''}`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`btn-view-mode ${viewMode === 'week' ? 'btn-view-mode--active' : ''}`}
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
            <div className="agenda-week-prof-select-wrapper">
              <select
                value={selectedWeekProfId}
                onChange={(e) => setSelectedWeekProfId(e.target.value)}
                className="agenda-week-prof-select"
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
            className="btn-agenda-espera"
            onClick={() => setIsEsperaDrawerOpen(true)}
            title="Ver fila de clientes aguardando no balcão"
          >
            <HugeiconsIcon icon={UserGroupIcon} size={16} />
            <span>Espera</span>
          </button>

          {/* Botão Bloquear Horário */}
          <button
            type="button"
            className="btn-agenda-bloquear"
            onClick={() => setIsBloqueioModalOpen(true)}
            title="Pausar horário para almoço, descanso ou saída"
          >
            <HugeiconsIcon icon={UnavailableIcon} size={16} />
            <span>Bloquear</span>
          </button>

          {/* Botão Mestre Encaixe */}
          <button
            type="button"
            className="btn-master-encaixe"
            onClick={() => handleOpenNewAppointment(undefined, undefined, true)}
            title="Atender cliente que chegou agora sem agendamento"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={18} />
            <span>Encaixe</span>
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
                  <div
                    key={slot}
                    className="time-slot-label"
                    style={{ height: `${slotHeightPx}px` }}
                  >
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
                          {timeSlots.map((slot) => {
                            const nowInstant = new Date();
                            const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
                            const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);

                            const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);
                            const isDayClosed = !dayBh.active;

                            const isPast =
                              selectedDate < currentLocalDate ||
                              (selectedDate === currentLocalDate && slot < currentLocalTime);
                            const isOutsideHours =
                              isDayClosed ||
                              slot < dayBh.open ||
                              slot >= dayBh.close;

                            const slotApps = profAppointments.filter(
                              (app) =>
                                ['pending', 'confirmed', 'in_progress'].includes(app.status) &&
                                formatTimeInZone(app.start_time, tenant.timezone) === slot
                            );
                            const fittingCount = slotApps.filter((a) => a.is_fitting).length;
                            const standardCount = slotApps.filter((a) => !a.is_fitting).length;
                            const isFittingFull = fittingCount >= 1;
                            const isSlotFull = standardCount >= 1 && isFittingFull;

                            let slotClass = 'grid-slot-cell';
                            if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours) slotClass += ' grid-slot-cell--closed';
                            else if (isSlotFull) slotClass += ' grid-slot-cell--full';

                            const handleCellClick = () => {
                              if (isDayClosed) {
                                addToast('A barbearia está fechada neste dia conforme as configurações.', 'warning');
                                return;
                              }
                              if (isPast) {
                                addToast('Horário já decorrido.', 'warning');
                                return;
                              }
                              if (isOutsideHours) {
                                addToast(`Horário fora do funcionamento da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
                                return;
                              }
                              if (isSlotFull) {
                                addToast('Capacidade máxima atingida para este horário (1 agendamento + 1 encaixe).', 'warning');
                                return;
                              }
                              if (standardCount >= 1 && !isFittingFull) {
                                handleOpenNewAppointment(prof.id, slot, true, selectedDate);
                              } else {
                                handleOpenNewAppointment(prof.id, slot, false, selectedDate);
                              }
                            };

                            return (
                              <div
                                key={slot}
                                className={slotClass}
                                style={{ height: `${slotHeightPx}px` }}
                                onClick={handleCellClick}
                                data-testid={`slot-cell-${prof.id}-${slot}`}
                                title={
                                  isDayClosed
                                    ? `Barbearia fechada neste dia (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot})`
                                    : isOutsideHours
                                    ? `Fora do expediente (${slot}) - Funcionamento: ${dayBh.open} às ${dayBh.close}`
                                    : isSlotFull
                                    ? `Horário lotado (${slot})`
                                    : `Clique para agendar às ${slot} com ${prof.name}`
                                }
                              >
                                {!isPast && !isOutsideHours && !isSlotFull && (
                                  <span className="slot-hover-text">+ {slot}</span>
                                )}
                              </div>
                            );
                          })}

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
                                onClick={() => handleOpenCheckout(app)}
                                title={`Clique para abrir comanda/detalhes de ${app.customer?.name || 'Cliente'}`}
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
                                      title="Iniciar atendimento"
                                    >
                                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                                      <span>Iniciar</span>
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

                    const dayBh = getDayBusinessHours(day.dateStr, tenant.businessHours);
                    const isDayClosed = !dayBh.active;

                    return (
                      <div
                        key={day.dateStr}
                        className="professional-timeline-column week-timeline-column"
                        data-testid={`week-col-${day.dateStr}`}
                      >
                        <div className="prof-col-header">
                          <div className="prof-col-info">
                            <h4 title={day.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{day.shortWeekday} • {day.label}</span>
                              {isDayClosed && (
                                <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#EF4444', color: 'white', fontWeight: 800 }}>
                                  Fechado
                                </span>
                              )}
                            </h4>
                            <span className="prof-col-count">
                              {isDayClosed ? 'Fechado' : `${dayAppointments.length} atendimento(s)`}
                            </span>
                          </div>
                        </div>

                        <div className="prof-col-grid-body">
                          {timeSlots.map((slot) => {
                            const nowInstant = new Date();
                            const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
                            const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);

                            const isPast =
                              day.dateStr < currentLocalDate ||
                              (day.dateStr === currentLocalDate && slot < currentLocalTime);
                            const isOutsideHours =
                              isDayClosed ||
                              slot < dayBh.open ||
                              slot >= dayBh.close;

                            const slotApps = dayAppointments.filter(
                              (app) =>
                                ['pending', 'confirmed', 'in_progress'].includes(app.status) &&
                                formatTimeInZone(app.start_time, tenant.timezone) === slot
                            );
                            const fittingCount = slotApps.filter((a) => a.is_fitting).length;
                            const standardCount = slotApps.filter((a) => !a.is_fitting).length;
                            const isFittingFull = fittingCount >= 1;
                            const isSlotFull = standardCount >= 1 && isFittingFull;

                            let slotClass = 'grid-slot-cell';
                            if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours) slotClass += ' grid-slot-cell--closed';
                            else if (isSlotFull) slotClass += ' grid-slot-cell--full';

                            const handleCellClick = () => {
                              if (isDayClosed) {
                                addToast('A barbearia não abre neste dia conforme as configurações.', 'warning');
                                return;
                              }
                              if (isPast) {
                                addToast('Horário já decorrido.', 'warning');
                                return;
                              }
                              if (isOutsideHours) {
                                addToast(`Horário fora do funcionamento da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
                                return;
                              }
                              if (isSlotFull) {
                                addToast('Capacidade máxima atingida para este horário (1 agendamento + 1 encaixe).', 'warning');
                                return;
                              }
                              setSelectedDate(day.dateStr);
                              if (standardCount >= 1 && !isFittingFull) {
                                handleOpenNewAppointment(selectedWeekProfId, slot, true, day.dateStr);
                              } else {
                                handleOpenNewAppointment(selectedWeekProfId, slot, false, day.dateStr);
                              }
                            };

                            return (
                              <div
                                key={slot}
                                className={slotClass}
                                style={{ height: `${slotHeightPx}px` }}
                                onClick={handleCellClick}
                                data-testid={`week-slot-cell-${day.dateStr}-${slot}`}
                                title={
                                  isDayClosed
                                    ? `Barbearia fechada neste dia (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot})`
                                    : isOutsideHours
                                    ? `Fora do expediente (${slot}) - Funcionamento: ${dayBh.open} às ${dayBh.close}`
                                    : isSlotFull
                                    ? `Horário lotado (${slot})`
                                    : `Clique para agendar às ${slot} em ${day.label}`
                                }
                              >
                                {!isPast && !isOutsideHours && !isSlotFull && (
                                  <span className="slot-hover-text">+ {slot}</span>
                                )}
                              </div>
                            );
                          })}

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
                                onClick={() => handleOpenCheckout(app)}
                                title={`Clique para abrir comanda/detalhes de ${app.customer?.name || 'Cliente'}`}
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
      </div>

      {/* 3. MODAL DE NOVO AGENDAMENTO / ENCAIXE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formIsFitting ? 'Novo encaixe rápido' : 'Novo agendamento'}
      >
        <form onSubmit={handleSaveAppointment} className="modal-agenda-form">
          {/* Seletor de Modo do Cliente */}
          <div className="form-group-segmented">
            <button
              type="button"
              className={`segmented-btn ${customerMode === 'existing' ? 'segmented-btn--active' : ''}`}
              onClick={() => setCustomerMode('existing')}
            >
              Cliente cadastrado
            </button>
            <button
              type="button"
              className={`segmented-btn ${customerMode === 'new' ? 'segmented-btn--active' : ''}`}
              onClick={() => setCustomerMode('new')}
            >
              Cliente rápido de balcão
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
                    {c.name}
                  </option>
                ))}
              </select>
              {customers.find((c) => c.id === selectedCustomerId)?.phone && (
                <div className="service-meta-pill">
                  <span>WhatsApp: <strong>{customers.find((c) => c.id === selectedCustomerId)?.phone}</strong></span>
                </div>
              )}
            </div>
          ) : (
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="new-customer-name">Nome do cliente</label>
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
                <label htmlFor="new-customer-phone">WhatsApp ou celular</label>
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
                    {s.name}
                  </option>
                ))}
              </select>
              {services.find((s) => s.id === formServiceId) && (
                <div className="service-meta-pill">
                  <span>Duração: <strong>{services.find((s) => s.id === formServiceId)?.duration_minutes} min</strong></span>
                  <span>•</span>
                  <span>Valor: <strong>R$ {Number(services.find((s) => s.id === formServiceId)?.price).toFixed(2)}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Horário */}
          <div className="form-group">
            <label htmlFor="form-time">Horário de início</label>
            <input
              id="form-time"
              type="time"
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
              className="input-text"
              required
            />
          </div>

          {/* Card de Encaixe de Balcão */}
          <div className={`fitting-toggle-card ${formIsFitting ? 'fitting-toggle-card--active' : ''}`}>
            <div className="fitting-toggle-info">
              <div className="fitting-toggle-header">
                <span className="fitting-toggle-title">Encaixe de balcão (50% do tempo)</span>
                {formIsFitting && <span className="badge-fitting-active">Ativo</span>}
              </div>
              <span className="fitting-toggle-desc">
                Permite atender dois clientes no mesmo horário dividindo a coluna da grade.
              </span>
            </div>
            <label className="checkbox-label" style={{ margin: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Marcar como Encaixe de Balcão"
                checked={formIsFitting}
                onChange={(e) => setFormIsFitting(e.target.checked)}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-primary)' }}>Encaixe</span>
            </label>
          </div>

          {/* Observações */}
          <div className="form-group">
            <label htmlFor="form-notes">Observações do atendimento (opcional)</label>
            <textarea
              id="form-notes"
              rows={2}
              placeholder="Ex: Cliente prefere tesoura no topo, café sem açúcar..."
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
              {savingAppointment ? (
                <span>Salvando...</span>
              ) : formIsFitting ? (
                <span>Confirmar encaixe na agenda</span>
              ) : (
                <span>Salvar agendamento</span>
              )}
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
          initialServices={
            checkoutAppointment.service?.id
              ? [
                  {
                    service_id: checkoutAppointment.service.id,
                    name: checkoutAppointment.service.name || 'Serviço',
                    price: checkoutAppointment.service.price || 0,
                    professional_id: checkoutAppointment.professional_id,
                  },
                ]
              : []
          }
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
        timezone={tenant.timezone}
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
          position: relative;
          z-index: 50;
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

        /* SELETOR DE MODO DE VISÃO (DIA VS SEMANA) */
        .agenda-view-mode-selector {
          display: flex;
          align-items: center;
          padding: 3px;
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          gap: 2px;
        }

        .btn-view-mode {
          padding: 0.4rem 0.85rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-view-mode:hover {
          color: var(--color-text-primary);
        }

        .btn-view-mode--active {
          background-color: var(--color-brand-primary);
          color: white;
          box-shadow: var(--shadow-sm);
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
          z-index: 110;
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
          box-shadow: 0 12px 28px -4px rgba(20, 17, 15, 0.2), var(--shadow-xl);
          padding: 0.75rem;
          z-index: 1000;
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

        /* SELETOR DE BARBEIRO NA SEMANA */
        .agenda-week-prof-select-wrapper {
          display: flex;
          align-items: center;
        }

        .agenda-week-prof-select {
          padding: 0.55rem 0.9rem;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          outline: none;
          cursor: pointer;
        }

        .agenda-week-prof-select:focus {
          border-color: var(--color-brand-primary);
        }

        /* BOTÕES DE AÇÃO DO HEADER */
        .btn-agenda-espera {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem 0.95rem;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-agenda-espera:hover {
          background-color: var(--color-brand-lightest);
          border-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
        }

        .btn-agenda-bloquear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem 0.95rem;
          background-color: var(--color-error-bg);
          border: 1px solid rgba(240, 82, 82, 0.3);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-error);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-agenda-bloquear:hover {
          background-color: #fbd5d5;
          border-color: var(--color-error);
        }

        /* BOTÃO MESTRE + ENCAIXE */
        .btn-master-encaixe {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem 1.15rem;
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
          min-height: 50px;
          box-sizing: border-box;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 6px;
          font-size: 0.75rem;
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

        .week-timeline-column {
          min-width: 140px;
          flex: 1;
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
          min-height: 50px;
          box-sizing: border-box;
          border-bottom: 1px dashed rgba(234, 222, 214, 0.5);
          cursor: pointer;
          position: relative;
          transition: background-color 0.15s ease;
        }

        .grid-slot-cell:hover {
          background-color: rgba(217, 108, 0, 0.06);
        }

        .grid-slot-cell--past {
          background-color: rgba(0, 0, 0, 0.035);
          cursor: not-allowed;
        }

        .grid-slot-cell--past:hover {
          background-color: rgba(0, 0, 0, 0.035) !important;
        }

        .grid-slot-cell--closed {
          background: repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0.02),
            rgba(0, 0, 0, 0.02) 6px,
            rgba(0, 0, 0, 0.05) 6px,
            rgba(0, 0, 0, 0.05) 12px
          );
          cursor: not-allowed;
          opacity: 0.6;
        }

        .grid-slot-cell--closed:hover {
          background: repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0.02),
            rgba(0, 0, 0, 0.02) 6px,
            rgba(0, 0, 0, 0.05) 6px,
            rgba(0, 0, 0, 0.05) 12px
          ) !important;
        }

        .grid-slot-cell--full {
          background-color: rgba(217, 108, 0, 0.08);
          cursor: not-allowed;
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
          padding: 0.4rem 0.55rem;
          z-index: 10;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          box-sizing: border-box;
          background-color: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.15s ease;
        }

        .timeline-appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          filter: brightness(1.02);
          z-index: 15;
        }

        /* Status Visual Semântico */
        .card-status--pending {
          border-color: rgba(217, 119, 6, 0.4);
          background-color: var(--color-warning-bg);
        }

        .card-status--confirmed {
          border-color: rgba(217, 108, 0, 0.3);
          background-color: var(--color-bg-secondary);
        }

        .card-status--fitting {
          border-color: rgba(106, 46, 0, 0.35);
          background-color: rgba(242, 178, 119, 0.2);
        }

        .card-status--in-progress {
          border-color: rgba(63, 131, 248, 0.4);
          background-color: var(--color-info-bg);
        }

        .card-status--completed {
          border-color: rgba(14, 159, 110, 0.4);
          background-color: var(--color-success-bg);
        }

        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.25rem;
        }

        .card-time-badge {
          font-size: 0.72rem;
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
          gap: 0.05rem;
          margin: 0.1rem 0;
        }

        .card-client-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
        }

        .card-service-name {
          font-size: 0.72rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
          font-weight: 500;
        }

        .card-notes-snippet {
          font-size: 0.62rem;
          color: var(--color-brand-primary);
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1;
          margin-top: 1px;
        }

        /* Toolbar de Ações Rápidas */
        .card-actions-toolbar {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-top: auto;
          padding-top: 0.2rem;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
        }

        .btn-card-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          border: none;
          border-radius: var(--radius-sm);
          padding: 0.25rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 700;
          font-family: var(--font-family-base);
          line-height: 1;
          height: 24px;
          box-sizing: border-box;
          vertical-align: middle;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-card-action span {
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1;
        }

        .btn-card-action svg {
          display: block;
          flex-shrink: 0;
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
          box-sizing: border-box;
        }

        .input-textarea {
          resize: vertical;
          min-height: 60px;
          max-height: 160px;
          line-height: 1.4;
        }

        .input-text:focus,
        .input-select:focus,
        .input-textarea:focus {
          outline: none;
          border-color: var(--color-brand-primary);
        }

        .service-meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.25rem;
          font-size: 0.72rem;
          color: var(--color-text-secondary);
        }

        .service-meta-pill strong {
          color: var(--color-brand-primary);
        }

        .fitting-toggle-card {
          padding: 0.75rem 0.9rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }

        .fitting-toggle-card--active {
          background-color: rgba(242, 178, 119, 0.15);
          border-color: var(--color-brand-soft);
        }

        .fitting-toggle-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .fitting-toggle-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .fitting-toggle-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .badge-fitting-active {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-sm);
          background-color: var(--color-brand-primary);
          color: white;
          text-transform: uppercase;
        }

        .fitting-toggle-desc {
          font-size: 0.7rem;
          color: var(--color-text-secondary);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          cursor: pointer;
        }

        .modal-actions-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
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
          min-height: 44px;
          box-sizing: border-box;
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
          min-height: 44px;
          box-sizing: border-box;
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
          min-height: 44px;
          box-sizing: border-box;
        }

        @media (max-width: 480px) {
          .modal-actions-footer {
            flex-direction: column-reverse;
            width: 100%;
          }
          .modal-actions-footer button {
            width: 100%;
          }
          .form-row-2col {
            grid-template-columns: 1fr !important;
          }
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

        .agenda-mobile-view {
          display: none;
        }

        .agenda-desktop-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        @media (max-width: 768px) {
          .agenda-mobile-view {
            display: block;
          }
          .agenda-desktop-view {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
