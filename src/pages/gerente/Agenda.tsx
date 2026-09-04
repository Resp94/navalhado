import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { ConfirmSoftDeleteModal } from '../../components/cadastros/ConfirmSoftDeleteModal';
import { ListaEsperaDrawer } from '../../components/espera/ListaEsperaDrawer';
import { CustomDatePicker } from '../../components/CustomDatePicker';
import { EsperaRepository } from '../../modules/espera/EsperaRepository';
import { SupabaseEsperaAdapter } from '../../modules/espera/adapters/SupabaseEsperaAdapter';
import { openWhatsApp } from '../../lib/whatsapp';
import { getAppointmentCardState } from '../../lib/appointment-card-state';
import { calculateAgendaHorizontalLayout } from '../../lib/agenda-layout';
import type { WaitingListEntry } from '../../modules/espera/types';
import type { BlockedSlot } from '../../modules/bloqueios/types';
import type { Comanda } from '../../modules/comandas/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  BadgeXIcon,
  Calendar02Icon,
  Calendar03Icon,
  Clock01Icon,
  AddCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FilterIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  UnavailableIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { MobileAgendaView } from './mobile/MobileAgendaView';
import { AgendaEquipeFilter } from './AgendaEquipeFilter';
import {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  generateTimeSlotsForSchedule,
  generateScheduleGridSlots,
  generateFittingTimeSlots,
  buildFittingAppointmentInterval,
  isValidFittingStartTime,
  isTimeAlignedToSlotInterval,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  getEffectiveServiceDuration,
  normalizeSlotIntervalMinutes,
  timeToMinutes,
} from '../../lib/schedule';
import type {
  FittingTimeMode,
  ProfessionalDaySchedule,
  WeeklySchedule,
  ScheduleGridSegment,
} from '../../lib/schedule';

export {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  generateTimeSlotsForSchedule,
  generateScheduleGridSlots,
  generateFittingTimeSlots,
  buildFittingAppointmentInterval,
  isValidFittingStartTime,
  isTimeAlignedToSlotInterval,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  getEffectiveServiceDuration,
  normalizeSlotIntervalMinutes,
};
export type { FittingTimeMode, ProfessionalDaySchedule, WeeklySchedule };

