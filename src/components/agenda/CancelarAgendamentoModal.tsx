import React, { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { AgendaOperationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
import type { Appointment } from '../../pages/gerente/Agenda';

interface CancelarAgendamentoModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  tenantId: string;
  onClose: () => void;
  /** Chamado depois que o banco confirmou o cancelamento. */
  onCancelado: (appointmentId: string) => void;
}

/** Cancelar Agendamento com motivo. Quem pode cancelar é decidido pelo banco. */
export const CancelarAgendamentoModal: React.FC<CancelarAgendamentoModalProps> = ({
  isOpen,
  appointment,
  tenantId,
  onClose,
  onCancelado,
}) => {
  const agendaRepo = useAgenda();
  const { addToast } = useToast();
  const [reason, setReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen, appointment?.id]);

  const handleConfirm = async () => {
    if (!appointment || !tenantId) return;
    if (!reason.trim()) {
      addToast('Informe o motivo do cancelamento.', 'warning');
      return;
    }
    setCanceling(true);

    try {
      await agendaRepo.cancelar(tenantId, appointment.id, reason);
      addToast('Agendamento cancelado com sucesso.', 'success');
      onClose();
      onCancelado(appointment.id);
    } catch (err: unknown) {
      console.error('Erro ao cancelar agendamento:', err);
      addToast(err instanceof AgendaOperationError ? err.message : 'Erro ao cancelar agendamento.', 'error');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancelar Agendamento">
      {appointment && (
        <div className="cancel-modal-body">
          <p className="text-sm text-text-primary leading-relaxed mb-4">
            Deseja realmente cancelar o agendamento de{' '}
            <strong>{appointment.customer?.name}</strong> para o serviço{' '}
            <strong>{appointment.service?.name}</strong>?
          </p>

          <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
            <label htmlFor="cancel-reason">Motivo do Cancelamento</label>
            <textarea
              id="cancel-reason"
              rows={2}
              placeholder="Ex: Cliente solicitou reagendamento por telefone..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] resize-y min-h-[60px] max-h-40 leading-[1.4]"
            />
          </div>

          <div className="flex justify-end items-center gap-3 mt-2 flex-wrap max-[480px]:flex-col-reverse max-[480px]:flex-nowrap max-[480px]:w-full [&>button]:max-[480px]:w-full">
            <button
              type="button"
              className="bg-bg-secondary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] py-[0.6rem] px-5 rounded-md text-sm font-bold text-text-primary cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-black/[0.04]"
              onClick={onClose}
              disabled={canceling}
            >
              Não Cancelar
            </button>
            <button
              type="button"
              className="bg-error text-white border-none py-[0.6rem] px-6 rounded-md text-sm font-bold cursor-pointer min-h-11 box-border"
              onClick={handleConfirm}
              disabled={canceling || !reason.trim()}
            >
              {canceling ? 'Cancelando...' : 'Sim, Cancelar Horário'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
