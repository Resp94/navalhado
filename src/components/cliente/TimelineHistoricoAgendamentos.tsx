import React, { useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  InformationCircleIcon,
  Calendar02Icon,
  UserIcon,
  Tick01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import type { AgendamentoCanal } from '../../modules/canal-cliente/types';

export interface TimelineHistoricoAgendamentosProps {
  appointments: AgendamentoCanal[];
}

export const TimelineHistoricoAgendamentos: React.FC<TimelineHistoricoAgendamentosProps> = ({
  appointments,
}) => {
  // Agrupa os agendamentos por Mês/Ano
  const groupedByMonth = useMemo(() => {
    const groups: { [key: string]: AgendamentoCanal[] } = {};
    const monthsNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    appointments.forEach((app) => {
      if (!app.start_time) return;
      const date = new Date(app.start_time);
      const monthYearKey = `${monthsNames[date.getMonth()]} de ${date.getFullYear()}`;

      if (!groups[monthYearKey]) {
        groups[monthYearKey] = [];
      }
      groups[monthYearKey].push(app);
    });

    return Object.entries(groups).map(([monthYear, items]) => ({
      monthYear,
      items: items.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    }));
  }, [appointments]);

  if (appointments.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-white rounded-2xl border border-[#EADED6]">
        <p className="text-xs font-semibold text-[#70625B] m-0">
          Nenhum agendamento anterior encontrado.
        </p>
      </div>
    );
  }

  const formatItemDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return {
      dayMonth: `${d}/${m}`,
      dayOfWeek: weekdays[date.getDay()],
      time: `${hours}:${minutes}`,
    };
  };

  return (
    <div className="w-full relative pl-6 flex flex-col gap-6">
      {/* Trilho Vertical Âmbar Contínuo */}
      <div className="absolute top-2 bottom-4 left-2.5 w-0.5 bg-[#D96C00]/60 rounded-full" />

      {groupedByMonth.map(({ monthYear, items }) => (
        <div key={monthYear} className="flex flex-col gap-4 relative">
          {/* Marcador de Mês */}
          <div className="flex items-center gap-2 -ml-6 z-10">
            <div className="w-3.5 h-3.5 rounded-full bg-[#D96C00] border-2 border-[#FFF1E6] shadow-xs" />
            <span className="text-xs font-bold text-[#2D231E]">
              {monthYear}
            </span>
          </div>

          {/* Lista de Atendimentos no Mês */}
          <div className="flex flex-col gap-3.5">
            {items.map((item) => {
              const { dayMonth, dayOfWeek, time } = formatItemDate(item.start_time);
              const formattedPrice = Number(item.service_price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });
              const isCompleted = item.status === 'completed';
              const isCanceled = item.status === 'canceled';

              return (
                <div key={item.appointment_id} className="relative flex flex-col gap-1">
                  {/* Ramificação de Data */}
                  <div className="flex items-center gap-2 text-xs font-bold text-[#D96C00]">
                    <span className="w-3 h-0.5 bg-[#D96C00]/60 -ml-4" />
                    <span>{dayMonth}</span>
                  </div>

                  {/* Card Double-Bezel do Histórico */}
                  <div className="w-full p-0.5 rounded-2xl bg-[#D96C00]/[0.04] border border-[#EADED6] shadow-xs">
                    <div className="w-full bg-white rounded-xl border border-[#EADED6] p-4 relative flex flex-col gap-1.5">
                      {/* Selo Flutuante de Conclusão / Cancelamento */}
                      <div className="absolute bottom-3 right-3">
                        {isCompleted ? (
                          <div className="w-7 h-7 rounded-full bg-[#0E9F6E] border-2 border-white shadow-sm flex items-center justify-center text-white" title="Concluído">
                            <HugeiconsIcon icon={Tick01Icon} size={15} strokeWidth={3} />
                          </div>
                        ) : isCanceled ? (
                          <div className="w-7 h-7 rounded-full bg-[#70625B] border-2 border-white shadow-sm flex items-center justify-center text-white" title="Cancelado">
                            <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={3} />
                          </div>
                        ) : null}
                      </div>

                      {/* Título do Serviço */}
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2D231E]">
                        <HugeiconsIcon icon={InformationCircleIcon} size={14} className="text-[#2D231E]" />
                        <span>{item.service_name}</span>
                      </div>

                      {/* Data e Hora */}
                      <div className="flex items-center gap-1.5 text-xs text-[#70625B]">
                        <HugeiconsIcon icon={Calendar02Icon} size={13} className="text-[#70625B]" />
                        <span>{dayOfWeek} {dayMonth} às {time}</span>
                      </div>

                      {/* Barbeiro e Valor */}
                      <div className="flex items-center gap-1.5 text-xs text-[#2D231E] font-medium">
                        <HugeiconsIcon icon={UserIcon} size={13} className="text-[#2D231E]" />
                        <span>Profissional: {item.professional_name || 'Profissional'}</span>
                      </div>

                      <div className="text-xs font-extrabold text-[#D96C00] pt-0.5">
                        Valor: {formattedPrice}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