// --- Interfaces de Domínio ---
export interface Professional {
  id: string;
  name: string;
  is_active: boolean;
  phone?: string;
  weekly_schedule?: WeeklySchedule | null;
  professional_services?: Array<{
    service_id: string;
    custom_duration_minutes?: number | null;
    is_enabled?: boolean | null;
  }>;
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
    duration_minutes?: number;
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
// Configurações Padrão da Grade Temporal
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_SLOT_HEIGHT_PX = 76;
const ANY_PROFESSIONAL = 'any';

const toScheduleGridSegment = (
  schedule: ProfessionalDaySchedule | null | undefined
): ScheduleGridSegment | null => {
  if (!schedule || schedule.active === false || !schedule.start || !schedule.end) return null;

  return {
    start: schedule.start,
    end: schedule.end,
    breakStart: schedule.break_start,
    breakEnd: schedule.break_end,
  };
};

interface AgendaGridSkeletonProps {
  viewMode: 'day' | 'week';
  professionals: Professional[];
  weekDays: Array<{ dateStr: string; label: string; shortWeekday: string }>;
  timeSlots: string[];
  slotHeightPx: number;
}

const AgendaGridSkeleton: React.FC<AgendaGridSkeletonProps> = ({
  viewMode,
  professionals,
  weekDays,
  timeSlots,
  slotHeightPx,
}) => {
  const displaySlots =
    timeSlots.length > 0
      ? timeSlots
      : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  const columns =
    viewMode === 'week'
      ? weekDays.map((d) => ({
          id: d.dateStr,
          initials: d.shortWeekday.slice(0, 2),
        }))
      : (professionals.length > 0
          ? professionals
          : [
              { id: 'sk-1', name: 'Barbeiro 1' },
              { id: 'sk-2', name: 'Barbeiro 2' },
              { id: 'sk-3', name: 'Barbeiro 3' },
            ]
        ).map((p) => ({
          id: p.id,
          initials: (p.name || 'BA').slice(0, 2).toUpperCase(),
        }));

  return (
    <div
      className="agenda-timeline-board agenda-timeline-board--skeleton"
      aria-busy="true"
      aria-label="Carregando grade da agenda"
    >
      {/* Coluna Fixa da Régua de Horários */}
      <div className="timeline-axis-column">
        <div className="timeline-axis-header">
          <HugeiconsIcon icon={Clock01Icon} size={16} />
        </div>
        <div className="timeline-axis-body">
          {displaySlots.map((slot) => (
            <div
              key={slot}
              className="time-slot-label"
              style={{ height: `${slotHeightPx}px` }}
            >
              <div
                className="skeleton-box skeleton-time-label"
                style={{ width: '38px', height: '11px', margin: '0 auto', borderRadius: '4px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Colunas da Grade com Shimmer */}
      <div className="professionals-columns-container">
        {columns.map((col, colIndex) => (
          <div key={col.id} className="professional-timeline-column">
            {/* Cabeçalho Skeleton */}
            <div className="prof-col-header">
              <div className="prof-col-avatar skeleton-box" style={{ color: 'transparent' }}>
                {col.initials}
              </div>
              <div className="prof-col-info">
                <div
                  className="skeleton-box skeleton-title"
                  style={{ width: viewMode === 'week' ? '56px' : '90px' }}
                />
                <div
                  className="skeleton-box skeleton-subtitle"
                  style={{ width: '64px', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Corpo da Grade com Slots e Cards Fantasmas */}
            <div className="prof-col-grid-body">
              {displaySlots.map((slot) => (
                <div
                  key={slot}
                  className="grid-slot-cell"
                  style={{ height: `${slotHeightPx}px` }}
                />
              ))}

              {/* Cards Fantasma de Agendamento em Posições Realistas */}
              {colIndex % 2 === 0 && (
                <div
                  className="skeleton-appointment-card"
                  style={{ top: `${slotHeightPx * 0.5}px`, height: `${slotHeightPx * 1.5}px` }}
                >
                  <div className="skeleton-box skeleton-card-badge" />
                  <div className="skeleton-box skeleton-card-name" />
                  <div className="skeleton-box skeleton-card-service" />
                </div>
              )}

              {colIndex % 3 === 1 && (
                <div
                  className="skeleton-appointment-card"
                  style={{ top: `${slotHeightPx * 2.6}px`, height: `${slotHeightPx * 1.2}px` }}
                >
                  <div className="skeleton-box skeleton-card-badge" />
                  <div className="skeleton-box skeleton-card-name" />
                </div>
              )}

              {colIndex % 2 === 1 && (
                <div
                  className="skeleton-appointment-card"
                  style={{ top: `${slotHeightPx * 4.6}px`, height: `${slotHeightPx * 1.7}px` }}
                >
                  <div className="skeleton-box skeleton-card-badge" />
                  <div className="skeleton-box skeleton-card-name" />
                  <div className="skeleton-box skeleton-card-service" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AppointmentQuickActionsProps {
  app: Appointment;
  onMarkNoShow: (app: Appointment) => void;
  onReschedule: (app: Appointment) => void;
  className?: string;
}

const AppointmentQuickActions: React.FC<AppointmentQuickActionsProps> = React.memo(({
  app,
  onMarkNoShow,
  onReschedule,
  className = 'card-quick-actions-right',
}) => {
  const canMarkNoShow =
    (app.status === 'pending' || app.status === 'confirmed') &&
    new Date(app.start_time).getTime() <= Date.now();
  const canReschedule = app.status !== 'canceled';

  if (!canMarkNoShow && !canReschedule) return null;

  return (
    <div className={className}>
      {canMarkNoShow && (
        <button
          type="button"
          className="card-quick-no-show-btn"
          title="Marcar atendimento como não compareceu"
          aria-label={`Marcar ${app.customer?.name || 'cliente'} como não compareceu`}
          onClick={(e) => {
            e.stopPropagation();
            onMarkNoShow(app);
          }}
        >
          <HugeiconsIcon icon={BadgeXIcon} size={11} />
          <span>Não compareceu</span>
        </button>
      )}
      {canReschedule && (
        <button
          type="button"
          className="card-quick-reagendar-btn"
          title="Reagendar horário deste agendamento"
          aria-label="Reagendar horário"
          onClick={(e) => {
            e.stopPropagation();
            onReschedule(app);
          }}
        >
          <HugeiconsIcon icon={Calendar02Icon} size={11} color="#ffffff" />
          <span>Reagendar</span>
        </button>
      )}
    </div>
  );
});
AppointmentQuickActions.displayName = 'AppointmentQuickActions';

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
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  const isViewTransitioningRef = useRef(false);
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const handleViewModeChange = useCallback((mode: 'day' | 'week') => {
    if (mode === viewMode) return;
    isViewTransitioningRef.current = true;
    setIsViewTransitioning(true);
    if (mode === 'week') {
      if (selectedProfessionalIds.length === 1 && selectedProfessionalIds[0] !== selectedWeekProfId) {
        setSelectedWeekProfId(selectedProfessionalIds[0]);
      } else if (!selectedWeekProfId && professionals.length > 0) {
        setSelectedWeekProfId(professionals[0].id);
      }
    }
    setViewMode(mode);
  }, [viewMode, selectedProfessionalIds, selectedWeekProfId, professionals]);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isBloqueioModalOpen, setIsBloqueioModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
  const [isEsperaDrawerOpen, setIsEsperaDrawerOpen] = useState(false);
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);
  const [noShowAppointment, setNoShowAppointment] = useState<Appointment | null>(null);
  const [blockPendingRemoval, setBlockPendingRemoval] = useState<BlockedSlot | null>(null);
  const [isRemovingBlock, setIsRemovingBlock] = useState(false);

  // Fechar o DatePicker ao clicar fora ou pressionar ESC
  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDatePickerOpen]);

  // Estados do Formulário de Agendamento / Encaixe
  const [formDate, setFormDate] = useState(selectedDate);
  const [formProfessionalId, setFormProfessionalId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formIsFitting, setFormIsFitting] = useState(false);
  const [fittingTimeMode, setFittingTimeMode] = useState<FittingTimeMode>('grid');
  const [formNotes, setFormNotes] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new' | 'none'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [savingAppointment, setSavingAppointment] = useState(false);

  // Estados do Cancelamento
  const [targetAppointment, setTargetAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelingAppointment, setCancelingAppointment] = useState(false);

  // Estados de Reagendamento Direto na Agenda
  const [isAgendaRescheduleModalOpen, setIsAgendaRescheduleModalOpen] = useState(false);
  const [agendaRescheduleAppointment, setAgendaRescheduleAppointment] = useState<Appointment | null>(null);
  const [agendaRescheduleDate, setAgendaRescheduleDate] = useState('');
  const [agendaRescheduleTime, setAgendaRescheduleTime] = useState('');
  const [agendaRescheduleProfId, setAgendaRescheduleProfId] = useState('');
  const [isAgendaRescheduling, setIsAgendaRescheduling] = useState(false);

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
      setFittingTimeMode('grid');
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
  const slotIntervalMinutes = normalizeSlotIntervalMinutes(
    tenant.slotIntervalMinutes,
    DEFAULT_SLOT_DURATION_MINUTES
  );
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
    const schedules: ScheduleGridSegment[] = [];

    if (selectedProfessionalIds.length === 0) {
      return [];
    }

    const filteredProfessionals = professionals.filter((p) =>
      selectedProfessionalIds.includes(p.id) && p.is_active
    );

    if (viewMode === 'week') {
      weekDays.forEach((d) => {
        const dayBh = getDayBusinessHours(d.dateStr, tenant.businessHours);
        if (!dayBh.active) return;

        filteredProfessionals.forEach((p) => {
          const sched = getEffectiveProfessionalDaySchedule(p, d.dateStr, tenant.businessHours);
          if (sched) {
            const segment = toScheduleGridSegment(sched);
            if (segment) schedules.push(segment);
          } else if (!p.weekly_schedule) {
            // Apenas se o profissional não tiver escala configurada, adota horário do dia da barbearia
            schedules.push({
              start: dayBh.open || '08:00',
              end: dayBh.close || '20:00',
            });
          }
        });
      });

      // Incluir horários de agendamentos e bloqueios existentes dos profissionais selecionados na semana
      appointments.forEach((a) => {
        if (selectedProfessionalIds.includes(a.professional_id)) {
          const aDate = dateInZone(new Date(a.start_time), tenant.timezone);
          if (weekDays.some((d) => d.dateStr === aDate)) {
            schedules.push({
              start: formatTimeInZone(a.start_time, tenant.timezone),
              end: formatTimeInZone(a.end_time, tenant.timezone),
            });
          }
        }
      });

      blockedSlots.forEach((b) => {
        if (selectedProfessionalIds.includes(b.professional_id)) {
          const bDate = dateInZone(new Date(b.start_time), tenant.timezone);
          if (weekDays.some((d) => d.dateStr === bDate)) {
            schedules.push({
              start: formatTimeInZone(b.start_time, tenant.timezone),
              end: formatTimeInZone(b.end_time, tenant.timezone),
            });
          }
        }
      });

      if (schedules.length === 0) {
        return [];
      }

      return generateScheduleGridSlots(schedules, slotIntervalMinutes);
    }

    // Visão Diária
    const dayBh = getDayBusinessHours(selectedDate, tenant.businessHours);

    filteredProfessionals.forEach((p) => {
      const sched = getEffectiveProfessionalDaySchedule(p, selectedDate, tenant.businessHours);
      if (sched) {
        const segment = toScheduleGridSegment(sched);
        if (segment) schedules.push(segment);
      } else if (!p.weekly_schedule && dayBh.active) {
        // Apenas se o profissional não tiver escala configurada, adota horário da barbearia
        schedules.push({
          start: dayBh.open || '08:00',
          end: dayBh.close || '20:00',
        });
      }
    });

    // Incluir horários de agendamentos e bloqueios pontuais fora da grade regular
    appointments.forEach((a) => {
      if (selectedProfessionalIds.includes(a.professional_id)) {
        const aDate = dateInZone(new Date(a.start_time), tenant.timezone);
        if (aDate === selectedDate) {
          schedules.push({
            start: formatTimeInZone(a.start_time, tenant.timezone),
            end: formatTimeInZone(a.end_time, tenant.timezone),
          });
        }
      }
    });

    blockedSlots.forEach((b) => {
      if (selectedProfessionalIds.includes(b.professional_id)) {
        const bDate = dateInZone(new Date(b.start_time), tenant.timezone);
        if (bDate === selectedDate) {
          schedules.push({
            start: formatTimeInZone(b.start_time, tenant.timezone),
            end: formatTimeInZone(b.end_time, tenant.timezone),
          });
        }
      }
    });

    if (schedules.length === 0) {
      return [];
    }

    return generateScheduleGridSlots(schedules, slotIntervalMinutes);
  }, [selectedDate, tenant.businessHours, viewMode, appointments, blockedSlots, selectedProfessionalIds, professionals, slotIntervalMinutes, weekDays, tenant.timezone]);

  // Slots de Horário válidos para seleção no Modal de Novo Agendamento
  const modalAvailableTimeSlots = useMemo(() => {
    const dayBh = getDayBusinessHours(formDate, tenant.businessHours);
    if (!dayBh.active) return [];

    const filterNormalServiceSlots = (slots: string[]): string[] => {
      if (formIsFitting || !formServiceId) return slots;

      const service = services.find((item) => item.id === formServiceId);
      if (!service) return slots;

      const candidateProfessionals = formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL
        ? professionals.filter((professional) => professional.id === formProfessionalId)
        : professionals.filter((professional) => professional.is_active);

      if (candidateProfessionals.length === 0) return [];

      return slots.filter((slot) => candidateProfessionals.some((professional) => {
        const duration = getEffectiveServiceDuration(
          service.duration_minutes,
          service.id,
          professional.professional_services
        );

        return isProfessionalWorkingAt(
          professional,
          formDate,
          slot,
          duration,
          tenant.businessHours
        );
      }));
    };

    if (formIsFitting && fittingTimeMode === 'grid') {
      if (formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL) {
        const selectedProf = professionals.find((p) => p.id === formProfessionalId);
        const selectedProfSchedule = selectedProf
          ? getEffectiveProfessionalDaySchedule(selectedProf, formDate, tenant.businessHours)
          : null;

        if (selectedProfSchedule?.active === false) return [];

        const selectedSegment = selectedProfSchedule
          ? toScheduleGridSegment(selectedProfSchedule)
          : null;
        if (selectedSegment) {
          return generateScheduleGridSlots([selectedSegment], slotIntervalMinutes);
        }
      }

      const fittingSchedules: ScheduleGridSegment[] = [];
      professionals.forEach((professional) => {
        if (!professional.is_active) return;
        const schedule = getEffectiveProfessionalDaySchedule(
          professional,
          formDate,
          tenant.businessHours
        );
        const segment = toScheduleGridSegment(schedule);
        if (segment) fittingSchedules.push(segment);
      });

      if (fittingSchedules.length > 0) {
        return generateScheduleGridSlots(fittingSchedules, slotIntervalMinutes);
      }

      return generateScheduleGridSlots(
        [{ start: dayBh.open, end: dayBh.close }],
        slotIntervalMinutes
      );
    }

    if (formProfessionalId) {
      const prof = professionals.find((p) => p.id === formProfessionalId);
      const profSched = prof
        ? getEffectiveProfessionalDaySchedule(prof, formDate, tenant.businessHours)
        : null;
      if (profSched?.active === false) return [];
      const segment = profSched ? toScheduleGridSegment(profSched) : null;
      if (segment) {
        return filterNormalServiceSlots(generateScheduleGridSlots([segment], slotIntervalMinutes));
      }
    }

    const schedules: ScheduleGridSegment[] = [];
    professionals.forEach((p) => {
      if (!p.is_active) return;
      const sched = getEffectiveProfessionalDaySchedule(p, formDate, tenant.businessHours);
      const segment = toScheduleGridSegment(sched);
      if (segment) schedules.push(segment);
    });

    if (schedules.length === 0) {
      schedules.push({ start: dayBh.open, end: dayBh.close });
    }

    return filterNormalServiceSlots(generateScheduleGridSlots(schedules, slotIntervalMinutes));
  }, [formDate, tenant.businessHours, formProfessionalId, formServiceId, professionals, services, slotIntervalMinutes, formIsFitting, fittingTimeMode]);

  // Slots de Horário válidos e livres para o Modal de Reagendamento Direto na Agenda
  const agendaRescheduleAvailableSlots = useMemo(() => {
    if (!agendaRescheduleDate || !agendaRescheduleProfId) return [];

    const dayBh = getDayBusinessHours(agendaRescheduleDate, tenant.businessHours);
    if (!dayBh.active) return [];

    const prof = professionals.find((p) => p.id === agendaRescheduleProfId);
    if (!prof) return [];
    const profSched = prof
      ? getEffectiveProfessionalDaySchedule(prof, agendaRescheduleDate, tenant.businessHours)
      : null;
    if (profSched?.active === false) return [];

    const segment = profSched ? toScheduleGridSegment(profSched) : null;
    const baseSlots = generateScheduleGridSlots(
      [segment || { start: dayBh.open || '08:00', end: dayBh.close || '20:00' }],
      slotIntervalMinutes
    );

    const durationMin = getEffectiveServiceDuration(
      agendaRescheduleAppointment?.service?.duration_minutes || 30,
      agendaRescheduleAppointment?.service?.id || '',
      prof?.professional_services
    );

    return baseSlots.filter((slotTime) => {
      if (!isProfessionalWorkingAt(
        prof,
        agendaRescheduleDate,
        slotTime,
        durationMin,
        tenant.businessHours
      )) return false;

      const slotStartIso = localDateTimeToIso(agendaRescheduleDate, slotTime, tenant.timezone);
      const slotEndIso = new Date(new Date(slotStartIso).getTime() + durationMin * 60 * 1000).toISOString();

      // Permitir o próprio horário já ocupado pelo agendamento
      const hasAppConflict = appointments.some((a) => {
        if (a.id === agendaRescheduleAppointment?.id) return false;
        if (a.status === 'canceled') return false;
        if (a.professional_id !== agendaRescheduleProfId) return false;
        return a.start_time < slotEndIso && a.end_time > slotStartIso;
      });
      if (hasAppConflict) return false;

      const hasBlockConflict = blockedSlots.some((b) => {
        if (b.professional_id && b.professional_id !== agendaRescheduleProfId) return false;
        return b.start_time < slotEndIso && b.end_time > slotStartIso;
      });
      if (hasBlockConflict) return false;

      return true;
    });
  }, [
    agendaRescheduleDate,
    agendaRescheduleProfId,
    agendaRescheduleAppointment,
    tenant.businessHours,
    tenant.timezone,
    professionals,
    slotIntervalMinutes,
    appointments,
    blockedSlots,
  ]);

  const currentService = useMemo(
    () => services.find((s) => s.id === formServiceId),
    [services, formServiceId]
  );

  // Profissionais disponíveis no horário selecionado (não estão em intervalo nem de folga considerando duração)
  // Em modo de Encaixe (formIsFitting), o gerente tem flexibilidade total para alocar qualquer profissional ativo
  const availableProfessionalsForFormTime = useMemo(() => {
    return professionals.filter((p) => {
      if (!p.is_active) return false;
      if (formIsFitting) return true;
      const serviceDuration = currentService
        ? getEffectiveServiceDuration(
            currentService.duration_minutes,
            currentService.id,
            p.professional_services
          )
        : slotIntervalMinutes;
      return isProfessionalWorkingAt(
        p,
        formDate,
        formTime,
        serviceDuration,
        tenant.businessHours
      );
    });
  }, [professionals, formIsFitting, formDate, formTime, currentService, slotIntervalMinutes, tenant.businessHours]);

  const isPastFormTime = useMemo(() => {
    const nowInstant = new Date();
    const currentLocalDate = dateInZone(nowInstant, tenant.timezone);
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);
    return (
      formDate < currentLocalDate ||
      (formDate === currentLocalDate && formTime < currentLocalTime)
    );
  }, [formDate, formTime, tenant.timezone]);

  // Sincronizar barbeiro selecionado caso o atual não esteja disponível no horário
  useEffect(() => {
    if (isModalOpen) {
      if (availableProfessionalsForFormTime.length > 0) {
        if (
          formProfessionalId !== ANY_PROFESSIONAL &&
          !availableProfessionalsForFormTime.some((p) => p.id === formProfessionalId)
        ) {
          setFormProfessionalId(availableProfessionalsForFormTime[0].id);
        }
      } else if (formProfessionalId !== ANY_PROFESSIONAL) {
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

  const todayDateStr = useMemo(() => dateInZone(new Date(), tenant.timezone), [tenant.timezone]);
  const isToday = useMemo(() => {
    return selectedDate === todayDateStr;
  }, [selectedDate, todayDateStr]);

  const isTodayInWeek = useMemo(() => {
    return weekDays.some((d) => d.dateStr === todayDateStr);
  }, [weekDays, todayDateStr]);

  const currentTimeFormatted = useMemo(() => {
    const h = String(Math.floor(currentTimeMinutes / 60)).padStart(2, '0');
    const m = String(currentTimeMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }, [currentTimeMinutes]);

  // Carregar dados de Apoio (Profissionais, Serviços, Clientes)
  const loadInitialData = useCallback(async () => {
    try {
      if (!tenant.tenantId) return;

      const [profsRes, servsRes, custsRes, professionalServicesRes] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, name, is_active, phone, weekly_schedule')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('tenant_id', tenant.tenantId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('tenant_id', tenant.tenantId)
          .order('name'),
        supabase
          .from('professional_services')
          .select('professional_id, service_id, custom_duration_minutes, is_enabled')
          .eq('tenant_id', tenant.tenantId),
      ]);

      if (profsRes.error) throw profsRes.error;
      if (servsRes.error) throw servsRes.error;
      if (custsRes.error) throw custsRes.error;
      if (professionalServicesRes.error) throw professionalServicesRes.error;

      const servicesByProfessional = new Map<string, Professional['professional_services']>();
      (professionalServicesRes.data || []).forEach((service) => {
        const current = servicesByProfessional.get(service.professional_id) || [];
        current.push({
          service_id: service.service_id,
          custom_duration_minutes: service.custom_duration_minutes,
          is_enabled: service.is_enabled,
        });
        servicesByProfessional.set(service.professional_id, current);
      });

      const activeProfs = (profsRes.data || []).map((professional) => ({
        ...professional,
        professional_services: servicesByProfessional.get(professional.id) || [],
      }));
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
      if (isViewTransitioningRef.current) {
        setTimeout(() => {
          isViewTransitioningRef.current = false;
          setIsViewTransitioning(false);
        }, 320);
      }
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
    isViewTransitioningRef.current = true;
    setIsViewTransitioning(true);
    const shift = viewMode === 'week' ? -7 : -1;
    setSelectedDate((prev) => shiftCalendarDate(prev, shift));
  };

  const handleNextDay = () => {
    isViewTransitioningRef.current = true;
    setIsViewTransitioning(true);
    const shift = viewMode === 'week' ? 7 : 1;
    setSelectedDate((prev) => shiftCalendarDate(prev, shift));
  };

  const handleToday = () => {
    isViewTransitioningRef.current = true;
    setIsViewTransitioning(true);
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
    let finalIsFitting = isFitting;

    if (timeSlot) {
      const isPast =
        dateToCheck < currentLocalDate ||
        (dateToCheck === currentLocalDate && timeSlot < currentLocalTime);
      if (isPast) {
        finalIsFitting = true;
      }
    }

    const dayBh = getDayBusinessHours(dateToCheck, tenant.businessHours);
    if (!finalIsFitting && !dayBh.active) {
      addToast('A barbearia não abre neste dia conforme as configurações de funcionamento.', 'warning');
      return;
    }

    if (timeSlot) {
      const directGridSlots = profId
        ? (() => {
            const prof = professionals.find((p) => p.id === profId);
            const schedule = prof
              ? getEffectiveProfessionalDaySchedule(prof, dateToCheck, tenant.businessHours)
              : null;
            const segment = schedule ? toScheduleGridSegment(schedule) : null;
            return segment
              ? generateScheduleGridSlots([segment], slotIntervalMinutes)
              : timeSlots;
          })()
        : timeSlots;

      if (finalIsFitting && !isValidFittingStartTime(
        timeSlot,
        'grid',
        slotIntervalMinutes,
        directGridSlots
      )) {
        addToast(`Horário de encaixe deve seguir a grade de ${slotIntervalMinutes} minutos.`, 'warning');
        return;
      }

      if (profId && !finalIsFitting) {
        const prof = professionals.find((p) => p.id === profId);
        if (prof && isProfessionalOnBreak(prof, dateToCheck, timeSlot)) {
          addToast(getProfessionalBreakMessage(prof, dateToCheck), 'warning');
          return;
        }
      }

      const isOutsideHours =
        timeSlot < dayBh.open ||
        timeSlot >= dayBh.close;
      if (!finalIsFitting && isOutsideHours) {
        addToast(`Horário fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
        return;
      }
    }

    const targetTime =
      timeSlot ||
      (finalIsFitting
        ? generateFittingTimeSlots(slotIntervalMinutes).find((slot) => slot >= currentLocalTime) || '00:00'
        : dateToCheck === currentLocalDate && currentLocalTime > dayBh.open
        ? timeSlots.find((s) => s >= currentLocalTime && s >= dayBh.open && s < dayBh.close) || dayBh.open
        : dayBh.open);

    setFormTime(targetTime);

    if (profId) {
      setFormProfessionalId(profId);
    } else {
      const available = professionals.filter((p) => {
        if (!p.is_active) return false;
        if (finalIsFitting) return true;
        return isProfessionalWorkingAt(p, dateToCheck, targetTime, 0, tenant.businessHours);
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
    setFittingTimeMode('grid');
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
    setFittingTimeMode('grid');
    setIsModalOpen(true);

    esperaRepository.setStatus(entry.id, 'atendido').catch(console.error);
  };

  // Salvar Novo Agendamento / Encaixe
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL) {
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
      let finalCustomerId: string | null = selectedCustomerId;

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

        const newCust = await clienteRepository.saveCustomer(tenant.tenantId, {
          name: newCustomerName,
          phone: newCustomerPhone,
          registration_origin: 'agenda',
          cadastro_completo: true,
        });

        finalCustomerId = newCust.id;
        setCustomers((prev) => [...prev, { id: newCust.id, name: newCust.name, phone: newCust.phone }]);
      } else if (customerMode === 'none') {
        finalCustomerId = null;
      }

      if (!finalCustomerId && customerMode !== 'none') {
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
      const selectedProfessionalId = formProfessionalId === ANY_PROFESSIONAL
        ? availableProfessionalsForFormTime[0]?.id
        : formProfessionalId;
      const selectedProf = professionals.find((p) => p.id === selectedProfessionalId);
      if (!selectedProf) {
        addToast('Selecione um profissional disponível.', 'warning');
        setSavingAppointment(false);
        return;
      }

      const effectiveServiceDuration = getEffectiveServiceDuration(
        selectedService.duration_minutes,
        selectedService.id,
        selectedProf.professional_services
      );

      const dayBh = getDayBusinessHours(formDate, tenant.businessHours);
      if (!formIsFitting && !dayBh.active) {
        addToast('A barbearia não abre nesta data conforme as configurações.', 'warning');
        setSavingAppointment(false);
        return;
      }
      if (formIsFitting && !isValidFittingStartTime(
        formTime,
        fittingTimeMode,
        slotIntervalMinutes,
        fittingTimeMode === 'grid' ? modalAvailableTimeSlots : undefined
      )) {
        addToast(
          fittingTimeMode === 'grid'
            ? `Horário de encaixe deve seguir a grade de ${slotIntervalMinutes} minutos.`
            : 'Informe um horário de início válido.',
          'warning'
        );
        setSavingAppointment(false);
        return;
      }
      if (!formIsFitting && (formTime < dayBh.open || formTime >= dayBh.close)) {
        addToast(`Horário selecionado está fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
        setSavingAppointment(false);
        return;
      }

      if (!formIsFitting) {
        if (isProfessionalOnBreak(selectedProf, formDate, formTime, effectiveServiceDuration)) {
          addToast(getProfessionalBreakMessage(selectedProf, formDate), 'warning');
          setSavingAppointment(false);
          return;
        }

        if (!isProfessionalWorkingAt(
          selectedProf,
          formDate,
          formTime,
          effectiveServiceDuration,
          tenant.businessHours
        )) {
          addToast(`O profissional ${selectedProf.name} não está atendendo neste horário.`, 'warning');
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

      // Calcular timestamps com Timezone. Encaixes usam o seam compartilhado;
      // agendamentos normais preservam o cálculo existente nesta etapa.
      let startIso: string;
      let endIso: string;
      if (formIsFitting) {
        try {
          const fittingInterval = buildFittingAppointmentInterval({
            date: formDate,
            time: formTime,
            timeZone: tenant.timezone,
            durationMinutes: effectiveServiceDuration,
            mode: fittingTimeMode,
            slotIntervalMinutes,
            gridSlots: fittingTimeMode === 'grid' ? modalAvailableTimeSlots : undefined,
          });
          startIso = fittingInterval.startIso;
          endIso = fittingInterval.endIso;
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : '';
          addToast(
            errorCode === 'FITTING_TIME_NOT_ALIGNED'
              ? `Horário de encaixe deve seguir a grade de ${slotIntervalMinutes} minutos.`
              : 'Informe uma data e horário válidos para o encaixe.',
            'warning'
          );
          setSavingAppointment(false);
          return;
        }
      } else {
        startIso = localDateTimeToIso(formDate, formTime, tenant.timezone);
        const [sh, sm] = formTime.split(':').map(Number);
        const endTotalMinutes = sh * 60 + sm + effectiveServiceDuration;
        const eh = Math.floor(endTotalMinutes / 60);
        const em = endTotalMinutes % 60;
        const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        endIso = localDateTimeToIso(formDate, endTimeStr, tenant.timezone);
      }

      const payload = {
        tenant_id: tenant.tenantId,
        customer_id: finalCustomerId,
        professional_id: selectedProfessionalId,
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
                professional_id: selectedProfessionalId || null,
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

      addToast(`Atendimento de ${app.customer?.name || 'Cliente Balcão'} iniciado.`, 'success');
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao iniciar atendimento:', err);
      addToast('Erro ao atualizar status do atendimento.', 'error');
    }
  };

  // Abrir Modal de Checkout de Comanda
  const handleOpenCheckout = (app: Appointment) => {
    if (app.status === 'no_show') {
      addToast('Este atendimento foi marcado como não compareceu e não pode gerar movimento financeiro.', 'warning');
      return;
    }
    setCheckoutAppointment(app);
    setIsCheckoutModalOpen(true);
  };

  const handleMarkNoShow = async (app: Appointment) => {
    if (!['pending', 'confirmed'].includes(app.status)) {
      addToast('Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.', 'warning');
      return;
    }

    if (new Date(app.start_time).getTime() > Date.now()) {
      addToast('O atendimento ainda não começou.', 'warning');
      return;
    }

    setNoShowAppointment(app);
    setIsNoShowModalOpen(true);
  };

  const handleConfirmNoShow = async () => {
    if (!noShowAppointment) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'no_show', updated_at: new Date().toISOString() })
        .eq('id', noShowAppointment.id)
        .eq('tenant_id', tenant.tenantId)
        .in('status', ['pending', 'confirmed'])
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setIsNoShowModalOpen(false);
        setNoShowAppointment(null);
        addToast('O status deste atendimento mudou antes da atualização. Recarregue a agenda.', 'warning');
        fetchAppointments();
        return;
      }

      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment.id === noShowAppointment.id ? { ...appointment, status: 'no_show' } : appointment
        )
      );
      setIsNoShowModalOpen(false);
      setNoShowAppointment(null);
      addToast('Atendimento marcado como não compareceu.', 'success');
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao marcar atendimento como não compareceu:', err);
      addToast(err?.message || 'Erro ao marcar atendimento como não compareceu.', 'error');
    }
  };

  // Remover Bloqueio de Horário
  const handleRemoveBlock = (blk: BlockedSlot) => {
    setBlockPendingRemoval(blk);
  };

  const handleConfirmRemoveBlock = async () => {
    if (!blockPendingRemoval || isRemovingBlock) return;

    setIsRemovingBlock(true);
    try {
      const { error } = await supabase
        .from('blocked_slots')
        .delete()
        .eq('id', blockPendingRemoval.id)
        .eq('tenant_id', tenant.tenantId);

      if (error) throw error;
      addToast('Bloqueio removido com sucesso!', 'success');
      setBlockPendingRemoval(null);
      await fetchBlockedSlots();
    } catch {
      addToast('Erro ao remover bloqueio.', 'error');
    } finally {
      setIsRemovingBlock(false);
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

  // Abrir Modal de Reagendamento Direto na Agenda
  const handleOpenRescheduleModal = (app: Appointment) => {
    setAgendaRescheduleAppointment(app);
    if (app.start_time) {
      const d = new Date(app.start_time);
      setAgendaRescheduleDate(dateInZone(d, tenant.timezone));
      setAgendaRescheduleTime(formatTimeInZone(app.start_time, tenant.timezone));
    } else {
      setAgendaRescheduleDate(selectedDate);
      setAgendaRescheduleTime('09:00');
    }
    setAgendaRescheduleProfId(app.professional_id || professionals[0]?.id || '');
    setIsAgendaRescheduleModalOpen(true);
  };

  // Confirmar Reagendamento Direto na Agenda
  const handleConfirmAgendaReschedule = async () => {
    if (!agendaRescheduleAppointment || !agendaRescheduleDate || !agendaRescheduleTime) {
      addToast('Selecione data e horário válidos para reagendar.', 'warning');
      return;
    }

    const dayBh = getDayBusinessHours(agendaRescheduleDate, tenant.businessHours);
    if (!dayBh.active) {
      addToast('A barbearia não abre nesta data conforme as configurações.', 'warning');
      return;
    }
    if (agendaRescheduleTime < dayBh.open || agendaRescheduleTime >= dayBh.close) {
      addToast(`Horário fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
      return;
    }

    const rescheduleProfessional = professionals.find((p) => p.id === agendaRescheduleProfId);
    const rescheduleDuration = getEffectiveServiceDuration(
      agendaRescheduleAppointment.service?.duration_minutes || 30,
      agendaRescheduleAppointment.service?.id || '',
      rescheduleProfessional?.professional_services
    );
    if (
      rescheduleProfessional &&
      !isProfessionalWorkingAt(
        rescheduleProfessional,
        agendaRescheduleDate,
        agendaRescheduleTime,
        rescheduleDuration,
        tenant.businessHours
      )
    ) {
      addToast(`O profissional ${rescheduleProfessional.name} não atende neste horário.`, 'warning');
      return;
    }

    setIsAgendaRescheduling(true);
    try {
      const startTimeIso = localDateTimeToIso(agendaRescheduleDate, agendaRescheduleTime, tenant.timezone);
      const durationMin = rescheduleDuration;
      const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMin * 60 * 1000).toISOString();

      const { error: updErr } = await supabase
        .from('appointments')
        .update({
          start_time: startTimeIso,
          end_time: endTimeIso,
          professional_id: agendaRescheduleProfId || agendaRescheduleAppointment.professional_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agendaRescheduleAppointment.id)
        .eq('tenant_id', tenant.tenantId);

      if (updErr) throw updErr;

      addToast('Agendamento reagendado com sucesso!', 'success');
      setIsAgendaRescheduleModalOpen(false);
      setAgendaRescheduleAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao reagendar agendamento na agenda:', err);
      addToast(err?.message || 'Erro ao reagendar agendamento.', 'error');
    } finally {
      setIsAgendaRescheduling(false);
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
    const appMinutes = h * 60 + m;

    let topPx = 0;
    if (timeSlots.length > 0) {
      const firstSlotMin = timeToMinutes(timeSlots[0]);
      const lastSlotMin = timeToMinutes(timeSlots[timeSlots.length - 1]);
      const regularEndMin = lastSlotMin + slotIntervalMinutes;

      if (appMinutes < firstSlotMin) {
        // Antes do início da grade regular
        const diff = appMinutes - firstSlotMin;
        topPx = Math.max(0, (diff / slotIntervalMinutes) * slotHeightPx);
      } else if (appMinutes >= regularEndMin) {
        // Após o horário de funcionamento regular: fica no final da grade
        const diff = appMinutes - regularEndMin;
        topPx = timeSlots.length * slotHeightPx + (diff / slotIntervalMinutes) * slotHeightPx;
      } else {
        // Dentro do horário da grade: alinhamento direto com os slots correspondentes
        let baseIndex = 0;
        for (let i = timeSlots.length - 1; i >= 0; i--) {
          if (timeToMinutes(timeSlots[i]) <= appMinutes) {
            baseIndex = i;
            break;
          }
        }
        const baseSlotMin = timeToMinutes(timeSlots[baseIndex]);
        const minutesAfterSlot = appMinutes - baseSlotMin;
        topPx = baseIndex * slotHeightPx + (minutesAfterSlot / slotIntervalMinutes) * slotHeightPx;
      }
    }

    // Calcular duração
    const endTimeStr = formatTimeInZone(endTimeIso, tenant.timezone);
    const [eh, em] = endTimeStr.split(':').map(Number);
    const durationMinutes = Math.max(slotIntervalMinutes, eh * 60 + em - (h * 60 + m));
    const durationSlots = durationMinutes / slotIntervalMinutes;
    const heightPx =
      durationMinutes <= slotIntervalMinutes
        ? 69
        : Math.max(69, Math.round(durationSlots * slotHeightPx - (slotHeightPx - 69)));

    // Centralização vertical dentro do slot (não colado ao slot de cima e alinhado entre as linhas da grade)
    const verticalOffset = Math.max(0, Math.round((slotHeightPx - 69) / 2));

    return { topPx: Math.max(0, Math.round(topPx + verticalOffset)), heightPx };
  };

  const calculateAppointmentsLayout = (
    appointmentsList: Appointment[],
  ): Map<string, CardLayout> => {
    const layoutMap = new Map<string, CardLayout>();
    const horizontalLayout = calculateAgendaHorizontalLayout(
      appointmentsList.map((appointment) => ({
        id: appointment.id,
        startMs: new Date(appointment.start_time).getTime(),
        endMs: new Date(appointment.end_time).getTime(),
        isFitting: appointment.is_fitting,
      })),
    );

    for (const app of appointmentsList) {
      const pos = calculateCardPosition(app.start_time, app.end_time);
      const horizontal = horizontalLayout.get(app.id);

      layoutMap.set(app.id, {
        topPx: pos.topPx,
        heightPx: pos.heightPx,
        left: horizontal?.left ?? '4px',
        width: horizontal?.width ?? 'calc(100% - 8px)',
      });
    }

    return layoutMap;
  };

  // Posição da Linha Vermelha de Tempo Real
  const redLineTopPx = useMemo(() => {
    if (timeSlots.length === 0) return null;
    const firstSlotMin = timeToMinutes(timeSlots[0]);
    const lastSlotMin = timeToMinutes(timeSlots[timeSlots.length - 1]);
    const regularEndMin = lastSlotMin + slotIntervalMinutes;

    if (currentTimeMinutes < firstSlotMin || currentTimeMinutes > regularEndMin) return null;

    let baseIndex = 0;
    for (let i = timeSlots.length - 1; i >= 0; i--) {
      if (timeToMinutes(timeSlots[i]) <= currentTimeMinutes) {
        baseIndex = i;
        break;
      }
    }
    const baseSlotMin = timeToMinutes(timeSlots[baseIndex]);
    const minutesAfterSlot = currentTimeMinutes - baseSlotMin;
    return Math.round(baseIndex * slotHeightPx + (minutesAfterSlot / slotIntervalMinutes) * slotHeightPx);
  }, [currentTimeMinutes, timeSlots, slotIntervalMinutes, slotHeightPx]);

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
          onMarkNoShow={handleMarkNoShow}
          onOpenReschedule={handleOpenRescheduleModal}
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
                  ? visibleProfessionals.length === 1
                    ? `Visão semanal do profissional ${visibleProfessionals[0].name}`
                    : `Visão semanal de ${visibleProfessionals.length} profissional(is)`
                  : `${visibleProfessionals.length} profissional(is) em atendimento`}
              </p>
            </div>
          </div>

        <div className="agenda-header-actions">
          {/* Seletor de Escopo Temporal: Dia vs Semana */}
          <div className="agenda-view-mode-selector">
            <button
              type="button"
              onClick={() => handleViewModeChange('day')}
              className={`btn-view-mode ${viewMode === 'day' ? 'btn-view-mode--active' : ''}`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('week')}
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

            <div className="agenda-date-picker-wrapper" ref={datePickerRef}>
              <label
                className="agenda-date-picker-label"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDatePickerOpen((prev) => !prev);
                }}
                title="Escolher data no calendário"
                aria-label="Escolher data no calendário"
                aria-expanded={isDatePickerOpen}
              >
                <HugeiconsIcon icon={Calendar03Icon} size={16} className="date-icon" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="agenda-date-picker-input-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </label>

              {isDatePickerOpen && (
                <CustomDatePicker
                  selectedDate={selectedDate}
                  timezone={tenant.timezone}
                  onSelectDate={(newDate) => {
                    isViewTransitioningRef.current = true;
                    setIsViewTransitioning(true);
                    setSelectedDate(newDate);
                    setIsDatePickerOpen(false);
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Filtro de Barbeiros Unificado (Visão Dia e Visão Semana) */}
          <AgendaEquipeFilter
            professionals={professionals}
            selectedProfessionalIds={selectedProfessionalIds}
            onToggleProfessional={toggleProfessionalFilter}
            onSelectAllProfessionals={() =>
              setSelectedProfessionalIds(professionals.map((p) => p.id))
            }
          />

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
            <HugeiconsIcon icon={AddCircleIcon} size={18} />
            <span>Encaixe</span>
          </button>
        </div>
      </header>

      {/* 2. GRADE TEMPORAL CONTÍNUA */}
      <div className="agenda-grid-wrapper">
        {isViewTransitioning || loading ? (
          <AgendaGridSkeleton
            viewMode={viewMode}
            professionals={visibleProfessionals}
            weekDays={weekDays}
            timeSlots={timeSlots}
            slotHeightPx={slotHeightPx}
          />
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
              <div className="timeline-axis-body" style={{ position: 'relative' }}>
                {/* Indicador da Linha Vermelha de Tempo Real na Régua de Horários */}
                {(viewMode === 'day' ? isToday : isTodayInWeek) && redLineTopPx !== null && (
                  <div
                    className="timeline-axis-now-badge"
                    style={{ top: `${redLineTopPx}px` }}
                    title={`Hora atual: ${currentTimeFormatted}`}
                  >
                    <span>{currentTimeFormatted}</span>
                  </div>
                )}
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
                            const hasOccupancy = slotApps.length > 0;

                            const isProfBreak = isProfessionalOnBreak(prof, selectedDate, slot);
                            const isProfWorking = isProfessionalWorkingAt(
                              prof,
                              selectedDate,
                              slot,
                              0,
                              tenant.businessHours
                            );

                            let slotClass = 'grid-slot-cell';
                            if (isProfBreak) slotClass += ' grid-slot-cell--break';
                            else if (hasOccupancy) slotClass += ' grid-slot-cell--occupied';
                            else if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours || !isProfWorking) slotClass += ' grid-slot-cell--closed';

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
                              if (hasOccupancy) {
                                return;
                              }
                              if (isPast) {
                                handleOpenNewAppointment(prof.id, slot, true, selectedDate);
                                return;
                              }
                              handleOpenNewAppointment(prof.id, slot, false, selectedDate);
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
                                    : hasOccupancy
                                    ? `Horário ocupado (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot}) - Clique para registrar encaixe`
                                    : isOutsideHours || !isProfWorking
                                    ? `Fora do expediente/atendimento de ${prof.name} (${slot})`
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
                                {!isProfBreak && !hasOccupancy && isPast && (
                                  <span className="slot-hover-text">Encaixe</span>
                                )}
                                {!isProfBreak && !hasOccupancy && !isPast && !isOutsideHours && isProfWorking && (
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
                              topPx: 4,
                              heightPx: 69,
                              left: '4px',
                              width: 'calc(100% - 8px)',
                            };

                            const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                            const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

                            const cardState = getAppointmentCardState({
                              isFitting: app.is_fitting,
                              appointmentStatus: app.status,
                              paymentStatus: app.payment_status,
                            });
                            const statusClass = `card-status--${cardState.replace('_', '-')}`;
                            const hasTopBadges = Boolean(
                              app.is_fitting ||
                              app.status === 'no_show' ||
                              app.status === 'in_progress' ||
                              app.payment_status === 'paid'
                            );

                            return (
                              <div
                                key={app.id}
                                className={`timeline-appointment-card ${statusClass} ${app.is_fitting ? 'timeline-appointment-card--fitting' : 'timeline-appointment-card--normal'}`}
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
                                  {hasTopBadges ? (
                                    <div className="card-badges-row">
                                      {app.is_fitting && (
                                        <span className="badge-chip badge-chip--fitting" title="Encaixe">
                                          Encaixe
                                        </span>
                                      )}
                                      {app.status === 'no_show' && (
                                        <span className="badge-chip badge-chip--no-show" title="Não compareceu">
                                          Não compareceu
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
                                  ) : (
                                    <AppointmentQuickActions
                                      app={app}
                                      onMarkNoShow={(target) => void handleMarkNoShow(target)}
                                      onReschedule={handleOpenRescheduleModal}
                                    />
                                  )}
                                </div>

                                <div className="card-client-row">
                                  <div className="card-client-info">
                                    <span className="card-client-name" title={app.customer?.name}>
                                      {app.customer?.name || 'Cliente'}
                                    </span>
                                    <span className="card-service-name" title={app.service?.name}>
                                      {app.service?.name} (R$ {Number(app.service?.price || 0).toFixed(2)})
                                    </span>
                                  </div>

                                  {hasTopBadges && (
                                    <AppointmentQuickActions
                                      app={app}
                                      onMarkNoShow={(target) => void handleMarkNoShow(target)}
                                      onReschedule={handleOpenRescheduleModal}
                                    />
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
                      return aDate === day.dateStr && selectedProfessionalIds.includes(a.professional_id);
                    });
                    const dayBlocked = blockedSlots.filter((b) => {
                      const bDate = dateInZone(new Date(b.start_time), tenant.timezone);
                      return bDate === day.dateStr && selectedProfessionalIds.includes(b.professional_id);
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
                            const hasOccupancy = slotApps.length > 0;

                            const activeWeekProfs = visibleProfessionals;
                            const defaultTargetProfId = activeWeekProfs[0]?.id || professionals[0]?.id;
                            const weekProf = activeWeekProfs[0] || professionals.find((p) => p.id === defaultTargetProfId);
                            const anyProfWorking = activeWeekProfs.length === 0 || activeWeekProfs.some((p) =>
                              isProfessionalWorkingAt(p, day.dateStr, slot, 0, tenant.businessHours)
                            );
                            const allProfsBreak =
                              activeWeekProfs.length > 0 &&
                              activeWeekProfs.every((p) => isProfessionalOnBreak(p, day.dateStr, slot));

                            let slotClass = 'grid-slot-cell';
                            if (allProfsBreak) slotClass += ' grid-slot-cell--break';
                            else if (hasOccupancy) slotClass += ' grid-slot-cell--occupied';
                            else if (isPast) slotClass += ' grid-slot-cell--past';
                            else if (isOutsideHours || !anyProfWorking) slotClass += ' grid-slot-cell--closed';

                            const handleCellClick = () => {
                              if (isDayClosed) {
                                addToast('A barbearia não abre neste dia conforme as configurações.', 'warning');
                                return;
                              }
                              if (allProfsBreak) {
                                if (weekProf) {
                                  addToast(getProfessionalBreakMessage(weekProf, day.dateStr), 'warning');
                                }
                                return;
                              }
                              if (isOutsideHours) {
                                addToast(`Horário fora do funcionamento da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
                                return;
                              }
                              if (!anyProfWorking) {
                                addToast(`Nenhum dos profissionais selecionados está atendendo neste horário.`, 'warning');
                                return;
                              }
                              if (hasOccupancy) {
                                return;
                              }
                              setSelectedDate(day.dateStr);
                              if (isPast) {
                                handleOpenNewAppointment(defaultTargetProfId, slot, true, day.dateStr);
                                return;
                              }
                              handleOpenNewAppointment(defaultTargetProfId, slot, false, day.dateStr);
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
                                    : allProfsBreak
                                    ? `Intervalo do profissional ${weekProf?.name || ''} (${slot})`
                                    : hasOccupancy
                                    ? `Horário ocupado (${slot})`
                                    : isPast
                                    ? `Horário decorrido (${slot}) - Clique para registrar encaixe`
                                    : isOutsideHours || !anyProfWorking
                                    ? `Fora do expediente/atendimento (${slot})`
                                    : `Clique para agendar às ${slot} em ${day.label}`
                                }
                              >
                                {allProfsBreak && (
                                  <span className="slot-break-label">
                                    {weekProf && getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end
                                      ? `Intervalo até ${getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end}`
                                      : 'Intervalo'}
                                  </span>
                                )}
                                {!allProfsBreak && !hasOccupancy && isPast && (
                                  <span className="slot-hover-text">Encaixe</span>
                                )}
                                {!allProfsBreak && !hasOccupancy && !isPast && !isOutsideHours && anyProfWorking && (
                                  <span className="slot-hover-text">+ {slot}</span>
                                )}
                              </div>
                            );
                          })}

                          {/* Linha Vermelha de Tempo Real na Visão Semanal */}
                          {day.dateStr === todayDateStr && redLineTopPx !== null && (
                            <div
                              className="agenda-red-line"
                              style={{ top: `${redLineTopPx}px` }}
                              title={`Hora Atual: ${currentTimeFormatted}`}
                            />
                          )}

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
                              topPx: 4,
                              heightPx: 69,
                              left: '4px',
                              width: 'calc(100% - 8px)',
                            };

                            const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                            const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

                            const cardState = getAppointmentCardState({
                              isFitting: app.is_fitting,
                              appointmentStatus: app.status,
                              paymentStatus: app.payment_status,
                            });
                            const statusClass = `card-status--${cardState.replace('_', '-')}`;

                            return (
                              <div
                                key={app.id}
                                className={`timeline-appointment-card ${statusClass} ${app.is_fitting ? 'timeline-appointment-card--fitting' : 'timeline-appointment-card--normal'}`}
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
                                    {app.status === 'no_show' && (
                                      <span className="badge-chip badge-chip--no-show" title="Não compareceu">
                                        Não compareceu
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
              Novo cadastro
            </button>
            <button
              type="button"
              className={`segmented-btn ${customerMode === 'none' ? 'segmented-btn--active' : ''}`}
              onClick={() => setCustomerMode('none')}
            >
              Sem cadastro (Balcão)
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
          ) : customerMode === 'new' ? (
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
          ) : (
            <div className="anonymous-customer-note" style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '0.5rem', border: '1px dashed rgba(255, 255, 255, 0.15)', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem' }}>
              <span>ℹ️ Atendimento avulso de balcão sem identificação de cliente. A comanda será aberta normalmente sem criar clientes fictícios no banco.</span>
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
                  <>
                    <option value={ANY_PROFESSIONAL}>Tanto faz</option>
                    {availableProfessionalsForFormTime.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </>
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
              {formIsFitting && fittingTimeMode === 'custom' ? (
                <input
                  id="form-time"
                  type="time"
                  step="60"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="input-text"
                  required
                />
              ) : modalAvailableTimeSlots.length > 0 ? (
                <select
                  id="form-time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="input-select"
                  required
                >
                  {formIsFitting && !modalAvailableTimeSlots.includes(formTime) && (
                    <option value={formTime}>{formTime} (fora da grade)</option>
                  )}
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
                  step="60"
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
                {isPastFormTime && (
                  <span className="badge-fitting-active" style={{ background: 'var(--color-bg-tertiary, #f3f4f6)', color: 'var(--color-text-secondary, #4b5563)' }}>
                    Obrigatório (passado)
                  </span>
                )}
              </div>
              <span className="fitting-toggle-desc">
                {formIsFitting && fittingTimeMode === 'custom'
                  ? 'Horário personalizado: permite registrar uma exceção fora da grade e do expediente configurado.'
                  : isPastFormTime
                  ? 'Horário já decorrido: o registro neste horário é restrito a Encaixe de balcão.'
                  : 'Permite atender dois clientes no mesmo horário dividindo a coluna da grade.'}
              </span>
            </div>
            {formIsFitting && (
              <div
                className="fitting-mode-switch"
                role="group"
                aria-label="Modalidade do horário do encaixe"
              >
                <span className={`fitting-mode-switch__label ${fittingTimeMode === 'grid' ? 'fitting-mode-switch__label--active' : ''}`}>
                  Grade
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fittingTimeMode === 'custom'}
                  aria-label="Alternar entre horário da grade e personalizado"
                  className={`fitting-mode-switch__control ${fittingTimeMode === 'custom' ? 'fitting-mode-switch__control--custom' : ''}`}
                  onClick={() => setFittingTimeMode((current) => current === 'grid' ? 'custom' : 'grid')}
                >
                  <span className="fitting-mode-switch__thumb" />
                </button>
                <button
                  type="button"
                  className={`fitting-mode-switch__label fitting-mode-switch__label-button ${fittingTimeMode === 'custom' ? 'fitting-mode-switch__label--active' : ''}`}
                  aria-label="Horário personalizado"
                  onClick={() => setFittingTimeMode('custom')}
                >
                  Personalizado
                </button>
              </div>
            )}
            <label className="checkbox-label" style={{ margin: 0, cursor: isPastFormTime ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Marcar como Encaixe de Balcão"
                checked={formIsFitting}
                disabled={isPastFormTime}
                onChange={(e) => {
                  setFormIsFitting(e.target.checked);
                  if (!e.target.checked) setFittingTimeMode('grid');
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Encaixe</span>
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
          timezone={tenant.timezone}
          appointmentDurationMinutes={
            services.find((s) => s.id === checkoutAppointment.service?.id)?.duration_minutes || 30
          }
          onClose={() => {
            setIsCheckoutModalOpen(false);
            setCheckoutAppointment(null);
          }}
          onRescheduled={(_newStartTime, _newProfId) => {
            addToast('Atendimento reagendado com sucesso!', 'success');
            fetchAppointments();
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

      <ConfirmSoftDeleteModal
        isOpen={Boolean(blockPendingRemoval)}
        title="Remover bloqueio"
        itemName={blockPendingRemoval?.reason || 'de horário'}
        itemTypeLabel="o bloqueio"
        warningText="O horário voltará a ficar disponível para novos agendamentos após a remoção."
        loading={isRemovingBlock}
        onConfirm={handleConfirmRemoveBlock}
        onClose={() => {
          if (!isRemovingBlock) setBlockPendingRemoval(null);
        }}
      />

      {/* 5b. CONFIRMAÇÃO DE NÃO COMPARECIMENTO */}
      <Modal
        isOpen={isNoShowModalOpen}
        onClose={() => {
          setIsNoShowModalOpen(false);
          setNoShowAppointment(null);
        }}
        title="Confirmar não comparecimento"
      >
        {noShowAppointment && (
          <div className="cancel-modal-body">
            <p className="cancel-alert-text">
              Deseja marcar o atendimento de{' '}
              <strong>{noShowAppointment.customer?.name || 'Cliente'}</strong> como não compareceu?
              A comanda aberta vinculada será cancelada e nenhum novo pagamento será permitido.
            </p>
            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsNoShowModalOpen(false);
                  setNoShowAppointment(null);
                }}
              >
                Não marcar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleConfirmNoShow()}
              >
                Sim, não compareceu
              </button>
            </div>
          </div>
        )}
      </Modal>

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

      {/* 7. MODAL DE REAGENDAMENTO DIRETO NA AGENDA */}
      <Modal
        isOpen={isAgendaRescheduleModalOpen}
        onClose={() => {
          setIsAgendaRescheduleModalOpen(false);
          setAgendaRescheduleAppointment(null);
        }}
        title="Reagendar Atendimento"
      >
        {agendaRescheduleAppointment && (
          <div className="reschedule-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
              Reagendar horário de <strong>{agendaRescheduleAppointment.customer?.name}</strong> para o serviço{' '}
              <strong>{agendaRescheduleAppointment.service?.name}</strong>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="agenda_reschedule_date" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>
                  Nova Data:
                </label>
                <input
                  id="agenda_reschedule_date"
                  type="date"
                  value={agendaRescheduleDate}
                  onChange={(e) => setAgendaRescheduleDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <label htmlFor="agenda_reschedule_time" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>
                  Novo Horário:
                </label>
                <select
                  id="agenda_reschedule_time"
                  value={agendaRescheduleTime}
                  onChange={(e) => setAgendaRescheduleTime(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                >
                  <option value="">Selecione um horário livre...</option>
                  {agendaRescheduleAvailableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                  {agendaRescheduleAvailableSlots.length === 0 && (
                    <option value="" disabled>
                      Nenhum horário livre nesta data
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="agenda_reschedule_prof" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>
                Profissional:
              </label>
              <select
                id="agenda_reschedule_prof"
                value={agendaRescheduleProfId}
                onChange={(e) => setAgendaRescheduleProfId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsAgendaRescheduleModalOpen(false);
                  setAgendaRescheduleAppointment(null);
                }}
                disabled={isAgendaRescheduling}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmAgendaReschedule}
                disabled={isAgendaRescheduling}
              >
                {isAgendaRescheduling ? 'Salvando...' : 'Confirmar Reagendamento'}
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
          display: none;
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
          background-color: #ffffff;
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

        .btn-view-mode--active,
        .btn-view-mode--active:hover {
          background-color: #f2b277;
          color: #000000;
          box-shadow: var(--shadow-sm);
        }

        /* NAVEGADOR DE DATAS */
        .agenda-date-navigator {
          display: flex;
          align-items: center;
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          position: relative;
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

        .btn-date-today--active,
        .btn-date-today--active:hover {
          color: #000000 !important;
          font-weight: 700 !important;
          background-color: #f2b277 !important;
        }

        .dark-theme .btn-date-today--active,
        .dark-theme .btn-date-today--active:hover {
          color: #000000 !important;
          font-weight: 700 !important;
          background-color: #f2b277 !important;
        }

        /* CUSTOM DATEPICKER */
        .agenda-date-picker-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          z-index: 120;
        }

        .agenda-date-picker-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.6rem;
          border-left: 1px solid var(--color-border);
          border-top-right-radius: var(--radius-md);
          border-bottom-right-radius: var(--radius-md);
          cursor: pointer;
          position: relative;
          color: var(--color-text-secondary);
          transition: color 0.15s ease;
        }

        .agenda-date-picker-label:hover {
          color: var(--color-text-primary);
        }

        .agenda-date-picker-input-hidden {
          position: absolute;
          opacity: 0;
          pointer-events: none;
          width: 0;
          height: 0;
          margin: 0;
          padding: 0;
          border: none;
        }

        .custom-datepicker-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 312px;
          background: #ffffff;
          border-radius: 20px;
          padding: 18px 18px 20px 18px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.08);
          z-index: 1000;
          box-sizing: border-box;
          user-select: none;
          animation: datepickerFadeIn 0.15s ease-out;
        }

        .dark-theme .custom-datepicker-dropdown {
          background: #1c1917;
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
        }

        @keyframes datepickerFadeIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .custom-datepicker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .custom-datepicker-title-group {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text-primary, #1e293b);
        }

        .custom-datepicker-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-text-primary, #1e293b);
          font-family: var(--font-family-base);
          letter-spacing: -0.01em;
        }

        .dark-theme .custom-datepicker-title {
          color: #ffffff;
        }

        .custom-datepicker-chevron {
          color: #0084ff;
          margin-top: 1px;
        }

        .custom-datepicker-arrows {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .custom-datepicker-arrow-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0084ff;
          border-radius: 6px;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }

        .custom-datepicker-arrow-btn:hover {
          background-color: rgba(0, 132, 255, 0.08);
        }

        .custom-datepicker-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .custom-datepicker-weekday {
          text-align: center;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #64748b;
          font-family: var(--font-family-base);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          margin: 0 auto;
        }

        .dark-theme .custom-datepicker-weekday {
          color: #a8a29e;
        }

        .custom-datepicker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          row-gap: 6px;
          width: 100%;
          box-sizing: border-box;
        }

        .custom-datepicker-cell {
          aspect-ratio: 1;
          width: 36px;
          height: 36px;
          max-width: 100%;
          margin: 0 auto;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #1e293b;
          background: transparent;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          outline: none;
          font-family: var(--font-family-base);
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          box-sizing: border-box;
        }

        @media (max-width: 380px) {
          .custom-datepicker-dropdown {
            width: calc(100vw - 24px);
            right: -12px;
            padding: 16px 12px 18px 12px;
          }
          .custom-datepicker-weekday,
          .custom-datepicker-cell {
            width: 32px;
            height: 32px;
            font-size: 0.85rem;
          }
        }

        .dark-theme .custom-datepicker-cell {
          color: #f5f5f4;
        }

        .custom-datepicker-cell:hover {
          background-color: #f1f5f9;
        }

        .dark-theme .custom-datepicker-cell:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .custom-datepicker-cell--outside {
          color: #94a3b8;
          font-weight: 400;
        }

        .dark-theme .custom-datepicker-cell--outside {
          color: #78716c;
        }

        .custom-datepicker-cell--today {
          background-color: #f1f5f9;
          font-weight: 600;
        }

        .dark-theme .custom-datepicker-cell--today {
          background-color: rgba(255, 255, 255, 0.08);
        }

        /* Selected Day: Anel azul com preenchimento suave */
        .custom-datepicker-cell--selected {
          border: 2px solid #0084ff !important;
          background-color: #e5f2fe !important;
          color: #0070d2 !important;
          font-weight: 700 !important;
        }

        .dark-theme .custom-datepicker-cell--selected {
          border-color: #38bdf8 !important;
          background-color: rgba(56, 189, 248, 0.22) !important;
          color: #38bdf8 !important;
        }

        /* FILTRO DE EQUIPE */
        .agenda-filter-container {
          position: relative;
          z-index: 110;
        }

        .btn-agenda-filter {
          width: 128px;
          min-width: 128px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0 0.5rem;
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
          white-space: nowrap;
        }

        .btn-agenda-filter:hover,
        .btn-agenda-filter--active {
          border-color: var(--color-brand-primary);
          color: #000000;
        }

        .btn-agenda-filter:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
        }

        .dark-theme .btn-agenda-filter {
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .dark-theme .btn-agenda-filter:hover,
        .dark-theme .btn-agenda-filter--active {
          border-color: var(--color-brand-primary);
          color: #FFFFFF;
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
          color: #000000;
          font-size: var(--font-size-xs);
          cursor: pointer;
          font-weight: 600;
        }

        .btn-link-xs:hover {
          color: #000000;
          text-decoration: underline;
        }

        .dark-theme .btn-link-xs {
          color: #FFFFFF;
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
          padding: 4px 6px;
          border-radius: var(--radius-sm);
          transition: background-color 0.15s ease;
        }

        .filter-checkbox-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .dark-theme .filter-checkbox-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .filter-checkbox-item input[type="radio"],
        .filter-checkbox-item input[type="checkbox"] {
          accent-color: var(--color-brand-primary);
          cursor: pointer;
          width: 16px;
          height: 16px;
        }

        @media (pointer: coarse) {
          .btn-agenda-filter {
            min-height: 44px;
            min-width: 44px;
          }
          .filter-checkbox-item {
            min-height: 44px;
            padding: 8px 6px;
          }
        }

        /* BOTÕES DE AÇÃO DO HEADER */
        .btn-agenda-espera {
          width: 128px;
          min-width: 128px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0 0.5rem;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
          white-space: nowrap;
        }

        .btn-agenda-espera:hover {
          border-color: #d96c00;
        }

        .btn-agenda-bloquear {
          width: 128px;
          min-width: 128px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0 0.5rem;
          background-color: #FFFFFF;
          border: 1px solid #F05252;
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: #F05252;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
          white-space: nowrap;
        }

        .btn-agenda-bloquear:hover {
          background-color: #FFF5F5;
          border-color: #F05252;
        }

        /* BOTÃO MESTRE + ENCAIXE */
        .btn-master-encaixe {
          width: 128px;
          min-width: 128px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0 0.5rem;
          background-color: #F2B277;
          color: #000000;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 700;
          font-size: var(--font-size-xs);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          box-sizing: border-box;
          white-space: nowrap;
        }

        .btn-master-encaixe:hover {
          background-color: #F2B277;
          color: #000000;
          transform: none;
          box-shadow: var(--shadow-sm);
        }

        /* GRADE DA TIMELINE */
        .agenda-grid-wrapper {
          width: 100%;
          max-height: calc(100dvh - 165px);
          overflow: auto;
          overscroll-behavior: contain;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1px solid rgba(234, 222, 214, 0.7);
          border-radius: var(--radius-lg);
          padding: 0;
          box-shadow: var(--shadow-sm);
          scrollbar-width: thin;
          scrollbar-color: rgba(45, 35, 30, 0.25) transparent;
          transition: scrollbar-color 0.2s ease;
          position: relative;
        }

        .agenda-grid-wrapper:hover {
          scrollbar-color: rgba(45, 35, 30, 0.45) transparent;
        }

        .dark-theme .agenda-grid-wrapper {
          background-color: var(--color-bg-secondary, #1E1B18);
          border-color: var(--color-border);
          scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
        }

        .dark-theme .agenda-grid-wrapper:hover {
          scrollbar-color: rgba(255, 255, 255, 0.45) transparent;
        }

        .agenda-grid-wrapper::-webkit-scrollbar {
          height: 5px;
          width: 5px;
        }

        .agenda-grid-wrapper::-webkit-scrollbar-track {
          background: transparent;
        }

        .agenda-grid-wrapper::-webkit-scrollbar-thumb {
          background: rgba(45, 35, 30, 0.15);
          border-radius: 9999px;
          transition: background-color 0.2s ease;
        }

        .agenda-grid-wrapper:hover::-webkit-scrollbar-thumb {
          background: rgba(45, 35, 30, 0.35);
        }

        .agenda-grid-wrapper:hover::-webkit-scrollbar-thumb:hover {
          background: rgba(45, 35, 30, 0.55);
        }

        .dark-theme .agenda-grid-wrapper::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
        }

        .dark-theme .agenda-grid-wrapper:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.35);
        }

        .dark-theme .agenda-grid-wrapper:hover::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.55);
        }

        .agenda-timeline-board {
          display: flex;
          min-width: 100%;
          width: 100%;
          position: relative;
        }

        /* Eixo de Horários (Coluna Fixa à Esquerda no Scroll Horizontal) */
        .timeline-axis-column {
          width: 65px;
          min-width: 65px;
          flex-shrink: 0;
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          position: sticky;
          left: 0;
          z-index: 35;
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
        }

        .dark-theme .timeline-axis-column {
          background-color: var(--color-bg-secondary, #1E1B18);
          border-right-color: var(--color-border);
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.35);
        }

        /* Canto Superior Esquerdo - Interseção Horários x Datas */
        .timeline-axis-header {
          height: 60px;
          min-height: 60px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          position: sticky;
          top: 0;
          left: 0;
          z-index: 50; /* Maior z-index de toda a estrutura */
          background-color: var(--color-bg-secondary, #FFFFFF);
          border-top-left-radius: calc(var(--radius-lg) - 1px);
          box-sizing: border-box;
        }

        .dark-theme .timeline-axis-header {
          background-color: var(--color-bg-secondary, #1E1B18);
          border-bottom-color: var(--color-border);
        }

        .timeline-axis-body {
          display: flex;
          flex-direction: column;
          background-color: inherit;
        }

        /* Indicador de Tempo Real na Régua de Horários */
        .timeline-axis-now-badge {
          position: absolute;
          left: 3px;
          right: 3px;
          transform: translateY(-50%);
          background-color: var(--color-error, #EF4444);
          color: #FFFFFF;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 3px;
          border-radius: var(--radius-sm, 4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 45;
          pointer-events: none;
          box-shadow: 0 1px 4px rgba(239, 68, 68, 0.4);
          white-space: nowrap;
          letter-spacing: -0.02em;
        }

        .time-slot-label {
          height: 76px;
          min-height: 76px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          border-bottom: 1px dashed rgba(234, 222, 214, 0.4);
          background-color: inherit;
        }

        .dark-theme .time-slot-label {
          border-bottom-color: rgba(255, 255, 255, 0.06);
        }

        /* Colunas dos Barbeiros */
        .professionals-columns-container {
          display: flex;
          flex: 1 1 auto;
          min-width: 0;
        }

        .professional-timeline-column {
          flex: 1 1 0;
          width: 100%;
          min-width: clamp(240px, 22vw, 640px);
          border-right: 1px solid rgba(234, 222, 214, 0.7);
          display: flex;
          flex-direction: column;
        }

        .week-timeline-column {
          flex: 1 1 0;
          width: 100%;
          min-width: clamp(140px, 12vw, 220px);
        }

        .professional-timeline-column:last-child {
          border-right: none;
        }

        .professional-timeline-column:last-child .prof-col-header {
          border-top-right-radius: calc(var(--radius-lg) - 1px);
        }

        /* Header das Datas e Profissionais (Fixo no Topo no Scroll Vertical) */
        .prof-col-header {
          height: 60px;
          min-height: 60px;
          border-bottom: 1px solid var(--color-border);
          padding: 0.5rem 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          position: sticky;
          top: 0;
          z-index: 30;
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .dark-theme .prof-col-header {
          background-color: var(--color-bg-secondary, #1E1B18);
          border-bottom-color: var(--color-border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
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
          width: 100%;
          flex: 0 0 auto;
          height: 76px;
          min-height: 76px;
          box-sizing: border-box;
          border-bottom: 1px dashed rgba(234, 222, 214, 0.5);
          cursor: pointer;
          position: relative;
          transition: background-color 0.08s ease;
          padding-top: var(--radius-sm, 4px);
          padding-bottom: var(--radius-sm, 4px);
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

        .grid-slot-cell--occupied,
        .grid-slot-cell--full {
          cursor: default;
        }

        .grid-slot-cell--occupied:hover,
        .grid-slot-cell--full:hover {
          background-color: transparent !important;
        }

        .grid-slot-cell--occupied .slot-hover-text,
        .grid-slot-cell--full .slot-hover-text {
          display: none !important;
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
          transition: background-color 0.08s ease, border-color 0.08s ease;
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
          justify-content: flex-start;
          gap: 4px;
          min-height: 69px;
          overflow: hidden;
          box-sizing: border-box;
          background-color: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: box-shadow 0.08s ease, border-color 0.08s ease;
        }

        .timeline-appointment-card:hover {
          box-shadow: var(--shadow-md);
          border-color: rgba(217, 108, 0, 0.45);
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

        .timeline-appointment-card--fitting {
          border-left: 4px solid #b45309;
        }

        .timeline-appointment-card--normal {
          border-left-width: 1px;
        }

        .card-status--in-progress {
          border-color: rgba(63, 131, 248, 0.4);
          background-color: var(--color-info-bg);
        }

        .card-status--completed {
          border-color: rgba(14, 159, 110, 0.4);
          background-color: var(--color-success-bg);
        }

        .card-status--no-show {
          border-color: rgba(185, 28, 28, 0.45);
          background-color: rgba(254, 226, 226, 0.9);
        }

        .badge-chip--no-show {
          background: #b91c1c;
          color: #fff;
        }

        .card-quick-no-show-btn,
        .card-quick-reagendar-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          line-height: 1;
          height: 19px;
          box-sizing: border-box;
          vertical-align: middle;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }

        .card-quick-no-show-btn svg,
        .card-quick-reagendar-btn svg {
          display: block;
          flex-shrink: 0;
          margin: 0;
        }

        .card-quick-no-show-btn span,
        .card-quick-reagendar-btn span {
          display: inline-flex;
          align-items: center;
          line-height: 1;
        }

        .card-quick-no-show-btn {
          border: 1px solid rgba(185, 28, 28, 0.35);
          background: rgba(254, 242, 242, 0.95);
          color: #b91c1c;
        }

        .card-quick-no-show-btn:hover {
          background: rgba(254, 226, 226, 1);
          border-color: rgba(185, 28, 28, 0.55);
        }

        .card-quick-reagendar-btn {
          border: 1px solid #0284c7;
          background: #0284c7;
          color: #ffffff;
        }

        .card-quick-reagendar-btn svg {
          color: #ffffff;
        }

        .card-quick-reagendar-btn:hover {
          background: #0369a1;
          border-color: #0369a1;
          color: #ffffff;
        }

        .dark-theme .card-quick-no-show-btn {
          background: rgba(185, 28, 28, 0.2);
          border-color: rgba(248, 113, 113, 0.4);
          color: #f87171;
        }

        .dark-theme .card-quick-reagendar-btn {
          background: #0284c7;
          border-color: #38bdf8;
          color: #ffffff;
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
          white-space: nowrap;
          flex-shrink: 0;
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
          white-space: nowrap;
          line-height: 1.2;
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
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
          margin: 0;
          width: 100%;
        }

        .card-client-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .card-quick-actions-right {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          flex-shrink: 0;
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

        /* REGRAS ESPECÍFICAS DA VISÃO SEMANAL */
        .week-timeline-column .timeline-appointment-card {
          padding: 0.3rem 0.45rem;
          gap: 1px;
          justify-content: flex-start;
        }

        .week-timeline-column .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 3px;
          margin-bottom: 2px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .week-timeline-column .card-time-badge {
          font-size: 0.66rem;
          font-weight: 800;
          white-space: nowrap;
          flex-shrink: 0;
          line-height: 1;
        }

        .week-timeline-column .card-badges-row {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .week-timeline-column .badge-chip {
          font-size: 0.52rem;
          padding: 1px 3px;
          white-space: nowrap;
          line-height: 1;
          letter-spacing: 0.2px;
        }

        .week-timeline-column .card-client-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          width: 100%;
          min-width: 0;
        }

        .week-timeline-column .card-client-name {
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
          line-height: 1.15;
        }

        .week-timeline-column .card-service-name {
          font-size: 0.68rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
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
          transition: background-color 0.08s ease, color 0.08s ease;
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
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          width: 100%;
          min-width: 0;
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
          min-width: 0;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          min-width: 0;
        }

        .input-text,
        .input-select,
        .input-textarea {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 0.6rem 0.8rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-family: inherit;
          box-sizing: border-box;
          inline-size: 100%;
        }

        #form-date,
        #form-time {
          min-inline-size: 0;
          max-inline-size: 100%;
          width: 100%;
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
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          box-sizing: border-box;
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
          min-width: 0;
        }

        .fitting-toggle-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
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

        .fitting-mode-switch {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.45rem;
          min-width: 0;
        }

        .fitting-mode-switch__label {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          transition: color 0.2s ease;
        }

        .fitting-mode-switch__label--active {
          color: var(--color-text-primary);
        }

        .fitting-mode-switch__label-button {
          border: 0;
          padding: 0;
          background: transparent;
          font-family: inherit;
          cursor: pointer;
        }

        .fitting-mode-switch__control {
          position: relative;
          width: 2.55rem;
          height: 1.35rem;
          padding: 0.15rem;
          border: 1px solid var(--color-border);
          border-radius: 999px;
          background: var(--color-border);
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease;
          box-sizing: border-box;
        }

        .fitting-mode-switch__control--custom {
          background: var(--color-brand-primary);
          border-color: var(--color-brand-primary);
        }

        .fitting-mode-switch__control:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
        }

        .fitting-mode-switch__thumb {
          display: block;
          width: 0.95rem;
          height: 0.95rem;
          border-radius: 50%;
          background: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
          transform: translateX(0);
          transition: transform 0.2s ease;
        }

        .fitting-mode-switch__control--custom .fitting-mode-switch__thumb {
          transform: translateX(1.05rem);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          cursor: pointer;
          white-space: nowrap;
        }

        @media (max-width: 480px) {
          .modal-agenda-form .form-row-2col,
          .modal-agenda-form .form-row-2 {
            grid-template-columns: minmax(0, 1fr);
          }

          .fitting-toggle-card {
            grid-template-columns: minmax(0, 1fr);
          }

          .fitting-mode-switch {
            justify-content: flex-start;
            width: 100%;
          }

          #form-date,
          #form-time {
            display: block;
            min-inline-size: 0;
            max-inline-size: 100%;
            width: 100%;
          }
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

        /* SKELETON LOADING DA GRADE DA AGENDA */
        @keyframes skeletonShimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .agenda-timeline-board--skeleton {
          pointer-events: none;
          user-select: none;
          animation: skeletonFadeIn 0.2s ease-out;
        }

        @keyframes skeletonFadeIn {
          from {
            opacity: 0.6;
          }
          to {
            opacity: 1;
          }
        }

        .skeleton-box {
          background: linear-gradient(
            90deg,
            rgba(45, 35, 30, 0.05) 0%,
            rgba(217, 108, 0, 0.12) 50%,
            rgba(45, 35, 30, 0.05) 100%
          );
          background-size: 200% 100%;
          animation: skeletonShimmer 1.5s ease-in-out infinite;
          border-radius: var(--radius-sm, 6px);
        }

        .dark-theme .skeleton-box {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(217, 108, 0, 0.16) 50%,
            rgba(255, 255, 255, 0.04) 100%
          );
          background-size: 200% 100%;
        }

        .skeleton-title {
          height: 14px;
          border-radius: 4px;
        }

        .skeleton-subtitle {
          height: 10px;
          border-radius: 4px;
        }

        .skeleton-appointment-card {
          position: absolute;
          left: 4px;
          right: 4px;
          border-radius: var(--radius-md, 8px);
          padding: 0.5rem;
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(234, 222, 214, 0.8);
          box-shadow: 0 2px 8px rgba(45, 35, 30, 0.04);
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: hidden;
          pointer-events: none;
          z-index: 5;
        }

        .dark-theme .skeleton-appointment-card {
          background: rgba(30, 27, 24, 0.85);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .skeleton-card-badge {
          width: 44px;
          height: 12px;
          border-radius: 4px;
        }

        .skeleton-card-name {
          width: 72%;
          height: 13px;
          border-radius: 4px;
        }

        .skeleton-card-service {
          width: 50%;
          height: 11px;
          border-radius: 4px;
        }

        /* EMPTY STATE */
        .agenda-empty-state {
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          text-align: center;
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

        @media (max-width: 1024px) {
          .agenda-header-subtitle {
            display: none;
          }
          .card-notes-snippet {
            display: none;
          }
          .grid-slot-cell {
            padding-top: var(--radius-sm, 4px);
            padding-bottom: var(--radius-sm, 4px);
          }
          .card-quick-no-show-btn {
            width: 115px;
            height: 19px;
            padding: 0 4px;
            font-size: 0.65rem;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .card-quick-reagendar-btn {
            height: 19px;
            padding: 0 4px;
            font-size: 0.65rem;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
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
