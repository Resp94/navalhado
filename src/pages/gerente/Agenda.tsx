import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
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
import { openWhatsApp } from '../../lib/whatsapp';
import type { WaitingListEntry } from '../../modules/espera/types';
import type { BlockedSlot } from '../../modules/bloqueios/types';
import type { Comanda } from '../../modules/comandas/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  Clock01Icon,
  PlusSignIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FilterIcon,
  CheckmarkCircle02Icon,
  Note01Icon,
  AlertCircleIcon,
  UnavailableIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { MobileAgendaView } from './mobile/MobileAgendaView';
import {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  generateTimeSlotsForSchedule,
} from '../../lib/schedule';
import type { ProfessionalDaySchedule, WeeklySchedule } from '../../lib/schedule';

export {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  generateTimeSlotsForSchedule,
};
export type { ProfessionalDaySchedule, WeeklySchedule };

// --- Interfaces de Domínio ---
export interface Professional {
  id: string;
  name: string;
  is_active: boolean;
  phone?: string;
  weekly_schedule?: WeeklySchedule | null;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface Customer {
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

export interface Appointment {
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
  const [formDate, setFormDate] = useState(selectedDate);
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
  const navigate = useNavigate();

  const clearActionUrl = useCallback(() => {
    if (location.search && location.search.includes('action=')) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    const locState = location.state as {
      action?: string;
      openNewAppointment?: boolean;
      customerId?: string;
      customerName?: string;
      isComanda?: boolean;
    } | null;

    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get('action') || locState?.action;

    if (action === 'encaixe') {
      setFormIsFitting(true);
      if (locState?.customerId) {
        setCustomerMode('existing');
        setSelectedCustomerId(locState.customerId);
      }
      setIsModalOpen(true);
    } else if (locState?.openNewAppointment || locState?.customerId) {
      if (locState?.customerId) {
        setCustomerMode('existing');
        setSelectedCustomerId(locState.customerId);
      }
      setIsModalOpen(true);
    } else if (action === 'bloqueio') {
      setIsBloqueioModalOpen(true);
    } else if (action === 'espera') {
      setIsEsperaDrawerOpen(true);
    }
  }, [location.state, location.search]);

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

  // Intervalo e Altura Dinâmicos da Grade Conforme Configurações da Barbearia
  const slotIntervalMinutes =
    tenant.slotIntervalMinutes && tenant.slotIntervalMinutes > 0
      ? tenant.slotIntervalMinutes
      : DEFAULT_SLOT_DURATION_MINUTES;
  const slotHeightPx = Math.max(50, Math.round((slotIntervalMinutes / 30) * DEFAULT_SLOT_HEIGHT_PX));
  const pxPerMinute = slotHeightPx / slotIntervalMinutes;

  // Horários de Início e Término da Grade Dinâmicos Conforme Funcionamento da Barbearia
  const { gridStartTotalMin, gridEndTotalMin } = useMemo(() => {
    if (viewMode === 'week') {
      let minOpen = 24 * 60;
      let maxClose = 0;
      let anyActive = false;

      weekDays.forEach((d) => {
        const bh = getDayBusinessHours(d.dateStr, tenant.businessHours);
        if (bh.active) {
          anyActive = true;
          const [oh, om] = bh.open.split(':').map(Number);
          const [ch, cm] = bh.close.split(':').map(Number);
          minOpen = Math.min(minOpen, oh * 60 + om);
          maxClose = Math.max(maxClose, ch * 60 + cm);
        }
      });

      if (!anyActive) {
        minOpen = 9 * 60;
        maxClose = 18 * 60;
      }

      // Expandir se houver agendamentos ou bloqueios pontuais fora da grade regular
      appointments.forEach((a) => {
        const [ah, am] = formatTimeInZone(a.start_time, tenant.timezone).split(':').map(Number);
        const [eh, em] = formatTimeInZone(a.end_time, tenant.timezone).split(':').map(Number);
        minOpen = Math.min(minOpen, ah * 60 + am);
        maxClose = Math.max(maxClose, eh * 60 + em);
      });
      blockedSlots.forEach((b) => {
        const [bh, bm] = formatTimeInZone(b.start_time, tenant.timezone).split(':').map(Number);
        const [eh, em] = formatTimeInZone(b.end_time, tenant.timezone).split(':').map(Number);
        minOpen = Math.min(minOpen, bh * 60 + bm);
        maxClose = Math.max(maxClose, eh * 60 + em);
      });

      return { gridStartTotalMin: minOpen, gridEndTotalMin: maxClose };
    }

    // Visão Diária
    const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);
    if (!dayBh.active) {
      if (appointments.length === 0 && blockedSlots.length === 0) {
        return { gridStartTotalMin: 9 * 60, gridEndTotalMin: 18 * 60 };
      }
    }

    const [oh, om] = dayBh.open.split(':').map(Number);
    const [ch, cm] = dayBh.close.split(':').map(Number);
    let startMin = oh * 60 + om;
    let endMin = ch * 60 + cm;

    appointments.forEach((a) => {
      const [ah, am] = formatTimeInZone(a.start_time, tenant.timezone).split(':').map(Number);
      const [eh, em] = formatTimeInZone(a.end_time, tenant.timezone).split(':').map(Number);
      startMin = Math.min(startMin, ah * 60 + am);
      endMin = Math.max(endMin, eh * 60 + em);
    });
    blockedSlots.forEach((b) => {
      const [bh, bm] = formatTimeInZone(b.start_time, tenant.timezone).split(':').map(Number);
      const [eh, em] = formatTimeInZone(b.end_time, tenant.timezone).split(':').map(Number);
      startMin = Math.min(startMin, bh * 60 + bm);
      endMin = Math.max(endMin, eh * 60 + em);
    });

    return { gridStartTotalMin: startMin, gridEndTotalMin: endMin };
  }, [viewMode, selectedDate, weekDays, tenant.businessHours, appointments, blockedSlots, tenant.timezone]);

  const totalGridMinutes = Math.max(slotIntervalMinutes, gridEndTotalMin - gridStartTotalMin);

  // Gerar Slots de Horário da Régua Dinamicamente
  const timeSlots = useMemo(() => {
    const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);
    if (viewMode === 'day' && !dayBh.active && appointments.length === 0 && blockedSlots.length === 0) {
      return [];
    }

    if (selectedProfessionalIds.length === 1) {
      const selectedProf = professionals.find((p) => p.id === selectedProfessionalIds[0]);
      const profSchedule = selectedProf ? getProfessionalDaySchedule(selectedProf, selectedDate) : null;
      if (profSchedule && profSchedule.active !== false && profSchedule.start && profSchedule.end) {
        return generateTimeSlotsForSchedule(
          profSchedule.start,
          profSchedule.end,
          slotIntervalMinutes,
          profSchedule.break_start,
          profSchedule.break_end
        );
      }
    }

    const slotsSet = new Set<string>();
    const baseSlots = generateTimeSlotsForSchedule(
      dayBh.open || '08:00',
      dayBh.close || '19:00',
      slotIntervalMinutes
    );
    baseSlots.forEach((s) => slotsSet.add(s));

    professionals.forEach((p) => {
      if (!p.is_active) return;
      const sched = getProfessionalDaySchedule(p, selectedDate);
      if (sched && sched.active !== false && sched.start && sched.end) {
        const pSlots = generateTimeSlotsForSchedule(
          sched.start,
          sched.end,
          slotIntervalMinutes,
          sched.break_start,
          sched.break_end
        );
        pSlots.forEach((s) => slotsSet.add(s));
      }
    });

    return Array.from(slotsSet).sort((a, b) => a.localeCompare(b));
  }, [selectedDate, tenant.businessHours, viewMode, appointments.length, blockedSlots.length, selectedProfessionalIds, professionals, slotIntervalMinutes]);

