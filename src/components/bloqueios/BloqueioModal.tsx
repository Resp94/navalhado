import React, { useState, useMemo, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';
import { BloqueioRepository } from '../../modules/bloqueios/BloqueioRepository';
import { SupabaseBloqueioAdapter } from '../../modules/bloqueios/adapters/SupabaseBloqueioAdapter';
import { Button, IconButton, Select, Input, Checkbox, EmptyState } from '../ui';
import { supabase } from '../../lib/supabase';
import { localDateTimeToIso, localDayUtcRange, dateInZone, formatTimeInZone } from '../../lib/timezone';
import {
  addMinutesToTime,
  generateScheduleGridSlots,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  normalizeSlotIntervalMinutes,
  type WeeklySchedule,
} from '../../lib/schedule';
import type { BlockedSlot } from '../../modules/bloqueios/types';

export interface ProfessionalOption {
  id: string;
  name: string;
  is_active?: boolean;
  weekly_schedule?: WeeklySchedule | null;
}

export interface BloqueioAppointmentOption {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  professional_id: string;
}

interface BloqueioModalProps {
  isOpen: boolean;
  tenantId: string;
  professionals: ProfessionalOption[];
  appointments?: BloqueioAppointmentOption[];
  blockedSlots?: BlockedSlot[];
  defaultDateIso?: string; // YYYY-MM-DD
  defaultProfessionalId?: string;
  timezone?: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  slotIntervalMinutes?: number;
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
  timezone = 'America/Sao_Paulo',
  businessHours,
  slotIntervalMinutes,
  appointments = [],
  blockedSlots = [],
  onClose,
  onBloqueioCriado,
  bloqueioRepo,
}) => {
  const repo = useMemo(() => bloqueioRepo || new BloqueioRepository(new SupabaseBloqueioAdapter()), [bloqueioRepo]);

  const todayStr = defaultDateIso || new Date().toISOString().split('T')[0];
  const [selectedProfId, setSelectedProfId] = useState<string>(
    defaultProfessionalId || professionals[0]?.id || ''
  );
  const [date, setDate] = useState<string>(todayStr);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('Almoço');
  const [isAllDay, setIsAllDay] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados com dados do dia buscados dinamicamente para a data e profissional selecionados
  const [dynamicAppointments, setDynamicAppointments] = useState<BloqueioAppointmentOption[]>([]);
  const [dynamicBlockedSlots, setDynamicBlockedSlots] = useState<BlockedSlot[]>([]);
  const [dynamicDataLoaded, setDynamicDataLoaded] = useState({
    appointments: false,
    blockedSlots: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (defaultProfessionalId) {
        setSelectedProfId(defaultProfessionalId);
      } else if (professionals.length > 0 && !selectedProfId) {
        setSelectedProfId(professionals[0].id);
      }
      if (defaultDateIso) {
        setDate(defaultDateIso);
      }
      setSelectedSlots([]);
      setErrorMsg(null);
    }
  }, [isOpen, defaultProfessionalId, defaultDateIso, professionals]);

  // Carregar agendamentos e bloqueios da data selecionada em tempo real para sincronização precisa
  useEffect(() => {
    if (!isOpen || !tenantId || !date) return;

    let isMounted = true;
    setDynamicDataLoaded({ appointments: false, blockedSlots: false });
    const loadDayData = async () => {
      try {
        const { start, endExclusive } = localDayUtcRange(date, timezone);
        
        // 1. Carregar bloqueios do dia
        try {
          const blkRes = await repo.listByDateRange(tenantId, start, endExclusive);
          if (isMounted && Array.isArray(blkRes)) {
            setDynamicBlockedSlots(blkRes);
            setDynamicDataLoaded((previous) => ({ ...previous, blockedSlots: true }));
          }
        } catch {
          // Fallback silencioso usando prop inicial
        }

        // 2. Carregar agendamentos ativos do dia
        try {
          const { data: apptData, error: apptErr } = await supabase
            .from('appointments')
            .select('id, start_time, end_time, status, professional_id')
            .eq('tenant_id', tenantId)
            .gte('start_time', start)
            .lt('start_time', endExclusive)
            .neq('status', 'canceled');

          if (!apptErr && apptData && isMounted) {
            setDynamicAppointments(apptData as BloqueioAppointmentOption[]);
            setDynamicDataLoaded((previous) => ({ ...previous, appointments: true }));
          }
        } catch {
          // Fallback silencioso usando prop inicial
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do dia no modal de bloqueio:', err);
      }
    };

    loadDayData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId, date, timezone, repo]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const stepMinutes = normalizeSlotIntervalMinutes(slotIntervalMinutes);

  // Gerar horários de expediente considerando a barbearia e a jornada do barbeiro
  // (omitindo o horário de almoço/intervalo, horários com agendamento ativo e horários já bloqueados)
  const availableSlots = useMemo(() => {
    if (!date || !selectedProfId) return [];

    const dayBh = getDayBusinessHours(date, businessHours);
    if (!dayBh.active) return [];

    const selectedProf = professionals.find((p) => p.id === selectedProfId);
    const profSched = selectedProf
      ? getEffectiveProfessionalDaySchedule(selectedProf, date, businessHours)
      : null;

    let baseSlots: string[] = [];

    if (profSched) {
      if (profSched.active === false) {
        return []; // Barbeiro de folga nesta data
      }
      if (profSched.start && profSched.end) {
        baseSlots = generateScheduleGridSlots([{
          start: profSched.start,
          end: profSched.end,
          breakStart: profSched.break_start,
          breakEnd: profSched.break_end,
        }], stepMinutes);
      }
    } else {
      baseSlots = generateScheduleGridSlots([{
        start: dayBh.open || '08:00',
        end: dayBh.close || '19:00',
      }], stepMinutes);
    }

    // 1. Filtrar horários em que o profissional já possui agendamento confirmado/em andamento
    const activeAppts = dynamicDataLoaded.appointments ? dynamicAppointments : appointments;
    const bookedIntervals = activeAppts
      .filter((a) => {
        if (a.status === 'canceled') return false;
        if (a.professional_id !== selectedProfId && selectedProfId !== 'all') return false;
        const apptDate = dateInZone(new Date(a.start_time), timezone);
        return apptDate === date;
      })
      .map((a) => ({
        start: formatTimeInZone(a.start_time, timezone),
        end: formatTimeInZone(a.end_time, timezone),
      }));

    // 2. Filtrar horários em que o profissional já possui bloqueios existentes
    const activeBlocks = dynamicDataLoaded.blockedSlots ? dynamicBlockedSlots : blockedSlots;
    const dayBlocks = activeBlocks.filter((b) => {
      if (b.professional_id && b.professional_id !== selectedProfId && selectedProfId !== 'all') return false;
      const blockDate = dateInZone(new Date(b.start_time), timezone);
      return blockDate === date;
    });

    // Se houver algum bloqueio de dia inteiro (is_all_day) para este profissional nesta data, todos os slots estão bloqueados
    if (dayBlocks.some((b) => b.is_all_day)) {
      return [];
    }

    const blockedIntervals = dayBlocks.map((b) => ({
      start: formatTimeInZone(b.start_time, timezone),
      end: formatTimeInZone(b.end_time, timezone),
    }));

    return baseSlots.filter((slot) => {
      const slotStart = slot;
      const slotEnd = addMinutesToTime(slot, stepMinutes);

      // O slot colide se iniciar antes do término do agendamento E terminar após o início do agendamento
      const hasApptConflict = bookedIntervals.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );
      if (hasApptConflict) return false;

      // O slot colide se iniciar antes do término do bloqueio E terminar após o início do bloqueio
      const hasBlockConflict = blockedIntervals.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );
      if (hasBlockConflict) return false;

      return true;
    });
  }, [date, selectedProfId, businessHours, professionals, stepMinutes, appointments, blockedSlots, dynamicAppointments, dynamicBlockedSlots, dynamicDataLoaded, timezone]);

  const handleToggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort((a, b) => a.localeCompare(b))
    );
  };

  const handleSelectAllSlots = () => {
    setSelectedSlots([...availableSlots]);
  };

  const handleClearSlots = () => {
    setSelectedSlots([]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProfId) {
      setErrorMsg('Selecione um profissional para o bloqueio.');
      return;
    }

    if (!isAllDay && selectedSlots.length === 0) {
      setErrorMsg('Selecione pelo menos um horário da grade para bloquear.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isAllDay) {
        const conflictingAppts = appointments.filter((a) => {
          if (a.status === 'canceled') return false;
          const apptDate = dateInZone(new Date(a.start_time), timezone);
          if (apptDate !== date) return false;
          return selectedProfId === 'all' || a.professional_id === selectedProfId;
        });

        if (conflictingAppts.length > 0) {
          setErrorMsg(
            `Não é possível bloquear o dia inteiro: existem ${conflictingAppts.length} agendamento(s) ativo(s) nesta data para este profissional. Cancele ou reagende-os primeiro, ou selecione horários específicos.`
          );
          return;
        }

        const startIso = localDateTimeToIso(date, '00:00', timezone);
        const endIso = localDateTimeToIso(date, '23:59', timezone);

        const bloqueio = await repo.createBlock({
          tenant_id: tenantId,
          professional_id: selectedProfId,
          start_time: startIso,
          end_time: endIso,
          reason: reason.trim() || 'Bloqueio de Horário',
          is_all_day: true,
        });

        onBloqueioCriado(bloqueio);
      } else {
        const sortedSlots = [...selectedSlots].sort((a, b) => a.localeCompare(b));
        const intervals: Array<{ start: string; end: string }> = [];
        let currentStart = sortedSlots[0];
        let currentEnd = addMinutesToTime(currentStart, stepMinutes);

        for (let i = 1; i < sortedSlots.length; i++) {
          const slot = sortedSlots[i];
          if (slot === currentEnd) {
            currentEnd = addMinutesToTime(slot, stepMinutes);
          } else {
            intervals.push({ start: currentStart, end: currentEnd });
            currentStart = slot;
            currentEnd = addMinutesToTime(slot, stepMinutes);
          }
        }
        intervals.push({ start: currentStart, end: currentEnd });

        let lastCreated: BlockedSlot | null = null;
        for (const intv of intervals) {
          const startIso = localDateTimeToIso(date, intv.start, timezone);
          const endIso = localDateTimeToIso(date, intv.end, timezone);
          lastCreated = await repo.createBlock({
            tenant_id: tenantId,
            professional_id: selectedProfId,
            start_time: startIso,
            end_time: endIso,
            reason: reason.trim() || 'Bloqueio de Horário',
            is_all_day: false,
          });
        }

        if (lastCreated) {
          onBloqueioCriado(lastCreated);
        }
      }

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
            <div>
              <h3 id="modal-bloqueio-title" className="bloqueio-modal-title">
                Bloquear horário do barbeiro
              </h3>
              <p className="bloqueio-modal-subtitle">
                Selecione os horários da grade para pausar a agenda
              </p>
            </div>
          </div>
          <IconButton
            icon={<HugeiconsIcon icon={Cancel01Icon} size={20} />}
            onClick={onClose}
            aria-label="Fechar"
            variant="ghost"
          />
        </div>

        {errorMsg && (
          <div className="bloqueio-error-alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bloqueio-modal-form">
          <div className="bloqueio-form-row">
            <Select
              label="Profissional *"
              value={selectedProfId}
              onChange={(e) => {
                setSelectedProfId(e.target.value);
                setSelectedSlots([]);
              }}
              required
            >
              <option value="">Selecione o profissional...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              label="Motivo do bloqueio *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Almoço">Almoço</option>
              <option value="Folga do dia">Folga do dia</option>
              <option value="Consulta médica">Consulta médica</option>
              <option value="Manutenção de equipamento">Manutenção de equipamento</option>
              <option value="Treinamento">Treinamento</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>

          <Input
            type="date"
            label="Data *"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlots([]);
            }}
            required
          />

          <div className="bloqueio-checkbox-box">
            <Checkbox
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              label="Bloquear o expediente inteiro deste dia"
            />
          </div>

          {!isAllDay && (
            <div className="bloqueio-slots-section">
              <div className="bloqueio-slots-header">
                <span className="bloqueio-slots-title">
                  Horários para bloqueio * ({selectedSlots.length} selecionado{selectedSlots.length === 1 ? '' : 's'})
                </span>
                {availableSlots.length > 0 && (
                  <div className="bloqueio-slots-actions">
                    <Button
                      size="xs"
                      variant="outline"
                      type="button"
                      onClick={handleSelectAllSlots}
                    >
                      Todos
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      type="button"
                      onClick={handleClearSlots}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              {availableSlots.length === 0 ? (
                <EmptyState
                  icon={<HugeiconsIcon icon={Clock01Icon} size={24} />}
                  title="Nenhum horário disponível"
                  description="Nenhum horário disponível para bloqueio nesta data (folga, barbearia fechada ou horários já ocupados por agendamentos/bloqueios)."
                />
              ) : (
                <div className="bloqueio-slots-grid">
                  {availableSlots.map((slot) => {
                    const endSlot = addMinutesToTime(slot, stepMinutes);
                    const isChecked = selectedSlots.includes(slot);

                    return (
                      <label
                        key={slot}
                        className={`bloqueio-slot-card ${
                          isChecked ? 'bloqueio-slot-card--selected' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSlot(slot)}
                          className="bloqueio-slot-checkbox"
                        />
                        <span className="bloqueio-slot-time font-mono">
                          {slot} - {endSlot}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="bloqueio-actions-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              fullWidth
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={isSubmitting}
              disabled={isSubmitting || (!isAllDay && availableSlots.length === 0)}
              fullWidth
              leftIcon={<HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />}
            >
              Confirmar bloqueio
            </Button>
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
          max-width: 520px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-text-primary);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl), 0 0 0 0.8px var(--color-text-primary);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
          box-sizing: border-box;
          max-height: calc(100vh - 2rem);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .bloqueio-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--color-border-subtle, rgba(0,0,0,0.06));
          box-sizing: border-box;
          width: 100%;
        }

        .bloqueio-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .bloqueio-modal-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .bloqueio-modal-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.15rem 0 0 0;
        }

        .bloqueio-error-alert {
          padding: 0.65rem 0.85rem;
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
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }

        .bloqueio-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }

        @media (max-width: 480px) {
          .bloqueio-form-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
        }

        .bloqueio-checkbox-box {
          padding: 0.5rem 0.75rem;
          background-color: var(--color-brand-lightest);
          border-radius: 8px;
          border: 1px solid var(--color-border-subtle, rgba(0,0,0,0.06));
          box-sizing: border-box;
          width: 100%;
        }

        .bloqueio-slots-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: var(--color-brand-lightest);
          border-radius: 12px;
          padding: 0.75rem;
          border: 1px solid var(--color-border-subtle, rgba(0,0,0,0.06));
          box-sizing: border-box;
          width: 100%;
        }

        .bloqueio-slots-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .bloqueio-slots-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .bloqueio-slots-actions {
          display: flex;
          gap: 0.35rem;
        }

        .bloqueio-slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
          gap: 0.4rem;
          max-height: 180px;
          overflow-y: auto;
          padding: 2px;
          box-sizing: border-box;
        }

        .bloqueio-slot-card {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.55rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-subtle, rgba(0,0,0,0.1));
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }

        .bloqueio-slot-card:hover {
          border-color: var(--color-text-primary);
        }

        .bloqueio-slot-card--selected {
          background: rgba(217, 72, 72, 0.1);
          border-color: var(--color-error);
        }

        .bloqueio-slot-checkbox {
          width: 15px;
          height: 15px;
          accent-color: var(--color-error);
          cursor: pointer;
        }

        .bloqueio-slot-time {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .bloqueio-actions-footer {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
          width: 100%;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
};
