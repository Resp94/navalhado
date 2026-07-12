import React, { useState } from 'react';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from './Icons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: 'email' | 'lock';
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  type = 'text',
  error,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  // Renderiza o ícone esquerdo correspondente
  const renderLeftIcon = () => {
    if (icon === 'email') {
      return (
        <MailIcon 
          size={20} 
          style={{
            color: error 
              ? 'var(--color-error)' 
              : isFocused 
                ? 'var(--color-brand-primary)' 
                : 'var(--color-text-secondary)',
            transition: 'color 0.2s ease'
          }} 
        />
      );
    }
    if (icon === 'lock') {
      return (
        <LockIcon 
          size={20} 
          style={{
            color: error 
              ? 'var(--color-error)' 
              : isFocused 
                ? 'var(--color-brand-primary)' 
                : 'var(--color-text-secondary)',
            transition: 'color 0.2s ease'
          }} 
        />
      );
    }
    return null;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      width: '100%',
      textAlign: 'left'
    }}>
      <label style={{
        fontSize: 'var(--font-size-sm)',
        color: error ? 'var(--color-error)' : 'var(--color-text-primary)',
        fontWeight: 500,
        transition: 'color 0.2s ease'
      }}>
        {label}
      </label>
      
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%'
      }}>
        {icon && (
          <div style={{
            position: 'absolute',
            left: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            {renderLeftIcon()}
          </div>
        )}

        <input
          type={inputType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            paddingLeft: icon ? '2.5rem' : '1rem',
            paddingRight: isPassword ? '2.5rem' : '1rem',
            fontSize: 'var(--font-size-sm)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid',
            borderColor: error 
              ? 'var(--color-error)' 
              : isFocused 
                ? 'var(--color-brand-primary)' 
                : 'var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isFocused 
              ? '0 0 0 3px rgba(217, 108, 0, 0.15)' 
              : 'none'
          }}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '0.75rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem',
              color: 'var(--color-text-secondary)',
              transition: 'color 0.2s ease',
              outline: 'none'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-brand-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            {showPassword ? (
              <EyeOffIcon size={20} />
            ) : (
              <EyeIcon size={20} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
