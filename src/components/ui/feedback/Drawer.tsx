import React, { useEffect } from 'react';
import { IconButton } from '../forms/IconButton';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'min(92vw, 500px)',
  className = '',
  style,
}) => {
  const resolvedWidth = typeof width === 'number' ? `${width}px` : width;
  // Tratar tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Travar scroll do body enquanto aberto
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="ui-drawer-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-drawer-title' : undefined}
      >
        <div
          className={`ui-drawer-panel ${className}`}
          style={{ width: resolvedWidth, ...style }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ui-drawer-header">
            <div className="ui-drawer-title-group">
              {title && (
                <h3 id="ui-drawer-title" className="ui-drawer-title">
                  {title}
                </h3>
              )}
              {description && <p className="ui-drawer-desc">{description}</p>}
            </div>

            <IconButton
              aria-label="Fechar painel"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </div>

          <div className="ui-drawer-body">{children}</div>

          {footer && <div className="ui-drawer-footer">{footer}</div>}
        </div>
      </div>

      <style>{`
        .ui-drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          justify-content: flex-end;
          animation: uiDrawerFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ui-drawer-panel {
          height: 100vh;
          height: 100dvh;
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          animation: uiDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .dark-theme .ui-drawer-panel {
          background-color: var(--color-bg-secondary, #1E1B18);
          border-left: 1px solid var(--color-border, #332D29);
        }

        .ui-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #EADED6);
          flex-shrink: 0;
          gap: 1rem;
        }

        .dark-theme .ui-drawer-header {
          border-bottom-color: var(--color-border, #332D29);
        }

        .ui-drawer-title-group {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }

        .ui-drawer-title {
          margin: 0;
          font-size: var(--font-size-base, 1rem);
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          letter-spacing: -0.01em;
        }

        .dark-theme .ui-drawer-title {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-drawer-desc {
          margin: 0;
          font-size: var(--font-size-xs, 0.75rem);
          color: var(--color-text-secondary, #70625B);
        }

        .ui-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .ui-drawer-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--color-border, #EADED6);
          background-color: var(--color-bg-primary, #FFF1E6);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .dark-theme .ui-drawer-footer {
          background-color: #14110F;
          border-top-color: var(--color-border, #332D29);
        }

        @keyframes uiDrawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes uiDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};
