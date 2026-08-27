import React, { useEffect } from 'react';
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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

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

      <style>{`
        .service-delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          animation: softDeleteFadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .service-delete-modal-card {
          width: 100%;
          max-width: 440px;
          background: var(--color-bg-primary, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-lg, 16px);
          padding: 1.75rem;
          box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.25));
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
          box-sizing: border-box;
          animation: softDeleteCardSpring 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .service-delete-icon-badge {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .service-delete-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--color-text-primary, #111827);
          margin: 0;
        }

        .service-delete-text {
          font-size: var(--font-size-sm, 14px);
          color: var(--color-text-secondary, #4b5563);
          margin: 0;
          line-height: 1.5;
        }

        .service-delete-warning-box {
          background: rgba(217, 108, 0, 0.08);
          border: 1px solid rgba(217, 108, 0, 0.2);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: 12px;
          color: var(--color-text-secondary, #4b5563);
          text-align: left;
          line-height: 1.45;
          width: 100%;
          box-sizing: border-box;
        }

        .service-delete-actions {
          display: flex;
          width: 100%;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .service-delete-actions button {
          flex: 1;
          min-height: 44px;
          font-size: var(--font-size-sm, 14px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .btn--danger-delete {
          background: #ef4444;
          color: #ffffff;
          border: none;
          font-weight: 700;
          padding: 10px 16px;
          border-radius: var(--radius-md, 8px);
          transition: all 0.15s ease;
        }

        .btn--danger-delete:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn--danger-delete:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes softDeleteFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes softDeleteCardSpring {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @media (max-width: 480px) {
          .service-delete-modal-card {
            padding: 1.25rem;
          }
          .service-delete-actions {
            flex-direction: column-reverse;
          }
          .service-delete-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
