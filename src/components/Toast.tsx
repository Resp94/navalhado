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
      <div style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 2000,
        pointerEvents: 'none',
        maxWidth: '360px',
        width: '100%'
      }}>
        {messages.map((msg) => (
          <ToastItem key={msg.id} toast={msg} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Componente para o item individual do Toast
const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <SuccessIcon size={20} style={{ color: 'var(--color-success)' }} />;
      case 'error':
        return <ErrorIcon size={20} style={{ color: 'var(--color-error)' }} />;
      case 'warning':
        return <WarningIcon size={20} style={{ color: 'var(--color-warning)' }} />;
      case 'info':
      default:
        return <InfoIcon size={20} style={{ color: 'var(--color-info)' }} />;
    }
  };

  const getStyle = () => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '1rem',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-md)',
      border: '1px solid',
      pointerEvents: 'auto',
      animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative',
      overflow: 'hidden'
    };

    switch (toast.type) {
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-success-bg)',
          borderColor: 'var(--color-success)',
          color: 'var(--color-text-primary)'
        };
      case 'error':
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-error-bg)',
          borderColor: 'var(--color-error)',
          color: 'var(--color-text-primary)'
        };
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-warning-bg)',
          borderColor: 'var(--color-warning)',
          color: 'var(--color-text-primary)'
        };
      case 'info':
      default:
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-info-bg)',
          borderColor: 'var(--color-info)',
          color: 'var(--color-text-primary)'
        };
    }
  };

  return (
    <div style={getStyle()}>
      {/* Ícone Semântico */}
      <div style={{ display: 'flex', marginTop: '0.125rem' }}>
        {getIcon()}
      </div>
      
      {/* Texto do Toast */}
      <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 500, lineHeight: 1.4, paddingRight: '1rem' }}>
        {toast.message}
      </div>

      {/* Botão de Fechar */}
      <button
        onClick={() => onClose(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.125rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          borderRadius: 'var(--radius-sm)',
          transition: 'color 0.2s ease',
          marginTop: '0.125rem'
        }}
        onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
        onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
      >
        <CloseIcon size={16} />
      </button>

      {/* Estilos locais de animação */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
