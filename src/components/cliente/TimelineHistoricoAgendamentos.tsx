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
      <div className="text-center py-10 px-4 bg-white rounded-2xl border border-border">
        <p className="text-xs font-semibold text-text-secondary m-0">
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
    <div className="relative pl-14 flex flex-col gap-4">
      <div className="absolute left-8 top-8 bottom-3 w-0.5 bg-border" />

      {monthGroups.map(([month, monthAppointments]) => (
        <section key={month} className="flex flex-col gap-1">
          <h3 className="m-0 mb-1 text-text-primary text-[0.8125rem] font-extrabold">{month}</h3>

          {monthAppointments.map((app) => {
            const isCompleted = app.status === 'completed' || app.status === 'confirmed';
            const formattedPrice = Number(app.service_price || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            return (
              <div key={app.appointment_id} className="relative pt-5">
                <span className="absolute -left-14 top-0 text-brand-primary text-[0.6875rem] font-extrabold">
                  {formatDayMonth(app.start_time)}
                </span>

                <div
                  className={`absolute -left-8 top-6 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[0.5625rem] ${
                    isCompleted ? 'bg-success text-white' : 'bg-text-secondary text-white'
                  }`}
                >
                  {isCompleted ? (
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} />
                  ) : (
                    <HugeiconsIcon icon={CancelCircleIcon} size={10} />
                  )}
                </div>

                <article className="bg-white rounded-2xl border border-border p-4 shadow-[0_1px_3px_rgba(45,35,30,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[0.8125rem] font-extrabold text-text-primary m-0">
                      {app.service_name}
                    </h4>
                    <span className="text-[0.8125rem] font-extrabold text-brand-primary">
                      {formattedPrice}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[0.6875rem] text-text-secondary">
                    <span>{app.professional_name || 'Profissional'}</span>
                    <span>{formatTime(app.start_time)}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className={`text-[0.625rem] font-bold py-0.5 px-2 rounded-full ${
                        isCompleted ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
                      }`}
                    >
                      {isCompleted ? 'Finalizado' : 'Cancelado'}
                    </span>
                    {app.cancellation_reason && (
                      <span className="text-[0.625rem] text-text-secondary italic">
                        Motivo: {app.cancellation_reason}
                      </span>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};
