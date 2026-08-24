import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CadastroInicialCliente } from '../CadastroInicialCliente';

describe('CadastroInicialCliente Component', () => {
  it('renders initial form correctly with tenant name and fields', () => {
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Barbearia Navalhado')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: João/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: Silva/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\(11\) 99999-9999/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar e continuar/i })).toBeInTheDocument();
  });

  it('blocks submission when fields are incomplete and shows validation errors', async () => {
    const handleSubmit = vi.fn();
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Salvar e continuar/i });

    // Tentativa vazia
    fireEvent.click(submitBtn);
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Por favor, informe seu primeiro nome (mínimo 2 letras).')
    ).toBeInTheDocument();

    // Primeiro nome preenchido, falta sobrenome
    fireEvent.change(screen.getByPlaceholderText(/Ex: João/i), { target: { value: 'Jonathas' } });
    fireEvent.click(submitBtn);
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Por favor, informe seu sobrenome (mínimo 2 letras).')
    ).toBeInTheDocument();

    // Sobrenome preenchido, falta telefone
    fireEvent.change(screen.getByPlaceholderText(/Ex: Silva/i), { target: { value: 'Resplande' } });
    fireEvent.click(submitBtn);
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Por favor, informe um número de WhatsApp/celular válido com DDD.')
    ).toBeInTheDocument();
  });

  it('submits successfully when first name, last name and valid phone are entered', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CadastroInicialCliente
        tenantName="Barbearia Navalhado"
        saving={false}
        onSubmit={handleSubmit}
      />
    );

    const firstInput = screen.getByPlaceholderText(/Ex: João/i);
    const lastInput = screen.getByPlaceholderText(/Ex: Silva/i);
    const phoneInput = screen.getByPlaceholderText(/\(11\) 99999-9999/i);
    const submitBtn = screen.getByRole('button', { name: /Salvar e continuar/i });

    fireEvent.change(firstInput, { target: { value: 'Jonathas' } });
    fireEvent.change(lastInput, { target: { value: 'Resplande' } });
    fireEvent.change(phoneInput, { target: { value: '11999998888' } });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Jonathas Resplande',
      phone: '11999998888',
    });
  });
});

