import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../ui';
import { useToast } from '../Toast';
import { AgendaOperationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
import type { BlockedSlot } from '../../modules/bloqueios/types';
import { dateInZone, formatTimeInZone, localDateTimeToIso } from '../../lib/timezone';
import {
  generateScheduleGridSlots,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  getEffectiveServiceDuration,
  isProfessionalWorkingAt,
  toScheduleGridSegment,
} from '../../lib/schedule';
import type { Appointment, Professional } from '../../pages/gerente/Agenda';

interface ReagendarAgendamentoModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  tenantId: string;
  timezone: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  slotIntervalMinutes: number;
  professionals: Professional[];
  /** Agendamentos e Bloqueios carregados, para esconder horários já ocupados. */
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
  /** Data de partida quando o Agendamento não tem horário. */
  fallbackDate: string;
  /** Barbeiro reagenda só data e hora: o profissional fica travado nele. */
  lockedProfessionalId?: string;
  onClose: () => void;
  /** Depois de reagendar, ou quando o banco recusou por regra: a tela deve recarregar. */
  onAtualizar: () => void;
}

/** Reagendar direto na Agenda. Conflito, Bloqueio, expediente e escala são conferidos no banco. */
export const ReagendarAgendamentoModal: React.FC<ReagendarAgendamentoModalProps> = ({
  isOpen,
  appointment,
  tenantId,
  timezone,
  businessHours,
  slotIntervalMinutes,
  professionals,
  appointments,
  blockedSlots,
  fallbackDate,
  lockedProfessionalId,
  onClose,
  onAtualizar,
}) => {
  const agendaRepo = useAgenda();
  const { addToast } = useToast();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !appointment) return;
    if (appointment.start_time) {
      setDate(dateInZone(new Date(appointment.start_time), timezone));
      setTime(formatTimeInZone(appointment.start_time, timezone));
    } else {
      setDate(fallbackDate);
      setTime('09:00');
    }
    setProfessionalId(lockedProfessionalId || appointment.professional_id || professionals[0]?.id || '');
    // Reinicia o formulário só ao abrir ou ao trocar de Agendamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointment?.id]);

  const availableSlots = useMemo(() => {
    if (!date || !professionalId) return [];

    const dayBh = getDayBusinessHours(date, businessHours);
    if (!dayBh.active) return [];

    const prof = professionals.find((p) => p.id === professionalId);
    if (!prof) return [];
    const profSched = getEffectiveProfessionalDaySchedule(prof, date, businessHours);
    if (profSched?.active === false) return [];

    const segment = profSched ? toScheduleGridSegment(profSched) : null;
    const baseSlots = generateScheduleGridSlots(
      [segment || { start: dayBh.open || '08:00', end: dayBh.close || '20:00' }],
      slotIntervalMinutes
    );

    const durationMin = getEffectiveServiceDuration(
      appointment?.service?.duration_minutes || 30,
      appointment?.service?.id || '',
      prof.professional_services
    );

    return baseSlots.filter((slotTime) => {
      if (!isProfessionalWorkingAt(prof, date, slotTime, durationMin, businessHours)) return false;

      const slotStartIso = localDateTimeToIso(date, slotTime, timezone);
      const slotEndIso = new Date(new Date(slotStartIso).getTime() + durationMin * 60 * 1000).toISOString();

      // O próprio horário já ocupado pelo Agendamento continua livre para ele.
      const hasAppConflict = appointments.some((a) => {
        if (a.id === appointment?.id) return false;
        if (a.status === 'canceled') return false;
        if (a.professional_id !== professionalId) return false;
        return a.start_time < slotEndIso && a.end_time > slotStartIso;
      });
      if (hasAppConflict) return false;

      const hasBlockConflict = blockedSlots.some((b) => {
        if (b.professional_id && b.professional_id !== professionalId) return false;
        return b.start_time < slotEndIso && b.end_time > slotStartIso;
      });
      return !hasBlockConflict;
    });
  }, [date, professionalId, appointment, businessHours, timezone, professionals, slotIntervalMinutes, appointments, blockedSlots]);

  const handleConfirm = async () => {
    if (!appointment || !date || !time) {
      addToast('Selecione data e horário válidos para reagendar.', 'warning');
      return;
    }

    const dayBh = getDayBusinessHours(date, businessHours);
    if (!dayBh.active) {
      addToast('A barbearia não abre nesta data conforme as configurações.', 'warning');
      return;
    }
    if (time < dayBh.open || time >= dayBh.close) {
      addToast(`Horário fora do expediente da barbearia (${dayBh.open} às ${dayBh.close}).`, 'warning');
      return;
    }

    const professional = professionals.find((p) => p.id === professionalId);
    const duration = getEffectiveServiceDuration(
      appointment.service?.duration_minutes || 30,
      appointment.service?.id || '',
      professional?.professional_services
    );
    if (professional && !isProfessionalWorkingAt(professional, date, time, duration, businessHours)) {
      addToast(`O profissional ${professional.name} não atende neste horário.`, 'warning');
      return;
    }

    if (!tenantId) return;
    setSaving(true);
    try {
      const startTimeIso = localDateTimeToIso(date, time, timezone);

      // O fim é calculado no banco pela duração do profissional; conflito, Bloqueio de Horário,
      // expediente e escala também são conferidos lá.
      await agendaRepo.reagendar(tenantId, appointment.id, {
        startTimeIso,
        professionalId: professionalId || null,
      });

      addToast('Agendamento reagendado com sucesso!', 'success');
      onClose();
      onAtualizar();
    } catch (err: unknown) {
      console.error('Erro ao reagendar agendamento na agenda:', err);
      addToast(
        err instanceof Error && err.message ? err.message : 'Erro ao reagendar agendamento.',
        err instanceof AgendaOperationError ? 'warning' : 'error'
      );
      if (err instanceof AgendaOperationError && err.kind === 'regra') onAtualizar();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reagendar Atendimento">
      {appointment && (
        <div className="reschedule-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
            Reagendar horário de <strong>{appointment.customer?.name}</strong> para o serviço{' '}
            <strong>{appointment.service?.name}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nova data"
              id="agenda_reschedule_date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Select
              label="Novo horário"
              id="agenda_reschedule_time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            >
              <option value="">Selecione um horário livre...</option>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
              {availableSlots.length === 0 && (
                <option value="" disabled>
                  Nenhum horário livre nesta data
                </option>
              )}
            </Select>
          </div>

          <Select
            label="Profissional"
            id="agenda_reschedule_prof"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            disabled={Boolean(lockedProfessionalId)}
          >
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="flex justify-end items-center gap-3 mt-2 flex-wrap max-[480px]:flex-col-reverse max-[480px]:flex-nowrap max-[480px]:w-full [&>button]:max-[480px]:w-full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              className="bg-bg-secondary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] py-[0.6rem] px-5 rounded-md text-sm font-bold text-text-primary cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-black/[0.04]"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="bg-brand-primary text-bg-secondary border-none py-[0.6rem] px-6 rounded-md text-sm font-bold cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-brand-hover"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Confirmar Reagendamento'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
