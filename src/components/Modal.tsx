import React, { useEffect } from 'react';
import { CloseIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      {/* Double-Bezel: outer shell */}
      <div className="modal-shell">
        {/* Inner core */}
        <div className="modal-card">
          {/* Header */}
          <div className="modal-header">
            <h3 className="modal-header__title">{title}</h3>
            <button
              onClick={onClose}
              className="modal-header__close"
              aria-label="Fechar"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="modal-body">
            {children}
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .modal-shell {
          width: 100%;
          max-width: 440px;
          padding: 4px;
          border-radius: calc(var(--radius-lg) + 4px);
          background: rgba(20, 17, 15, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            0 8px 32px rgba(20, 17, 15, 0.25);
          animation: springUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
        }

        .modal-card {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          width: 100%;
          display: flex;
          flex-direction: column;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            var(--shadow-lg);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem 0;
        }

        .modal-header__title {
          font-size: var(--font-size-lg);
          color: var(--color-text-primary);
          font-weight: 600;
          margin: 0;
        }

        .modal-header__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: var(--radius-full);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          outline: none;
        }

        .modal-header__close:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .modal-header__close:focus-visible {
          box-shadow: 0 0 0 2px var(--color-error);
        }

        .modal-header__close:active {
          transform: scale(0.9);
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
      `}</style>
    </div>
  );
};
