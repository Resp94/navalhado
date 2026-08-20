import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/Toast';
import { Comandas } from '../Comandas';

// Mock do OutletContext
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      tenant: { id: 'tenant-123', name: 'Barbearia Navalha de Ouro' },
    }),
  };
});

describe('Comandas Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza título, abas de filtro e botão de nova comanda avulsa', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <Comandas />
        </BrowserRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Comandas & Atendimentos')).toBeInTheDocument();
    expect(screen.getByText('Nova Comanda Avulsa')).toBeInTheDocument();
    expect(screen.getByText('Abertas')).toBeInTheDocument();
    expect(screen.getByText('Pagas')).toBeInTheDocument();
    expect(screen.getByText('Todas')).toBeInTheDocument();
  });
});
