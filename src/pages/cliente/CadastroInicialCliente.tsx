import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { maskPhone } from '../../lib/whatsapp';

interface CadastroInicialClienteProps {
  tenantName: string;
  saving: boolean;
  onSubmit(data: { name: string; phone: string }): Promise<void>;
}

export const CadastroInicialCliente: React.FC<CadastroInicialClienteProps> = ({
  tenantName,
  saving,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(maskPhone(e.target.value));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (cleanFirst.length < 2) {
      setValidationError('Por favor, informe seu primeiro nome (mínimo 2 letras).');
      return;
    }

    if (cleanLast.length < 2) {
      setValidationError('Por favor, informe seu sobrenome (mínimo 2 letras).');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setValidationError('Por favor, informe um número de WhatsApp/celular válido com DDD.');
      return;
    }

    const ddd = parseInt(phoneDigits.slice(0, 2), 10);
    if (ddd < 11 || ddd > 99) {
      setValidationError('O DDD informado é inválido. Digite um DDD brasileiro válido.');
      return;
    }

    setValidationError('');
    const fullName = `${cleanFirst} ${cleanLast}`;
    await onSubmit({ name: fullName, phone: phoneDigits });
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
                  fontSize: '1.875rem',
                  lineHeight: 1.1,
                  letterSpacing: '-0.04em',
                  fontWeight: 800,
                }}
              >
                Identificação do cliente
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
                Informe seus dados para receber as confirmações e lembretes do seu horário via WhatsApp.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Grid Nome e Sobrenome */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  htmlFor="customer-first-name"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '0.35rem',
                  }}
                >
                  Nome
                </label>
                <div
                  style={{
                    backgroundColor: 'rgba(234, 222, 214, 0.22)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    padding: '4px',
                  }}
                >
                  <input
                    id="customer-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    disabled={saving}
                    autoComplete="given-name"
                    placeholder="Ex: João"
                    style={{
                      width: '100%',
                      border: '1px solid rgba(255, 255, 255, 0.72)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      borderRadius: '12px',
                      padding: '0.85rem 0.95rem',
                      outline: 'none',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-last-name"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '0.35rem',
                  }}
                >
                  Sobrenome
                </label>
                <div
                  style={{
                    backgroundColor: 'rgba(234, 222, 214, 0.22)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    padding: '4px',
                  }}
                >
                  <input
                    id="customer-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    disabled={saving}
                    autoComplete="family-name"
                    placeholder="Ex: Silva"
                    style={{
                      width: '100%',
                      border: '1px solid rgba(255, 255, 255, 0.72)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      borderRadius: '12px',
                      padding: '0.85rem 0.95rem',
                      outline: 'none',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Campo de Telefone com DDD */}
            <div>
              <label
                htmlFor="customer-phone"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.35rem',
                }}
              >
                WhatsApp / Celular com DDD
              </label>
              <div
                style={{
                  backgroundColor: 'rgba(234, 222, 214, 0.22)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  padding: '4px',
                }}
              >
                <input
                  id="customer-phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  disabled={saving}
                  type="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  style={{
                    width: '100%',
                    border: '1px solid rgba(255, 255, 255, 0.72)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: '12px',
                    padding: '0.85rem 0.95rem',
                    outline: 'none',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xs)',
                lineHeight: 1.5,
                color: 'var(--color-text-secondary)',
              }}
            >
              Seus dados serão salvos para seus próximos agendamentos nesta barbearia.
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
