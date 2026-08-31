import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar02Icon,
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
  const formattedPrice = Number(appointment.service_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { dayOfWeek: '', fullDate: '', time: '' };
    const date = new Date(dateStr);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return {
      dayOfWeek: weekdays[date.getDay()],
      fullDate: `${d}/${m}`,
      time: `${hours}:${minutes}`,
    };
  };

  const { dayOfWeek, fullDate, time } = formatDateTime(appointment.start_time);

  return (
    <div className="w-full p-1 rounded-2xl bg-[#D96C00]/[0.05] border border-[#EADED6] shadow-xs">
      <div className="w-full bg-white rounded-xl border border-[#EADED6] p-4 flex flex-col gap-3">
        {/* Topo do Card: Badge de Status e Preço */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[11px] font-extrabold text-[#0E9F6E]">
            Confirmado
          </span>
          <span className="text-base font-extrabold text-[#D96C00]">
            {formattedPrice}
          </span>
        </div>

        {/* Título do Serviço */}
        <div>
          <h3 className="text-sm font-extrabold text-[#2D231E] m-0 tracking-tight">
            {appointment.service_name}
          </h3>
        </div>

        {/* Detalhes de Data e Barbeiro */}
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-[#70625B] font-medium">
            <HugeiconsIcon icon={Calendar02Icon} size={14} className="text-[#70625B]" />
            <span>
              {dayOfWeek}, {fullDate} às {time} ({appointment.service_duration} min)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[#2D231E] font-semibold">
            <HugeiconsIcon icon={UserIcon} size={14} className="text-[#2D231E]" />
            <span>Profissional: {appointment.professional_name || 'Qualquer livre'}</span>
          </div>
        </div>

        {/* Botões de Ação Direta: Remarcar e Cancelar */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onReschedule(appointment)}
            className="py-2.5 px-3 rounded-xl bg-[#D96C00] hover:bg-[#9C3F00] text-[#FFF1E6] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={2.5} />
            <span>Remarcar</span>
          </button>

          <button
            type="button"
            onClick={() => onCancel(appointment.appointment_id)}
            className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#FDE8E8]/40 border border-[#F05252] text-[#F05252] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.5} />
            <span>Cancelar</span>
          </button>
        </div>

        <p className="text-[11px] text-[#70625B] text-center m-0 pt-0.5">
          Você pode remarcar ou cancelar sem custo até 2h antes.
        </p>
      </div>
    </div>
  );
};
