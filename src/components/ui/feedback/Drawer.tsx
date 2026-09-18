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
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex justify-end animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'ui-drawer-title' : undefined}
    >
      <div
        className={`h-dvh bg-bg-secondary shadow-[-10px_0_40px_rgba(45,35,30,0.25)] flex flex-col box-border font-base animate-slide-in-right overflow-hidden ${className}`}
        style={{ width: resolvedWidth, ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0 gap-4">
          <div className="flex flex-col gap-[0.15rem] min-w-0">
            {title && (
              <h3 id="ui-drawer-title" className="m-0 text-base font-extrabold text-text-primary tracking-tight">
                {title}
              </h3>
            )}
            {description && <p className="m-0 text-xs text-text-secondary">{description}</p>}
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

        <div className="flex-1 overflow-y-auto p-6 box-border flex flex-col gap-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-border bg-bg-primary flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
