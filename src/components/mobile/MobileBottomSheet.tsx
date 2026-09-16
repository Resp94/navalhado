import React, { useEffect, useState } from 'react';
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
  // Controla a transição de entrada (slide-up) do painel: monta fora da tela
  // e, no frame seguinte, desliza para a posição final via transition-transform.
  const [slidIn, setSlidIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const raf = requestAnimationFrame(() => setSlidIn(true));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
      setSlidIn(false);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-[8px] z-[1000] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-[1001] bg-bg-secondary border-t border-border rounded-t-lg shadow-lg flex flex-col pb-[env(safe-area-inset-bottom,1rem)] touch-pan-y transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${slidIn ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Painel de Ações'}
      >
        {/* Alça de puxar (Drag Handle) */}
        <div className="w-full pt-2.5 pb-1.5 flex justify-center cursor-pointer group" onClick={onClose}>
          <div className="w-9 h-1 rounded-sm bg-border transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:bg-brand-primary" />
        </div>

        {/* Header se houver título */}
        {title && (
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-border">
            <h3 className="text-lg font-bold text-text-primary m-0 tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-text-secondary cursor-pointer p-2.5 min-w-11 min-h-11 rounded-md flex items-center justify-center transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] touch-manipulation hover:text-text-primary"
              aria-label="Fechar"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>
        )}

        {/* Conteúdo rolável */}
        <div className="p-5 overflow-y-auto [-webkit-overflow-scrolling:touch] flex-1">
          {children}
        </div>
      </div>
    </>
  );
};
