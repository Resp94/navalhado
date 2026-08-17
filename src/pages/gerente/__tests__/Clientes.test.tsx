import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Clientes } from '../Clientes';

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
  mockSupabaseClient,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  const mockSupabaseClient = {
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

// Mock do react-router-dom para obter o contexto do tenant
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({
      tenantId: 'tenant-test-id',
      tenantName: 'Barbearia Estilo',
    }),
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
    render(<Clientes />);

    expect(screen.getByText('Carregando clientes...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
    });

    expect(screen.getByText('5511999999999')).toBeInTheDocument();
    expect(screen.getByText('5511988888888')).toBeInTheDocument();
  });

  it('deve filtrar os clientes por status (Cadastrado vs Provisório)', async () => {
    render(<Clientes />);

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    // Clicar no filtro "Completos"
    const btnCompletos = screen.getByRole('button', { name: 'Completos' });
    fireEvent.click(btnCompletos);

    // Esperar que apenas o cadastrado apareça
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Visitante Zap')).not.toBeInTheDocument();

    // Clicar no filtro "Provisórios"
    const btnProvisorios = screen.getByRole('button', { name: 'Provisórios' });
    fireEvent.click(btnProvisorios);

    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    expect(screen.getByText('Visitante Zap')).toBeInTheDocument();
  });

  it('deve buscar clientes pelo termo de busca digitado', async () => {
    render(<Clientes />);

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

    render(<Clientes />);

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

  it('deve promover um cliente provisório a completo ao preencher seu nome na edição', async () => {
    render(<Clientes />);

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

  it('deve exibir erro ao tentar excluir cliente que possui agendamentos cadastrados', async () => {
    // Configura o mock do delete para retornar erro especificamente para este teste
    mockDelete.mockImplementationOnce(() => {
      return createDefaultBuilder(null, {
        code: '23503',
        message: 'violates foreign key constraint',
      });
    });

    render(<Clientes />);

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
    render(<Clientes />);

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
});
