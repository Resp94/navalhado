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
} from '@hugeicons/core-free-icons';
import {
  dateInZone,
  formatTimeInZone,
  shiftCalendarDate,
} from '../../../lib/timezone';

interface Professional {
  id: string;
  name: string;
  is_active: boolean;
  phone?: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  is_fitting: boolean;
  notes?: string | null;
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

interface BlockedSlot {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface MobileAgendaViewProps {
  timezone: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  professionals: Professional[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
  timeSlots: string[];
  onOpenNewAppointment: (professionalId?: string, timeSlot?: string) => void;
  onOpenCheckout: (app: Appointment) => void;
  onOpenCancel: (app: Appointment) => void;
  onStartService: (app: Appointment) => void;
  onDirectWhatsApp: (phone: string, name: string, time: string) => void;
  onRemoveBlock: (blk: BlockedSlot) => void;
}

export const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
  timezone,
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
}) => {
  const [selectedProfId, setSelectedProfId] = useState<string>('all');

  const todayStr = useMemo(() => dateInZone(new Date(), timezone), [timezone]);
  const isToday = selectedDate === todayStr;

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

  // Formatação legível da data
  const formattedDateTitle = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    }
    return selectedDate;
  }, [selectedDate]);

  return (
    <div className="mobile-agenda">
      {/* ─── SELETOR DE DATA ─── */}
      <div className="mobile-agenda__date-bar">
        <div className="mobile-agenda__date-nav">
          <button
            type="button"
            className="mobile-agenda__nav-btn"
            onClick={handlePrevDay}
            aria-label="Dia Anterior"
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
            aria-label="Próximo Dia"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            className="mobile-agenda__today-btn"
            onClick={handleSetToday}
          >
            Ir para Hoje
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

      {/* ─── BOTÃO DE AÇÃO RÁPIDA (NOVO AGENDAMENTO) ─── */}
      <div className="mobile-agenda__quick-action">
        <button
          type="button"
          className="mobile-agenda__add-btn"
          onClick={() => onOpenNewAppointment(selectedProfId === 'all' ? undefined : selectedProfId)}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={18} />
          <span>Novo Agendamento / Encaixe</span>
        </button>
      </div>

      {/* ─── LISTA CRONOLÓGICA DE AGENDAMENTOS ─── */}
      <div className="mobile-agenda__timeline">
        {filteredAppointments.length === 0 && filteredBlocks.length === 0 ? (
          <div className="mobile-agenda__empty-state">
            <div className="mobile-agenda__empty-icon">
              <HugeiconsIcon icon={Calendar03Icon} size={32} />
            </div>
            <h3 className="mobile-agenda__empty-title">Sem agendamentos para esta data</h3>
            <p className="mobile-agenda__empty-desc">
              {selectedProfId === 'all'
                ? 'Nenhum atendimento marcado para a equipe hoje.'
                : `Nenhum atendimento para ${profNameMap.get(selectedProfId) || 'o profissional'} hoje.`}
            </p>
            <button
              type="button"
              className="mobile-agenda__empty-cta"
              onClick={() => onOpenNewAppointment(selectedProfId === 'all' ? undefined : selectedProfId)}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              Criar Primeiro Agendamento
            </button>
          </div>
        ) : (
          <div className="mobile-agenda__cards-list">
            {/* Bloqueios */}
            {filteredBlocks.map((blk) => {
              const tStart = formatTimeInZone(blk.start_time, timezone);
              const tEnd = formatTimeInZone(blk.end_time, timezone);
              const profName = profNameMap.get(blk.professional_id) || 'Profissional';

              return (
                <div
                  key={blk.id}
                  className="mobile-agenda__block-card"
                  onClick={() => onRemoveBlock(blk)}
                  title="Clique para remover bloqueio"
                >
                  <div className="mobile-agenda__block-info">
                    <HugeiconsIcon icon={UnavailableIcon} size={16} />
                    <div>
                      <span className="mobile-agenda__block-title">Bloqueio: {blk.reason}</span>
                      <span className="mobile-agenda__block-time">{tStart} - {tEnd} • {profName}</span>
                    </div>
                  </div>
                  <span className="mobile-agenda__block-remove">Remover</span>
                </div>
              );
            })}

            {/* Agendamentos */}
            {filteredAppointments.map((app) => {
              const timeStart = formatTimeInZone(app.start_time, timezone);
              const timeEnd = formatTimeInZone(app.end_time, timezone);
              const profName = profNameMap.get(app.professional_id) || 'Profissional';

              let statusBadge = { label: 'Confirmado', class: 'status-confirmed' };
              if (app.payment_status === 'paid' || app.status === 'completed') {
                statusBadge = { label: 'Concluído/Pago', class: 'status-paid' };
              } else if (app.status === 'in_progress') {
                statusBadge = { label: 'Em Atendimento', class: 'status-progress' };
              } else if (app.is_fitting) {
                statusBadge = { label: 'Encaixe', class: 'status-fitting' };
              }

              return (
                <div
                  key={app.id}
                  className={`mobile-agenda__card ${app.status === 'in_progress' ? 'mobile-agenda__card--active' : ''}`}
                  onClick={() => onOpenCheckout(app)}
                >
                  {/* Topo do Card: Horário + Status */}
                  <div className="mobile-agenda__card-header">
                    <div className="mobile-agenda__card-time">
                      <HugeiconsIcon icon={Clock01Icon} size={15} />
                      <span>{timeStart} - {timeEnd}</span>
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
                        title="Chamar no WhatsApp"
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
                        title="Iniciar Atendimento"
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
                        title="Cobrar / Receber"
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
                      title="Cancelar"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                    </button>
                  </div>
                </div>
              );
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
          border-radius: 12px;
          padding: 0.5rem 0.75rem;
        }

        .mobile-agenda__date-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mobile-agenda__nav-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
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
          text-transform: capitalize;
        }

        .mobile-agenda__today-pill {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .mobile-agenda__today-btn {
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent;
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #f59e0b;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
        }

        .mobile-agenda__prof-carousel {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
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
          border-radius: 9999px;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .mobile-agenda__prof-chip:active {
          transform: scale(0.96);
        }

        .mobile-agenda__prof-chip--active {
          background: var(--color-brand-primary, #f59e0b);
          color: #18181b;
          border-color: var(--color-brand-primary, #f59e0b);
          font-weight: 700;
        }

        .mobile-agenda__chip-avatar {
          width: 18px;
          height: 18px;
          border-radius: 50%;
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
          border-radius: 9999px;
        }

        .mobile-agenda__quick-action {
          width: 100%;
        }

        .mobile-agenda__add-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08));
          border: 1px dashed rgba(245, 158, 11, 0.4);
          color: var(--color-text-primary);
          padding: 0.75rem;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mobile-agenda__add-btn:active {
          transform: scale(0.98);
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
          border-radius: 16px;
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
          background: var(--color-brand-primary, #f59e0b);
          color: #18181b;
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.625rem 1rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }

        .mobile-agenda__cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-agenda__block-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px dashed rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #ef4444;
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
          border-radius: 14px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .mobile-agenda__card:active {
          transform: scale(0.99);
        }

        .mobile-agenda__card--active {
          border-color: #f59e0b;
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
        }

        .mobile-agenda__card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mobile-agenda__card-time {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .mobile-agenda__badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .status-confirmed { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .status-progress { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .status-paid { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .status-fitting { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

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
          border-radius: 4px;
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
          color: var(--color-brand-primary, #f59e0b);
        }

        .mobile-agenda__notes {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          background: var(--color-bg-primary);
          padding: 4px 6px;
          border-radius: 4px;
        }

        .mobile-agenda__card-footer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-top: 0.625rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .mobile-agenda__action-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.45rem 0.65rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mobile-agenda__action-btn:active {
          transform: scale(0.95);
        }

        .mobile-agenda__action-btn--whatsapp {
          background: rgba(37, 211, 102, 0.12);
          color: #25d366;
          border: 1px solid rgba(37, 211, 102, 0.25);
        }

        .mobile-agenda__action-btn--start {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .mobile-agenda__action-btn--pay {
          background: #f59e0b;
          color: #18181b;
          font-weight: 700;
        }

        .mobile-agenda__action-btn--cancel {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          padding: 0.45rem;
          margin-left: auto;
        }

        .mobile-agenda__paid-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #10b981;
          margin-right: auto;
        }
      `}</style>
    </div>
  );
};
