import React from 'react';
import { Modal } from '../Modal';
import { useMarcarNaoCompareceu, type ResultadoNaoCompareceu } from './useMarcarNaoCompareceu';
import type { Appointment } from '../../pages/gerente/Agenda';

interface NaoCompareceuModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  tenantId: string;
  onClose: () => void;
  /** Chamado depois de marcar, e também quando o banco recusou por regra (a tela deve recarregar). */
  onResultado: (appointmentId: string, resultado: ResultadoNaoCompareceu) => void;
}

/** Confirmação de "não compareceu". A Comanda aberta do Agendamento é cancelada pelo banco. */
export const NaoCompareceuModal: React.FC<NaoCompareceuModalProps> = ({
  isOpen,
  appointment,
  tenantId,
  onClose,
  onResultado,
}) => {
  const { marcar, saving } = useMarcarNaoCompareceu(tenantId);

  const handleConfirm = async () => {
    if (!appointment) return;
    const resultado = await marcar(appointment);
    if (resultado === 'erro') return;
    onClose();
    onResultado(appointment.id, resultado);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar não comparecimento">
      {appointment && (
        <div className="cancel-modal-body">
          <p className="text-sm text-text-primary leading-relaxed mb-4">
            Deseja marcar o atendimento de{' '}
            <strong>{appointment.customer?.name || 'Cliente'}</strong> como não compareceu?
            A comanda aberta vinculada será cancelada e nenhum novo pagamento será permitido.
          </p>
          <div className="flex justify-end items-center gap-3 mt-2 flex-wrap max-[480px]:flex-col-reverse max-[480px]:flex-nowrap max-[480px]:w-full [&>button]:max-[480px]:w-full">
            <button
              type="button"
              className="bg-bg-secondary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] py-[0.6rem] px-5 rounded-md text-sm font-bold text-text-primary cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-black/[0.04]"
              onClick={onClose}
              disabled={saving}
            >
              Não marcar
            </button>
            <button
              type="button"
              className="bg-error text-white border-none py-[0.6rem] px-6 rounded-md text-sm font-bold cursor-pointer min-h-11 box-border"
              onClick={() => void handleConfirm()}
              disabled={saving}
            >
              Sim, não compareceu
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
