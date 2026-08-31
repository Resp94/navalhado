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

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  };

  const formatDayMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const monthGroups = appointments.reduce<Array<[string, AgendamentoCanal[]]>>((groups, appointment) => {
    const monthKey = formatMonth(appointment.start_time);
    const currentGroup = groups.find(([key]) => key === monthKey);
    if (currentGroup) {
      currentGroup[1].push(appointment);
    } else {
      groups.push([monthKey, [appointment]]);
    }
    return groups;
  }, []);

  return (
    <div className="timeline-container">
      <div className="timeline-track-line" />

      {monthGroups.map(([month, monthAppointments]) => (
        <section key={month} className="timeline-month-group">
          <h3 className="timeline-month-label">{month}</h3>

          {monthAppointments.map((app) => {
            const isCompleted = app.status === 'completed' || app.status === 'confirmed';
            const formattedPrice = Number(app.service_price || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            return (
              <div key={app.appointment_id} className="timeline-entry">
                <span className="timeline-entry__date">{formatDayMonth(app.start_time)}</span>

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
                    <span>{formatTime(app.start_time)}</span>
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
        </section>
      ))}
    </div>
  );
};
