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
      const prevBodyOverflow = document.body.style.overflow;
      const prevDocOverflow = document.documentElement.style.overflow;
      const prevTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';

      // Prevenir gestos de pinça no Safari iOS exclusivamente quando o modal estiver aberto
      const preventGesture = (e: Event) => {
        e.preventDefault();
      };

      const preventMultiTouch = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };

      window.addEventListener('gesturestart', preventGesture, { passive: false });
      window.addEventListener('gesturechange', preventGesture, { passive: false });
      window.addEventListener('gestureend', preventGesture, { passive: false });
      window.addEventListener('touchmove', preventMultiTouch, { passive: false });

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.touchAction = prevTouchAction;
        document.documentElement.style.overflow = prevDocOverflow;

        window.removeEventListener('gesturestart', preventGesture);
        window.removeEventListener('gesturechange', preventGesture);
        window.removeEventListener('gestureend', preventGesture);
        window.removeEventListener('touchmove', preventMultiTouch);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Double-Bezel: outer shell */}
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
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
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          background-color: rgba(20, 17, 15, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          touch-action: none;
          overscroll-behavior: contain;
          animation: fadeIn 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .modal-shell {
          width: 100%;
          max-width: min(92vw, 540px);
          max-height: calc(100vh - 2rem);
          max-height: calc(100dvh - 2rem);
          display: flex;
          flex-direction: column;
          padding: 0;
          border-radius: var(--radius-lg, 16px);
          background: transparent;
          box-shadow: 0 16px 48px -8px rgba(20, 17, 15, 0.28);
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
          box-sizing: border-box;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }

        .modal-card {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg, 16px);
          width: 100%;
          max-height: 100%;
          min-width: 0;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          box-shadow: none;
          overflow: hidden;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem 1rem;
          border-bottom: 1px solid var(--color-text-primary);
          flex-shrink: 0;
          user-select: none;
          -webkit-user-select: none;
        }

        .modal-header__title {
          font-size: var(--font-size-lg);
          color: var(--color-text-primary);
          font-weight: 700;
          margin: 0;
        }

        .modal-header__close {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-full);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-primary);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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
          padding: 1.25rem 1.5rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
          max-height: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .modal-shell {
            max-width: 100%;
            max-height: 90vh;
            max-height: 90dvh;
            border-radius: 20px 20px 0 0;
            padding: 0;
            margin: 0;
            background: transparent;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
            animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .modal-card {
            border-radius: 20px 20px 0 0;
            border-bottom: none;
            max-height: 90dvh;
            padding-bottom: env(safe-area-inset-bottom, 1rem);
          }

          .modal-header {
            padding: 1.15rem 1.25rem 0.85rem;
            border-bottom: 1px solid var(--color-text-primary);
          }

          .modal-body {
            padding: 1rem 1.25rem 1.25rem;
            overflow-x: hidden;
          }
        }

        @keyframes slideUpMobile {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
