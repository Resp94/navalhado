import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar02Icon,
  Time01Icon,
  UserIcon,
  RefreshIcon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import type { AgendamentoCanal } from '../../modules/canal-cliente/types';

export interface CardAgendamentoAtivoProps {
  appointment: AgendamentoCanal;
  onReschedule: (appointment: AgendamentoCanal) => void;
  onCancel: (appointmentId: string) => void;
}

export const CardAgendamentoAtivo: React.FC<CardAgendamentoAtivoProps> = ({
  appointment,
  onReschedule,
  onCancel,
}) => {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return {
      weekday: weekdays[date.getDay()],
      dateFormatted: `${d}/${m}`,
      timeFormatted: `${hours}:${minutes}`,
    };
  };

  const dt = formatDateTime(appointment.start_time);
  const formattedPrice = Number(appointment.service_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div className="card-agendamento-ativo">
      {/* Topo do Card */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
            {appointment.service_name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#70625B' }}>
            <HugeiconsIcon icon={UserIcon} size={13} />
            <span>{appointment.professional_name || 'Qualquer profissional'}</span>
          </div>
        </div>

        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#D96C00' }}>
          {formattedPrice}
        </span>
      </div>

      {/* Box com Data e Hora */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', backgroundColor: '#FFF1E6', border: '1px solid #EADED6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: '#2D231E' }}>
          <HugeiconsIcon icon={Calendar02Icon} size={15} style={{ color: '#D96C00' }} />
          <span>{dt.weekday}, {dt.dateFormatted}</span>
        </div>
        <span style={{ color: '#70625B', opacity: 0.5 }}>•</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: '#2D231E' }}>
          <HugeiconsIcon icon={Time01Icon} size={15} style={{ color: '#D96C00' }} />
          <span>{dt.timeFormatted} ({appointment.service_duration} min)</span>
        </div>
      </div>

      {/* Ações */}
      <div className="card-agendamento-ativo__actions">
        <button
          type="button"
          onClick={() => onReschedule(appointment)}
          className="btn-action-remarcar"
        >
          <HugeiconsIcon icon={RefreshIcon} size={14} />
          <span>Remarcar</span>
        </button>

        <button
          type="button"
          onClick={() => onCancel(appointment.appointment_id)}
          className="btn-action-cancelar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          <span>Cancelar</span>
        </button>
      </div>
    </div>
  );
};
