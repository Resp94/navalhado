import React from 'react';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';

export interface ConfirmSoftDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  itemTypeLabel: string;
  warningText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmSoftDeleteModal: React.FC<ConfirmSoftDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  itemTypeLabel,
  warningText,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const defaultWarning =
    'O histórico de agendamentos, atendimentos e comandas passadas será 100% preservado nos relatórios, mas este item não estará mais disponível para novos agendamentos.';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={
        <span>
          Deseja realmente excluir {itemTypeLabel} <strong>{itemName}</strong>?
        </span>
      }
      warningText={warningText || defaultWarning}
      confirmText={loading ? 'Excluindo...' : 'Sim, excluir'}
      cancelText="Cancelar"
      variant="danger"
      loading={loading}
    />
  );
};
