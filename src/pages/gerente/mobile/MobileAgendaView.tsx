import React, { useState, useMemo, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlusSignIcon,
  UnavailableIcon,
  Clock01Icon,
  AlertCircleIcon,
  CancelCircleIcon,
} from '@hugeicons/core-free-icons';
import {
  dateInZone,
  formatTimeInZone,
  shiftCalendarDate,
} from '../../../lib/timezone';
import { getDayBusinessHours } from '../Agenda';
import type { Appointment, Professional } from '../Agenda';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { Badge } from '../../../components/ui/data-display/Badge';
import {
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
} from '../../../lib/schedule';
import type { BlockedSlot } from '../../../modules/bloqueios/types';
import { getAppointmentCardState } from '../../../lib/appointment-card-state';

interface MobileAgendaViewProps {
  timezone: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  professionals: Professional[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
  /** A leitura de Bloqueios falhou: os Agendamentos continuam na lista, mas ela pode não estar completa. */
  blockedSlotsComErro?: boolean;
  timeSlots: string[];
  onOpenNewAppointment: (professionalId?: string, timeSlot?: string, isFitting?: boolean) => void;
  onOpenCheckout: (app: Appointment) => void;
  onMarkNoShow?: (app: Appointment) => void | Promise<void>;
  onOpenReschedule?: (app: Appointment) => void;
  onOpenCancel?: (app: Appointment) => void;
  onStartService?: (app: Appointment) => void | Promise<void>;
  onDirectWhatsApp?: (phone: string, name: string, time: string) => void;
  onRemoveBlock: (blk: BlockedSlot) => void | Promise<void>;
  onOpenBloqueio?: () => void;
  onOpenEspera?: () => void;
  /** O que o toque no card faz, no fim de "Toque para ...". O gestor abre a comanda; o barbeiro, as ações do Agendamento. */
  cardActionHint?: string;
  /** Cancelamentos do dia selecionado, já recortados pelo filtro de equipe; abre o Painel de Cancelados do Dia (spec 044, ticket 15). Omitido, a faixa não aparece — hoje só o gerente tem o painel no celular. */
  cancelamentosDoDia?: { quantidade: number; comErro: boolean; onAbrir: () => void };
}

interface TimelineItem {
  type: 'appointment' | 'block' | 'empty' | 'break';
  time: string;
  appointment?: Appointment;
  block?: BlockedSlot;
}

// Cores dos estados visuais do card de agendamento (ticket 12, spec 039).
// Os estados são mutuamente exclusivos na origem (status do agendamento), exceto
// por "isFitting", que é independente e pode combinar com qualquer um deles.
// Prioridade (replica a cascata do CSS legado): no-show > pago > encaixe > em andamento > padrão.
const AGENDA_CARD_COLORS = {
  default: { background: '#d1d5db', borderColor: 'rgba(0, 0, 0, 0.08)' },
  fitting: { background: '#ffedd5', borderColor: '#b45309' },
  active: { background: '#fed7aa', borderColor: '#f97316' },
  paid: { background: '#86efac', borderColor: '#4ade80' },
  noShow: { background: '#fee2e2', borderColor: '#fca5a5' },
} as const;

function getAgendaCardStyle(opts: {
  isNoShow: boolean;
  isPaid: boolean;
  isFitting: boolean;
  isProgress: boolean;
}): React.CSSProperties {
  const state = opts.isNoShow
    ? AGENDA_CARD_COLORS.noShow
    : opts.isPaid
      ? AGENDA_CARD_COLORS.paid
      : opts.isFitting
        ? AGENDA_CARD_COLORS.fitting
        : opts.isProgress
          ? AGENDA_CARD_COLORS.active
          : AGENDA_CARD_COLORS.default;

  return {
    backgroundColor: state.background,
    borderColor: state.borderColor,
    borderLeftWidth: opts.isFitting ? 4 : 1,
  };
}

export const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
  timezone,
  businessHours,
  selectedDate,
  onSelectDate,
  professionals,
  appointments,
  blockedSlots,
  blockedSlotsComErro = false,
  timeSlots,
  onOpenNewAppointment,
  onOpenCheckout,
  onMarkNoShow,
  onOpenReschedule: _onOpenReschedule,
  onOpenCancel: _onOpenCancel,
  onStartService: _onStartService,
  onDirectWhatsApp: _onDirectWhatsApp,
  onRemoveBlock,
  onOpenBloqueio: _onOpenBloqueio,
  onOpenEspera: _onOpenEspera,
  cardActionHint = 'abrir a comanda',
  cancelamentosDoDia,
}) => {
  // Filtrar profissionais ativos
  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.is_active),
    [professionals]
  );

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [selectedProfId, setSelectedProfId] = useState<string>(() => {
    return activeProfessionals[0]?.id || professionals[0]?.id || '';
  });

  useEffect(() => {
    if (!selectedProfId || !professionals.some((p) => p.id === selectedProfId)) {
      const defaultId = activeProfessionals[0]?.id || professionals[0]?.id || '';
      if (defaultId) {
        setSelectedProfId(defaultId);
      }
    }
  }, [professionals, activeProfessionals, selectedProfId]);

  const showEmptySlots = true;

  const [currentNow, setCurrentNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => dateInZone(currentNow, timezone), [currentNow, timezone]);
  const isToday = selectedDate === todayStr;

  const currentLocalDate = useMemo(() => dateInZone(currentNow, timezone), [currentNow, timezone]);
  const currentLocalTime = useMemo(
    () => formatTimeInZone(currentNow.toISOString(), timezone),
    [currentNow, timezone]
  );
  const dayBh = useMemo(
    () => getDayBusinessHours(selectedDate, businessHours),
    [selectedDate, businessHours]
  );

  const handlePrevDay = () => onSelectDate(shiftCalendarDate(selectedDate, -1));
  const handleNextDay = () => onSelectDate(shiftCalendarDate(selectedDate, 1));
  const handleSetToday = () => onSelectDate(todayStr);

  // Agendamentos e bloqueios filtrados pelo profissional selecionado
  const filteredAppointments = useMemo(() => {
    if (!selectedProfId) return [];
    return appointments
      .filter((a) => a.professional_id === selectedProfId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [appointments, selectedProfId]);

  const filteredBlocks = useMemo(() => {
    if (!selectedProfId) return [];
    return blockedSlots.filter((b) => b.professional_id === selectedProfId);
  }, [blockedSlots, selectedProfId]);

  // Mapa de nomes de profissionais
  const profNameMap = useMemo(() => {
    const map = new Map<string, string>();
    professionals.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [professionals]);

  // Formatação legível da data em Sentence case (ex: "Sáb., 22 de ago.")
  const formattedDateTitle = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const str = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
    return selectedDate;
  }, [selectedDate]);

  // Construir itens da linha do tempo cronológica com slots vagos intercalados
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Adicionar Agendamentos
    filteredAppointments.forEach((app) => {
      const time = formatTimeInZone(app.start_time, timezone);
      items.push({ type: 'appointment', time, appointment: app });
    });

    // Adicionar Bloqueios
    filteredBlocks.forEach((blk) => {
      const time = formatTimeInZone(blk.start_time, timezone);
      items.push({ type: 'block', time, block: blk });
    });

    // Adicionar Slots Vazios Interativos e Intervalos se solicitado e quando timeSlots estiver disponível e barbearia aberta
    if (showEmptySlots && dayBh.active && timeSlots && timeSlots.length > 0) {
      timeSlots.forEach((slot) => {
        if (slot < dayBh.open || slot >= dayBh.close) return;

        const isOccupiedByApp = filteredAppointments.some((a) => {
          const tStart = formatTimeInZone(a.start_time, timezone);
          const tEnd = formatTimeInZone(a.end_time, timezone);
          return slot >= tStart && slot < tEnd;
        });

        const isOccupiedByBlock = filteredBlocks.some((b) => {
          const tStart = formatTimeInZone(b.start_time, timezone);
          const tEnd = formatTimeInZone(b.end_time, timezone);
          return slot >= tStart && slot < tEnd;
        });

        if (!isOccupiedByApp && !isOccupiedByBlock) {
          // Os horários de intervalo NÃO devem aparecer na agenda do profissional:
          const prof = professionals.find((p) => p.id === selectedProfId);
          if (prof && isProfessionalOnBreak(prof, selectedDate, slot)) {
            return;
          }
          if (prof && !isProfessionalWorkingAt(prof, selectedDate, slot, 0, businessHours)) {
            return;
          }

          items.push({ type: 'empty', time: slot });
        }
      });
    }

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredAppointments, filteredBlocks, showEmptySlots, timeSlots, timezone, dayBh, businessHours, selectedProfId, professionals, selectedDate]);

  return (
    <div className="flex flex-col gap-3 w-full max-w-full box-border overflow-x-hidden pb-2">
      {/* ─── SELETOR DE DATA ─── */}
      <div className="flex items-center w-full max-w-full box-border max-[380px]:gap-[0.2rem]">
        <div className="flex items-center justify-between w-full bg-bg-secondary border border-border rounded-md py-[0.32rem] px-2 box-border max-[380px]:py-[0.2rem] max-[380px]:px-[0.25rem]">
          <button
            type="button"
            className="w-7 h-7 min-w-7 min-h-7 rounded-sm bg-transparent border border-border text-black flex items-center justify-center cursor-pointer transition-all duration-150 ease-linear touch-manipulation p-0 hover:border-brand-primary hover:text-brand-primary active:scale-92"
            onClick={handlePrevDay}
            aria-label="Dia anterior"
            title="Voltar para o dia anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>

          <div className="flex items-center gap-1.5 select-none">
            <div className="relative shrink-0">
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 p-0 rounded-sm bg-transparent border border-border text-black cursor-pointer transition-all duration-150 ease-linear shrink-0 hover:border-brand-primary hover:bg-brand-lightest active:scale-92"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                title="Escolher data no calendário"
                aria-label="Escolher data no calendário"
                aria-expanded={isDatePickerOpen}
              >
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  size={15}
                  className="pointer-events-none fill-none stroke-black"
                />
              </button>

              {isDatePickerOpen && (
                <CustomDatePicker
                  selectedDate={selectedDate}
                  timezone={timezone}
                  onSelectDate={(newDate) => {
                    onSelectDate(newDate);
                    setIsDatePickerOpen(false);
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                  position="left"
                  // Sobrescreve o posicionamento absoluto padrão do CustomDatePicker
                  // (componente compartilhado) para que o calendário apareça fixo e
                  // ocupando a largura útil da tela em vez de um dropdown ancorado
                  // ao botão, em viewport mobile. !important é necessário pois as
                  // utilities de posicionamento base do CustomDatePicker têm a
                  // mesma especificidade destas.
                  className="!fixed !left-4 !right-4 !top-24 !w-auto"
                />
              )}
            </div>
            <span className="text-[0.84375rem] font-bold text-text-primary whitespace-nowrap tracking-[-0.01em]">
              {formattedDateTitle}
            </span>
            {isToday ? (
              <span className="text-[0.5625rem] font-bold uppercase bg-[rgba(217,108,0,0.15)] text-brand-primary py-[1.5px] px-[5px] rounded-sm whitespace-nowrap leading-[1.2]">
                Hoje
              </span>
            ) : (
              <button
                type="button"
                className="text-[0.5625rem] font-bold uppercase bg-[rgba(217,108,0,0.15)] text-brand-primary py-[1.5px] px-[5px] rounded-sm whitespace-nowrap leading-[1.2] cursor-pointer border-none transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-brand-primary hover:text-brand-lightest"
                onClick={handleSetToday}
                title="Voltar para hoje"
              >
                Hoje
              </button>
            )}
          </div>

          <button
            type="button"
            className="w-7 h-7 min-w-7 min-h-7 rounded-sm bg-transparent border border-border text-black flex items-center justify-center cursor-pointer transition-all duration-150 ease-linear touch-manipulation p-0 hover:border-brand-primary hover:text-brand-primary active:scale-92"
            onClick={handleNextDay}
            aria-label="Próximo dia"
            title="Avançar para o próximo dia"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
          </button>
        </div>
      </div>

      {/* ─── CARROSSEL DE PROFISSIONAIS ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] max-w-full [&::-webkit-scrollbar]:hidden">
        {activeProfessionals.map((prof) => {
          const count = appointments.filter((a) => a.professional_id === prof.id).length;
          const isSelected = selectedProfId === prof.id;

          return (
            <button
              key={prof.id}
              type="button"
              className={`flex items-center gap-1.5 py-[0.45rem] px-3 rounded-full text-[0.8125rem] whitespace-nowrap cursor-pointer shrink-0 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-96 ${
                isSelected
                  ? 'bg-brand-primary text-brand-lightest border border-brand-primary font-bold'
                  : 'bg-bg-secondary text-text-secondary border border-border font-medium'
              }`}
              onClick={() => setSelectedProfId(prof.id)}
            >
              <span className="w-[18px] h-[18px] rounded-full bg-black/15 text-inherit text-[0.625rem] font-bold flex items-center justify-center">
                {prof.name.charAt(0).toUpperCase()}
              </span>
              <span>{prof.name.split(' ')[0]}</span>
              <span className="text-[0.6875rem] bg-black/15 py-px px-[5px] rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      {blockedSlotsComErro && (
        <div
          className="flex items-center gap-2 bg-warning-bg border border-warning text-warning rounded-xl px-3 py-2 text-[0.75rem] font-bold w-full box-border"
          role="status"
        >
          <HugeiconsIcon icon={AlertCircleIcon} size={16} className="shrink-0" />
          <span>Não foi possível carregar os Bloqueios de Horário. A lista pode não refletir horários bloqueados.</span>
        </div>
      )}

      {/* ─── FAIXA DE CANCELADOS DO DIA (spec 044, ticket 15) ─── */}
      {cancelamentosDoDia && (cancelamentosDoDia.comErro || cancelamentosDoDia.quantidade > 0) && (
        <button
          type="button"
          onClick={cancelamentosDoDia.onAbrir}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 min-h-11 text-[0.75rem] font-bold w-full box-border border cursor-pointer ${
            cancelamentosDoDia.comErro
              ? 'bg-warning-bg border-warning text-warning'
              : 'bg-info-bg border-info text-info'
          }`}
        >
          <HugeiconsIcon
            icon={cancelamentosDoDia.comErro ? AlertCircleIcon : CancelCircleIcon}
            size={16}
            className="shrink-0"
          />
          <span>
            {cancelamentosDoDia.comErro
              ? 'Não foi possível carregar os cancelamentos do dia.'
              : `${cancelamentosDoDia.quantidade} ${cancelamentosDoDia.quantidade === 1 ? 'cancelamento' : 'cancelamentos'} no dia. Toque para ver.`}
          </span>
        </button>
      )}

      {/* ─── LINHA DO TEMPO CRONOLÓGICA ─── */}
      <div className="flex flex-col gap-3 w-full box-border">
        {timelineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-bg-secondary border border-border rounded-xl w-full box-border">
            <div className="text-text-secondary mb-3">
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 className="text-base font-bold text-text-primary m-0 mb-1">
              {!dayBh.active ? 'Barbearia fechada neste dia' : 'Nenhum agendamento para este dia'}
            </h3>
            <p className="text-[0.8125rem] text-text-secondary m-0 mb-5">
              {!dayBh.active
                ? `Conforme o horário de funcionamento configurado, o estabelecimento não abre às ${dayBh.dayLabel}s.`
                : `Nenhum atendimento para ${profNameMap.get(selectedProfId) || 'o profissional'} hoje.`}
            </p>
            <button
              type="button"
              className="flex items-center gap-2 bg-brand-primary text-brand-lightest text-[0.8125rem] font-semibold py-2.5 px-4 rounded-md border-none cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-brand-hover"
              onClick={() =>
                onOpenNewAppointment(
                  selectedProfId || undefined,
                  undefined,
                  true
                )
              }
              title="Criar encaixe imediato para cliente no balcão"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              Criar encaixe de balcão
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 w-full box-border">
            {timelineItems.map((item) => {
              if (item.type === 'empty') {
                const isPast =
                  selectedDate < currentLocalDate ||
                  (selectedDate === currentLocalDate && item.time < currentLocalTime);

                if (isPast) {
                  return (
                    <div
                      key={`empty-past-${item.time}`}
                      className="flex items-center gap-3 py-2.5 px-3.5 rounded-md min-h-11 w-full box-border transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_6px,rgba(0,0,0,0.05)_6px,rgba(0,0,0,0.05)_12px)] border border-dashed border-border opacity-85 cursor-pointer hover:border-brand-primary hover:bg-[rgba(217,108,0,0.06)] hover:opacity-100 active:border-brand-primary active:bg-[rgba(217,108,0,0.06)] active:opacity-100"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onOpenNewAppointment(
                          selectedProfId || undefined,
                          item.time,
                          true
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenNewAppointment(
                            selectedProfId || undefined,
                            item.time,
                            true
                          );
                        }
                      }}
                      title={`Horário já passou (${item.time}) - Toque para registrar encaixe`}
                      aria-label={`Horário decorrido às ${item.time}. Toque para registrar encaixe.`}
                    >
                      <span className="text-xs font-bold text-text-secondary min-w-[42px]">{item.time}</span>
                      <span className="flex items-center gap-[0.35rem] text-xs font-medium text-text-secondary">
                        <HugeiconsIcon icon={Clock01Icon} size={14} />
                        Toque para encaixe
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-avail-${item.time}`}
                    className="flex items-center gap-3 py-2.5 px-3.5 rounded-md min-h-11 w-full box-border transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] bg-white/[0.02] border border-dashed border-border cursor-pointer hover:border-brand-primary hover:bg-[rgba(217,108,0,0.08)] hover:scale-[0.99] active:border-brand-primary active:bg-[rgba(217,108,0,0.08)] active:scale-[0.99]"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onOpenNewAppointment(
                        selectedProfId || undefined,
                        item.time,
                        false
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenNewAppointment(
                          selectedProfId || undefined,
                          item.time,
                          false
                        );
                      }
                    }}
                    title={`Toque para agendar às ${item.time}`}
                    aria-label={`Horário vago às ${item.time}. Toque para agendar.`}
                  >
                    <span className="text-xs font-bold text-text-secondary min-w-[42px]">{item.time}</span>
                    <span className="flex items-center gap-[0.35rem] text-xs font-medium text-text-secondary">
                      <HugeiconsIcon icon={PlusSignIcon} size={14} />
                      Toque para agendar
                    </span>
                  </div>
                );
              }

              if (item.type === 'block' && item.block) {
                const blk = item.block;
                const tStart = formatTimeInZone(blk.start_time, timezone);
                const tEnd = formatTimeInZone(blk.end_time, timezone);
                const profName = profNameMap.get(blk.professional_id) || 'Profissional';

                return (
                  <div
                    key={blk.id}
                    className="flex items-center justify-between py-3 px-4 bg-[rgba(240,82,82,0.08)] border border-dashed border-[rgba(240,82,82,0.3)] rounded-md text-error cursor-pointer w-full box-border"
                    role="button"
                    tabIndex={0}
                    onClick={() => onRemoveBlock(blk)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRemoveBlock(blk);
                      }
                    }}
                    title="Toque para remover este bloqueio"
                    aria-label={`Bloqueio ${blk.reason} das ${tStart} às ${tEnd}. Toque para remover.`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                      <HugeiconsIcon icon={UnavailableIcon} size={16} />
                      <div>
                        <span className="text-[0.8125rem] font-semibold block whitespace-nowrap overflow-hidden text-ellipsis">
                          Bloqueio: {blk.reason}
                        </span>
                        <span className="text-[0.6875rem] opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">
                          {tStart} às {tEnd} • {profName}
                        </span>
                      </div>
                    </div>
                    <span className="text-[0.6875rem] font-semibold underline shrink-0">Remover</span>
                  </div>
                );
              }

              if (item.type === 'appointment' && item.appointment) {
                const app = item.appointment;
                const timeStart = formatTimeInZone(app.start_time, timezone);
                const cardState = getAppointmentCardState({
                  isFitting: app.is_fitting,
                  appointmentStatus: app.status,
                  paymentStatus: app.payment_status,
                });
                const isCompletedAndPaid = cardState === 'completed';
                const isProgress = app.status === 'in_progress';
                const isFitting = app.is_fitting;
                const isNoShow = app.status === 'no_show';
                const canMarkNoShow =
                  (app.status === 'pending' || app.status === 'confirmed') &&
                  new Date(app.start_time).getTime() <= currentNow.getTime();

                return (
                  <div
                    key={app.id}
                    className={`rounded-xl py-[0.65rem] px-3.5 cursor-pointer transition-transform duration-150 ease-linear select-none shadow-[0_1px_3px_rgba(0,0,0,0.05)] w-full max-w-full box-border min-w-0 overflow-hidden border border-solid active:scale-[0.985] ${isNoShow ? 'mobile-agenda__card--no-show' : isCompletedAndPaid ? 'mobile-agenda__card--paid' : isProgress ? 'mobile-agenda__card--active' : ''} ${isFitting ? 'mobile-agenda__card--fitting' : 'mobile-agenda__card--normal'}`}
                    style={getAgendaCardStyle({
                      isNoShow,
                      isPaid: isCompletedAndPaid,
                      isFitting,
                      isProgress,
                    })}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCheckout(app)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCheckout(app);
                      }
                    }}
                    title={`Toque para ${cardActionHint}`}
                    aria-label={`Agendamento de ${app.customer?.name || 'Cliente'} para ${app.service?.name || 'Serviço'} às ${timeStart}. Toque para ${cardActionHint}.`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center min-w-11 shrink-0">
                        <span className="text-[0.9375rem] font-extrabold text-[#111827] tracking-[-0.02em]">{timeStart}</span>
                      </div>

                      <div className="flex flex-col justify-center gap-[0.1rem] flex-1 min-w-0 overflow-hidden">
                        <span className="text-[0.8125rem] font-semibold text-[#111827] whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                          {app.customer?.name || 'Cliente Balcão'}
                        </span>
                        {app.customer?.phone && (
                          <span className="text-[0.6875rem] text-[#374151] whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                            {app.customer.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end justify-center gap-[0.15rem] text-right [flex:0_1_auto] max-w-[45%] min-w-0 overflow-hidden">
                        <span className="text-[0.6875rem] font-bold text-[#1f2937] uppercase leading-[1.2] whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                          {(app.service?.name || 'Serviço').toUpperCase()} - R$ {Number(app.service?.price || 0).toFixed(2)}
                        </span>
                        {isFitting && (
                          <Badge variant="brand" badgeType="solid" size="xs" title="Encaixe">Encaixe</Badge>
                        )}
                        {app.from_waiting_list && (
                          <Badge variant="brand" badgeType="subtle" size="xs" title="Veio da Lista de Espera">Espera</Badge>
                        )}
                        {isCompletedAndPaid && (
                          <Badge variant="success" badgeType="solid" size="xs" title="Pago">Pago</Badge>
                        )}
                        {isNoShow && (
                          <Badge variant="error" badgeType="solid" size="xs" title="Não compareceu">Não compareceu</Badge>
                        )}
                      </div>
                    </div>
                    {canMarkNoShow && onMarkNoShow && (
                      <button
                        type="button"
                        className="self-end mt-[0.45rem] border border-[#fca5a5] rounded-md py-[0.3rem] px-[0.55rem] bg-white/80 text-[#b91c1c] text-[0.7rem] font-bold cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onMarkNoShow(app);
                        }}
                        aria-label={`Marcar ${app.customer?.name || 'cliente'} como não compareceu`}
                      >
                        Marcar não compareceu
                      </button>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
