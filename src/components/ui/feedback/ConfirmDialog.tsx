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

const ICON_BADGE_CLASSES: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  danger: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
};

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
    <div
      className="fixed inset-0 z-[1100] bg-black/65 backdrop-blur-md flex items-center justify-center p-5 box-border animate-fade-in"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-confirm-title"
    >
      <div
        className="w-full max-w-[440px] bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary),0_20px_48px_rgba(45,35,30,0.25)] rounded-xl p-7 flex flex-col items-center text-center gap-4 box-border font-base animate-dialog-in max-[480px]:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`w-13 h-13 rounded-full flex items-center justify-center shrink-0 bg-transparent ${ICON_BADGE_CLASSES[variant]}`}>
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

        <h3 id="ui-confirm-title" className="text-[1.15rem] font-extrabold text-text-primary m-0 tracking-tight">
          {title}
        </h3>

        <div className="text-sm text-text-primary leading-relaxed m-0 [&_span]:text-text-primary [&_strong]:text-text-primary">
          {description}
        </div>

        {warningText && (
          <div className="bg-brand-lightest shadow-[0_0_0_0.3px_var(--color-text-primary)] rounded-md p-[0.85rem] text-xs text-text-primary text-left leading-relaxed w-full box-border">
            <p className="m-0 text-text-primary">{warningText}</p>
          </div>
        )}

        <div className="flex w-full gap-3 mt-2 max-[480px]:flex-col-reverse">
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
  );
};
