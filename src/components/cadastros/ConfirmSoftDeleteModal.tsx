import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

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
  if (!isOpen) return null;

  const defaultWarning =
    'O histórico de agendamentos, atendimentos e comandas passadas será 100% preservado nos relatórios, mas este item não estará mais disponível para novos agendamentos.';

  return (
    <div
      className="service-delete-modal-overlay"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-soft-delete-title"
    >
      <div
        className="service-delete-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="service-delete-icon-badge">
          <HugeiconsIcon icon={Delete02Icon} size={24} />
        </div>
        <h3 id="modal-soft-delete-title" className="service-delete-title">
          {title}
        </h3>
        <p className="service-delete-text">
          Deseja realmente excluir {itemTypeLabel} <strong>{itemName}</strong>?
        </p>
        <div className="service-delete-warning-box">
          <p>{warningText || defaultWarning}</p>
        </div>
        <div className="service-delete-actions">
          <button
            type="button"
            className="btn btn--outline-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--danger-delete"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Excluindo...' : 'Sim, excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};
