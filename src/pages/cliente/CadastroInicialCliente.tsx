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
      setValidationError('Informe um nome entre 2 e 100 caracteres.');
      return;
    }
    setValidationError('');
    await onSubmit(normalizedName);
  };

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: '420px', padding: '2rem',
          border: '1px solid var(--color-border)', borderRadius: '24px',
          backgroundColor: 'var(--color-bg-secondary)', boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ color: 'var(--color-brand-primary)', fontWeight: 700 }}>{tenantName}</p>
        <h1>Antes de agendar</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Como podemos chamar você?</p>
        <label htmlFor="customer-first-name">Seu nome</label>
        <input
          id="customer-first-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          autoComplete="name"
        />
        {validationError && <p role="alert">{validationError}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>
    </main>
  );
};
