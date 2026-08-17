import React, { useState } from 'react';
import type { FormEvent } from 'react';

interface CadastroInicialClienteProps {
  tenantName: string;
  saving: boolean;
  onSubmit(name: string): Promise<void>;
}

export const CadastroInicialCliente: React.FC<CadastroInicialClienteProps> = ({
  tenantName,
  saving,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setValidationError('Informe um nome com 2 a 100 caracteres.');
      return;
    }

    const words = normalizedName.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 2) {
      setValidationError('Por favor, informe seu nome e sobrenome para agilizar seu atendimento.');
      return;
    }

    setValidationError('');
    await onSubmit(normalizedName);
  };


  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        position: 'relative',
        background: `
          radial-gradient(ellipse 80% 60% at 50% 18%, rgba(217, 108, 0, 0.08) 0%, transparent 72%),
          radial-gradient(ellipse 120% 80% at 80% 85%, rgba(217, 108, 0, 0.04) 0%, transparent 60%),
          var(--color-bg-primary)
        `,
      }}
    >
      <div className="noise-overlay" />

      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'rgba(45, 35, 30, 0.04)',
          padding: '8px',
          borderRadius: '32px',
          border: '1px solid rgba(45, 35, 30, 0.06)',
          boxShadow: '0 24px 48px -20px rgba(45, 35, 30, 0.14)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            padding: '2.25rem',
            borderRadius: 'calc(32px - 8px)',
            backgroundColor: 'var(--color-bg-secondary)',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontWeight: 800,
                color: 'var(--color-brand-primary)',
                backgroundColor: 'var(--color-brand-lightest)',
                border: '1px solid rgba(217, 108, 0, 0.14)',
                borderRadius: '9999px',
                padding: '0.45rem 0.85rem',
              }}
            >
              {tenantName}
            </span>

            <div
              style={{
                backgroundColor: 'var(--color-brand-lightest)',
                color: 'var(--color-text-primary)',
                borderRadius: '24px',
                padding: '1.5rem',
                border: '1px solid rgba(217, 108, 0, 0.12)',
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.7)',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  fontWeight: 700,
                  color: 'var(--color-brand-primary)',
                  margin: '0 0 0.75rem 0',
                }}
              >
                Cadastro rápido
              </p>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  fontWeight: 800,
                }}
              >
                Como podemos chamar você?
              </h1>
              <p
                style={{
                  margin: '0.85rem 0 0 0',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 1.6,
                  color: 'var(--color-text-secondary)',
                  maxWidth: '28rem',
                }}
              >
                Seu nome fica salvo para os próximos agendamentos. Isso só aparece na
                sua primeira visita.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <label
              htmlFor="customer-first-name"
              style={{
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-text-secondary)',
              }}
            >
              Nome e Sobrenome
            </label>

            <div
              style={{
                backgroundColor: 'rgba(234, 222, 214, 0.22)',
                border: '1px solid var(--color-border)',
                borderRadius: '20px',
                padding: '6px',
              }}
            >
              <input
                id="customer-first-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
                autoComplete="name"
                placeholder="Digite seu nome e sobrenome"

                style={{
                  width: '100%',
                  border: '1px solid rgba(255, 255, 255, 0.72)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '14px',
                  padding: '1rem 1.1rem',
                  outline: 'none',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                }}
              />
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-sm)',
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
              }}
            >
              Depois disso, a agenda abre direto sem pedir novamente.
            </p>

            {validationError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: '0.85rem 1rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1px solid rgba(240, 82, 82, 0.18)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                }}
              >
                {validationError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf: 'stretch',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.95rem 1.25rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 800,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 14px 28px -18px rgba(217, 108, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <span>{saving ? 'Salvando...' : 'Salvar e continuar'}</span>
          </button>
        </form>
      </div>
    </main>
  );
};
