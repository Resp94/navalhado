import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNavigate, mockAddToast, mockListar, mockGetUser, mockSignOut } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAddToast: vi.fn(),
  mockListar: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/admin/tenants' }),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser(), signOut: () => mockSignOut() },
    from: (tabela: string) => {
      if (tabela === 'users') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: 'Dono do Navalhado' } }) }) }) };
      }
      const consulta: any = {
        or: () => consulta,
        order: () => mockListar(),
      };
      return { select: () => consulta };
    },
  },
}));

// A visão de detalhe e os avisos que falharam têm teste próprio; aqui interessa o que a lista faz com eles.
vi.mock('../../../components/admin/DetalhesDoTenant', () => ({
  DetalhesDoTenant: ({ tenantId, aoFechar, aoMudar }: { tenantId: string | null; aoFechar: () => void; aoMudar: () => void }) =>
    tenantId ? (
      <div data-testid="detalhes">
        <span>{`detalhes de ${tenantId}`}</span>
        <button onClick={aoMudar}>simular ação feita</button>
        <button onClick={aoFechar}>simular fechar</button>
      </div>
    ) : null,
}));
vi.mock('../../../components/admin/AvisosQueFalharam', () => ({
  AvisosQueFalharam: () => <div data-testid="avisos-que-falharam" />,
}));

import { Tenants } from '../Tenants';

const linha = (extra: Record<string, unknown>) => ({
  tenant_id: 'tenant-1',
  tenant_name: 'Barbearia Alpha',
  tenant_email: 'alpha@exemplo.com',
  tenant_phone: '92999990001',
  tenant_logo_url: null,
  tenant_created_at: '2026-01-10T15:30:00Z',
  plan_name: 'Máquina',
  plan_price: 89.9,
  subscription_status: 'active',
  subscription_end_date: '2026-11-01T12:00:00Z',
  whatsapp_status: 'connected',
  subscription_unblocked_until: null,
  tenant_timezone: 'America/Manaus',
  ...extra,
});

const LINHAS = [
  linha({}),
  linha({
    tenant_id: 'tenant-2',
    tenant_name: 'Barbearia Beta',
    subscription_status: 'blocked',
    subscription_unblocked_until: '2040-03-11T03:59:59.999+00:00',
  }),
  linha({ tenant_id: 'tenant-3', tenant_name: 'Barbearia Gama', subscription_status: 'blocked', subscription_unblocked_until: '2020-01-01T03:59:59.999+00:00' }),
  linha({ tenant_id: 'tenant-4', tenant_name: 'Barbearia Delta', subscription_status: null, plan_name: null, plan_price: null }),
];

const linhaDa = (nome: string) => screen.getByText(nome).closest('tr') as HTMLElement;

