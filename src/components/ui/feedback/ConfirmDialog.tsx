import React, { useEffect } from 'react';
import { Button } from '../forms/Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  warningText?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warningText,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
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

  return (
    <>
      <div
        className="ui-confirm-overlay"
        onClick={() => !loading && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-title"
      >
        <div className="ui-confirm-card" onClick={(e) => e.stopPropagation()}>
          <div className={`ui-confirm-icon-badge ui-confirm-icon-badge--${variant}`}>
            {variant === 'danger' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            )}
            {variant === 'warning' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {variant === 'info' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </div>

          <h3 id="ui-confirm-title" className="ui-confirm-title">
            {title}
          </h3>

          <div className="ui-confirm-desc">{description}</div>

          {warningText && (
            <div className="ui-confirm-warning-box">
              <p>{warningText}</p>
            </div>
          )}

          <div className="ui-confirm-actions">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>

            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="md"
              fullWidth
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .ui-confirm-overlay {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          box-sizing: border-box;
          animation: uiConfirmFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ui-confirm-card {
          width: 100%;
          max-width: 440px;
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E), 0 20px 48px rgba(0, 0, 0, 0.25);
          border-radius: var(--radius-xl, 16px);
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          animation: uiConfirmSpring 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .dark-theme .ui-confirm-card {
          background-color: var(--color-bg-secondary, #1E1B18);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6), 0 20px 48px rgba(0, 0, 0, 0.6);
        }

        .ui-confirm-icon-badge {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ui-confirm-icon-badge--danger {
          background-color: var(--color-error-bg, #FDE8E8);
          color: var(--color-error, #F05252);
        }

        .ui-confirm-icon-badge--warning {
          background-color: var(--color-warning-bg, #FEF3C7);
          color: var(--color-warning, #D97706);
        }

        .ui-confirm-icon-badge--info {
          background-color: var(--color-info-bg, #EBF5FF);
          color: var(--color-info, #3F83F8);
        }

        .ui-confirm-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .dark-theme .ui-confirm-title {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-confirm-desc {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
          line-height: 1.45;
          margin: 0;
        }

        .ui-confirm-warning-box {
          background-color: var(--color-brand-lightest, #FFF1E6);
          border: 1px solid var(--color-brand-soft, #F2B277);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: 12px;
          color: var(--color-brand-deep, #6A2E00);
          text-align: left;
          line-height: 1.45;
          width: 100%;
          box-sizing: border-box;
        }

        .ui-confirm-warning-box p {
          margin: 0;
        }

        .ui-confirm-actions {
          display: flex;
          width: 100%;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        @keyframes uiConfirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes uiConfirmSpring {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @media (max-width: 480px) {
          .ui-confirm-card {
            padding: 1.25rem;
          }
          .ui-confirm-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </>
  );
};
