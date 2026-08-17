import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CadastroInicialCliente } from '../CadastroInicialCliente';

describe('CadastroInicialCliente Component', () => {
  it('renders initial form correctly with tenant name', () => {
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Barbearia Navalhado')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Digite seu nome e sobrenome/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar e continuar/i })).toBeInTheDocument();
  });

  it('blocks submission when single word is entered and shows friendly validation error', async () => {
    const handleSubmit = vi.fn();
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByPlaceholderText(/Digite seu nome e sobrenome/i);
    const submitBtn = screen.getByRole('button', { name: /Salvar e continuar/i });

    fireEvent.change(input, { target: { value: 'Jonathas' } });
    fireEvent.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Por favor, informe seu nome e sobrenome para agilizar seu atendimento.')
    ).toBeInTheDocument();
  });

  it('submits successfully when full name with first and last name is entered', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByPlaceholderText(/Digite seu nome e sobrenome/i);
    const submitBtn = screen.getByRole('button', { name: /Salvar e continuar/i });

    fireEvent.change(input, { target: { value: 'Jonathas Resplande' } });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith('Jonathas Resplande');
    expect(
      screen.queryByText('Por favor, informe seu nome e sobrenome para agilizar seu atendimento.')
    ).not.toBeInTheDocument();
  });
});

