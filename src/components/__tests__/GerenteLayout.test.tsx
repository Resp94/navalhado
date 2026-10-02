import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GerenteLayout } from '../GerenteLayout';
import { VERSAO_ATUAL_DOS_TERMOS } from '../../modules/termos/textos';

const {
  mockAddToast,
  mockNavigate,
  mockUseLocation,
  mockRpc,
  mockGerarArquivos,
  mockBaixarCsv,
  mockJaAceitouTermos,
  mockAceitarTermos,
  mockSignOut,
  contextosDoOutlet,
} = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn().mockReturnValue({ pathname: '/agenda' }),
  mockRpc: vi.fn(),
  mockGerarArquivos: vi.fn(),
  mockBaixarCsv: vi.fn(),
  mockJaAceitouTermos: vi.fn(),
  mockAceitarTermos: vi.fn(),
  mockSignOut: vi.fn(),
  // Cada contexto que o layout entregou ao Outlet, na ordem: dá para conferir a identidade do objeto e usar as funções dele.
  contextosDoOutlet: [] as any[],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
    Outlet: ({ context }: any) => {
      contextosDoOutlet.push(context);
      return (
        <div data-testid="outlet" data-context={JSON.stringify(context)}>
          Conteúdo Outlet
          {context?.recarregarEstadoDeAcesso && (
            <button onClick={() => context.recarregarEstadoDeAcesso()}>simular releitura do acesso</button>
          )}
        </div>
      );
    },
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

vi.mock('../Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
  }),
}));

// O fluxo de cancelar tem teste próprio (CancelarAssinatura.test); aqui só interessa que a tela de bloqueio o oferece e que o
// layout relê o Estado de Acesso depois dele.
vi.mock('../acesso/CancelarAssinatura', () => ({
  CancelarAssinatura: ({ onCancelada }: { onCancelada?: () => void }) => (
    <button onClick={onCancelada}>simular assinatura cancelada</button>
  ),
}));

// A leitura e o CSV da exportação têm teste próprio (módulo exportacao); aqui só interessa de qual barbearia, em qual fuso, o
// botão da tela de bloqueio pede os dados.
vi.mock('../../modules/exportacao/repositorio', () => ({
  exportacaoRepository: { gerarArquivos: (...args: unknown[]) => mockGerarArquivos(...args) },
}));
vi.mock('../../modules/relatorios/csv', () => ({ baixarCsv: (...args: unknown[]) => mockBaixarCsv(...args) }));

// A leitura e a gravação do aceite têm teste próprio (módulo termos); aqui só interessa o que o layout faz com a situação do aceite.
vi.mock('../../modules/termos/repositorio', () => ({
  termosRepository: {
    jaAceitou: (...args: unknown[]) => mockJaAceitouTermos(...args),
    aceitar: (...args: unknown[]) => mockAceitarTermos(...args),
  },
}));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      signOut: () => mockSignOut(),
    },
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

