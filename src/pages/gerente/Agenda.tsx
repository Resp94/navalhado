import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Button, Tooltip } from '../../components/ui';
import {
  dateInZone,
  formatTimeInZone,
  localDayUtcRange,
  shiftCalendarDate,
} from '../../lib/timezone';
import { ComandaCheckoutModal } from '../../components/comandas/ComandaCheckoutModal';
import { BloqueioModal } from '../../components/bloqueios/BloqueioModal';
import { ConfirmSoftDeleteModal } from '../../components/cadastros/ConfirmSoftDeleteModal';
import { ListaEsperaDrawer } from '../../components/espera/ListaEsperaDrawer';
import { NovoAgendamentoModal } from '../../components/agenda/NovoAgendamentoModal';
import type { NovoAgendamentoInicial } from '../../components/agenda/NovoAgendamentoModal';
import { CancelarAgendamentoModal } from '../../components/agenda/CancelarAgendamentoModal';
import { NaoCompareceuModal } from '../../components/agenda/NaoCompareceuModal';
import { ReagendarAgendamentoModal } from '../../components/agenda/ReagendarAgendamentoModal';
import {
  motivoRecusaNaoCompareceu,
  useMarcarNaoCompareceu,
} from '../../components/agenda/useMarcarNaoCompareceu';
import type { ResultadoNaoCompareceu } from '../../components/agenda/useMarcarNaoCompareceu';
import { CustomDatePicker } from '../../components/CustomDatePicker';
import { AgendaOperationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
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
  Calendar03Icon,
  Clock01Icon,
  AddCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
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
  toScheduleGridSegment,
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

  const skeletonBoxClass =
    'bg-[linear-gradient(90deg,rgba(45,35,30,0.05)_0%,rgba(217,108,0,0.12)_50%,rgba(45,35,30,0.05)_100%)] bg-[length:200%_100%] animate-shimmer rounded-sm';

  return (
    <div
      className="flex min-w-full w-max relative pointer-events-none select-none animate-fade-in"
      aria-busy="true"
      aria-label="Carregando grade da agenda"
    >
      {/* Coluna Fixa da Régua de Horários */}
      <div className="w-[65px] min-w-[65px] shrink-0 border-r border-border flex flex-col sticky left-0 z-[35] bg-bg-secondary shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
        <div className="h-[60px] min-h-[60px] border-b border-border flex items-center justify-center text-text-secondary sticky top-0 left-0 z-50 bg-bg-secondary rounded-tl-[calc(var(--radius-lg)-1px)] box-border">
          <HugeiconsIcon icon={Clock01Icon} size={16} />
        </div>
        <div className="flex flex-col bg-[inherit]">
          {displaySlots.map((slot) => (
            <div
              key={slot}
              className="box-border flex items-center justify-center text-xs font-bold text-text-secondary border-b border-dashed border-border/40 bg-[inherit]"
              style={{ height: `${slotHeightPx}px` }}
            >
              <div
                className={skeletonBoxClass}
                style={{ width: '38px', height: '11px', margin: '0 auto', borderRadius: '4px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Colunas da Grade com Shimmer */}
      <div className="flex flex-1 min-w-0">
        {columns.map((col, colIndex) => (
          <div key={col.id} className="flex-1 w-full min-w-[clamp(240px,22vw,640px)] border-r border-border/70 flex flex-col last:border-r-0">
            {/* Cabeçalho Skeleton */}
            <div className="h-[60px] min-h-[60px] border-b border-border py-2 px-3 flex items-center gap-2.5 sticky top-0 z-30 bg-bg-secondary box-border shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs border-[1.5px] border-white/80 ${skeletonBoxClass}`} style={{ color: 'transparent' }}>
                {col.initials}
              </div>
              <div className="flex flex-col min-w-0">
                <div
                  className={`${skeletonBoxClass} h-3.5 rounded`}
                  style={{ width: viewMode === 'week' ? '56px' : '90px' }}
                />
                <div
                  className={`${skeletonBoxClass} h-2.5 rounded`}
                  style={{ width: '64px', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Corpo da Grade com Slots e Cards Fantasmas */}
            <div className="relative flex flex-col">
              {displaySlots.map((slot) => (
                <div
                  key={slot}
                  className="w-full flex-none box-border border-b border-dashed border-border/50 relative py-1"
                  style={{ height: `${slotHeightPx}px` }}
                />
              ))}

              {/* Cards Fantasma de Agendamento em Posições Realistas */}
              {colIndex % 2 === 0 && (
                <div
                  className="absolute left-1 right-1 rounded-md p-2 box-border bg-white/85 backdrop-blur-[10px] border border-border/80 shadow-[0_2px_8px_rgba(45,35,30,0.04)] flex flex-col gap-1.5 overflow-hidden pointer-events-none z-[5]"
                  style={{ top: `${slotHeightPx * 0.5}px`, height: `${slotHeightPx * 1.5}px` }}
                >
                  <div className={`${skeletonBoxClass} w-11 h-3`} />
                  <div className={`${skeletonBoxClass} w-[72%] h-[13px]`} />
                  <div className={`${skeletonBoxClass} w-1/2 h-[11px]`} />
                </div>
              )}

              {colIndex % 3 === 1 && (
                <div
                  className="absolute left-1 right-1 rounded-md p-2 box-border bg-white/85 backdrop-blur-[10px] border border-border/80 shadow-[0_2px_8px_rgba(45,35,30,0.04)] flex flex-col gap-1.5 overflow-hidden pointer-events-none z-[5]"
                  style={{ top: `${slotHeightPx * 2.6}px`, height: `${slotHeightPx * 1.2}px` }}
                >
                  <div className={`${skeletonBoxClass} w-11 h-3`} />
                  <div className={`${skeletonBoxClass} w-[72%] h-[13px]`} />
                </div>
              )}

              {colIndex % 2 === 1 && (
                <div
                  className="absolute left-1 right-1 rounded-md p-2 box-border bg-white/85 backdrop-blur-[10px] border border-border/80 shadow-[0_2px_8px_rgba(45,35,30,0.04)] flex flex-col gap-1.5 overflow-hidden pointer-events-none z-[5]"
                  style={{ top: `${slotHeightPx * 4.6}px`, height: `${slotHeightPx * 1.7}px` }}
                >
                  <div className={`${skeletonBoxClass} w-11 h-3`} />
                  <div className={`${skeletonBoxClass} w-[72%] h-[13px]`} />
                  <div className={`${skeletonBoxClass} w-1/2 h-[11px]`} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CARD_STATUS_TW: Record<string, string> = {
  pending: 'border-warning/40 bg-warning-bg',
  confirmed: 'border-brand-primary/30 bg-bg-secondary',
  fitting: 'border-brand-deep/35 bg-brand-soft/20',
  'in-progress': 'border-info/40 bg-info-bg',
  completed: 'border-success/40 bg-success-bg',
  // Sem token exato para este vermelho mais escuro (distinto de --color-error); mantido em hex literal.
  'no-show': 'border-[rgba(185,28,28,0.45)] bg-[rgba(254,226,226,0.9)]',
};

const getAppointmentCardClasses = (cardState: string, isFitting: boolean) => {
  const statusClass = CARD_STATUS_TW[cardState.replace('_', '-')] || '';
  // Sem token exato para este âmbar (#b45309), usado apenas na borda esquerda dos cards de encaixe.
  const borderLeftClass = isFitting ? 'border-l-4 border-l-[#b45309]' : 'border-l';
  return `absolute rounded-md py-[0.4rem] px-[0.55rem] z-10 flex flex-col justify-start gap-1 min-h-[69px] overflow-hidden box-border bg-bg-secondary shadow-sm border cursor-pointer transition-[box-shadow,border-color] duration-75 hover:shadow-md hover:border-brand-primary/45 hover:z-[15] ${statusClass} ${borderLeftClass}`;
};

export const Agenda: React.FC = () => {
  // Contexto do Tenant / Barbearia
  const tenant = useOutletContext<TenantContextType>();
  const agendaRepo = useAgenda();
  const { addToast } = useToast();

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

  // Valores de partida do modal de novo agendamento/encaixe (um objeto novo a cada abertura).
  const [novoInicial, setNovoInicial] = useState<NovoAgendamentoInicial | null>(null);

  // Agendamentos alvo dos modais de cancelamento e de reagendamento.
  const [targetAppointment, setTargetAppointment] = useState<Appointment | null>(null);
  const [isAgendaRescheduleModalOpen, setIsAgendaRescheduleModalOpen] = useState(false);
  const [agendaRescheduleAppointment, setAgendaRescheduleAppointment] = useState<Appointment | null>(null);

  const { marcar: marcarNaoCompareceu } = useMarcarNaoCompareceu(tenant.tenantId);

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

    const abrirNovo = (parcial: Partial<NovoAgendamentoInicial>) => {
      setNovoInicial({
        date: selectedDate,
        time: '09:00',
        professionalId: professionals[0]?.id || '',
        isFitting: false,
        customerMode: 'existing',
        ...parcial,
      });
      setIsModalOpen(true);
    };

    if (action === 'encaixe') {
      abrirNovo({ isFitting: true, customerId: locState?.customerId });
    } else if (locState?.openNewAppointment || locState?.customerId) {
      abrirNovo({ customerId: locState?.customerId });
    } else if (action === 'bloqueio') {
      setIsBloqueioModalOpen(true);
    } else if (action === 'espera') {
      setIsEsperaDrawerOpen(true);
    }
    // Abre os modais só quando a navegação pede (URL ou estado); data e profissionais são a partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    let professionalId = profId || '';
    if (!profId) {
      const available = professionals.filter((p) => {
        if (!p.is_active) return false;
        if (finalIsFitting) return true;
        return isProfessionalWorkingAt(p, dateToCheck, targetTime, 0, tenant.businessHours);
      });

      if (available.length > 0) {
        if (finalIsFitting) {
          // Algoritmo de balanceamento de rodízio de balcão apenas entre profissionais disponíveis
          const suggested = esperaRepository.suggestRotationFromAppointments(available, appointments);
          professionalId = suggested?.id || available[0].id;
        } else {
          professionalId = available[0].id;
        }
      } else if (professionals.length > 0) {
        professionalId = professionals[0].id;
      }
    }

    setNovoInicial({
      date: dateToCheck,
      time: targetTime,
      professionalId,
      isFitting: finalIsFitting,
      customerMode: 'existing',
      customerId: customers.length > 0 ? customers[0].id : '',
    });
    setIsModalOpen(true);
  };

  // Encaixe Rápido a partir da Lista de Espera
  const handleEncaixarFromWaitingList = (entry: WaitingListEntry) => {
    setIsEsperaDrawerOpen(false);

    let targetProfId = entry.professional_id;
    if (!targetProfId && professionals.length > 0) {
      const suggested = esperaRepository.suggestRotationFromAppointments(professionals, appointments);
      targetProfId = suggested?.id || professionals[0].id;
    }

    const nowInstant = new Date();
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), tenant.timezone);
    setNovoInicial({
      date: selectedDate,
      time: timeSlots.find((s) => s >= currentLocalTime) || timeSlots[0] || '09:00',
      professionalId: targetProfId || professionals[0]?.id || '',
      serviceId: entry.service_id || (services[0]?.id ?? ''),
      isFitting: true,
      customerMode: 'new',
      newCustomerName: entry.customer_name,
      newCustomerPhone: entry.customer_phone || '',
      notes: esperaRepository.notaDeEncaixe(entry),
      // A entrada só sai da fila quando o Agendamento for salvo (na mesma transação do banco).
      waitingEntryId: entry.id,
    });
    setIsModalOpen(true);
  };

  // Transição de Status: Iniciar Atendimento
  const handleStartService = async (app: Appointment) => {
    if (!tenant.tenantId) return;
    try {
      await agendaRepo.iniciarAtendimento(tenant.tenantId, app.id);

      // A Comanda do agendamento já existe: nasce no banco, junto com o agendamento.

      addToast(`Atendimento de ${app.customer?.name || 'Cliente Balcão'} iniciado.`, 'success');
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao iniciar atendimento:', err);
      addToast(
        err instanceof AgendaOperationError ? err.message : 'Erro ao atualizar status do atendimento.',
        err instanceof AgendaOperationError && err.kind === 'regra' ? 'warning' : 'error'
      );
      if (err instanceof AgendaOperationError && err.kind === 'regra') fetchAppointments();
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

  const handleMarkNoShow = (app: Appointment) => {
    const recusa = motivoRecusaNaoCompareceu(app);
    if (recusa) {
      addToast(recusa, 'warning');
      return;
    }

    setNoShowAppointment(app);
    setIsNoShowModalOpen(true);
  };

  const handleNaoCompareceuResultado = (appointmentId: string, resultado: ResultadoNaoCompareceu) => {
    if (resultado === 'marcado') {
      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment.id === appointmentId ? { ...appointment, status: 'no_show' } : appointment
        )
      );
      setIsCheckoutModalOpen(false);
      setCheckoutAppointment(null);
    }
    fetchAppointments();
  };

  // Falta marcada direto pela Comanda (checkout), sem a confirmação da agenda.
  const handleNoShowFromCheckout = async (app: Appointment) => {
    const resultado = await marcarNaoCompareceu(app);
    if (resultado === 'erro') return;
    handleNaoCompareceuResultado(app.id, resultado);
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
    setIsCancelModalOpen(true);
  };

  // Abrir Modal de Reagendamento Direto na Agenda
  const handleOpenRescheduleModal = (app: Appointment) => {
    setAgendaRescheduleAppointment(app);
    setIsAgendaRescheduleModalOpen(true);
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
    isWeekView = false,
  ): Map<string, CardLayout> => {
    const layoutMap = new Map<string, CardLayout>();

    if (isWeekView) {
      const sorted = [...appointmentsList].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
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
            left: isSecondSlot ? '239px' : '3px',
            width: '231px',
          });
        } else {
          layoutMap.set(app.id, {
            topPx: pos.topPx,
            heightPx: pos.heightPx,
            left: '5px',
            width: '463px',
          });
        }
      }

      return layoutMap;
    }

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
    <div className="flex flex-col w-full h-full max-h-full min-h-0 flex-1 overflow-hidden font-base">
      {/* ─── VISÃO MOBILE (<= 768px) ─── */}
      <div className="hidden max-md:block max-md:w-full max-md:max-w-full max-md:box-border">
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
      <div className="flex flex-col gap-3 w-full h-full max-h-full min-h-0 flex-1 max-md:hidden">
        {/* 1. HEADER DE CONTROLE OPERACIONAL */}
        <header className="relative z-50 flex items-center justify-between flex-wrap gap-4 py-4 px-6 shrink-0 bg-white/65 backdrop-blur-2xl backdrop-saturate-125 border border-border/70 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight">{formattedDateTitle}</h2>
              <p className="hidden text-xs text-text-secondary">
                {viewMode === 'week'
                  ? visibleProfessionals.length === 1
                    ? `Visão semanal do profissional ${visibleProfessionals[0].name}`
                    : `Visão semanal de ${visibleProfessionals.length} profissional(is)`
                  : `${visibleProfessionals.length} profissional(is) em atendimento`}
              </p>
            </div>
          </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Seletor de Escopo Temporal: Dia vs Semana */}
          <div className="flex items-center p-[3px] bg-white border border-border rounded-md gap-0.5">
            <button
              type="button"
              onClick={() => handleViewModeChange('day')}
              className={`px-[0.85rem] py-[0.4rem] text-xs font-bold border-none rounded-sm cursor-pointer transition-all duration-200 hover:text-text-primary ${viewMode === 'day' ? 'bg-brand-primary text-black hover:text-black' : 'bg-transparent text-text-secondary'}`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('week')}
              className={`px-[0.85rem] py-[0.4rem] text-xs font-bold border-none rounded-sm bg-transparent text-text-secondary cursor-pointer transition-all duration-200 hover:text-text-primary ${viewMode === 'week' ? 'bg-brand-soft text-black shadow-sm hover:text-black' : ''}`}
            >
              Semana
            </button>
          </div>

          {/* Navegação de Datas */}
          <div className="flex items-center bg-white/80 border border-border rounded-md relative">
            <Tooltip content={viewMode === 'week' ? 'Semana Anterior' : 'Dia Anterior'}>
              <button
                type="button"
                className="flex items-center justify-center py-[0.55rem] px-3 bg-transparent border-none text-text-primary cursor-pointer transition-colors duration-200 hover:bg-brand-primary/[0.08] hover:text-brand-primary"
                onClick={handlePrevDay}
                aria-label={viewMode === 'week' ? 'Semana Anterior' : 'Dia Anterior'}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
              </button>
            </Tooltip>
            <button
              type="button"
              className={`flex items-center justify-center py-[0.55rem] px-[0.9rem] bg-transparent border-l border-r border-border text-text-primary text-xs font-bold cursor-pointer transition-colors duration-200 hover:bg-brand-primary/[0.08] hover:text-brand-primary ${isToday ? 'text-black font-bold bg-brand-soft hover:bg-brand-soft hover:text-black' : ''}`}
              onClick={handleToday}
            >
              Hoje
            </button>
            <Tooltip content={viewMode === 'week' ? 'Próxima Semana' : 'Próximo Dia'}>
              <button
                type="button"
                className="flex items-center justify-center py-[0.55rem] px-3 bg-transparent border-none text-text-primary cursor-pointer transition-colors duration-200 hover:bg-brand-primary/[0.08] hover:text-brand-primary"
                onClick={handleNextDay}
                aria-label={viewMode === 'week' ? 'Próxima Semana' : 'Próximo Dia'}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </button>
            </Tooltip>

            <div className="relative flex items-center z-[120]" ref={datePickerRef}>
              <Tooltip content="Escolher data no calendário">
              <label
                className="flex items-center gap-1.5 py-[0.35rem] px-[0.6rem] border-l border-border rounded-tr-md rounded-br-md cursor-pointer relative text-text-secondary transition-colors duration-150 hover:text-text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDatePickerOpen((prev) => !prev);
                }}
                aria-label="Escolher data no calendário"
                aria-expanded={isDatePickerOpen}
              >
                <HugeiconsIcon icon={Calendar03Icon} size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="absolute opacity-0 pointer-events-none w-0 h-0 m-0 p-0 border-none"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </label>
              </Tooltip>

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
          <Tooltip content="Ver fila de clientes aguardando no balcão">
            <button
              type="button"
              className="w-32 min-w-32 h-9 inline-flex items-center justify-center gap-1.5 px-2 bg-bg-secondary border border-border rounded-md text-xs font-bold text-text-primary cursor-pointer transition-all duration-200 box-border whitespace-nowrap hover:border-brand-primary"
              onClick={() => setIsEsperaDrawerOpen(true)}
            >
              <HugeiconsIcon icon={UserGroupIcon} size={16} />
              <span>Espera</span>
            </button>
          </Tooltip>

          {/* Botão Bloquear Horário */}
          <Tooltip content="Pausar horário para almoço, descanso ou saída">
            <button
              type="button"
              className="w-32 min-w-32 h-9 inline-flex items-center justify-center gap-1.5 px-2 bg-white border border-error rounded-md text-xs font-bold text-error cursor-pointer transition-all duration-200 box-border whitespace-nowrap hover:bg-error-bg hover:border-error"
              onClick={() => setIsBloqueioModalOpen(true)}
            >
              <HugeiconsIcon icon={UnavailableIcon} size={16} />
              <span>Bloquear</span>
            </button>
          </Tooltip>

          {/* Botão Mestre Encaixe */}
          <Tooltip content="Atender cliente que chegou agora sem agendamento">
          <Button
            variant="primary"
            size="sm"
            className="w-32 min-w-32"
            onClick={() => handleOpenNewAppointment(undefined, undefined, true)}
            leftIcon={<HugeiconsIcon icon={AddCircleIcon} size={18} />}
          >
            Encaixe
          </Button>
          </Tooltip>
        </div>
      </header>

      {/* 2. GRADE TEMPORAL CONTÍNUA */}
      <div className="w-full flex-1 min-h-0 max-h-none overflow-auto overscroll-contain bg-bg-secondary border border-border/70 rounded-lg p-0 shadow-sm relative top-0 left-0 [scrollbar-width:thin] [scrollbar-color:rgba(45,35,30,0.25)_transparent] hover:[scrollbar-color:rgba(45,35,30,0.45)_transparent] [&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[rgba(45,35,30,0.15)] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(45,35,30,0.35)]">
        {isViewTransitioning || loading ? (
          <AgendaGridSkeleton
            viewMode={viewMode}
            professionals={visibleProfessionals}
            weekDays={weekDays}
            timeSlots={timeSlots}
            slotHeightPx={slotHeightPx}
          />
        ) : visibleProfessionals.length === 0 ? (
          <div className="p-16 px-8 flex flex-col items-center justify-center gap-4 text-center">
            <HugeiconsIcon icon={AlertCircleIcon} size={48} className="text-brand-soft" />
            <h3>Nenhum profissional selecionado</h3>
            <p>Ative ao menos um profissional no filtro acima para visualizar a grade.</p>
            <button
              type="button"
              className="bg-brand-primary text-white border-none py-2 px-4 rounded-md text-xs font-bold cursor-pointer"
              onClick={() => setSelectedProfessionalIds(professionals.map((p) => p.id))}
            >
              Exibir Todos
            </button>
          </div>
        ) : viewMode === 'day' && timeSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-16 px-8 text-center">
            <div className="inline-flex p-4 rounded-full bg-error-bg text-error mb-4">
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 className="text-xl font-bold m-0 mb-2 text-text-primary">Barbearia fechada neste dia</h3>
            <p className="text-text-secondary max-w-[440px] mx-auto mb-6 text-sm">
              Conforme os horários de funcionamento configurados, o estabelecimento não abre neste dia.
            </p>
            <button
              type="button"
              className="bg-brand-primary text-white border-none py-2 px-4 rounded-md text-xs font-bold cursor-pointer"
              onClick={handleToday}
            >
              Ir para hoje
            </button>
          </div>
        ) : (
          <div className="flex min-w-full w-max relative">
            {/* Coluna Fixa da Régua de Horários */}
            <div className="w-[65px] min-w-[65px] shrink-0 border-r border-border flex flex-col sticky left-0 z-[35] bg-bg-secondary shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
              <div className="h-[60px] min-h-[60px] border-b border-border flex items-center justify-center text-text-secondary sticky top-0 left-0 z-50 bg-bg-secondary rounded-tl-[calc(var(--radius-lg)-1px)] box-border">
                <HugeiconsIcon icon={Clock01Icon} size={16} />
              </div>
              <div className="flex flex-col bg-[inherit] relative">
                {/* Indicador da Linha Vermelha de Tempo Real na Régua de Horários */}
                {(viewMode === 'day' ? isToday : isTodayInWeek) && redLineTopPx !== null && (
                  <div
                    className="absolute left-[3px] right-[3px] -translate-y-1/2 bg-error text-white text-[0.65rem] font-extrabold py-0.5 px-[3px] rounded-sm flex items-center justify-center z-[45] pointer-events-none shadow-[0_1px_4px_rgba(239,68,68,0.4)] whitespace-nowrap tracking-tight"
                    style={{ top: `${redLineTopPx}px` }}
                    title={`Hora atual: ${currentTimeFormatted}`}
                  >
                    <span>{currentTimeFormatted}</span>
                  </div>
                )}
                {timeSlots.map((slot) => (
                  <div
                    key={slot}
                    className="box-border flex items-center justify-center text-xs font-bold text-text-secondary border-b border-dashed border-border/40 bg-[inherit]"
                    style={{ height: `${slotHeightPx}px` }}
                  >
                    <span>{slot}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colunas: Visão Dia (por Barbeiro) vs Visão Semana (7 dias para o Barbeiro) */}
            <div className="flex flex-1 min-w-0">
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
                        className="flex-1 w-full min-w-[clamp(240px,22vw,640px)] border-r border-border/70 flex flex-col last:border-r-0 [&:last-child>.prof-col-header]:rounded-tr-[calc(var(--radius-lg)-1px)]"
                        data-testid={`prof-col-${prof.id}`}
                      >
                        {/* Cabeçalho do Barbeiro */}
                        <div className="prof-col-header h-[60px] min-h-[60px] border-b border-border py-2 px-3 flex items-center gap-2.5 sticky top-0 z-30 bg-bg-secondary box-border shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                          <div className="w-9 h-9 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center font-extrabold text-xs border-[1.5px] border-white/80">
                            {prof.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <Tooltip content={prof.name} className="min-w-0 w-full">
                              <h4 className="text-sm font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">{prof.name}</h4>
                            </Tooltip>
                            <span className="text-[0.7rem] text-text-secondary">
                              {profAppointments.length} atendimento(s)
                            </span>
                          </div>
                        </div>

                        {/* Corpo da Grade com Slots Clicáveis */}
                        <div className="relative flex flex-col">
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

                            const slotBaseClass = 'w-full flex-none box-border border-b border-dashed border-border/50 relative py-1';
                            let slotClass: string;
                            if (isProfBreak) {
                              slotClass = `${slotBaseClass} cursor-not-allowed flex items-center justify-center bg-[repeating-linear-gradient(45deg,rgba(217,108,0,0.03),rgba(217,108,0,0.03)_6px,rgba(217,108,0,0.07)_6px,rgba(217,108,0,0.07)_12px)] hover:bg-[repeating-linear-gradient(45deg,rgba(217,108,0,0.05),rgba(217,108,0,0.05)_6px,rgba(217,108,0,0.09)_6px,rgba(217,108,0,0.09)_12px)]`;
                            } else if (hasOccupancy) {
                              slotClass = `${slotBaseClass} cursor-default`;
                            } else if (isPast) {
                              slotClass = `${slotBaseClass} group cursor-pointer bg-black/[0.03] transition-colors duration-75 hover:bg-brand-primary/[0.08]`;
                            } else if (isOutsideHours || !isProfWorking) {
                              slotClass = `${slotBaseClass} cursor-not-allowed opacity-60 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_6px,rgba(0,0,0,0.05)_6px,rgba(0,0,0,0.05)_12px)]`;
                            } else {
                              slotClass = `${slotBaseClass} group cursor-pointer transition-colors duration-75 hover:bg-brand-primary/[0.06]`;
                            }

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
                                  <span className="text-[0.6875rem] font-bold text-brand-primary bg-white/90 py-0.5 px-2 rounded border border-brand-primary/25 pointer-events-none tracking-wide uppercase">
                                    {getProfessionalDaySchedule(prof, selectedDate)?.break_end
                                      ? `Intervalo até ${getProfessionalDaySchedule(prof, selectedDate)?.break_end}`
                                      : 'Intervalo'}
                                  </span>
                                )}
                                {!isProfBreak && !hasOccupancy && isPast && (
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-brand-primary opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100">Encaixe</span>
                                )}
                                {!isProfBreak && !hasOccupancy && !isPast && !isOutsideHours && isProfWorking && (
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-brand-primary opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100">+ {slot}</span>
                                )}
                              </div>
                            );
                          })}

                          {/* Linha Vermelha de Tempo Real */}
                          {isToday && redLineTopPx !== null && (
                            <div
                              className="absolute left-0 right-0 h-0.5 bg-error z-20 pointer-events-none before:content-[''] before:absolute before:-left-1 before:-top-[3px] before:w-2 before:h-2 before:rounded-full before:bg-error"
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
                                className="absolute left-1 right-1 rounded-md py-[0.45rem] px-[0.6rem] z-[5] flex flex-col justify-center overflow-hidden bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05),rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_20px)] bg-black/[0.15] border border-dashed border-text-secondary text-text-primary cursor-pointer transition-colors duration-75 hover:bg-error/10 hover:border-error"
                                data-testid="blocked-card"
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

                          {/* Cards de Agendamento Flutuantes (lanes percentuais genéricas) */}
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
                            return (
                              <div
                                key={app.id}
                                className={getAppointmentCardClasses(cardState, app.is_fitting)}
                                data-testid="appointment-card"
                                onClick={() => handleOpenCheckout(app)}
                                title={`Clique para abrir comanda/detalhes de ${app.customer?.name || 'Cliente'}`}
                                style={{
                                  top: `${layout.topPx}px`,
                                  height: `${layout.heightPx}px`,
                                  left: layout.left,
                                  width: layout.width,
                                }}
                              >
                                <div className="flex items-center justify-between gap-1" data-testid="card-top-row">
                                  <span className="text-[0.72rem] font-extrabold text-text-primary whitespace-nowrap shrink-0">
                                    {timeStart} - {timeEnd}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {app.is_fitting && (
                                      <span className="text-[0.6rem] font-bold py-0.5 px-1.5 rounded-sm uppercase whitespace-nowrap leading-tight bg-brand-deep text-white" title="Encaixe">
                                        Encaixe
                                      </span>
                                    )}
                                    {app.status === 'no_show' && (
                                      <span className="text-[0.6rem] font-bold py-0.5 px-1.5 rounded-sm uppercase whitespace-nowrap leading-tight bg-[#b91c1c] text-white" title="Não compareceu">
                                        Não compareceu
                                      </span>
                                    )}
                                    {app.status === 'in_progress' && (
                                      <span className="text-[0.6rem] font-bold py-0.5 px-1.5 rounded-sm uppercase whitespace-nowrap leading-tight bg-info text-white" title="Em Atendimento">
                                        Atendendo
                                      </span>
                                    )}
                                    {app.payment_status === 'paid' && (
                                      <span className="text-[0.6rem] font-bold py-0.5 px-1.5 rounded-sm uppercase whitespace-nowrap leading-tight bg-success text-white" title="Pago">
                                        Pago
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-start justify-between gap-1.5 m-0 w-full" data-testid="card-client-row">
                                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <span className="text-[0.85rem] font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis leading-tight" title={app.customer?.name}>
                                      {app.customer?.name || 'Cliente'}
                                    </span>
                                    <span className="text-[0.72rem] text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis leading-tight font-medium" title={app.service?.name}>
                                      {app.service?.name} (R$ {Number(app.service?.price || 0).toFixed(2)})
                                    </span>
                                  </div>

                                </div>

                                {app.payment_status === 'paid' && (
                                  <div className="flex items-center gap-1 mt-auto pt-[0.2rem] border-t border-black/5">
                                    <span className="text-success flex items-center">
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
                    const layoutMap = calculateAppointmentsLayout(dayAppointments, true);

                    const dayBh = getDayBusinessHours(day.dateStr, tenant.businessHours);
                    const isDayClosed = !dayBh.active;

                    return (
                      <div
                        key={day.dateStr}
                        className="w-[473px] min-w-[473px] flex-1 border-r border-border/70 flex flex-col last:border-r-0 [&:last-child>.prof-col-header]:rounded-tr-[calc(var(--radius-lg)-1px)]"
                        data-testid={`week-col-${day.dateStr}`}
                      >
                        <div className="prof-col-header h-[60px] min-h-[60px] border-b border-border py-2 px-3 flex items-center gap-2.5 sticky top-0 z-30 bg-bg-secondary box-border shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                          <div className="flex flex-col min-w-0">
                            <Tooltip content={day.label} className="min-w-0 w-full">
                              <h4 className="flex items-center gap-1 text-sm font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                                <span>{day.shortWeekday} • {day.label}</span>
                                {isDayClosed && (
                                  <span className="text-[0.6rem] py-px px-[5px] rounded bg-error text-white font-extrabold">
                                    Fechado
                                  </span>
                                )}
                              </h4>
                            </Tooltip>
                            <span className="text-[0.7rem] text-text-secondary">
                              {isDayClosed ? 'Fechado' : `${dayAppointments.length} atendimento(s)`}
                            </span>
                          </div>
                        </div>

                        <div className="relative flex flex-col">
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

                            const slotBaseClass = 'w-full flex-none box-border border-b border-dashed border-border/50 relative py-1';
                            let slotClass: string;
                            if (allProfsBreak) {
                              slotClass = `${slotBaseClass} cursor-not-allowed flex items-center justify-center bg-[repeating-linear-gradient(45deg,rgba(217,108,0,0.03),rgba(217,108,0,0.03)_6px,rgba(217,108,0,0.07)_6px,rgba(217,108,0,0.07)_12px)] hover:bg-[repeating-linear-gradient(45deg,rgba(217,108,0,0.05),rgba(217,108,0,0.05)_6px,rgba(217,108,0,0.09)_6px,rgba(217,108,0,0.09)_12px)]`;
                            } else if (hasOccupancy) {
                              slotClass = `${slotBaseClass} cursor-default`;
                            } else if (isPast) {
                              slotClass = `${slotBaseClass} group cursor-pointer bg-black/[0.03] transition-colors duration-75 hover:bg-brand-primary/[0.08]`;
                            } else if (isOutsideHours || !anyProfWorking) {
                              slotClass = `${slotBaseClass} cursor-not-allowed opacity-60 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_6px,rgba(0,0,0,0.05)_6px,rgba(0,0,0,0.05)_12px)]`;
                            } else {
                              slotClass = `${slotBaseClass} group cursor-pointer transition-colors duration-75 hover:bg-brand-primary/[0.06]`;
                            }

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
                                  <span className="text-[0.6875rem] font-bold text-brand-primary bg-white/90 py-0.5 px-2 rounded border border-brand-primary/25 pointer-events-none tracking-wide uppercase">
                                    {weekProf && getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end
                                      ? `Intervalo até ${getProfessionalDaySchedule(weekProf, day.dateStr)?.break_end}`
                                      : 'Intervalo'}
                                  </span>
                                )}
                                {!allProfsBreak && !hasOccupancy && isPast && (
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-brand-primary opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100">Encaixe</span>
                                )}
                                {!allProfsBreak && !hasOccupancy && !isPast && !isOutsideHours && anyProfWorking && (
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-brand-primary opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100">+ {slot}</span>
                                )}
                              </div>
                            );
                          })}

                          {/* Linha Vermelha de Tempo Real na Visão Semanal */}
                          {day.dateStr === todayDateStr && redLineTopPx !== null && (
                            <div
                              className="absolute left-0 right-0 h-0.5 bg-error z-20 pointer-events-none before:content-[''] before:absolute before:-left-1 before:-top-[3px] before:w-2 before:h-2 before:rounded-full before:bg-error"
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
                                className="absolute left-1 right-1 rounded-md py-[0.45rem] px-[0.6rem] z-[5] flex flex-col justify-center overflow-hidden bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05),rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_20px)] bg-black/[0.15] border border-dashed border-text-secondary text-text-primary cursor-pointer transition-colors duration-75 hover:bg-error/10 hover:border-error"
                                data-testid="blocked-card"
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
                              left: '5px',
                              width: '463px',
                            };

                            const timeStart = formatTimeInZone(app.start_time, tenant.timezone);
                            const timeEnd = formatTimeInZone(app.end_time, tenant.timezone);

                            const cardState = getAppointmentCardState({
                              isFitting: app.is_fitting,
                              appointmentStatus: app.status,
                              paymentStatus: app.payment_status,
                            });

                            return (
                              <div
                                key={app.id}
                                className={`${getAppointmentCardClasses(cardState, app.is_fitting)} !py-[0.3rem] !px-[0.45rem] !gap-px !justify-start`}
                                data-testid="appointment-card"
                                onClick={() => handleOpenCheckout(app)}
                                title={`Clique para abrir comanda/detalhes de ${app.customer?.name || 'Cliente'}`}
                                style={{
                                  top: `${layout.topPx}px`,
                                  height: `${layout.heightPx}px`,
                                  left: layout.left,
                                  width: layout.width,
                                }}
                              >
                                <div className="flex items-center justify-between gap-[3px] mb-0.5 min-w-0 flex-wrap" data-testid="card-top-row">
                                  <span className="text-[0.66rem] font-extrabold whitespace-nowrap shrink-0 leading-none">
                                    {timeStart} - {timeEnd}
                                  </span>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {app.is_fitting && (
                                      <span className="text-[0.52rem] py-px px-[3px] whitespace-nowrap leading-none tracking-[0.2px] rounded-sm uppercase bg-brand-deep text-white" title="Encaixe">
                                        Encaixe
                                      </span>
                                    )}
                                    {app.status === 'no_show' && (
                                      <span className="text-[0.52rem] py-px px-[3px] whitespace-nowrap leading-none tracking-[0.2px] rounded-sm uppercase bg-[#b91c1c] text-white" title="Não compareceu">
                                        Não compareceu
                                      </span>
                                    )}
                                    {app.payment_status === 'paid' && (
                                      <span className="text-[0.52rem] py-px px-[3px] whitespace-nowrap leading-none tracking-[0.2px] rounded-sm uppercase bg-success text-white" title="Pago">
                                        Pago
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-start gap-px w-full min-w-0" data-testid="card-client-row">
                                  <span className="text-[0.78rem] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full block leading-tight text-text-primary" title={app.customer?.name}>
                                    {app.customer?.name || 'Cliente'}
                                  </span>
                                  <span className="text-[0.68rem] whitespace-nowrap overflow-hidden text-ellipsis w-full block leading-tight font-medium text-text-secondary" title={app.service?.name}>
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
      <NovoAgendamentoModal
        isOpen={isModalOpen}
        initial={novoInicial}
        tenantId={tenant.tenantId}
        timezone={tenant.timezone}
        businessHours={tenant.businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        professionals={professionals}
        services={services}
        customers={customers}
        appointments={appointments}
        onClose={() => {
          setIsModalOpen(false);
          clearActionUrl();
        }}
        onSaved={({ newCustomer }) => {
          if (newCustomer) setCustomers((prev) => [...prev, newCustomer]);
          fetchAppointments();
        }}
      />

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
          onClose={() => {
            setIsCheckoutModalOpen(false);
            setCheckoutAppointment(null);
          }}
          onRescheduled={(_newStartTime, _newProfId) => {
            addToast('Atendimento reagendado com sucesso!', 'success');
            fetchAppointments();
          }}
          onMarkNoShow={() => handleNoShowFromCheckout(checkoutAppointment)}
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
      <NaoCompareceuModal
        isOpen={isNoShowModalOpen}
        appointment={noShowAppointment}
        tenantId={tenant.tenantId}
        onClose={() => {
          setIsNoShowModalOpen(false);
          setNoShowAppointment(null);
        }}
        onResultado={handleNaoCompareceuResultado}
      />

      {/* 6. MODAL DE CANCELAMENTO */}
      <CancelarAgendamentoModal
        isOpen={isCancelModalOpen}
        appointment={targetAppointment}
        tenantId={tenant.tenantId}
        onClose={() => setIsCancelModalOpen(false)}
        onCancelado={(appointmentId) => {
          // Atualização otimista imediata para liberar o horário na tela sem refresh (a trigger no banco cancela a comanda atrelada)
          setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
          fetchAppointments();
        }}
      />

      {/* 7. MODAL DE REAGENDAMENTO DIRETO NA AGENDA */}
      <ReagendarAgendamentoModal
        isOpen={isAgendaRescheduleModalOpen}
        appointment={agendaRescheduleAppointment}
        tenantId={tenant.tenantId}
        timezone={tenant.timezone}
        businessHours={tenant.businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        professionals={professionals}
        appointments={appointments}
        blockedSlots={blockedSlots}
        fallbackDate={selectedDate}
        onClose={() => {
          setIsAgendaRescheduleModalOpen(false);
          setAgendaRescheduleAppointment(null);
        }}
        onAtualizar={fetchAppointments}
      />

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
    </div>
  );
};
