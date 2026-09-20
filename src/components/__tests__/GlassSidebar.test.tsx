import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GlassSidebar, type NavItemConfig } from '../GlassSidebar';
import { GERENTE_NAV_ITEMS } from '../gerenteNavItems';

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
  const defaultProps = {
    items: GERENTE_NAV_ITEMS,
    homePath: '/agenda',
    tenantName: 'Barbearia Navalha de Ouro',
    logoUrl: null,
    userName: 'Carlos Silva',
    userRole: 'Gerente' as const,
    notifications: [],
    unreadCount: 2,
    onMarkAllAsRead: vi.fn(),
    onMarkAsRead: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLocation.pathname = '/agenda';
  });

  it('renderiza o nome da barbearia e as rotas de navegação', () => {
    render(<GlassSidebar {...defaultProps} />);

    expect(screen.getByText('Barbearia Navalha de Ouro')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Comandas')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Equipe')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('lista exatamente as dez telas do gestor', () => {
    render(<GlassSidebar {...defaultProps} />);

    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('button')).toHaveLength(10);
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

  it('mantém o item Financeiro ativo em qualquer sub-rota de /financeiro', () => {
    mockLocation.pathname = '/financeiro/comissoes';

    render(<GlassSidebar {...defaultProps} />);

    const financeiroBtn = screen.getByRole('button', { name: /Financeiro/i, current: 'page' });
    expect(financeiroBtn).toHaveAttribute('aria-current', 'page');

    mockLocation.pathname = '/agenda';
  });

  it('clicar na logo leva ao caminho da tela inicial recebido', () => {
    render(<GlassSidebar {...defaultProps} homePath="/minha-agenda" />);

    fireEvent.click(screen.getByRole('button', { name: /Página inicial de Barbearia Navalha de Ouro/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/minha-agenda');
  });

  it('usa o papel recebido no rótulo da navegação e o nome do usuário no rodapé', () => {
    render(<GlassSidebar {...defaultProps} userRole="Barbeiro" userName="João" />);

    expect(screen.getByLabelText('Navegação Principal do Barbeiro')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
  });

  it('renderiza só os itens recebidos, sem vazar rotas de gerente', () => {
    const items: NavItemConfig[] = [
      { path: '/minha-agenda', label: 'Agenda', renderIcon: () => null },
      { path: '/minhas-comissoes', label: 'Comissões', renderIcon: () => null },
    ];
    render(<GlassSidebar {...defaultProps} items={items} />);

    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Comissões')).toBeInTheDocument();
    for (const vazado of ['Clientes', 'Equipe', 'Serviços', 'Produtos', 'Financeiro', 'Relatórios', 'WhatsApp', 'Ajustes']) {
      expect(screen.queryByText(vazado)).not.toBeInTheDocument();
    }
  });

  it('mantém o item ativo nas subrotas só quando marcado com matchPrefix', () => {
    mockLocation.pathname = '/financeiro/caixa';
    const { rerender } = render(<GlassSidebar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Financeiro/i })).toHaveAttribute('aria-current', 'page');

    const semPrefixo = GERENTE_NAV_ITEMS.map((i) => ({ ...i, matchPrefix: false }));
    rerender(<GlassSidebar {...defaultProps} items={semPrefixo} />);
    expect(screen.getByRole('button', { name: /Financeiro/i })).not.toHaveAttribute('aria-current');
  });

  it('restaura a preferência recolhida gravada ao montar', () => {
    localStorage.setItem('navalhado_sidebar_open', 'false');
    render(<GlassSidebar {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Expandir menu lateral/i })).toBeInTheDocument();
  });
});
