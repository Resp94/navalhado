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
    <div
      className="fixed inset-0 h-dvh bg-[rgba(20,17,15,0.55)] flex items-center justify-center z-[1000] p-4 [touch-action:none] [overscroll-behavior:contain] animate-[fadeIn_0.25s_cubic-bezier(0.32,0.72,0,1)] max-md:items-end max-md:p-0"
      onClick={onClose}
    >
      {/* Double-Bezel: outer shell */}
      <div
        className="w-full max-w-[min(92vw,540px)] max-h-[calc(100dvh-2rem)] flex flex-col p-0 rounded-lg bg-transparent shadow-[0_16px_48px_-8px_rgba(20,17,15,0.28)] animate-[slideUp_0.25s_cubic-bezier(0.16,1,0.3,1)_both] box-border [touch-action:pan-y] [overscroll-behavior:contain] max-md:max-w-full max-md:max-h-[90dvh] max-md:rounded-t-[20px] max-md:p-0 max-md:m-0 max-md:bg-transparent max-md:shadow-[0_-10px_40px_rgba(0,0,0,0.4)] max-md:animate-[slideUpMobile_0.3s_cubic-bezier(0.16,1,0.3,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner core */}
        <div className="bg-bg-secondary rounded-lg w-full max-h-full min-w-0 box-border flex flex-col shadow-none overflow-hidden [touch-action:pan-y] [overscroll-behavior:contain] max-md:rounded-t-[20px] max-md:border-b-0 max-md:max-h-[90dvh] max-md:pb-[env(safe-area-inset-bottom,1rem)]">
          {/* Header */}
          <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-text-primary shrink-0 select-none max-md:px-5 max-md:pt-[1.15rem] max-md:pb-[0.85rem]">
            <h3 className="text-lg text-text-primary font-bold m-0">{title}</h3>
            <button
              onClick={onClose}
              className="flex items-center justify-center min-w-11 min-h-11 rounded-full bg-none border-none cursor-pointer text-text-primary transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] outline-none hover:bg-error-bg hover:text-error focus-visible:shadow-[0_0_0_2px_var(--color-error)] active:scale-90"
              aria-label="Fechar"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pt-5 pb-6 flex flex-col gap-4 overflow-y-auto [-webkit-overflow-scrolling:touch] [overscroll-behavior:contain] [touch-action:pan-y] max-h-full min-w-0 box-border max-md:px-5 max-md:pt-4 max-md:pb-5 max-md:overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
