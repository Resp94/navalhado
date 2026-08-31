import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import type { AgendamentoCanal } from '../../modules/canal-cliente/types';

export interface ModalCancelamentoAgendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AgendamentoCanal | null;
  cancelReason: string;
  onChangeReason: (reason: string) => void;
  onConfirmCancel: () => Promise<void>;
  canceling: boolean;
}

export const ModalCancelamentoAgendamento: React.FC<ModalCancelamentoAgendamentoProps> = ({
  isOpen,
  onClose,
  appointment,
  cancelReason,
  onChangeReason,
  onConfirmCancel,
  canceling,
}) => {
  if (!isOpen || !appointment) return null;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${weekdays[date.getDay()]}, ${d}/${m} às ${hours}:${minutes}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-xs text-center">
      <div className="w-full max-w-[390px] bg-white rounded-3xl border border-[#EADED6] p-6 shadow-2xl relative">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={canceling}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer disabled:opacity-50"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Ícone de Alerta */}
        <div className="w-12 h-12 rounded-full bg-[#FDE8E8] text-[#F05252] flex items-center justify-center mx-auto mb-3">
          <HugeiconsIcon icon={AlertCircleIcon} size={24} strokeWidth={2.5} />
        </div>

        <h2 className="text-base font-extrabold text-[#2D231E] m-0 tracking-tight">
          Deseja cancelar seu horário?
        </h2>

        <p className="text-xs text-[#70625B] mt-1.5 mb-4 leading-relaxed">
          Seu horário para <strong>{appointment.service_name}</strong> na{' '}
          <strong>{formatDateTime(appointment.start_time)}</strong> será liberado para outros clientes.
        </p>

        {/* Campo de Motivo Opcional */}
        <div className="text-left mb-5">
          <label className="block text-[11px] font-bold text-[#70625B] uppercase tracking-wider mb-1">
            Motivo do cancelamento (opcional):
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Ex: Tive um imprevisto de horário"
            disabled={canceling}
            className="w-full py-2.5 px-3.5 rounded-xl border border-[#EADED6] focus:border-[#D96C00] focus:outline-hidden text-xs font-medium text-[#2D231E] bg-[#FFF1E6]/40 transition-colors disabled:bg-gray-100"
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmCancel}
            disabled={canceling}
            className="w-full py-3 px-4 rounded-full text-xs font-extrabold bg-[#F05252] hover:bg-[#C81E1E] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {canceling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cancelando...</span>
              </>
            ) : (
              <span>Sim, confirmar cancelamento</span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={canceling}
            className="w-full py-3 px-4 rounded-full text-xs font-bold bg-white hover:bg-[#FFF1E6] text-[#2D231E] border border-[#EADED6] transition-colors cursor-pointer disabled:opacity-50"
          >
            Não, manter meu agendamento
          </button>
        </div>
      </div>
    </div>
  );
};
