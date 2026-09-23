import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Clientes } from '../Clientes';

function renderClientes() {
  return render(<Clientes />);
}

// Mocks do GSAP para evitar erros no JSDOM
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (cb: () => void) => {
    cb();
  },
}));

// Mocks hoisted do Vitest
const {
  mockAddToast,
  mockInvoke,
  mockSupabaseClient,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockInvoke = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  const mockSupabaseClient = {
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn().mockImplementation((_table) => {
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      };
    }),
  };

  return {
    mockAddToast,
    mockInvoke,
    mockSupabaseClient,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
  };
});

// Mock do Toast
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Mock do react-router-dom para obter o contexto do tenant. `useSearchParams`
// precisa ser mockado também (não só `useNavigate`): sua implementação real
// usa `useLocation`, que exige um `<Router>` em volta -- e este arquivo
// renderiza `<Clientes />` sem nenhum (spec 038, ticket 09: `Clientes.tsx`
// passou a ler `?customerId=` da URL para abrir a Central 360º vinda da
// página de Clientes sem Retorno).
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({
      tenantId: 'tenant-test-id',
      tenantName: 'Barbearia Estilo',
    }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock do Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Aba de Clientes (Clientes.tsx)', () => {
  const mockCustomers = [
    {
      id: 'customer-1',
      tenant_id: 'tenant-test-id',
      name: 'João Silva',
      phone: '5511999999999',
      email: 'joao@email.com',
      notes: 'Gosta de café e corte degradê.',
      cadastro_completo: true,
      token_acesso: 'token-uuid-1',
      created_at: '2026-07-10T12:00:00Z',
    },
    {
      id: 'customer-2',
      tenant_id: 'tenant-test-id',
      name: 'Visitante Zap',
      phone: '5511988888888',
      email: null,
      notes: null,
      cadastro_completo: false,
      token_acesso: 'token-uuid-2',
      created_at: '2026-07-15T10:00:00Z',
    },
  ];

  // Helper para criar um builder fluido com dados padrão
  const createDefaultBuilder = (data: any, error: any = null) => {
    const builder: any = {
      eq: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      select: vi.fn().mockImplementation(() => builder),
      single: vi.fn().mockResolvedValue({ data: data?.[0] || data, error }),
      maybeSingle: vi.fn().mockResolvedValue({ data: data?.[0] || data, error }),
      then: vi.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve(onfulfilled({ data, error }));
      }),
    };
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Configurações padrão de mocks
    mockSelect.mockImplementation(() => createDefaultBuilder(mockCustomers));
    mockInsert.mockImplementation(() => createDefaultBuilder(mockCustomers[0]));
    mockUpdate.mockImplementation(() => createDefaultBuilder(mockCustomers[1]));
    mockDelete.mockImplementation(() => createDefaultBuilder(null));

    mockSupabaseClient.from = vi.fn().mockImplementation((table) => {
      if (table === 'appointments') {
        // Retorna histórico vazio por padrão
        return {
          select: vi.fn().mockReturnValue(createDefaultBuilder([])),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      };
    });
  });

  it('deve buscar e listar todos os clientes da barbearia', async () => {
    renderClientes();

    expect(screen.getByText('Carregando clientes...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
    });

    expect(screen.getByText('5511999999999')).toBeInTheDocument();
    expect(screen.getByText('5511988888888')).toBeInTheDocument();
  });

  it('deve filtrar os clientes por status (Cadastrado vs Provisório)', async () => {
    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    // Clicar no filtro "Completos"
    const btnCompletos = screen.getByRole('tab', { name: 'Completos' });
    fireEvent.click(btnCompletos);

    // Esperar que apenas o cadastrado apareça
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Visitante Zap')).not.toBeInTheDocument();

    // Clicar no filtro "Provisórios"
    const btnProvisorios = screen.getByRole('tab', { name: 'Provisórios' });
    fireEvent.click(btnProvisorios);

    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
  });

  it('deve buscar clientes pelo termo de busca digitado', async () => {
    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const inputBusca = screen.getByPlaceholderText(/Buscar por nome/i);
    
    // Digitar "João"

    fireEvent.change(inputBusca, { target: { value: 'João' } });
    
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Visitante Zap')).not.toBeInTheDocument();

    // Digitar telefone "98888"
    fireEvent.change(inputBusca, { target: { value: '98888' } });
    
    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
  });

  it('deve abrir a gaveta lateral de detalhes do cliente e carregar histórico de agendamentos', async () => {
    const mockAppointments = [
      {
        id: 'appointment-1',
        start_time: '2026-07-12T14:00:00Z',
        status: 'completed',
        payment_status: 'paid',
        services: { name: 'Cabelo & Barba', price: 80.00 },
        professionals: { name: 'Lucas Barbeiro' },
      }
    ];

    // Configurar retorno de agendamentos especificamente para este teste
    mockSupabaseClient.from = vi.fn().mockImplementation((table) => {
      if (table === 'appointments') {
        return {
          select: vi.fn().mockReturnValue(createDefaultBuilder(mockAppointments)),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue(createDefaultBuilder(mockCustomers)),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      };
    });

    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    // Clicar no botão de Ver Detalhes (gaveta) do primeiro cliente
    const btnDetalhes = screen.getAllByRole('button', { name: /Ver Detalhes/i })[0];
    fireEvent.click(btnDetalhes);

    // Esperar a gaveta lateral abrir
    expect(await screen.findByRole('button', { name: /Copiar Link/i })).toBeInTheDocument();

    // Navegar para a aba Linha do Tempo
    const tabTimeline = screen.getByRole('button', { name: /Linha do Tempo/i });
    fireEvent.click(tabTimeline);

    await waitFor(() => {
      expect(screen.getByText('Cabelo & Barba')).toBeInTheDocument();
      expect(screen.getByText('Lucas Barbeiro')).toBeInTheDocument();
      expect(screen.getByText('R$ 80,00')).toBeInTheDocument();
    });

    // Copiar link de agendamento tokenizado
    const btnCopiar = screen.getByRole('button', { name: /Copiar Link/i });
    expect(btnCopiar).toBeInTheDocument();
  });

  describe('motivo do cancelamento na Linha do Tempo (spec 043, ticket 02)', () => {
    const agendamento = (overrides: Record<string, unknown>) => ({
      id: 'appointment-x',
      start_time: '2026-07-12T14:00:00Z',
      status: 'canceled',
      payment_status: 'pending',
      cancellation_reason: null,
      services: { name: 'Cabelo & Barba', price: 80.0 },
      professionals: { name: 'Lucas Barbeiro' },
      ...overrides,
    });

    const abrirLinhaDoTempo = async (agendamentos: unknown[]) => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'appointments') {
          return { select: vi.fn().mockReturnValue(createDefaultBuilder(agendamentos)) };
        }
        return { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete };
      });

      renderClientes();
      await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: /Ver Detalhes/i })[0]);
      await screen.findByRole('button', { name: /Copiar Link/i });
      fireEvent.click(screen.getByRole('button', { name: /Linha do Tempo/i }));
      await screen.findByText('Cabelo & Barba');
    };

    it('mostra o motivo no atendimento cancelado', async () => {
      await abrirLinhaDoTempo([agendamento({ cancellation_reason: 'Cliente desistiu' })]);

      expect(screen.getByText('Motivo:')).toBeInTheDocument();
      expect(screen.getByText('Cliente desistiu')).toBeInTheDocument();
    });

    it('não desenha rótulo vazio quando o cancelamento não tem motivo', async () => {
      await abrirLinhaDoTempo([agendamento({ cancellation_reason: null })]);

      expect(screen.getByText('Cancelado')).toBeInTheDocument();
      expect(screen.queryByText('Motivo:')).toBeNull();
    });

    it('não mostra motivo em atendimento que não foi cancelado', async () => {
      await abrirLinhaDoTempo([
        agendamento({ status: 'completed', payment_status: 'paid', cancellation_reason: 'Sobrou de um cancelamento antigo' }),
      ]);

      expect(screen.getByText('Concluído')).toBeInTheDocument();
      expect(screen.queryByText('Motivo:')).toBeNull();
      expect(screen.queryByText('Sobrou de um cancelamento antigo')).toBeNull();
    });

    it('rotula um atendimento não compareceu, em vez de deixar o rótulo em branco (spec 044)', async () => {
      await abrirLinhaDoTempo([agendamento({ status: 'no_show', payment_status: 'pending' })]);

      expect(screen.getByText('Não compareceu')).toBeInTheDocument();
    });

    it('não mostra "Valor cobrado" em atendimento cancelado ou não compareceu, que não foram cobrados (spec 044)', async () => {
      await abrirLinhaDoTempo([
        agendamento({
          id: 'appointment-cancelado',
          status: 'canceled',
          services: { name: 'Cabelo & Barba', price: 80.0 },
        }),
        agendamento({
          id: 'appointment-faltou',
          status: 'no_show',
          services: { name: 'Barba Terapia', price: 40.0 },
        }),
      ]);
      await screen.findByText('Barba Terapia');

      expect(screen.queryByText('Valor cobrado:')).toBeNull();
    });

    it('mostra "Valor cobrado" em atendimento concluído', async () => {
      await abrirLinhaDoTempo([agendamento({ status: 'completed', payment_status: 'paid' })]);

      expect(screen.getByText('Valor cobrado:')).toBeInTheDocument();
    });
  });

  it('deve promover um cliente provisório a completo ao preencher seu nome na edição', async () => {
    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
    });

    // Clicar em Editar do segundo cliente (provisório)
    const btnEditar = screen.getAllByRole('button', { name: /Editar/i })[1];
    fireEvent.click(btnEditar);

    // Mudar o nome no modal
    const inputNome = screen.getByLabelText(/Nome/i);
    fireEvent.change(inputNome, { target: { value: 'João Carlos' } });

    // Salvar
    const btnSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(btnSalvar);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Cliente atualizado com sucesso!', 'success');
    });
  });

  it('deve recusar salvar cliente com e-mail de formato inválido (spec 047) e não gravar nada', async () => {
    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btnEditar = screen.getAllByRole('button', { name: /Editar/i })[0];
    fireEvent.click(btnEditar);

    const inputEmail = screen.getByLabelText(/E-mail/i);
    fireEvent.change(inputEmail, { target: { value: 'joao@x.c' } });

    const btnSalvar = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(btnSalvar);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('O formato do e-mail informado é inválido.', 'warning');
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('recusa salvar cliente com domínio de e-mail que não recebe e-mails (spec 047, ticket 05) e não grava nada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 3 }), // NXDOMAIN
    } as any);

    renderClientes();
    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btnEditar = screen.getAllByRole('button', { name: /Editar/i })[0];
    fireEvent.click(btnEditar);

    const inputEmail = screen.getByLabelText(/E-mail/i);
    fireEvent.change(inputEmail, { target: { value: 'joao@dominio-inventado-clientes.example' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Este domínio não recebe e-mails.', 'warning');
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('salva cliente normalmente quando a consulta de domínio de e-mail está indisponível (spec 047, ticket 05)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS fora do ar'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderClientes();
    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btnEditar = screen.getAllByRole('button', { name: /Editar/i })[0];
    fireEvent.click(btnEditar);

    const inputEmail = screen.getByLabelText(/E-mail/i);
    fireEvent.change(inputEmail, { target: { value: 'joao@dominio-indisponivel-clientes.example' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Cliente atualizado com sucesso!', 'success');
    });
  });

  it('sugere a correção de domínio digitado errado e aplica ao clicar (spec 047, ticket 06)', async () => {
    renderClientes();
    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btnEditar = screen.getAllByRole('button', { name: /Editar/i })[0];
    fireEvent.click(btnEditar);

    const inputEmail = screen.getByLabelText(/E-mail/i) as HTMLInputElement;
    fireEvent.change(inputEmail, { target: { value: 'joao@gmial.com' } });
    fireEvent.blur(inputEmail);

    const btnSugestao = await screen.findByRole('button', { name: /joao@gmail\.com/i });
    fireEvent.click(btnSugestao);

    expect(inputEmail.value).toBe('joao@gmail.com');
    expect(screen.queryByRole('button', { name: /joao@gmail\.com/i })).toBeNull();
  });

  it('deve exibir erro ao tentar excluir cliente que possui agendamentos cadastrados', async () => {
    // Configura o mock do delete para retornar erro especificamente para este teste
    mockDelete.mockImplementationOnce(() => {
      return createDefaultBuilder(null, {
        code: '23503',
        message: 'violates foreign key constraint',
      });
    });

    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btnExcluir = screen.getAllByRole('button', { name: /Excluir/i })[0];
    fireEvent.click(btnExcluir);

    // Modal de confirmação seguro abre
    const btnConfirmar = await screen.findByRole('button', { name: /Sim, Excluir/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Este cliente não pode ser excluído porque possui agendamentos registrados no histórico.',
        'error'
      );
    });
  });

  it('deve excluir com sucesso um cliente provisório sem agendamentos', async () => {
    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
    });

    const btnExcluir = screen.getAllByRole('button', { name: /Excluir/i })[1];
    fireEvent.click(btnExcluir);

    // Modal de confirmação seguro abre
    const btnConfirmar = await screen.findByRole('button', { name: /Sim, Excluir/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Cliente excluído com sucesso!', 'success');
    });
  });

  it('deve abrir modal de WhatsApp direto e disparar mensagem via Uazapi', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    renderClientes();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    const btn360 = screen.getAllByRole('button', { name: /Ver Detalhes/i })[0];
    fireEvent.click(btn360);

    // Clicar no botão WhatsApp na Central 360
    const btnZap = await screen.findByRole('button', { name: /Conversar no WhatsApp/i });
    fireEvent.click(btnZap);

    // Modal abre
    expect(screen.getByText(/Enviar WhatsApp para João Silva/i)).toBeInTheDocument();

    // Selecionar modelo de Agradecimento
    const chipAgradecimento = screen.getByRole('radio', { name: /🤝 Agradecimento/i });
    fireEvent.click(chipAgradecimento);

    // Disparar
    const btnDisparar = screen.getByRole('button', { name: /Disparar pelo WhatsApp/i });
    fireEvent.click(btnDisparar);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('whatsapp-integration/send-manual', {
        body: expect.objectContaining({
          tenant_id: 'tenant-test-id',
          number: '5511999999999',
        }),
      });
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('via WhatsApp da barbearia'),
        'success'
      );
    });
  });
});