describe('GerenteLayout Gatekeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextosDoOutlet.length = 0;
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'gerente@test.local' } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ access: 'allowed', reason: 'active', relevant_date: null }], error: null });
    // Por padrão o Gerente já aceitou a versão atual dos termos: os testes do aceite (spec 052, ticket 16) mudam isto.
    mockJaAceitouTermos.mockResolvedValue(true);
    mockAceitarTermos.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('redireciona para /onboarding quando onboarding_completed for false e rota for /agenda', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/agenda' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: false,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('redireciona para /agenda quando onboarding_completed for true e usuário tentar acessar /onboarding', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/onboarding' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/agenda');
    });
  });

  it('renderiza o painel normalmente quando onboarding_completed for true em rota /agenda', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/agenda' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/onboarding');
  });

  // Spec 052, ticket 03: o porteiro lê o Estado de Acesso ao lado do redirecionamento
  // para o onboarding. O bloqueio do painel é no front; o banco continua entregando os
  // dados do Gerente para ele poder exportá-los.
  describe('porteiro do Estado de Acesso', () => {
    const painelDaBarbearia = (pathname: string, onboardingCompleted = true, search = '', timezone = 'America/Sao_Paulo') => {
      mockUseLocation.mockReturnValue({ pathname, search });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'tenant-123',
                    name: 'Barbearia Navalhado',
                    logo_url: null,
                    timezone,
                    onboarding_completed: onboardingCompleted,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });
    };

    const estadoDoBanco = (access: string, reason: string, relevantDate: string | null = null) =>
      mockRpc.mockResolvedValue({ data: [{ access, reason, relevant_date: relevantDate }], error: null });

    it('bloqueado: mostra só a tela de bloqueio, com o motivo e o Pagar', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pagar' })).toBeEnabled();
      expect(screen.getByText('Barbearia Navalhado')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Spec 052, ticket 14: o bloqueio é do front, e o Gerente bloqueado continua lendo os próprios dados para exportá-los.
    it('bloqueado: o Gerente exporta os dados da própria barbearia, no fuso dela', async () => {
      painelDaBarbearia('/agenda', true, '', 'America/Manaus');
      estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');
      mockGerarArquivos.mockResolvedValue([{ nome: 'clientes_2026-10-01.csv', conteudo: 'conteudo' }]);

      render(<GerenteLayout />);
      await userEvent.click(await screen.findByRole('button', { name: 'Exportar dados' }));

      await waitFor(() => expect(mockBaixarCsv).toHaveBeenCalledWith('clientes_2026-10-01.csv', 'conteudo'));
      expect(mockGerarArquivos).toHaveBeenCalledWith('tenant-123', 'America/Manaus', { sinal: expect.any(AbortSignal) });
    });

    // Spec 052, ticket 05: o Mercado Pago devolve o Gerente em /configuracoes?assinatura=retorno.
    // Se o webhook ainda não chegou, a barbearia segue bloqueada e a tela avisa que confirma.
    it('bloqueado, voltando do Mercado Pago: avisa que o pagamento está sendo confirmado', async () => {
      painelDaBarbearia('/configuracoes', true, '?assinatura=retorno');
      estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent(/confirmando seu pagamento/i);
    });

    it('bloqueado, voltando do Mercado Pago: "Atualizar situação" relê o estado e libera o painel quando o webhook chegou', async () => {
      painelDaBarbearia('/configuracoes', true, '?assinatura=retorno');
      mockRpc
        .mockResolvedValueOnce({ data: [{ access: 'blocked', reason: 'trial_expired', relevant_date: null }], error: null })
        .mockResolvedValue({ data: [{ access: 'allowed', reason: 'active', relevant_date: null }], error: null });

      render(<GerenteLayout />);

      await userEvent.click(await screen.findByRole('button', { name: 'Atualizar situação' }));

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Seu período de teste terminou' })).not.toBeInTheDocument();
    });

    it('bloqueado: o onboarding também fica atrás da tela de bloqueio', async () => {
      painelDaBarbearia('/onboarding', false);
      estadoDoBanco('blocked', 'trial_expired');

      render(<GerenteLayout />);

      expect(await screen.findByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('bloqueado: o Gerente consegue sair da conta', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('blocked', 'payment_failed');

      render(<GerenteLayout />);

      expect(await screen.findByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
    });

    it('com aviso: mostra a faixa com os dias restantes e mantém o painel', async () => {
      painelDaBarbearia('/agenda');
      const fim = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
      estadoDoBanco('warning', 'trial', fim);

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('Seu período de teste termina em 2 dias.');
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    // Spec 052, ticket 07: a data da faixa é a do bloqueio (5 dias depois da primeira recusa), no fuso da barbearia.
    it('pagamento recusado: mostra a faixa com a data do bloqueio e mantém o painel', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('warning', 'payment_failed', '2026-10-03T15:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Pagamento recusado. Atualize o cartão até 03/10 para não ter o acesso bloqueado.'
      );
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('pagamento recusado: a data do bloqueio na faixa segue o fuso da barbearia', async () => {
      painelDaBarbearia('/agenda', true, '', 'America/Manaus');
      // 03:30 UTC de 04/10: 00:30 do dia 4 em Brasília, 23:30 do dia 3 em Manaus.
      estadoDoBanco('warning', 'payment_failed', '2026-10-04T03:30:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('até 03/10');
    });

    // Spec 052, ticket 12: depois de cancelar, a faixa "Assinatura cancelada. Acesso até DD/MM." aparece sem recarregar a página.
    it('cancelada dentro do período pago: mostra a faixa com a data do fim do acesso e mantém o painel', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('warning', 'canceled', '2026-10-29T23:26:22Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('Assinatura cancelada. Acesso até 29/10.');
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('cancelada: a data do fim do acesso na faixa segue o fuso da barbearia', async () => {
      painelDaBarbearia('/agenda', true, '', 'America/Manaus');
      // 03:30 UTC de 30/10: 00:30 do dia 30 em Brasília, 23:30 do dia 29 em Manaus.
      estadoDoBanco('warning', 'canceled', '2026-10-30T03:30:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('Acesso até 29/10.');
    });

    it('as páginas pedem a releitura do estado pelo contexto: a faixa de cancelada aparece sem recarregar a página', async () => {
      painelDaBarbearia('/configuracoes');
      estadoDoBanco('allowed', 'active');
      render(<GerenteLayout />);
      await screen.findByTestId('outlet');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      estadoDoBanco('warning', 'canceled', '2026-10-29T23:26:22Z');
      await userEvent.click(screen.getByRole('button', { name: 'simular releitura do acesso' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Assinatura cancelada. Acesso até 29/10.');
    });

    it('a releitura que bloqueia (cancelada sem período a esperar) troca o painel pela tela de bloqueio', async () => {
      painelDaBarbearia('/configuracoes');
      estadoDoBanco('allowed', 'active');
      render(<GerenteLayout />);
      await screen.findByTestId('outlet');

      estadoDoBanco('blocked', 'canceled', '2026-09-30T23:00:00Z');
      await userEvent.click(screen.getByRole('button', { name: 'simular releitura do acesso' }));

      expect(await screen.findByRole('heading', { name: 'Sua assinatura foi cancelada' })).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    // Revisão do ticket 12: o Gerente bloqueado por estorno que só quer sair cancela a assinatura que o Mercado Pago ainda cobra.
    // O banco mantém o bloqueio e troca o motivo para canceled; o layout relê o estado e a tela passa a mandar assinar de novo.
    it('bloqueado com a assinatura ainda viva: depois de cancelar, relê o estado e a tela de bloqueio passa a dizer que a assinatura foi cancelada', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('blocked', 'refunded', '2026-09-29T12:00:00Z');
      render(<GerenteLayout />);
      expect(await screen.findByRole('heading', { name: 'Um pagamento da assinatura foi estornado' })).toBeInTheDocument();

      estadoDoBanco('blocked', 'canceled', '2026-09-29T12:00:00Z');
      await userEvent.click(screen.getByRole('button', { name: 'simular assinatura cancelada' }));

      expect(await screen.findByRole('heading', { name: 'Sua assinatura foi cancelada' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pagar' })).toBeEnabled();
    });

    // As páginas usam o contexto em dependências de efeitos: um objeto novo a cada render as faria reler tudo a cada render.
    it('o contexto das páginas é o mesmo objeto enquanto os dados da barbearia não mudam, mesmo com a faixa aparecendo', async () => {
      painelDaBarbearia('/configuracoes');
      estadoDoBanco('allowed', 'active');
      render(<GerenteLayout />);
      await screen.findByTestId('outlet');

      estadoDoBanco('warning', 'canceled', '2026-10-29T23:26:22Z');
      await userEvent.click(screen.getByRole('button', { name: 'simular releitura do acesso' }));
      await screen.findByRole('status');

      expect(contextosDoOutlet.length).toBeGreaterThan(1);
      expect(new Set(contextosDoOutlet).size).toBe(1);
      expect(contextosDoOutlet[0]).toMatchObject({ tenantId: 'tenant-123', tenantName: 'Barbearia Navalhado' });
    });

    it('liberado: mostra o painel, sem faixa e sem tela de bloqueio', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('allowed', 'active');

      render(<GerenteLayout />);

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
    });

    it('lê o estado em paralelo com os dados da barbearia, sem esperar por eles', async () => {
      // A consulta do perfil nunca responde: se a leitura do estado esperasse pela barbearia,
      // ela não aconteceria.
      mockFrom.mockImplementation(() => ({
        select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }),
      }));
      estadoDoBanco('allowed', 'active');

      render(<GerenteLayout />);

      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    });

    it('enquanto o estado não chega, não mostra o painel para depois trocar pelo bloqueio', async () => {
      painelDaBarbearia('/agenda');
      mockRpc.mockReturnValue(new Promise(() => {}));

      render(<GerenteLayout />);

      await waitFor(() => expect(mockRpc).toHaveBeenCalled());
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('se a leitura do estado falha, o painel abre: o banco protege o resto', async () => {
      painelDaBarbearia('/agenda');
      mockRpc.mockResolvedValue({ data: null, error: { message: 'sem rede' } });
      const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<GerenteLayout />);

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      erro.mockRestore();
    });

    it('o redirecionamento para o onboarding continua valendo com o estado liberado', async () => {
      painelDaBarbearia('/agenda', false);
      estadoDoBanco('allowed', 'trial');

      render(<GerenteLayout />);

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'));
    });

    // Spec 052, ticket 16: o Gerente que não aceitou a versão atual dos Termos de Uso e da Política de Privacidade vê o aceite antes
    // do painel. O aceite vem antes até da tela de bloqueio: quem vai pagar a assinatura está contratando. O aceite é do front (o
    // banco só o guarda), então a falha de leitura não fecha o painel.
    describe('aceite dos Termos de Uso', () => {
      const TITULO_DO_ACEITE = 'Termos de Uso e Política de Privacidade';

      const aceitarNaTela = async () => {
        await userEvent.click(await screen.findByRole('checkbox', { name: /Li e aceito/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Aceitar e continuar' }));
      };

      it('sem o aceite da versão atual: mostra a tela de aceite e não mostra o painel', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockResolvedValue(false);

        render(<GerenteLayout />);

        expect(await screen.findByRole('heading', { name: TITULO_DO_ACEITE })).toBeInTheDocument();
        expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
        expect(mockJaAceitouTermos).toHaveBeenCalledWith(VERSAO_ATUAL_DOS_TERMOS);
      });

      it('com o aceite da versão atual: abre o painel direto, sem a tela de aceite', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');

        render(<GerenteLayout />);

        expect(await screen.findByTestId('outlet')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: TITULO_DO_ACEITE })).not.toBeInTheDocument();
      });

      it('aceitar grava o aceite da versão atual e libera o painel, sem recarregar a página', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockResolvedValue(false);
        render(<GerenteLayout />);

        await aceitarNaTela();

        expect(mockAceitarTermos).toHaveBeenCalledWith(VERSAO_ATUAL_DOS_TERMOS);
        expect(await screen.findByTestId('outlet')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: TITULO_DO_ACEITE })).not.toBeInTheDocument();
      });

      it('se gravar o aceite falha, a tela mostra o erro e o painel continua fechado', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockResolvedValue(false);
        mockAceitarTermos.mockRejectedValue(new Error('Não foi possível registrar o seu aceite. Tente de novo.'));
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<GerenteLayout />);

        await aceitarNaTela();

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar o seu aceite. Tente de novo.');
        expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
        erro.mockRestore();
      });

      // Quem vai pagar está contratando: o aceite vem antes da tela de bloqueio (e do "Pagar" dela).
      it('bloqueado e sem o aceite: o aceite vem antes da tela de bloqueio, e aceitar leva a ela', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');
        mockJaAceitouTermos.mockResolvedValue(false);
        render(<GerenteLayout />);

        expect(await screen.findByRole('heading', { name: TITULO_DO_ACEITE })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Seu período de teste terminou' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();

        await aceitarNaTela();

        expect(await screen.findByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
      });

      it('o aceite vem antes do onboarding', async () => {
        painelDaBarbearia('/onboarding', false);
        estadoDoBanco('allowed', 'trial');
        mockJaAceitouTermos.mockResolvedValue(false);

        render(<GerenteLayout />);

        expect(await screen.findByRole('heading', { name: TITULO_DO_ACEITE })).toBeInTheDocument();
        expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
      });

      it('enquanto a leitura do aceite não chega, não mostra o painel para depois trocar pela tela de aceite', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockReturnValue(new Promise(() => {}));

        render(<GerenteLayout />);

        await waitFor(() => expect(mockJaAceitouTermos).toHaveBeenCalled());
        expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: TITULO_DO_ACEITE })).not.toBeInTheDocument();
      });

      it('se a leitura do aceite falha, o painel abre: o aceite não fecha ninguém por falha de rede', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockRejectedValue(new Error('sem rede'));
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<GerenteLayout />);

        expect(await screen.findByTestId('outlet')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: TITULO_DO_ACEITE })).not.toBeInTheDocument();
        erro.mockRestore();
      });

      it('lê o aceite em paralelo com os dados da barbearia, sem esperar por eles', async () => {
        // A consulta do perfil nunca responde: se a leitura do aceite esperasse pela barbearia, ela não aconteceria.
        mockFrom.mockImplementation(() => ({
          select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }),
        }));
        estadoDoBanco('allowed', 'active');

        render(<GerenteLayout />);

        await waitFor(() => expect(mockJaAceitouTermos).toHaveBeenCalledTimes(1));
      });

      it('na tela de aceite o Gerente consegue sair da conta', async () => {
        painelDaBarbearia('/agenda');
        estadoDoBanco('allowed', 'active');
        mockJaAceitouTermos.mockResolvedValue(false);
        render(<GerenteLayout />);

        await userEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));

        await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });
});
