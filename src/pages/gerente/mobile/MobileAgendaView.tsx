import React, { useState, useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  WhatsappIcon,
  CheckmarkCircle02Icon,
  Money01Icon,
  Cancel01Icon,
  PlusSignIcon,
  UnavailableIcon,
  Clock01Icon,
  Note01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import {
  dateInZone,
  formatTimeInZone,
  shiftCalendarDate,
} from '../../../lib/timezone';
import { getDayBusinessHours } from '../Agenda';
import type { Appointment, Professional } from '../Agenda';
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
  onOpenCancel: (app: Appointment) => void;
  onStartService: (app: Appointment) => void | Promise<void>;
  onDirectWhatsApp: (phone: string, name: string, time: string) => void;
  onRemoveBlock: (blk: BlockedSlot) => void | Promise<void>;
  onOpenBloqueio?: () => void;
  onOpenEspera?: () => void;
}

interface TimelineItem {
  type: 'appointment' | 'block' | 'empty';
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
  onOpenCancel,
  onStartService,
  onDirectWhatsApp,
  onRemoveBlock,
  onOpenBloqueio,
  onOpenEspera,
}) => {
  const [selectedProfId, setSelectedProfId] = useState<string>('all');
  const showEmptySlots = true;

  const todayStr = useMemo(() => dateInZone(new Date(), timezone), [timezone]);
  const isToday = selectedDate === todayStr;

  const nowInstant = useMemo(() => new Date(), []);
  const currentLocalDate = useMemo(() => dateInZone(nowInstant, timezone), [nowInstant, timezone]);
  const currentLocalTime = useMemo(
    () => formatTimeInZone(nowInstant.toISOString(), timezone),
    [nowInstant, timezone]
  );
  const dayBh = useMemo(
    () => getDayBusinessHours(selectedDate, businessHours),
    [selectedDate, businessHours]
  );

  const handlePrevDay = () => onSelectDate(shiftCalendarDate(selectedDate, -1));
  const handleNextDay = () => onSelectDate(shiftCalendarDate(selectedDate, 1));
  const handleSetToday = () => onSelectDate(todayStr);

  // Filtrar profissionais ativos
  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.is_active),
    [professionals]
  );

  // Agendamentos e bloqueios filtrados pelo profissional selecionado
  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (selectedProfId !== 'all') {
      list = list.filter((a) => a.professional_id === selectedProfId);
    }
    return [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [appointments, selectedProfId]);

  const filteredBlocks = useMemo(() => {
    let list = blockedSlots;
    if (selectedProfId !== 'all') {
      list = list.filter((b) => b.professional_id === selectedProfId);
    }
    return list;
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

    // Adicionar Slots Vazios Interativos se solicitado e quando timeSlots estiver disponível e barbearia aberta
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
          items.push({ type: 'empty', time: slot });
        }
      });
    }

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredAppointments, filteredBlocks, showEmptySlots, timeSlots, timezone, dayBh]);

  return (
    <div className="mobile-agenda">
      {/* ─── SELETOR DE DATA ─── */}
      <div className="mobile-agenda__date-bar">
        <div className="mobile-agenda__date-nav">
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
            {isToday && <span className="mobile-agenda__today-pill">Hoje</span>}
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

        {!isToday && (
          <button
            type="button"
            className="mobile-agenda__today-btn"
            onClick={handleSetToday}
            title="Voltar para a data de hoje"
          >
            Ir para hoje
          </button>
        )}
      </div>

      {/* ─── CARROSSEL DE PROFISSIONAIS ─── */}
      <div className="mobile-agenda__prof-carousel">
        <button
          type="button"
          className={`mobile-agenda__prof-chip ${selectedProfId === 'all' ? 'mobile-agenda__prof-chip--active' : ''}`}
          onClick={() => setSelectedProfId('all')}
        >
          <span>Todos</span>
          <span className="mobile-agenda__chip-count">{appointments.length}</span>
        </button>

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

      {/* ─── BARRA DE AÇÕES RÁPIDAS (ENCAIXE, BLOQUEIO, ESPERA) ─── */}
      <div className="mobile-agenda__quick-action">
        <button
          type="button"
          className="mobile-agenda__add-btn"
          onClick={() =>
            onOpenNewAppointment(
              selectedProfId === 'all' ? undefined : selectedProfId,
              undefined,
              true
            )
          }
          title="Atender cliente que chegou agora sem agendamento (Encaixe)"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={18} />
          <span>Encaixe</span>
        </button>

        {onOpenBloqueio && (
          <button
            type="button"
            className="mobile-agenda__sub-btn"
            onClick={onOpenBloqueio}
            title="Bloquear horário (almoço, saída)"
          >
            <HugeiconsIcon icon={UnavailableIcon} size={16} />
            <span>Bloquear</span>
          </button>
        )}

        {onOpenEspera && (
          <button
            type="button"
            className="mobile-agenda__sub-btn"
            onClick={onOpenEspera}
            title="Fila de espera de clientes no balcão"
          >
            <HugeiconsIcon icon={UserGroupIcon} size={16} />
            <span>Espera</span>
          </button>
        )}
      </div>

      {/* ─── LINHA DO TEMPO CRONOLÓGICA ─── */}
      <div className="mobile-agenda__timeline">
        {timelineItems.length === 0 ? (
          <div className="mobile-agenda__empty-state">
            <div className="mobile-agenda__empty-icon">
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 className="mobile-agenda__empty-title">Nenhum agendamento para este dia</h3>
            <p className="mobile-agenda__empty-desc">
              {selectedProfId === 'all'
                ? 'Nenhum atendimento marcado para a equipe hoje.'
                : `Nenhum atendimento para ${profNameMap.get(selectedProfId) || 'o profissional'} hoje.`}
            </p>
            <button
              type="button"
              className="mobile-agenda__empty-cta"
              onClick={() =>
                onOpenNewAppointment(
                  selectedProfId === 'all' ? undefined : selectedProfId,
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
                      : selectedProfId === 'all'
                      ? 'Toque em qualquer horário disponível abaixo para agendar.'
                      : `Agenda disponível para ${profNameMap.get(selectedProfId) || 'o profissional'}. Toque abaixo para agendar.`}
                  </p>
                </div>
              </div>
            )}

            {timelineItems.map((item, idx) => {
              if (item.type === 'empty') {
                const isPast =
                  selectedDate < currentLocalDate ||
                  (selectedDate === currentLocalDate && item.time < currentLocalTime);

                if (isPast) {
                  return (
                    <div
                      key={`empty-${item.time}-${idx}`}
                      className="mobile-agenda__empty-slot mobile-agenda__empty-slot--past"
                      title={`Horário já passou (${item.time})`}
                    >
                      <span className="mobile-agenda__empty-slot-time">{item.time}</span>
                      <span className="mobile-agenda__empty-slot-text">
                        <HugeiconsIcon icon={Clock01Icon} size={14} />
                        Horário já passou
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-${item.time}-${idx}`}
                    className="mobile-agenda__empty-slot mobile-agenda__empty-slot--available"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onOpenNewAppointment(
                        selectedProfId === 'all' ? undefined : selectedProfId,
                        item.time,
                        false
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenNewAppointment(
                          selectedProfId === 'all' ? undefined : selectedProfId,
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
                const timeEnd = formatTimeInZone(app.end_time, timezone);
                const profName = profNameMap.get(app.professional_id) || 'Profissional';

                let statusBadge = { label: 'Confirmado', class: 'status-confirmed' };
                if (app.payment_status === 'paid' || app.status === 'completed') {
                  statusBadge = { label: 'Concluído e pago', class: 'status-paid' };
                } else if (app.status === 'in_progress') {
                  statusBadge = { label: 'Em atendimento', class: 'status-progress' };
                } else if (app.is_fitting) {
                  statusBadge = { label: 'Encaixe', class: 'status-fitting' };
                }

                return (
                  <div
                    key={app.id}
                    className={`mobile-agenda__card ${app.status === 'in_progress' ? 'mobile-agenda__card--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCheckout(app)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCheckout(app);
                      }
                    }}
                    title="Toque para ver detalhes ou receber a comanda"
                    aria-label={`Agendamento de ${app.customer?.name || 'Cliente'} para ${app.service?.name || 'Serviço'} às ${timeStart}. Status: ${statusBadge.label}. Toque para abrir comanda.`}
                  >
                    {/* Topo do Card: Horário + Status */}
                    <div className="mobile-agenda__card-header">
                      <div className="mobile-agenda__card-time">
                        <HugeiconsIcon icon={Clock01Icon} size={15} />
                        <span>{timeStart} às {timeEnd}</span>
                      </div>
                      <span className={`mobile-agenda__badge ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    {/* Meio: Cliente e Serviço */}
                    <div className="mobile-agenda__card-body">
                      <div className="mobile-agenda__client-row">
                        <span className="mobile-agenda__client-name">{app.customer?.name || 'Cliente'}</span>
                        {selectedProfId === 'all' && (
                          <span className="mobile-agenda__prof-badge">{profName}</span>
                        )}
                      </div>
                      <div className="mobile-agenda__service-row">
                        <span className="mobile-agenda__service-name">{app.service?.name}</span>
                        <span className="mobile-agenda__price">
                          R$ {Number(app.service?.price || 0).toFixed(2)}
                        </span>
                      </div>
                      {app.notes && (
                        <div className="mobile-agenda__notes">
                          <HugeiconsIcon icon={Note01Icon} size={12} />
                          <span>{app.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Card: Ações Rápidas */}
                    <div className="mobile-agenda__card-footer" onClick={(e) => e.stopPropagation()}>
                      {app.customer?.phone && (
                        <button
                          type="button"
                          className="mobile-agenda__action-btn mobile-agenda__action-btn--whatsapp"
                          onClick={() => onDirectWhatsApp(app.customer.phone, app.customer.name, timeStart)}
                          title="Conversar com o cliente no WhatsApp"
                        >
                          <HugeiconsIcon icon={WhatsappIcon} size={16} />
                          <span>WhatsApp</span>
                        </button>
                      )}

                      {app.status === 'confirmed' && (
                        <button
                          type="button"
                          className="mobile-agenda__action-btn mobile-agenda__action-btn--start"
                          onClick={() => onStartService(app)}
                          title="Iniciar atendimento deste cliente"
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                          <span>Iniciar</span>
                        </button>
                      )}

                      {app.payment_status !== 'paid' ? (
                        <button
                          type="button"
                          className="mobile-agenda__action-btn mobile-agenda__action-btn--pay"
                          onClick={() => onOpenCheckout(app)}
                          title="Cobrar comanda e receber pagamento"
                        >
                          <HugeiconsIcon icon={Money01Icon} size={16} />
                          <span>Cobrar</span>
                        </button>
                      ) : (
                        <span className="mobile-agenda__paid-indicator">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                          Pago
                        </span>
                      )}

                      <button
                        type="button"
                        className="mobile-agenda__action-btn mobile-agenda__action-btn--cancel"
                        onClick={() => onOpenCancel(app)}
                        title="Cancelar este agendamento"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </button>
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

        .mobile-agenda__date-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 0.5rem 0.75rem;
        }

        .mobile-agenda__date-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mobile-agenda__nav-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-md, 8px);
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }

        .mobile-agenda__nav-btn:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .mobile-agenda__nav-btn:active {
          transform: scale(0.94);
        }

        .mobile-agenda__date-display {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mobile-agenda__date-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .mobile-agenda__today-pill {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(217, 108, 0, 0.15);
          color: var(--color-brand-primary);
          padding: 2px 6px;
          border-radius: var(--radius-sm, 4px);
        }

        .mobile-agenda__today-btn {
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent;
          border: 1px solid var(--color-brand-primary);
          color: var(--color-brand-primary);
          border-radius: var(--radius-sm, 6px);
          padding: 8px 12px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }

        .mobile-agenda__today-btn:hover {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .mobile-agenda__today-btn:active {
          transform: scale(0.96);
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

        .mobile-agenda__quick-action {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.5rem;
          align-items: stretch;
        }

        .mobile-agenda__add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          background: rgba(217, 108, 0, 0.08);
          border: 1px dashed var(--color-brand-primary);
          color: var(--color-brand-primary);
          padding: 0.625rem 0.75rem;
          border-radius: var(--radius-lg, 12px);
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          min-height: 44px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          white-space: nowrap;
        }

        .mobile-agenda__add-btn:active {
          transform: scale(0.98);
        }

        .mobile-agenda__sub-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          padding: 0.625rem 0.75rem;
          border-radius: var(--radius-lg, 12px);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          min-height: 44px;
          min-width: 44px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          white-space: nowrap;
        }

        .mobile-agenda__sub-btn:active {
          transform: scale(0.96);
          color: var(--color-brand-primary);
        }

        @media (max-width: 360px) {
          .mobile-agenda__quick-action {
            grid-template-columns: 1fr 1fr;
          }
          .mobile-agenda__add-btn {
            grid-column: span 2;
          }
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
          border: 1px solid var(--color-border);
          opacity: 0.5;
          cursor: not-allowed;
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
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
          cursor: pointer;
          transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-agenda__card:active {
          transform: scale(0.99);
        }

        .mobile-agenda__card--active {
          border-color: var(--color-brand-primary);
          box-shadow: 0 4px 16px rgba(217, 108, 0, 0.2);
        }

        .mobile-agenda__card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed var(--color-border);
        }

        .mobile-agenda__card-time {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--color-brand-primary);
        }

        .mobile-agenda__card-badges {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .mobile-agenda__badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: var(--radius-sm, 4px);
        }

        .status-confirmed { background: rgba(63, 131, 248, 0.15); color: var(--color-info); }
        .status-progress { background: rgba(217, 119, 6, 0.15); color: var(--color-warning); }
        .status-paid { background: rgba(14, 159, 110, 0.15); color: var(--color-success); }
        .status-fitting { background: rgba(217, 108, 0, 0.15); color: var(--color-brand-primary); }

        .mobile-agenda__card-body {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .mobile-agenda__client-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mobile-agenda__client-name {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .mobile-agenda__prof-badge {
          font-size: 0.6875rem;
          background: var(--color-bg-primary);
          color: var(--color-text-secondary);
          padding: 2px 6px;
          border-radius: var(--radius-sm, 4px);
          border: 1px solid var(--color-border);
        }

        .mobile-agenda__service-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8125rem;
        }

        .mobile-agenda__service-name {
          color: var(--color-text-secondary);
        }

        .mobile-agenda__price {
          font-weight: 700;
          color: var(--color-brand-primary);
        }

        .mobile-agenda__notes {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          background: var(--color-bg-primary);
          padding: 4px 6px;
          border-radius: var(--radius-sm, 4px);
        }

        .mobile-agenda__card-footer {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.375rem;
          padding-top: 0.625rem;
          border-top: 1px solid var(--color-border);
        }

        .mobile-agenda__action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          min-height: 44px;
          padding: 0.55rem 0.85rem;
          border-radius: var(--radius-md, 8px);
          font-size: 0.75rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          white-space: nowrap;
          flex-shrink: 0;
          touch-action: manipulation;
        }

        .mobile-agenda__action-btn:active {
          transform: scale(0.95);
        }

        .mobile-agenda__action-btn--whatsapp {
          background: rgba(14, 159, 110, 0.12);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.25);
        }

        .mobile-agenda__action-btn--start {
          background: rgba(63, 131, 248, 0.15);
          color: var(--color-info);
          border: 1px solid rgba(63, 131, 248, 0.3);
        }

        .mobile-agenda__action-btn--pay {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          font-weight: 700;
        }

        .mobile-agenda__action-btn--cancel {
          background: rgba(240, 82, 82, 0.1);
          color: var(--color-error);
          min-width: 44px;
          min-height: 44px;
          padding: 0.55rem 0.65rem;
          margin-left: auto;
        }

        .mobile-agenda__paid-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-success);
          margin-right: auto;
        }
      `}</style>
    </div>
  );
};