  // Geração de horários 24 horas (00:00 às 23:00) para encaixes
  const all24hTimeSlots = useMemo(() => {
    const slots: string[] = [];
    const interval = slotIntervalMinutes > 0 ? slotIntervalMinutes : 30;
    for (let m = 0; m < 24 * 60; m += interval) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return slots;
  }, [slotIntervalMinutes]);

  // Slots de Horário válidos para seleção no Modal de Novo Agendamento
  const modalAvailableTimeSlots = useMemo(() => {
    if (formIsFitting) {
      return all24hTimeSlots;
    }

    const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);
    if (!dayBh.active) return [];

    if (formProfessionalId) {
      const prof = professionals.find((p) => p.id === formProfessionalId);
      const profSched = prof ? getProfessionalDaySchedule(prof, selectedDate) : null;
      if (profSched && profSched.active !== false && profSched.start && profSched.end) {
        return generateTimeSlotsForSchedule(
          profSched.start,
          profSched.end,
          slotIntervalMinutes,
          profSched.break_start,
          profSched.break_end
        );
      }
    }

    const slotsSet = new Set<string>();
    const baseSlots = generateTimeSlotsForSchedule(
      dayBh.open,
      dayBh.close,
      slotIntervalMinutes
    );
    baseSlots.forEach((s) => slotsSet.add(s));

    professionals.forEach((p) => {
      if (!p.is_active) return;
      const sched = getProfessionalDaySchedule(p, selectedDate);
      if (sched && sched.active !== false && sched.start && sched.end) {
        const pSlots = generateTimeSlotsForSchedule(
          sched.start,
          sched.end,
          slotIntervalMinutes,
          sched.break_start,
          sched.break_end
        );
        pSlots.forEach((s) => slotsSet.add(s));
      }
    });

    return Array.from(slotsSet).sort((a, b) => a.localeCompare(b));
  }, [all24hTimeSlots, formIsFitting, selectedDate, tenant.businessHours, formProfessionalId, professionals, slotIntervalMinutes]);

  const currentService = useMemo(
    () => services.find((s) => s.id === formServiceId),
    [services, formServiceId]
  );
  const currentServiceDuration = currentService?.duration_minutes || slotIntervalMinutes;

  // Profissionais disponíveis no horário selecionado (não estão em intervalo nem de folga considerando duração)
  // Em modo de Encaixe (formIsFitting), o gerente tem flexibilidade total para alocar qualquer profissional ativo
  const availableProfessionalsForFormTime = useMemo(() => {
    return professionals.filter((p) => {
      if (!p.is_active) return false;
      if (formIsFitting) return true;
      return isProfessionalWorkingAt(p, selectedDate, formTime, currentServiceDuration);
    });
  }, [professionals, formIsFitting, selectedDate, formTime, currentServiceDuration]);

  const isPastFormTime = useMemo(() => {
    const nowInstant = new Date();
    const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);
    return (
      selectedDate < currentLocalDate ||
      (selectedDate === currentLocalDate && formTime < currentLocalTime)
    );
  }, [selectedDate, formTime, tenant.timezone]);

  // Sincronizar barbeiro selecionado caso o atual não esteja disponível no horário
  useEffect(() => {
    if (isModalOpen) {
      if (availableProfessionalsForFormTime.length > 0) {
        if (!availableProfessionalsForFormTime.some((p) => p.id === formProfessionalId)) {
          setFormProfessionalId(availableProfessionalsForFormTime[0].id);
        }
      } else {
        setFormProfessionalId('');
      }
    }
  }, [isModalOpen, availableProfessionalsForFormTime, formProfessionalId]);

  // Forçar encaixe de balcão para horários decorridos
  useEffect(() => {
    if (isModalOpen && isPastFormTime) {
      setFormIsFitting(true);
    }
  }, [isModalOpen, isPastFormTime]);

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
          .select('id, name, is_active, phone, weekly_schedule')
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

    let finalIsFitting = isFitting;

    if (timeSlot) {
      const isPast =
        dateToCheck < currentLocalDate ||
        (dateToCheck === currentLocalDate && timeSlot < currentLocalTime);
      if (isPast) {
        finalIsFitting = true;
      }

      if (profId) {
        const prof = professionals.find((p) => p.id === profId);
        if (prof && isProfessionalOnBreak(prof, dateToCheck, timeSlot)) {
          addToast(getProfessionalBreakMessage(prof, dateToCheck), 'warning');
          return;
        }
      }

      const isOutsideHours =
        timeSlot < dayBh.open ||
        timeSlot >= dayBh.close;
      if (isOutsideHours) {
        addToast(`Horário fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
        return;
      }
    }

    const targetTime =
      timeSlot ||
      (dateToCheck === currentLocalDate && currentLocalTime > dayBh.open
        ? timeSlots.find((s) => s >= currentLocalTime && s >= dayBh.open && s < dayBh.close) || dayBh.open
        : dayBh.open);

    setFormTime(targetTime);

    if (profId) {
      setFormProfessionalId(profId);
    } else {
      const available = professionals.filter((p) => {
        if (!p.is_active) return false;
        return isProfessionalWorkingAt(p, dateToCheck, targetTime);
      });

      if (available.length > 0) {
        if (finalIsFitting) {
          // Algoritmo de balanceamento de rodízio de balcão apenas entre profissionais disponíveis
          const counts: Record<string, number> = {};
          for (const app of appointments) {
            counts[app.professional_id] = (counts[app.professional_id] || 0) + 1;
          }
          const suggested = esperaRepository.suggestRotationProfessional(available, counts);
          setFormProfessionalId(suggested?.id || available[0].id);
        } else {
          setFormProfessionalId(available[0].id);
        }
      } else if (professionals.length > 0) {
        setFormProfessionalId(professionals[0].id);
      }
    }

    setFormDate(dateToCheck);
    setFormIsFitting(finalIsFitting);
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
    setFormServiceId(entry.service_id || (services[0]?.id ?? ''));
    setFormDate(selectedDate);
    const nowInstant = new Date();
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);
    setFormTime(
      timeSlots.find((s) => s >= currentLocalTime) ||
        timeSlots[0] ||
        '09:00'
    );
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

      // Bloqueio de agendamento em horário decorrido (permitido apenas para Encaixe de balcão)
      const nowInstant = new Date();
      const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
      const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);

      const isPastTime =
        formDate < currentLocalDate ||
        (formDate === currentLocalDate && formTime < currentLocalTime);

      if (isPastTime && !formIsFitting) {
        addToast('Horários já decorridos são permitidos exclusivamente como Encaixe de balcão.', 'warning');
        setSavingAppointment(false);
        return;
      }

      // Validação de intervalo e disponibilidade do barbeiro
      const selectedProf = professionals.find((p) => p.id === formProfessionalId);
      if (!selectedProf) {
        addToast('Selecione um profissional disponível.', 'warning');
        setSavingAppointment(false);
        return;
      }

      if (!formIsFitting) {
        if (isProfessionalOnBreak(selectedProf, formDate, formTime, selectedService.duration_minutes)) {
          addToast(getProfessionalBreakMessage(selectedProf, formDate), 'warning');
          setSavingAppointment(false);
          return;
        }

        if (!isProfessionalWorkingAt(selectedProf, formDate, formTime, selectedService.duration_minutes)) {
          addToast(`O profissional ${selectedProf.name} não está atendendo neste horário ou o serviço ultrapassa seu expediente.`, 'warning');
          setSavingAppointment(false);
          return;
        }

        const dayBh = getDayBusinessHours(formDate, tenant.businessHours);
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
      const startIso = localDateTimeToIso(formDate, formTime, tenant.timezone);
      const [sh, sm] = formTime.split(':').map(Number);
      const endTotalMinutes = sh * 60 + sm + selectedService.duration_minutes;
      const eh = Math.floor(endTotalMinutes / 60);
      const em = endTotalMinutes % 60;
      const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      const endIso = localDateTimeToIso(formDate, endTimeStr, tenant.timezone);

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

      const { data: insertedApp, error: insertErr } = await supabase
        .from('appointments')
        .insert(payload)
        .select()
        .single();

      if (insertErr) {
        if (insertErr.code === '23P01') {
          addToast('Horário indisponível: este profissional já possui atendimento agendado neste período.', 'error');
          return;
        }
        throw insertErr;
      }

      // Garantir abertura automática de comanda vinculada ao agendamento / encaixe
      if (insertedApp && tenant.tenantId) {
        try {
          const { data: existingCmd } = await supabase
            .from('comandas')
            .select('id')
            .eq('appointment_id', insertedApp.id)
            .maybeSingle();

          if (!existingCmd) {
            const srvPrice = Number(selectedService.price || 0);
            const { data: newCmd, error: cmdErr } = await supabase
              .from('comandas')
              .insert({
                tenant_id: tenant.tenantId,
                appointment_id: insertedApp.id,
                customer_id: finalCustomerId || null,
                status: 'aberta',
                total_amount: srvPrice,
                discount_amount: 0,
                tip_amount: 0,
              })
              .select()
              .single();

            if (!cmdErr && newCmd && formServiceId) {
              await supabase.from('comanda_itens').insert({
                comanda_id: newCmd.id,
                tenant_id: tenant.tenantId,
                item_type: 'servico',
                service_id: formServiceId,
                professional_id: formProfessionalId || null,
                quantity: 1,
                unit_price: srvPrice,
                total_price: srvPrice,
              });
            }
          }
        } catch (comandaErr) {
          console.error('Erro ao garantir comanda imediata ao salvar agendamento:', comandaErr);
        }
      }

      addToast(
        formIsFitting ? 'Encaixe agendado com sucesso!' : 'Agendamento criado com sucesso!',
        'success'
      );
      setIsModalOpen(false);
      clearActionUrl();
      fetchAppointments();
    } catch (err: unknown) {
      console.error('Erro ao salvar agendamento:', err);
      const message = err instanceof Error ? err.message : 'Erro ao agendar horário.';
      addToast(message, 'error');
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

      // Garantir abertura automática de comanda vinculada ao agendamento
      try {
        const { data: existingComanda } = await supabase
          .from('comandas')
          .select('id')
          .eq('appointment_id', app.id)
          .maybeSingle();

        if (!existingComanda && tenant.tenantId) {
          const servicePrice = Number(app.service?.price || 0);
          const { data: newComanda, error: cmdError } = await supabase
            .from('comandas')
            .insert({
              tenant_id: tenant.tenantId,
              appointment_id: app.id,
              customer_id: app.customer?.id || null,
              status: 'aberta',
              total_amount: servicePrice,
              discount_amount: 0,
              tip_amount: 0,
            })
            .select()
            .single();

          if (!cmdError && newComanda && app.service?.id) {
            await supabase.from('comanda_itens').insert({
              comanda_id: newComanda.id,
              tenant_id: tenant.tenantId,
              item_type: 'servico',
              service_id: app.service.id,
              professional_id: app.professional_id || null,
              quantity: 1,
              unit_price: servicePrice,
              total_price: servicePrice,
            });
          }
        }
      } catch (comandaErr) {
        console.error('Erro ao abrir comanda automática para agendamento:', comandaErr);
      }

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

      // Atualização otimista imediata para liberar o horário na tela sem refresh (a trigger no banco cancela a comanda atrelada)
      setAppointments((prev) => prev.filter((a) => a.id !== targetAppointment.id));

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
    openWhatsApp(
      phone,
      `Olá ${customerName}! Confirmando seu horário de atendimento hoje às ${timeFormatted} na ${tenant.tenantName}.`
    );
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
    const startMinutesFromGridStart = (h * 60 + m) - gridStartTotalMin;

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
    const minutesFromStart = currentTimeMinutes - gridStartTotalMin;
    if (minutesFromStart < 0 || minutesFromStart > totalGridMinutes) return null;
    return minutesFromStart * pxPerMinute;
  }, [currentTimeMinutes, gridStartTotalMin, totalGridMinutes, pxPerMinute]);

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
        ) : viewMode === 'day' && timeSlots.length === 0 ? (
          <div className="agenda-empty-state" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', marginBottom: '1rem' }}>
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--color-text-primary)' }}>Barbearia fechada neste dia</h3>
            <p style={{ color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem', fontSize: '0.875rem' }}>
              Conforme os horários de funcionamento configurados, o estabelecimento não abre neste dia.
            </p>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={handleToday}
            >
              Ir para hoje
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

                            const isProfBreak = isProfessionalOnBreak(prof, selectedDate, slot);
                            const isProfWorking = isProfessionalWorkingAt(prof, selectedDate, slot);

                            let slotClass = 'grid-slot-cell';
                            if (isProfBreak) slotClass += ' grid-slot-cell--break';
                            else if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours || !isProfWorking) slotClass += ' grid-slot-cell--closed';
                            else if (isSlotFull) slotClass += ' grid-slot-cell--full';

                            const handleCellClick = () => {
                              if (isDayClosed) {
                                addToast('A barbearia está fechada neste dia conforme as configurações.', 'warning');
                                return;
                              }
                              if (isProfBreak) {
                                addToast(getProfessionalBreakMessage(prof, selectedDate), 'warning');
                                return;
                              }
                              if (isOutsideHours) {
                                addToast(`Horário fora do funcionamento da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
                                return;
                              }
                              if (!isProfWorking) {
                                addToast(`O profissional ${prof.name} não está atendendo neste horário.`, 'warning');
                                return;
                              }
                              if (isSlotFull) {
                                addToast('Capacidade máxima atingida para este horário (1 agendamento + 1 encaixe).', 'warning');
                                return;
                              }
                              if (isPast) {
                                handleOpenNewAppointment(prof.id, slot, true, selectedDate);
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
                                    : isProfBreak
                                    ? `Intervalo do profissional ${prof.name} (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot}) - Clique para registrar encaixe`
                                    : isOutsideHours || !isProfWorking
                                    ? `Fora do expediente/atendimento de ${prof.name} (${slot})`
                                    : isSlotFull
                                    ? `Horário lotado (${slot})`
                                    : `Clique para agendar às ${slot} com ${prof.name}`
                                }
                              >
                                {isProfBreak && (
                                  <span className="slot-break-label">
                                    {getProfessionalDaySchedule(prof, selectedDate)?.break_end
                                      ? `Intervalo até ${getProfessionalDaySchedule(prof, selectedDate)?.break_end}`
                                      : 'Intervalo'}
                                  </span>
                                )}
                                {!isProfBreak && isPast && (
                                  <span className="slot-hover-text">Encaixe</span>
                                )}
                                {!isProfBreak && !isPast && !isOutsideHours && isProfWorking && !isSlotFull && (
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

                                {app.payment_status === 'paid' && (
                                  <div className="card-actions-toolbar">
                                    <span className="paid-confirmed-label">
                                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} /> Pago
                                    </span>
                                  </div>
                                )}
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

                            const weekProf = professionals.find((p) => p.id === selectedWeekProfId);
                            const isProfBreak = weekProf ? isProfessionalOnBreak(weekProf, day.dateStr, slot) : false;
                            const isProfWorking = weekProf ? isProfessionalWorkingAt(weekProf, day.dateStr, slot) : true;

                            let slotClass = 'grid-slot-cell';
                            if (isProfBreak) slotClass += ' grid-slot-cell--break';
                            else if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours || !isProfWorking) slotClass += ' grid-slot-cell--closed';
                            else if (isSlotFull) slotClass += ' grid-slot-cell--full';

                            const handleCellClick = () => {
                              if (isDayClosed) {
                                addToast('A barbearia não abre neste dia conforme as configurações.', 'warning');
                                return;
                              }
                              if (isProfBreak) {
                                if (weekProf) {
                                  addToast(getProfessionalBreakMessage(weekProf, day.dateStr), 'warning');
                                }
                                return;
                              }
                              if (isOutsideHours) {
                                addToast(`Horário fora do funcionamento da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
                                return;
                              }
                              if (!isProfWorking) {
                                addToast(`O profissional ${weekProf?.name || 'selecionado'} não está atendendo neste horário.`, 'warning');
                                return;
                              }
                              if (isSlotFull) {
                                addToast('Capacidade máxima atingida para este horário (1 agendamento + 1 encaixe).', 'warning');
                                return;
                              }
                              setSelectedDate(day.dateStr);
                              if (isPast) {
                                handleOpenNewAppointment(selectedWeekProfId, slot, true, day.dateStr);
                                return;
                              }
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
                                    : isProfBreak
                                    ? `Intervalo do profissional ${weekProf?.name || ''} (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot}) - Clique para registrar encaixe`
                                    : isOutsideHours || !isProfWorking
                                    ? `Fora do expediente/atendimento (${slot})`
                                    : isSlotFull
                                    ? `Horário lotado (${slot})`
                                    : `Clique para agendar às ${slot} em ${day.label}`
                                }
                              >
                                {isProfBreak && (
                                  <span className="slot-break-label">
                                    {weekProf && getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end
                                      ? `Intervalo até ${getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end}`
                                      : 'Intervalo'}
                                  </span>
                                )}
                                {!isProfBreak && isPast && (
                                  <span className="slot-hover-text">Encaixe</span>
                                )}
                                {!isProfBreak && !isPast && !isOutsideHours && isProfWorking && !isSlotFull && (
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
        onClose={() => {
          setIsModalOpen(false);
          clearActionUrl();
        }}
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
                {availableProfessionalsForFormTime.length > 0 ? (
                  availableProfessionalsForFormTime.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    Nenhum barbeiro disponível (intervalo/folga)
                  </option>
                )}
              </select>
              {availableProfessionalsForFormTime.length === 0 && (
                <span className="form-error" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Nenhum barbeiro disponível às {formTime} (intervalo ou folga).
                </span>
              )}
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

          {/* Data e Horário */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="form-date">Data do atendimento</label>
              <input
                id="form-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="input-text"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="form-time">Horário de início</label>
              {modalAvailableTimeSlots.length > 0 ? (
                <select
                  id="form-time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="input-select"
                  required
                >
                  {modalAvailableTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="form-time"
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="input-text"
                  required
                />
              )}
            </div>
          </div>

          {/* Card de Encaixe de Balcão */}
          <div className={`fitting-toggle-card ${formIsFitting ? 'fitting-toggle-card--active' : ''}`}>
            <div className="fitting-toggle-info">
              <div className="fitting-toggle-header">
                <span className="fitting-toggle-title">Encaixe de balcão (50% do tempo)</span>
                {formIsFitting && <span className="badge-fitting-active">Ativo</span>}
                {isPastFormTime && (
                  <span className="badge-fitting-active" style={{ background: 'var(--color-bg-tertiary, #f3f4f6)', color: 'var(--color-text-secondary, #4b5563)' }}>
                    Obrigatório (passado)
                  </span>
                )}
              </div>
              <span className="fitting-toggle-desc">
                {isPastFormTime
                  ? 'Horário já decorrido: o registro neste horário é restrito a Encaixe de balcão.'
                  : 'Permite atender dois clientes no mesmo horário dividindo a coluna da grade.'}
              </span>
            </div>
            <label className="checkbox-label" style={{ margin: 0, cursor: isPastFormTime ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Marcar como Encaixe de Balcão"
                checked={formIsFitting}
                disabled={isPastFormTime}
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
              onClick={() => {
                setIsModalOpen(false);
                clearActionUrl();
              }}
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
          appointmentStartTime={checkoutAppointment.start_time || null}
          appointmentServiceName={checkoutAppointment.service?.name || null}
          appointmentIsFitting={checkoutAppointment.is_fitting || false}
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
        appointments={appointments}
        blockedSlots={blockedSlots}
        defaultDateIso={selectedDate}
        defaultProfessionalId={selectedProfessionalIds[0] || professionals[0]?.id}
        timezone={tenant.timezone}
        businessHours={tenant.businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        onClose={() => {
          setIsBloqueioModalOpen(false);
          clearActionUrl();
        }}
        onBloqueioCriado={(_blk) => {
          setIsBloqueioModalOpen(false);
          clearActionUrl();
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
        onClose={() => {
          setIsEsperaDrawerOpen(false);
          clearActionUrl();
        }}
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
          background-color: rgba(0, 0, 0, 0.03);
          cursor: pointer;
        }

        .grid-slot-cell--past:hover {
          background-color: rgba(217, 108, 0, 0.08) !important;
        }

        .grid-slot-cell--break {
          background: repeating-linear-gradient(
            45deg,
            rgba(217, 108, 0, 0.03),
            rgba(217, 108, 0, 0.03) 6px,
            rgba(217, 108, 0, 0.07) 6px,
            rgba(217, 108, 0, 0.07) 12px
          );
          cursor: not-allowed;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .grid-slot-cell--break:hover {
          background: repeating-linear-gradient(
            45deg,
            rgba(217, 108, 0, 0.05),
            rgba(217, 108, 0, 0.05) 6px,
            rgba(217, 108, 0, 0.09) 6px,
            rgba(217, 108, 0, 0.09) 12px
          ) !important;
        }

        .slot-break-label {
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--color-brand-primary, #d96c00);
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(217, 108, 0, 0.25);
          pointer-events: none;
          letter-spacing: 0.02em;
          text-transform: uppercase;
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
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }
          .agenda-desktop-view {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
