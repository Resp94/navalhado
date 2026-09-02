import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GlassSidebar } from '../GlassSidebar';

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/agenda' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

describe('GlassSidebar Component', () => {
  const mockTenantInfo = {
    tenantId: 'tenant-1',
    tenantName: 'Barbearia Navalha de Ouro',
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    onboardingCompleted: true,
  };

  const defaultProps = {
    tenantInfo: mockTenantInfo,
    managerName: 'Carlos Silva',
    notifications: [],
    unreadCount: 2,
    onMarkAllAsRead: vi.fn(),
    onMarkAsRead: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renderiza o nome da barbearia e as rotas de navegação', () => {
    render(<GlassSidebar {...defaultProps} />);

    expect(screen.getByText('Barbearia Navalha de Ouro')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Equipe')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('navega para a rota correta ao clicar em um item de navegação', () => {
    render(<GlassSidebar {...defaultProps} />);

    const clientesBtn = screen.getByRole('button', { name: /Clientes/i });
    fireEvent.click(clientesBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/clientes');
  });

  it('aciona o callback de logout ao clicar no botão Sair', () => {
    render(<GlassSidebar {...defaultProps} />);

    const sairBtn = screen.getByRole('button', { name: /Sair da Conta/i });
    fireEvent.click(sairBtn);

    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('alterna o estado recolhido/expandido ao clicar no botão toggle', () => {
    render(<GlassSidebar {...defaultProps} />);

    const toggleBtn = screen.getByRole('button', { name: /Recolher menu lateral/i });
    fireEvent.click(toggleBtn);

    expect(localStorage.getItem('navalhado_sidebar_open')).toBe('false');
  });
});
