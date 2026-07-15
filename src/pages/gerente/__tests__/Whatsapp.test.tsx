import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Whatsapp } from '../Whatsapp';

// Mocks do GSAP para evitar erros no jsdom
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

// Declarar variáveis içadas (hoisted) pelo Vitest para evitar erros de inicialização
const { 
  mockAddToast, 
  mockSupabaseClient, 
  mockMaybeSingle, 
  mockUpdate, 
  mockSelect, 
  mockInsert, 
  mockEq,
  mockSingle,
  mockFunctionsInvoke
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockFunctionsInvoke = vi.fn();

  // Estrutura fluente e robusta para simular o encadeamento do Supabase JS Client
  const mockSupabaseClient = {
    channel: vi.fn().mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn(),
    functions: {
      invoke: mockFunctionsInvoke,
    },
    from: vi.fn().mockImplementation(() => ({
      select: mockSelect.mockImplementation(() => ({
        eq: mockEq.mockImplementation(() => ({
          maybeSingle: mockMaybeSingle,
          single: mockSingle,
        })),
        maybeSingle: mockMaybeSingle,
      })),
      update: mockUpdate.mockImplementation(() => ({
        eq: mockEq.mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => ({
            single: mockSingle,
          })),
        })),
      })),
      insert: mockInsert.mockImplementation(() => ({
        select: vi.fn().mockImplementation(() => ({
          single: mockSingle,
        })),
      })),
    })),
  };

  return { 
    mockAddToast, 
    mockSupabaseClient, 
    mockMaybeSingle, 
    mockUpdate, 
    mockSelect, 
    mockInsert, 
    mockEq,
    mockSingle,
    mockFunctionsInvoke
  };
});

// Mock do Toast
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Mock do react-router-dom para obter o contexto do tenant
vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'tenant-test-id',
    tenantName: 'Barbearia Estilo',
  }),
}));

// Mock do Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Whatsapp Config Page - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar as chaves de configuracao do WhatsApp a partir dos dados do banco', async () => {
    // Simula o retorno de uma instancia conectada com configuracoes salvas
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        api_key: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: false, // Lembrete desativado
        reminder_hours: 4, // 4 horas antes
        send_cancellation: true,
      },
      error: null,
    });

    render(<Whatsapp />);

    // Aguarda carregar o estado
    await waitFor(() => {
      expect(screen.getByText('Status da Integração')).toBeInTheDocument();
    });

    // Confirmação automática (send_confirmation = true) -> Switch ativado
    const confirmCheckbox = screen.getByLabelText('Confirmação Automática') as HTMLInputElement;
    expect(confirmCheckbox.checked).toBe(true);

    // Lembrete (send_reminders = false) -> Switch desativado
    const reminderCheckbox = screen.getByLabelText('Lembretes de Agendamento') as HTMLInputElement;
    expect(reminderCheckbox.checked).toBe(false);

    // Select de horas deve estar desabilitado (porque send_reminders é false)
    const hoursSelect = screen.getByLabelText('Tempo de antecedência do lembrete') as HTMLSelectElement;
    expect(hoursSelect).toBeDisabled();
    expect(hoursSelect.value).toBe('4');
    // Descrição estática do lembrete
    expect(screen.getByText('Envia lembrete com opção de cancelamento antes do horário.')).toBeInTheDocument();

    // Texto de ajuda dinâmico de horas
    expect(screen.getByText('Lembrete enviado 4 horas antes do agendamento')).toBeInTheDocument();

    // Alerta de cancelamento (send_cancellation = true) -> Switch ativado
    const cancellationCheckbox = screen.getByLabelText('Alerta de Cancelamento') as HTMLInputElement;
    expect(cancellationCheckbox.checked).toBe(true);
  });

  it('deve alternar a confirmacao automatica e salvar no banco', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        api_key: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    // Mock do update do Supabase retornando sucesso
    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        api_key: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: false, // atualizado
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmação Automática')).toBeInTheDocument();
    });

    const confirmCheckbox = screen.getByLabelText('Confirmação Automática') as HTMLInputElement;
    expect(confirmCheckbox.checked).toBe(true);

    // Alternar o switch
    fireEvent.click(confirmCheckbox);

    // Deve chamar o update informando o novo estado (false)
    expect(mockUpdate).toHaveBeenCalledWith({
      send_confirmation: false,
      updated_at: expect.any(String),
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'inst-123');
    
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Configurações do WhatsApp atualizadas com sucesso!', 'success');
    });
  });

  it('deve habilitar e alterar as horas do lembrete e salvar no banco', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        api_key: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: false, // começa desativado
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    // Mock do update do Supabase retornando sucesso
    mockSingle.mockImplementation(async () => {
      const lastUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1]?.[0] || {};
      return {
        data: {
          id: 'inst-123',
          tenant_id: 'tenant-test-id',
          instance_name: 'nav_estilo_123',
          api_key: 'key_123',
          status: 'connected',
          qr_code: null,
          send_confirmation: true,
          send_reminders: lastUpdateCall.send_reminders !== undefined ? lastUpdateCall.send_reminders : true,
          reminder_hours: lastUpdateCall.reminder_hours !== undefined ? lastUpdateCall.reminder_hours : 2,
          send_cancellation: true,
        },
        error: null,
      };
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByLabelText('Lembretes de Agendamento')).toBeInTheDocument();
    });

    const reminderCheckbox = screen.getByLabelText('Lembretes de Agendamento') as HTMLInputElement;
    const hoursSelect = screen.getByLabelText('Tempo de antecedência do lembrete') as HTMLSelectElement;

    expect(reminderCheckbox.checked).toBe(false);
    expect(hoursSelect).toBeDisabled();
    expect(screen.getByText('Lembrete enviado 2 horas antes do agendamento')).toBeInTheDocument();

    // Ativar o switch do lembrete
    fireEvent.click(reminderCheckbox);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        send_reminders: true,
        updated_at: expect.any(String),
      });
    });

    // O select agora deve estar habilitado (aguarda o re-render após a resolução do update)
    await waitFor(() => {
      expect(hoursSelect).not.toBeDisabled();
    });

    // Alterar o valor do lembrete para 6 horas
    fireEvent.change(hoursSelect, { target: { value: '6' } });
 
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        reminder_hours: 6,
        updated_at: expect.any(String),
      });
    });
 
    // Validar se a legenda de equivalência abaixo mudou dinamicamente para "Lembrete enviado 6 horas antes do agendamento"
    await waitFor(() => {
      expect(screen.getByText('Lembrete enviado 6 horas antes do agendamento')).toBeInTheDocument();
    });
  });

  it('deve disparar mensagem de teste enviando os dados para a Edge Function', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        api_key: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: false,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true },
      error: null
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByText('Disparar Mensagem')).toBeInTheDocument();
    });

    const phoneInput = screen.getByLabelText('Número com DDD (Apenas números)') as HTMLInputElement;
    const msgTextarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement;
    const submitButton = screen.getByRole('button', { name: 'Enviar Mensagem de Teste' });

    // Preencher formulário
    fireEvent.change(phoneInput, { target: { value: '11999999999' } });
    fireEvent.change(msgTextarea, { target: { value: 'Teste de mensagem' } });

    // Submeter formulário
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/send-test', {
        body: {
          tenant_id: 'tenant-test-id',
          number: '11999999999',
          text: 'Teste de mensagem'
        }
      });
    });

    expect(mockAddToast).toHaveBeenCalledWith('Mensagem de teste disparada com sucesso para 11999999999!', 'success');
  });
});
