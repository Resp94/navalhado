import React, { useState, useMemo, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlusSignIcon,
  UnavailableIcon,
  Clock01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import {
  dateInZone,
  formatTimeInZone,
  shiftCalendarDate,
} from '../../../lib/timezone';
import { getDayBusinessHours } from '../Agenda';
import type { Appointment, Professional } from '../Agenda';
import {
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
} from '../../../lib/schedule';
import type { BlockedSlot } from '../../../modules/bloqueios/types';

interface MobileAgendaViewProps {
  timezone: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  professionals: Professional[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
  timeSlots: string[];
  onOpenNewAppointment: (professionalId?: string, timeSlot?: string, isFitting?: boolean) => void;
  onOpenCheckout: (app: Appointment) => void;
  onOpenCancel?: (app: Appointment) => void;
  onStartService?: (app: Appointment) => void | Promise<void>;
  onDirectWhatsApp?: (phone: string, name: string, time: string) => void;
  onRemoveBlock: (blk: BlockedSlot) => void | Promise<void>;
  onOpenBloqueio?: () => void;
  onOpenEspera?: () => void;
}

interface TimelineItem {
  type: 'appointment' | 'block' | 'empty' | 'break';
  time: string;
  appointment?: Appointment;
  block?: BlockedSlot;
}

export const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
  timezone,
  businessHours,
  selectedDate,
  onSelectDate,
  professionals,
  appointments,
  blockedSlots,
  timeSlots,
  onOpenNewAppointment,
  onOpenCheckout,
  onOpenCancel: _onOpenCancel,
  onStartService: _onStartService,
  onDirectWhatsApp: _onDirectWhatsApp,
  onRemoveBlock,
  onOpenBloqueio,
  onOpenEspera,
}) => {
  // Filtrar profissionais ativos
  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.is_active),
    [professionals]
  );

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

  // Formatação legível da data em Sentence case
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
          if (prof && !isProfessionalWorkingAt(prof, selectedDate, slot)) {
            return;
          }

          items.push({ type: 'empty', time: slot });
        }
      });
    }

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredAppointments, filteredBlocks, showEmptySlots, timeSlots, timezone, dayBh, selectedProfId, professionals, selectedDate]);

  return (
    <div className="mobile-agenda">
      {/* ─── SELETOR DE DATA E AÇÕES RÁPIDAS (AO LADO DA DATA) ─── */}
      <div className="mobile-agenda__header-row">
        <div className="mobile-agenda__date-bar">
          <button
            type="button"
            className="mobile-agenda__nav-btn"
            onClick={handlePrevDay}
            aria-label="Dia anterior"
            title="Voltar para o dia anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>

          <div className="mobile-agenda__date-display">
            <span className="mobile-agenda__date-title">{formattedDateTitle}</span>
            {isToday ? (
              <span className="mobile-agenda__today-pill">Hoje</span>
            ) : (
              <button
                type="button"
                className="mobile-agenda__today-pill mobile-agenda__today-pill--btn"
                onClick={handleSetToday}
                title="Voltar para hoje"
              >
                Hoje
              </button>
            )}
          </div>

          <button
            type="button"
            className="mobile-agenda__nav-btn"
            onClick={handleNextDay}
            aria-label="Próximo dia"
            title="Avançar para o próximo dia"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
          </button>
        </div>

        {/* ─── BOTÕES AO LADO DA DATA: ENCAIXE, BLOQUEIO, ESPERA ─── */}
        <div className="mobile-agenda__quick-actions-bar">
          <button
            type="button"
            className="mobile-agenda__action-btn mobile-agenda__action-btn--encaixe"
            onClick={() =>
              onOpenNewAppointment(
                selectedProfId || undefined,
                undefined,
                true
              )
            }
            title="Atender cliente que chegou agora sem agendamento (Encaixe)"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} />
            <span>Encaixe</span>
          </button>

          {onOpenBloqueio && (
            <button
              type="button"
              className="mobile-agenda__action-btn mobile-agenda__action-btn--sub"
              onClick={onOpenBloqueio}
              title="Bloquear horário (almoço, saída)"
            >
              <HugeiconsIcon icon={UnavailableIcon} size={15} />
              <span>Bloquear</span>
            </button>
          )}

          {onOpenEspera && (
            <button
              type="button"
              className="mobile-agenda__action-btn mobile-agenda__action-btn--sub"
              onClick={onOpenEspera}
              title="Fila de espera de clientes no balcão"
            >
              <HugeiconsIcon icon={UserGroupIcon} size={15} />
              <span>Espera</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── CARROSSEL DE PROFISSIONAIS ─── */}
      <div className="mobile-agenda__prof-carousel">
        {activeProfessionals.map((prof) => {
          const count = appointments.filter((a) => a.professional_id === prof.id).length;
          const isSelected = selectedProfId === prof.id;

          return (
            <button
              key={prof.id}
              type="button"
              className={`mobile-agenda__prof-chip ${isSelected ? 'mobile-agenda__prof-chip--active' : ''}`}
              onClick={() => setSelectedProfId(prof.id)}
            >
              <span className="mobile-agenda__chip-avatar">
                {prof.name.charAt(0).toUpperCase()}
              </span>
              <span>{prof.name.split(' ')[0]}</span>
              <span className="mobile-agenda__chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ─── LINHA DO TEMPO CRONOLÓGICA ─── */}
      <div className="mobile-agenda__timeline">
        {timelineItems.length === 0 ? (
          <div className="mobile-agenda__empty-state">
            <div className="mobile-agenda__empty-icon">
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 className="mobile-agenda__empty-title">
              {!dayBh.active ? 'Barbearia fechada neste dia' : 'Nenhum agendamento para este dia'}
            </h3>
            <p className="mobile-agenda__empty-desc">
              {!dayBh.active
                ? `Conforme o horário de funcionamento configurado, o estabelecimento não abre às ${dayBh.dayLabel}s.`
                : `Nenhum atendimento para ${profNameMap.get(selectedProfId) || 'o profissional'} hoje.`}
            </p>
            <button
              type="button"
              className="mobile-agenda__empty-cta"
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
          <div className="mobile-agenda__cards-list">
            {filteredAppointments.length === 0 && (
              <div className={`mobile-agenda__empty-banner ${!dayBh.active ? 'mobile-agenda__empty-banner--closed' : ''}`}>
                <div className="mobile-agenda__empty-icon-sm" style={{ color: !dayBh.active ? '#EF4444' : undefined }}>
                  <HugeiconsIcon icon={Calendar03Icon} size={20} />
                </div>
                <div className="mobile-agenda__empty-banner-content">
                  <h3 className="mobile-agenda__empty-title" style={{ fontSize: '0.875rem', margin: 0 }}>
                    {!dayBh.active ? 'Barbearia fechada neste dia' : 'Nenhum agendamento para este dia'}
                  </h3>
                  <p className="mobile-agenda__empty-desc" style={{ fontSize: '0.75rem', margin: 0 }}>
                    {!dayBh.active
                      ? `Conforme o horário de funcionamento configurado, o estabelecimento não abre às ${dayBh.dayLabel}s.`
                      : `Agenda disponível para ${profNameMap.get(selectedProfId) || 'o profissional'}. Toque abaixo para agendar.`}
                  </p>
                </div>
              </div>
            )}

            {timelineItems.map((item) => {
              if (item.type === 'empty') {
                const isPast =
                  selectedDate < currentLocalDate ||
                  (selectedDate === currentLocalDate && item.time < currentLocalTime);

                if (isPast) {
                  return (
                    <div
                      key={`empty-past-${item.time}`}
                      className="mobile-agenda__empty-slot mobile-agenda__empty-slot--past"
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
                      <span className="mobile-agenda__empty-slot-time">{item.time}</span>
                      <span className="mobile-agenda__empty-slot-text">
                        <HugeiconsIcon icon={Clock01Icon} size={14} />
                        Toque para encaixe
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-avail-${item.time}`}
                    className="mobile-agenda__empty-slot mobile-agenda__empty-slot--available"
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
                    <span className="mobile-agenda__empty-slot-time">{item.time}</span>
                    <span className="mobile-agenda__empty-slot-text">
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
                    className="mobile-agenda__block-card"
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
                    <div className="mobile-agenda__block-info">
                      <HugeiconsIcon icon={UnavailableIcon} size={16} />
                      <div>
                        <span className="mobile-agenda__block-title">Bloqueio: {blk.reason}</span>
                        <span className="mobile-agenda__block-time">{tStart} às {tEnd} • {profName}</span>
                      </div>
                    </div>
                    <span className="mobile-agenda__block-remove">Remover</span>
                  </div>
                );
              }

              if (item.type === 'appointment' && item.appointment) {
                const app = item.appointment;
                const timeStart = formatTimeInZone(app.start_time, timezone);
                const isPaid = app.payment_status === 'paid' || app.status === 'completed';
                const isProgress = app.status === 'in_progress';
                const isFitting = app.is_fitting;

                return (
                  <div
                    key={app.id}
                    className={`mobile-agenda__card ${isPaid ? 'mobile-agenda__card--paid' : isProgress ? 'mobile-agenda__card--active' : isFitting ? 'mobile-agenda__card--fitting' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCheckout(app)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCheckout(app);
                      }
                    }}
                    title="Toque para abrir a comanda"
                    aria-label={`Agendamento de ${app.customer?.name || 'Cliente'} para ${app.service?.name || 'Serviço'} às ${timeStart}. Toque para abrir comanda.`}
                  >
                    <div className="mobile-agenda__card-compact">
                      <div className="mobile-agenda__card-col-time">
                        <span className="mobile-agenda__time-text">{timeStart}</span>
                      </div>

                      <div className="mobile-agenda__card-col-client">
                        <span className="mobile-agenda__client-name">
                          {app.customer?.name || 'Cliente Balcão'}
                        </span>
                        {app.customer?.phone && (
                          <span className="mobile-agenda__client-phone">
                            {app.customer.phone}
                          </span>
                        )}
                      </div>

                      <div className="mobile-agenda__card-col-service">
                        <span className="mobile-agenda__service-price">
                          {(app.service?.name || 'Serviço').toUpperCase()} - R$ {Number(app.service?.price || 0).toFixed(2)}
                        </span>
                        {isPaid && (
                          <span className="mobile-agenda__paid-pill">Pago</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>

      <style>{`
        .mobile-agenda {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          width: 100%;
        }

        .mobile-agenda__header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.375rem;
          width: 100%;
          flex-wrap: nowrap;
        }

        .mobile-agenda__date-bar {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 10px);
          padding: 0.25rem 0.4rem;
          flex-shrink: 0;
        }

        .mobile-agenda__date-display {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .mobile-agenda__nav-btn {
          width: 28px;
          height: 28px;
          min-width: 28px;
          min-height: 28px;
          border-radius: var(--radius-sm, 6px);
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
          padding: 0;
        }

        .mobile-agenda__nav-btn:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .mobile-agenda__nav-btn:active {
          transform: scale(0.92);
        }

        .mobile-agenda__date-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
        }

        .mobile-agenda__today-pill {
          font-size: 0.5625rem;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(217, 108, 0, 0.15);
          color: var(--color-brand-primary);
          padding: 1px 4px;
          border-radius: var(--radius-sm, 3px);
          white-space: nowrap;
        }

        .mobile-agenda__today-pill--btn {
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .mobile-agenda__today-pill--btn:hover {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .mobile-agenda__quick-actions-bar {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .mobile-agenda__action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          padding: 0.35rem 0.5rem;
          border-radius: var(--radius-md, 8px);
          font-size: 0.6875rem;
          font-weight: 700;
          cursor: pointer;
          min-height: 32px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          box-sizing: border-box;
          touch-action: manipulation;
        }

        .mobile-agenda__action-btn:active {
          transform: scale(0.96);
        }

        .mobile-agenda__action-btn--encaixe {
          background: rgba(217, 108, 0, 0.12);
          border: 1px solid var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .mobile-agenda__action-btn--encaixe:hover {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .mobile-agenda__action-btn--sub {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .mobile-agenda__action-btn--sub:hover {
          color: var(--color-text-primary);
          border-color: var(--color-text-secondary);
        }

        .mobile-agenda__prof-carousel {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .mobile-agenda__prof-carousel::-webkit-scrollbar {
          display: none;
        }

        .mobile-agenda__prof-chip {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.45rem 0.75rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full, 9999px);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-agenda__prof-chip:active {
          transform: scale(0.96);
        }

        .mobile-agenda__prof-chip--active {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          border-color: var(--color-brand-primary);
          font-weight: 700;
        }

        .mobile-agenda__chip-avatar {
          width: 18px;
          height: 18px;
          border-radius: var(--radius-full, 50%);
          background: rgba(0, 0, 0, 0.15);
          color: inherit;
          font-size: 0.625rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-agenda__chip-count {
          font-size: 0.6875rem;
          background: rgba(0, 0, 0, 0.15);
          padding: 1px 5px;
          border-radius: var(--radius-full, 9999px);
        }

        .mobile-agenda__empty-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 8px);
          margin-bottom: 0.25rem;
        }

        .mobile-agenda__empty-icon-sm {
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-agenda__empty-banner-content {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .mobile-agenda__timeline {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-agenda__empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 3rem 1.5rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl, 16px);
        }

        .mobile-agenda__empty-icon {
          color: var(--color-text-secondary);
          margin-bottom: 0.75rem;
        }

        .mobile-agenda__empty-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0 0 0.25rem;
        }

        .mobile-agenda__empty-desc {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin: 0 0 1.25rem;
        }

        .mobile-agenda__empty-cta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.625rem 1rem;
          border-radius: var(--radius-md, 8px);
          border: none;
          cursor: pointer;
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-agenda__empty-cta:hover {
          background: var(--color-brand-hover);
        }

        .mobile-agenda__cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-agenda__empty-slot {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md, 8px);
          min-height: 44px;
          box-sizing: border-box;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-agenda__empty-slot--available {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed var(--color-border);
          cursor: pointer;
        }

        .mobile-agenda__empty-slot--available:hover,
        .mobile-agenda__empty-slot--available:active {
          border-color: var(--color-brand-primary);
          background: rgba(217, 108, 0, 0.08);
          transform: scale(0.99);
        }

        .mobile-agenda__empty-slot--past {
          background: repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0.02),
            rgba(0, 0, 0, 0.02) 6px,
            rgba(0, 0, 0, 0.05) 6px,
            rgba(0, 0, 0, 0.05) 12px
          );
          border: 1px dashed var(--color-border);
          opacity: 0.85;
          cursor: pointer;
        }

        .mobile-agenda__empty-slot--past:hover,
        .mobile-agenda__empty-slot--past:active {
          border-color: var(--color-brand-primary);
          background: rgba(217, 108, 0, 0.06);
          opacity: 1;
        }

        .mobile-agenda__empty-slot--break {
          background: repeating-linear-gradient(
            45deg,
            rgba(217, 108, 0, 0.03),
            rgba(217, 108, 0, 0.03) 6px,
            rgba(217, 108, 0, 0.07) 6px,
            rgba(217, 108, 0, 0.07) 12px
          );
          border: 1px solid rgba(217, 108, 0, 0.2);
          opacity: 0.8;
          cursor: not-allowed;
        }

        .mobile-agenda__empty-slot--break .mobile-agenda__empty-slot-text {
          color: var(--color-brand-primary, #d96c00);
          font-weight: 700;
        }

        .mobile-agenda__empty-slot--closed {
          background: repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0.03),
            rgba(0, 0, 0, 0.03) 6px,
            rgba(0, 0, 0, 0.06) 6px,
            rgba(0, 0, 0, 0.06) 12px
          );
          border: 1px solid var(--color-border);
          opacity: 0.45;
          cursor: not-allowed;
        }

        .mobile-agenda__empty-slot-time {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          min-width: 42px;
        }

        .mobile-agenda__empty-slot-text {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .mobile-agenda__block-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: rgba(240, 82, 82, 0.08);
          border: 1px dashed rgba(240, 82, 82, 0.3);
          border-radius: var(--radius-md, 10px);
          color: var(--color-error);
          cursor: pointer;
        }

        .mobile-agenda__block-info {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .mobile-agenda__block-title {
          font-size: 0.8125rem;
          font-weight: 600;
          display: block;
        }

        .mobile-agenda__block-time {
          font-size: 0.6875rem;
          opacity: 0.8;
        }

        .mobile-agenda__block-remove {
          font-size: 0.6875rem;
          font-weight: 600;
          text-decoration: underline;
        }

        .mobile-agenda__card {
          background: #d1d5db;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 0.65rem 0.875rem;
          cursor: pointer;
          transition: transform 0.15s ease, background-color 0.2s ease, border-color 0.2s ease;
          user-select: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          width: 100%;
          box-sizing: border-box;
        }

        .mobile-agenda__card:active {
          transform: scale(0.985);
        }

        .mobile-agenda__card--paid {
          background: #86efac;
          border-color: #4ade80;
        }

        .mobile-agenda__card--active {
          background: #fed7aa;
          border-color: #f97316;
        }

        .mobile-agenda__card--fitting {
          border-left: 4px solid var(--color-brand-primary);
        }

        .mobile-agenda__card-compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
        }

        .mobile-agenda__card-col-time {
          display: flex;
          align-items: center;
          min-width: 50px;
          flex-shrink: 0;
        }

        .mobile-agenda__time-text {
          font-size: 1rem;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.02em;
        }

        .mobile-agenda__card-col-client {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.1rem;
          flex: 1;
          min-width: 0;
        }

        .mobile-agenda__client-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-agenda__client-phone {
          font-size: 0.75rem;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-agenda__prof-tag {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #4b5563;
        }

        .mobile-agenda__card-col-service {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 0.15rem;
          text-align: right;
          flex-shrink: 0;
          max-width: 45%;
        }

        .mobile-agenda__service-price {
          font-size: 0.75rem;
          font-weight: 700;
          color: #1f2937;
          text-transform: uppercase;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-agenda__paid-pill {
          font-size: 0.625rem;
          font-weight: 700;
          color: #065f46;
          background: rgba(16, 185, 129, 0.25);
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
};
