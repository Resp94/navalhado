import React, { createContext, useContext, useState, useCallback } from 'react';
import { ErrorIcon, SuccessIcon, InfoIcon, WarningIcon, CloseIcon } from './Icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextData {
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export const useToast = (): ToastContextData => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type, duration };

    setMessages((prevMessages) => [...prevMessages, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* Container de Toasts flutuantes */}
      <div className="fixed top-6 right-6 flex flex-col gap-3 z-[2000] pointer-events-none max-w-[360px] w-full">
        {messages.map((msg) => (
          <ToastItem key={msg.id} toast={msg} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Componente para o item individual do Toast
const TOAST_TYPE_CLASSES: Record<ToastType, string> = {
  success: 'bg-success-bg border-success text-text-primary',
  error: 'bg-error-bg border-error text-text-primary',
  warning: 'bg-warning-bg border-warning text-text-primary',
  info: 'bg-info-bg border-info text-text-primary',
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <SuccessIcon size={20} className="text-success" />;
      case 'error':
        return <ErrorIcon size={20} className="text-error" />;
      case 'warning':
        return <WarningIcon size={20} className="text-warning" />;
      case 'info':
      default:
        return <InfoIcon size={20} className="text-info" />;
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg shadow-md border pointer-events-auto animate-slide-in-right relative overflow-hidden ${TOAST_TYPE_CLASSES[toast.type]}`}
    >
      {/* Ícone Semântico */}
      <div className="flex mt-0.5">
        {getIcon()}
      </div>

      {/* Texto do Toast */}
      <div className="flex-1 text-sm font-medium leading-[1.4] pr-4">
        {toast.message}
      </div>

      {/* Botão de Fechar */}
      <button
        onClick={() => onClose(toast.id)}
        className="bg-none border-none cursor-pointer p-0.5 flex items-center justify-center text-text-secondary rounded-sm transition-colors duration-200 ease-in mt-0.5 hover:text-text-primary"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
};
