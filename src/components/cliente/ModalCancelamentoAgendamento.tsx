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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,17,15,0.6)] backdrop-blur-[4px] box-border">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-border p-6 shadow-[0_16px_48px_rgba(45,35,30,0.2)] relative box-border text-center">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={canceling}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Ícone de Alerta */}
        <div className="w-12 h-12 rounded-full bg-error-bg text-error flex items-center justify-center mx-auto mb-3">
          <HugeiconsIcon icon={AlertCircleIcon} size={24} strokeWidth={2.5} />
        </div>

        <h2 className="text-base font-extrabold text-text-primary m-0">
          Deseja cancelar seu horário?
        </h2>

        <p className="text-xs text-text-secondary mt-1.5 mb-4 leading-[1.4]">
          Seu horário para <strong>{appointment.service_name}</strong> na{' '}
          <strong>{formatDateTime(appointment.start_time)}</strong> será liberado para outros clientes.
        </p>

        {/* Campo de Motivo Opcional */}
        <div className="text-left mb-5">
          <label className="text-[0.6875rem] font-bold text-text-primary uppercase tracking-[0.05em]">
            Motivo do cancelamento (opcional):
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Ex: Tive um imprevisto de horário"
            disabled={canceling}
            className="w-full py-[0.625rem] px-[0.875rem] rounded-xl border border-border text-xs font-semibold text-text-primary bg-[rgba(255,241,230,0.4)] transition-colors duration-200 box-border focus:border-brand-primary focus:outline-none"
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmCancel}
            disabled={canceling}
            className="w-full py-3 px-4 rounded-full text-xs font-extrabold bg-error text-white border-none cursor-pointer flex items-center justify-center gap-2"
          >
            {canceling ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
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
            className="w-full py-3 px-4 rounded-full text-xs font-bold bg-white text-text-primary border border-border cursor-pointer"
          >
            Não, manter meu agendamento
          </button>
        </div>
      </div>
    </div>
  );
};
