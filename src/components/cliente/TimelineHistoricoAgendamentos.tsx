import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, CancelCircleIcon } from '@hugeicons/core-free-icons';
import type { AgendamentoCanal } from '../../modules/canal-cliente/types';

export interface TimelineHistoricoAgendamentosProps {
  appointments: AgendamentoCanal[];
}

export const TimelineHistoricoAgendamentos: React.FC<TimelineHistoricoAgendamentosProps> = ({
  appointments,
}) => {
  if (appointments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', backgroundColor: '#FFFFFF', borderRadius: '1rem', border: '1px solid #EADED6' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#70625B', margin: 0 }}>
          Você ainda não possui histórico de agendamentos anteriores.
        </p>
      </div>
    );
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${weekdays[date.getDay()]}, ${d}/${m} às ${hours}:${minutes}`;
  };

  return (
    <div className="timeline-container">
      <div className="timeline-track-line" />

      {appointments.map((app) => {
        const isCompleted = app.status === 'completed' || app.status === 'confirmed';
        const formattedPrice = Number(app.service_price || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });

        return (
          <div key={app.appointment_id} className="timeline-entry">
            {/* Ponto / Ícone na Linha */}
            <div
              className={`timeline-entry__dot ${
                isCompleted ? 'timeline-entry__dot--completed' : 'timeline-entry__dot--canceled'
              }`}
            >
              {isCompleted ? (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} />
              ) : (
                <HugeiconsIcon icon={CancelCircleIcon} size={10} />
              )}
            </div>

            {/* Conteúdo do Card */}
            <div className="timeline-entry__card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
                  {app.service_name}
                </h4>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#D96C00' }}>
                  {formattedPrice}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.6875rem', color: '#70625B' }}>
                <span>{app.professional_name || 'Profissional'}</span>
                <span>{formatDateTime(app.start_time)}</span>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: isCompleted ? '#E6F4EA' : '#FDE8E8',
                    color: isCompleted ? '#0E9F6E' : '#F05252',
                  }}
                >
                  {isCompleted ? 'Finalizado' : 'Cancelado'}
                </span>
                {app.cancellation_reason && (
                  <span style={{ fontSize: '0.625rem', color: '#70625B', fontStyle: 'italic' }}>
                    Motivo: {app.cancellation_reason}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
