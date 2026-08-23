import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';
import { BloqueioRepository } from '../../modules/bloqueios/BloqueioRepository';
import { SupabaseBloqueioAdapter } from '../../modules/bloqueios/adapters/SupabaseBloqueioAdapter';
import { localDateTimeToIso } from '../../lib/timezone';
import type { BlockedSlot } from '../../modules/bloqueios/types';

interface ProfessionalOption {
  id: string;
  name: string;
}

interface BloqueioModalProps {
  isOpen: boolean;
  tenantId: string;
  professionals: ProfessionalOption[];
  defaultDateIso?: string; // YYYY-MM-DD
  defaultProfessionalId?: string;
  defaultStartTime?: string; // HH:mm
  timezone?: string;
  onClose: () => void;
  onBloqueioCriado: (bloqueio: BlockedSlot) => void;
  bloqueioRepo?: BloqueioRepository;
}

export const BloqueioModal: React.FC<BloqueioModalProps> = ({
  isOpen,
  tenantId,
  professionals,
  defaultDateIso,
  defaultProfessionalId,
  defaultStartTime = '12:00',
  timezone = 'America/Sao_Paulo',
  onClose,
  onBloqueioCriado,
  bloqueioRepo,
}) => {
  const repo = bloqueioRepo || new BloqueioRepository(new SupabaseBloqueioAdapter());

  const todayStr = defaultDateIso || new Date().toISOString().split('T')[0];
  const [selectedProfId, setSelectedProfId] = useState<string>(
    defaultProfessionalId || professionals[0]?.id || ''
  );
  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(defaultStartTime);
  const [endTime, setEndTime] = useState<string>('13:00');
  const [reason, setReason] = useState<string>('Almoço');
  const [isAllDay, setIsAllDay] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProfId) {
      setErrorMsg('Selecione um profissional para o bloqueio.');
      return;
    }

    let startIso: string;
    let endIso: string;

    if (isAllDay) {
      startIso = localDateTimeToIso(date, '00:00', timezone);
      endIso = localDateTimeToIso(date, '23:59', timezone);
    } else {
      startIso = localDateTimeToIso(date, startTime, timezone);
      endIso = localDateTimeToIso(date, endTime, timezone);
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setErrorMsg('O horário de término deve ser posterior ao horário de início.');
      return;
    }

    setIsSubmitting(true);
    try {
      const bloqueio = await repo.createBlock({
        tenant_id: tenantId,
        professional_id: selectedProfId,
        start_time: startIso,
        end_time: endIso,
        reason: reason.trim() || 'Bloqueio de Horário',
        is_all_day: isAllDay,
      });

      onBloqueioCriado(bloqueio);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao criar bloqueio de horário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bloqueio-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bloqueio-title"
    >
      <div className="bloqueio-modal-shell">
        <div className="bloqueio-modal-header">
          <div className="bloqueio-header-left">
            <div className="bloqueio-icon-badge">
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </div>
            <div>
              <h3 id="modal-bloqueio-title" className="bloqueio-modal-title">
                Bloquear horário do barbeiro
              </h3>
              <p className="bloqueio-modal-subtitle">
                Pausar agenda para almoço, folga ou compromisso pessoal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="bloqueio-close-btn"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="bloqueio-error-alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bloqueio-modal-form">
          <div className="bloqueio-form-group">
            <label className="bloqueio-label">
              Profissional *
            </label>
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="bloqueio-select"
              required
            >
              <option value="">Selecione o profissional...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bloqueio-form-group">
            <label className="bloqueio-label">
              Motivo do bloqueio *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bloqueio-select"
            >
              <option value="Almoço">Almoço</option>
              <option value="Folga do dia">Folga do dia</option>
              <option value="Consulta médica">Consulta médica</option>
              <option value="Manutenção de equipamento">Manutenção de equipamento</option>
              <option value="Treinamento">Treinamento</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="bloqueio-form-group">
            <label className="bloqueio-label">
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bloqueio-input-date"
              required
            />
          </div>

          <div className="bloqueio-checkbox-group">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="bloqueio-checkbox"
            />
            <label htmlFor="isAllDay" className="bloqueio-checkbox-label">
              Bloquear o expediente inteiro deste dia
            </label>
          </div>

          {!isAllDay && (
            <div className="bloqueio-time-row">
              <div className="bloqueio-form-group">
                <label className="bloqueio-label">
                  Horário de início
                </label>
                <div className="bloqueio-input-icon-wrapper">
                  <HugeiconsIcon icon={Clock01Icon} size={16} className="bloqueio-input-icon" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bloqueio-input-time"
                    required
                  />
                </div>
              </div>
              <div className="bloqueio-form-group">
                <label className="bloqueio-label">
                  Horário de término
                </label>
                <div className="bloqueio-input-icon-wrapper">
                  <HugeiconsIcon icon={Clock01Icon} size={16} className="bloqueio-input-icon" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bloqueio-input-time"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bloqueio-actions-footer">
            <button
              type="button"
              onClick={onClose}
              className="bloqueio-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bloqueio-btn-danger"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  <span>Confirmar bloqueio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .bloqueio-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 1rem;
          box-sizing: border-box;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .bloqueio-modal-shell {
          width: 100%;
          max-width: 480px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
          box-sizing: border-box;
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .bloqueio-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border);
          box-sizing: border-box;
          width: 100%;
        }

        .bloqueio-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .bloqueio-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background-color: var(--color-error-bg);
          color: var(--color-error);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bloqueio-modal-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .bloqueio-modal-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
        }

        .bloqueio-close-btn {
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .bloqueio-close-btn:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .bloqueio-error-alert {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 600;
          box-sizing: border-box;
          width: 100%;
        }

        .bloqueio-modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }

        .bloqueio-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }

        .bloqueio-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .bloqueio-select,
        .bloqueio-input-date {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
          padding: 0.65rem 0.85rem;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .bloqueio-select:focus,
        .bloqueio-input-date:focus {
          border-color: var(--color-brand-primary);
        }

        .bloqueio-checkbox-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
        }

        .bloqueio-checkbox {
          width: 16px;
          height: 16px;
          accent-color: var(--color-brand-primary);
          cursor: pointer;
          flex-shrink: 0;
        }

        .bloqueio-checkbox-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .bloqueio-time-row {
          display: flex;
          gap: 0.75rem;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }

        .bloqueio-time-row .bloqueio-form-group {
          flex: 1;
          min-width: 0;
        }

        .bloqueio-input-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }

        .bloqueio-input-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--color-text-secondary);
          pointer-events: none;
        }

        .bloqueio-input-time {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
          padding: 0.65rem 0.85rem 0.65rem 2.25rem;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .bloqueio-input-time:focus {
          border-color: var(--color-brand-primary);
        }

        .bloqueio-actions-footer {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .bloqueio-btn-secondary {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          text-align: center;
        }

        .bloqueio-btn-secondary:hover {
          background-color: var(--color-border);
        }

        .bloqueio-btn-danger {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          border: none;
          background-color: var(--color-error);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .bloqueio-btn-danger:hover:not(:disabled) {
          background-color: #d33838;
        }

        .bloqueio-btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
