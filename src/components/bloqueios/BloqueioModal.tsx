import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  UnavailableIcon,
} from '@hugeicons/core-free-icons';
import { BloqueioRepository } from '../../modules/bloqueios/BloqueioRepository';
import { SupabaseBloqueioAdapter } from '../../modules/bloqueios/adapters/SupabaseBloqueioAdapter';
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
      startIso = `${date}T00:00:00.000Z`;
      endIso = `${date}T23:59:59.999Z`;
    } else {
      startIso = `${date}T${startTime}:00.000Z`;
      endIso = `${date}T${endTime}:00.000Z`;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bloqueio-title"
    >
      <div className="bg-[var(--color-bg-primary,#121214)] border border-[var(--color-border-subtle,rgba(255,255,255,0.1))] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-[var(--color-text-primary,#fff)] font-sans">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle,rgba(255,255,255,0.08))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-error,#EF4444)]/15 flex items-center justify-center text-[var(--color-error,#EF4444)]">
              <HugeiconsIcon icon={UnavailableIcon} size={22} />
            </div>
            <div>
              <h3 id="modal-bloqueio-title" className="text-lg font-bold">
                Bloquear Horário na Grade
              </h3>
              <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)]">
                Impede novos agendamentos neste intervalo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-[var(--color-text-secondary,#A1A1AA)] hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-[var(--color-error,#EF4444)]/10 border border-[var(--color-error,#EF4444)]/30 text-xs text-[var(--color-error,#EF4444)]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
              Profissional *
            </label>
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)]"
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
              Motivo do Bloqueio *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)]"
            >
              <option value="Almoço">Almoço</option>
              <option value="Folga">Folga</option>
              <option value="Consulta Médica">Consulta Médica</option>
              <option value="Manutenção de Equipamento">Manutenção de Equipamento</option>
              <option value="Treinamento">Treinamento</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)]"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded bg-black/40 border-white/20 text-[var(--color-brand-primary,#D4AF37)] focus:ring-0"
            />
            <label htmlFor="isAllDay" className="text-xs text-[var(--color-text-secondary,#A1A1AA)] cursor-pointer">
              Bloquear o dia inteiro
            </label>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
                  Início
                </label>
                <div className="relative">
                  <HugeiconsIcon icon={Clock01Icon} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
                  Término
                </label>
                <div className="relative">
                  <HugeiconsIcon icon={Clock01Icon} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-border-subtle,rgba(255,255,255,0.15))] text-sm font-semibold text-[var(--color-text-secondary,#A1A1AA)] hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--color-error,#EF4444)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  <span>Confirmar Bloqueio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
