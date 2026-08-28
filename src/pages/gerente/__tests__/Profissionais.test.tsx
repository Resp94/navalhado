import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profissionais } from '../Profissionais';

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
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  const mockSupabaseClient = {
    from: vi.fn().mockImplementation((_table) => {
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
    }),
  };

  return {
    mockAddToast,
    mockSupabaseClient,
    mockSelect,
    mockInsert,
    mockUpdate,
  };
});

// Mock do Toast
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Mock do react-router-dom
vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'tenant-test-id',
    tenantName: 'Barbearia Estilo',
    businessHours: {
      monday: { active: true, open: '09:00', close: '18:00' },
      tuesday: { active: true, open: '09:00', close: '18:00' },
      wednesday: { active: true, open: '09:00', close: '18:00' },
      thursday: { active: true, open: '09:00', close: '18:00' },
      friday: { active: true, open: '09:00', close: '18:00' },
      saturday: { active: true, open: '09:00', close: '18:00' },
      sunday: { active: false, open: '09:00', close: '18:00' },
    },
  }),
  useNavigate: () => vi.fn(),
}));

// Mock do Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Aba de Profissionais (Profissionais.tsx)', () => {
  const mockProfessionals = [
    {
      id: 'prof-1',
      tenant_id: 'tenant-test-id',
      name: 'Carlos Silva',
      phone: '(11) 99999-9999',
      commission_percentage: 40,
      weekly_schedule: {
        monday: { start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        tuesday: { start: '09:00', end: '18:00', break_start: '12:30', break_end: '13:30' },
      },
      is_active: true,
      user_id: null,
    },
  ];

  const createDefaultBuilder = (data: any, error: any = null) => {
    const builder: any = {
      eq: vi.fn().mockImplementation(() => builder),
      is: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      select: vi.fn().mockImplementation(() => builder),
      then: vi.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve(onfulfilled({ data, error }));
      }),
    };
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockImplementation(() => createDefaultBuilder(mockProfessionals));
    mockInsert.mockImplementation(() => createDefaultBuilder(mockProfessionals[0]));
    mockUpdate.mockImplementation(() => createDefaultBuilder(mockProfessionals[0]));
  });

  it('deve renderizar a listagem de profissionais e abrir o formulário de cadastro no drawer', async () => {
    render(<Profissionais />);

    expect(screen.getByText('Carregando equipe...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
      expect(screen.getByText('(11) 99999-9999')).toBeInTheDocument();
    });

    // Clica no botão de Novo Barbeiro para abrir o Drawer
    const btnNovo = screen.getByRole('button', { name: /Novo Barbeiro/i });
    fireEvent.click(btnNovo);

    expect(screen.getByRole('heading', { name: 'Novo Profissional' })).toBeInTheDocument();
  });

  it('deve ter inputs de Início do Almoço e Fim do Almoço para cada dia ativo da escala semanal', async () => {
    render(<Profissionais />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    });

    // Abre o drawer para novo profissional
    fireEvent.click(screen.getByRole('button', { name: /Novo Barbeiro/i }));

    // Pelo estado inicial do formulário, a Segunda-feira (monday) está ativa por padrão.
    // Verificamos a presença dos inputs de horário de trabalho e de almoço.
    const breakStartInputs = screen.getAllByLabelText('Início do Almoço');
    const breakEndInputs = screen.getAllByLabelText('Fim do Almoço');

    // Inicialmente, 6 dias estão ativos no estado inicial padrão do formulário (monday a saturday).
    // Esperamos 6 inputs para início e fim de almoço.
    expect(breakStartInputs.length).toBe(6);
    expect(breakEndInputs.length).toBe(6);
  });

  it('deve limitar o expediente do profissional ao funcionamento da barbearia', async () => {
    render(<Profissionais />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Novo Barbeiro/i }));

    const startInputs = screen.getAllByLabelText(/Início do expediente/i);
    fireEvent.change(startInputs[0], { target: { value: '20:00' } });

    expect(startInputs[0]).toHaveValue('18:00');
  });

  it('deve conter as chaves break_start e break_end no weekly_schedule JSONB ao cadastrar um novo profissional', async () => {
    render(<Profissionais />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    });

    // Abre o drawer para cadastrar novo profissional
    fireEvent.click(screen.getByRole('button', { name: /Novo Barbeiro/i }));

    // Preencher formulário de cadastro
    fireEvent.change(screen.getByLabelText(/Nome do Barbeiro/i), { target: { value: 'Lucas Barbeiro' } });
    fireEvent.change(screen.getByLabelText(/WhatsApp \/ Celular/i), { target: { value: '(11) 98888-8888' } });
    fireEvent.change(screen.getByLabelText(/Comissão/i), { target: { value: '50' } });


    // Modificar horários de almoço da Segunda-feira (que já está ativa por padrão)
    const breakStartInputs = screen.getAllByLabelText('Início do Almoço');
    const breakEndInputs = screen.getAllByLabelText('Fim do Almoço');

    // Primeira entrada é monday
    fireEvent.change(breakStartInputs[0], { target: { value: '12:00' } });
    fireEvent.change(breakEndInputs[0], { target: { value: '13:00' } });

    // Enviar formulário
    const btnSubmit = screen.getByRole('button', { name: 'Cadastrar Profissional' });
    fireEvent.click(btnSubmit);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });

    const callArgs = mockInsert.mock.calls[0][0];
    expect(callArgs[0]).toMatchObject({
      name: 'Lucas Barbeiro',
      phone: '(11) 98888-8888',
      commission_percentage: 50,
      weekly_schedule: expect.objectContaining({
        monday: expect.objectContaining({
          start: '09:00',
          end: '18:00',
          break_start: '12:00',
          break_end: '13:00',
        }),
      }),
    });
  });

  it('deve carregar os valores de break_start e break_end ao editar um profissional existente', async () => {
    render(<Profissionais />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    });

    // Clicar em editar para o Carlos Silva
    const btnEditar = screen.getByRole('button', { name: /Editar Escala\/Dados/i });
    fireEvent.click(btnEditar);

    // O título do formulário deve mudar para Editar Profissional
    expect(screen.getByRole('heading', { name: 'Editar Profissional' })).toBeInTheDocument();

    // Deve carregar os valores de almoço salvos de Carlos Silva para segunda-feira
    // Carlos Silva tem monday: break_start: '12:00', break_end: '13:00'
    const breakStartInputs = screen.getAllByLabelText('Início do Almoço');
    const breakEndInputs = screen.getAllByLabelText('Fim do Almoço');

    expect(breakStartInputs[0]).toHaveValue('12:00');
    expect(breakEndInputs[0]).toHaveValue('13:00');
  });

  it('permite realizar soft delete de profissional com modal de confirmação preservando histórico', async () => {
    render(<Profissionais />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    });

    const btnExcluir = screen.getByRole('button', { name: /Excluir profissional Carlos Silva/i });
    fireEvent.click(btnExcluir);

    // Modal de confirmação deve aparecer
    expect(screen.getByRole('heading', { name: 'Excluir profissional' })).toBeInTheDocument();
    expect(screen.getByText(/O histórico de atendimentos passados/i)).toBeInTheDocument();

    const btnConfirmar = screen.getByRole('button', { name: /Sim, excluir/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          deleted_at: expect.any(String),
        })
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('excluído com sucesso'),
        'success'
      );
    });
  });
});