// Spec 052, ticket 15: Admin > Tenants. A lista mostra a situação de cada barbearia e abre a visão de detalhe, onde ficam as ações do
// Proprietário (funções do banco, com confirmação). A lista não escreve mais direto na assinatura.
describe('Admin > Tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } });
    mockSignOut.mockResolvedValue({ error: null });
    mockListar.mockResolvedValue({ data: LINHAS, error: null });
  });

  it('lista as barbearias com o plano e a situação da assinatura', async () => {
    render(<Tenants />);

    expect(await screen.findByText('Barbearia Alpha')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Alpha')).getByText('Máquina')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Alpha')).getByText('Ativa')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Beta')).getByText('Bloqueada')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Delta')).getByText('Sem assinatura')).toBeInTheDocument();
  });

  // Spec 054, ticket 01: o cabeçalho é o mesmo componente do Admin > Dashboard, com a aba da página atual marcada.
  it('usa o cabeçalho compartilhado do Admin, com a aba Barbearias marcada, e o Sair sai da conta', async () => {
    const user = userEvent.setup();
    render(<Tenants />);

    const abas = within(await screen.findByRole('navigation', { name: 'Navegação do Admin' }));
    expect(abas.getByRole('button', { name: 'Barbearias' })).toHaveAttribute('aria-current', 'page');
    expect(abas.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('Dono do Navalhado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  // Os quatro estados da Instância WhatsApp (CONTEXT.md): 'connecting' é o pareamento em andamento e 'hibernated', a sessão pausada.
  // A tela do Gerente os chama de "Pareando" e "Pausado"; o Proprietário lê os mesmos rótulos, e não "Desconectado" para tudo o que
  // não é conectado.
  it('mostra o estado do WhatsApp de cada barbearia com o mesmo rótulo da tela do Gerente', async () => {
    mockListar.mockResolvedValue({
      data: [
        linha({ tenant_id: 'w-1', tenant_name: 'Barbearia Conectada', whatsapp_status: 'connected' }),
        linha({ tenant_id: 'w-2', tenant_name: 'Barbearia Pareando', whatsapp_status: 'connecting' }),
        linha({ tenant_id: 'w-3', tenant_name: 'Barbearia Pausada', whatsapp_status: 'hibernated' }),
        linha({ tenant_id: 'w-4', tenant_name: 'Barbearia Desconectada', whatsapp_status: 'disconnected' }),
        linha({ tenant_id: 'w-5', tenant_name: 'Barbearia Sem Instancia', whatsapp_status: null }),
      ],
      error: null,
    });
    render(<Tenants />);
    await screen.findByText('Barbearia Conectada');

    expect(within(linhaDa('Barbearia Conectada')).getByText('Conectado')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Pareando')).getByText('Pareando')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Pausada')).getByText('Pausado')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Desconectada')).getByText('Desconectado')).toBeInTheDocument();
    expect(within(linhaDa('Barbearia Sem Instancia')).getByText('Desconectado')).toBeInTheDocument();
  });

  it('o selo de cada estado do WhatsApp tem uma classe de cor, e pareando e pausado não herdam a do desconectado', async () => {
    mockListar.mockResolvedValue({
      data: [
        linha({ tenant_id: 'w-2', tenant_name: 'Barbearia Pareando', whatsapp_status: 'connecting' }),
        linha({ tenant_id: 'w-3', tenant_name: 'Barbearia Pausada', whatsapp_status: 'hibernated' }),
        linha({ tenant_id: 'w-4', tenant_name: 'Barbearia Desconectada', whatsapp_status: 'disconnected' }),
      ],
      error: null,
    });
    render(<Tenants />);
    await screen.findByText('Barbearia Pareando');

    const classes = {
      pareando: within(linhaDa('Barbearia Pareando')).getByText('Pareando').className,
      pausado: within(linhaDa('Barbearia Pausada')).getByText('Pausado').className,
      desconectado: within(linhaDa('Barbearia Desconectada')).getByText('Desconectado').className,
    };

    // Um estado que o mapa de classes não conhece vira "undefined" no texto da classe.
    for (const classe of Object.values(classes)) expect(classe).not.toContain('undefined');
    expect(classes.pareando).not.toBe(classes.desconectado);
    expect(classes.pausado).not.toBe(classes.desconectado);
    expect(classes.pausado).not.toBe(classes.pareando);
  });

  it('a barbearia desbloqueada à mão mostra até que dia está liberada, no fuso dela', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Beta');

    // 03:59:59 UTC de 11/03 é o fim do dia 10 em Manaus.
    expect(within(linhaDa('Barbearia Beta')).getByText('Liberada até 10/03')).toBeInTheDocument();
  });

  it('um desbloqueio que já acabou, e a barbearia que nunca foi desbloqueada, não mostram data', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Gama');

    expect(within(linhaDa('Barbearia Gama')).queryByText(/liberada até/i)).not.toBeInTheDocument();
    expect(within(linhaDa('Barbearia Alpha')).queryByText(/liberada até/i)).not.toBeInTheDocument();
  });

  it('não oferece mais as mudanças diretas de situação: tudo passa pela visão de detalhe', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Alpha');

    for (const nome of ['Dar cortesia', 'Suspender', 'Bloquear']) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: 'Detalhes' })).toHaveLength(LINHAS.length);
  });

  it('"Detalhes" abre a visão de detalhe da barbearia da linha, e fechar a esconde', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Beta');
    expect(screen.queryByTestId('detalhes')).not.toBeInTheDocument();

    await userEvent.click(within(linhaDa('Barbearia Beta')).getByRole('button', { name: 'Detalhes' }));
    expect(screen.getByTestId('detalhes')).toHaveTextContent('detalhes de tenant-2');

    await userEvent.click(screen.getByRole('button', { name: 'simular fechar' }));
    expect(screen.queryByTestId('detalhes')).not.toBeInTheDocument();
  });

  it('depois de uma ação feita na visão de detalhe, a lista é lida de novo', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Alpha');
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

    await userEvent.click(within(linhaDa('Barbearia Alpha')).getByRole('button', { name: 'Detalhes' }));
    await userEvent.click(screen.getByRole('button', { name: 'simular ação feita' }));

    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
  });

  it('mostra os avisos por e-mail que falharam', async () => {
    render(<Tenants />);
    await screen.findByText('Barbearia Alpha');

    expect(screen.getByTestId('avisos-que-falharam')).toBeInTheDocument();
  });

  it('sem barbearias, diz isso', async () => {
    mockListar.mockResolvedValue({ data: [], error: null });
    render(<Tenants />);

    expect(await screen.findByText('Nenhuma barbearia encontrada')).toBeInTheDocument();
  });

  it('se a lista falha, avisa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockListar.mockResolvedValue({ data: null, error: new Error('falhou') });
    render(<Tenants />);

    await waitFor(() => expect(mockAddToast).toHaveBeenCalledWith('Erro ao listar barbearias parceiras.', 'error'));
  });
});
