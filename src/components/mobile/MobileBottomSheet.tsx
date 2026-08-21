import React, { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="bottom-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div 
        className="bottom-sheet-panel" 
        style={{ maxHeight }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Painel de Ações'}
      >
        {/* Alça de puxar (Drag Handle) */}
        <div className="bottom-sheet-handle-container" onClick={onClose}>
          <div className="bottom-sheet-handle" />
        </div>

        {/* Header se houver título */}
        {title && (
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">{title}</h3>
            <button 
              type="button" 
              onClick={onClose} 
              className="bottom-sheet-close"
              aria-label="Fechar"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>
        )}

        {/* Conteúdo rolável */}
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>

      <style>{`
        .bottom-sheet-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
          animation: bottomSheetFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .bottom-sheet-panel {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1001;
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
          box-shadow: var(--shadow-lg, 0 -10px 40px rgba(0, 0, 0, 0.6));
          display: flex;
          flex-direction: column;
          padding-bottom: env(safe-area-inset-bottom, 1rem);
          animation: bottomSheetSlideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
          touch-action: pan-y;
        }

        .bottom-sheet-handle-container {
          width: 100%;
          padding: 10px 0 6px;
          display: flex;
          justify-content: center;
          cursor: pointer;
        }

        .bottom-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: var(--radius-sm, 2px);
          background: var(--color-border);
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .bottom-sheet-handle-container:hover .bottom-sheet-handle {
          background: var(--color-brand-primary);
        }

        .bottom-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1.25rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .bottom-sheet-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .bottom-sheet-close {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 10px;
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-md, 8px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }

        .bottom-sheet-close:hover {
          color: var(--color-text-primary);
        }

        .bottom-sheet-content {
          padding: 1.25rem;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          flex: 1;
        }

        @keyframes bottomSheetFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bottomSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};
