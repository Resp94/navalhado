import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNavigate, estado } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  estado: { pathname: '/admin/dashboard' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: estado.pathname }),
}));

import { CabecalhoDoAdmin } from '../CabecalhoDoAdmin';

describe('CabecalhoDoAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.pathname = '/admin/dashboard';
  });

  it('mostra o logo, as duas abas, o nome com o papel e o Sair', () => {
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={vi.fn()} />);

    expect(screen.getByAltText('Navalhado')).toBeInTheDocument();
    const abas = within(screen.getByRole('navigation', { name: 'Navegação do Admin' }));
    expect(abas.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(abas.getByRole('button', { name: 'Barbearias' })).toBeInTheDocument();
    expect(screen.getByText('João Admin')).toBeInTheDocument();
    expect(screen.getByText('Proprietário')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('marca a aba da página atual: o Dashboard em /admin/dashboard', () => {
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Barbearias' })).not.toHaveAttribute('aria-current');
  });

  it('marca a aba da página atual: Barbearias em /admin/tenants', () => {
    estado.pathname = '/admin/tenants';
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Barbearias' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('clicar na outra aba navega para ela', async () => {
    const user = userEvent.setup();
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Barbearias' }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/tenants');
  });

  it('o logo leva ao Dashboard', async () => {
    const user = userEvent.setup();
    estado.pathname = '/admin/tenants';
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={vi.fn()} />);

    await user.click(screen.getByAltText('Navalhado'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('Sair chama a saída recebida', async () => {
    const user = userEvent.setup();
    const aoSair = vi.fn();
    render(<CabecalhoDoAdmin nomeDoAdmin="João Admin" aoSair={aoSair} />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(aoSair).toHaveBeenCalledTimes(1);
  });
});
