import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  mockEq,
  mockSingle,
  mockFunctionsInvoke,
  mockRealtimeCallback,
  mockChannel
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockFunctionsInvoke = vi.fn();
  const mockRealtimeCallback: { current?: (payload: any) => void } = {};
  const mockChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  mockChannel.on.mockImplementation((_event, _filter, callback) => {
    mockRealtimeCallback.current = callback;
    return mockChannel;
  });
  mockChannel.subscribe.mockReturnValue(mockChannel);

  // Estrutura fluente e robusta para simular o encadeamento do Supabase JS Client
  const mockSupabaseClient = {
    channel: vi.fn().mockReturnValue(mockChannel),
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
    mockEq,
    mockSingle,
    mockFunctionsInvoke,
    mockRealtimeCallback,
    mockChannel
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
    mockRealtimeCallback.current = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve buscar somente colunas nao secretas da instancia', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith(
        'id, tenant_id, instance_name, qr_code, status, send_confirmation, send_reminders, reminder_hours, send_cancellation, template_confirmation, template_reschedule, template_cancellation, template_reminder, template_first_contact'
      );
    });

    expect(mockSelect).not.toHaveBeenCalledWith('*');
  });

  it('deve reconciliar com o provedor uma instancia desconectada ao carregar', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true, status: 'connected', qrcode: null },
      error: null,
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/manage-instance', {
        body: {
          action: 'status',
          instance_id: 'inst-123',
          instance_name: 'nav_estilo_123',
        },
      });
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });
  });

  it('deve refletir atualizacoes realtime e remover o canal ao desmontar', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    const { unmount } = render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByText('Desconectado')).toBeInTheDocument();
      expect(mockRealtimeCallback.current).toBeTypeOf('function');
    });

    act(() => {
      mockRealtimeCallback.current?.({
        eventType: 'UPDATE',
        new: {
          id: 'inst-123',
          tenant_id: 'tenant-test-id',
          instance_name: 'nav_estilo_123',
          instance_token: 'must-not-enter-ui-state',
          status: 'connected',
          qr_code: null,
          send_confirmation: true,
          send_reminders: true,
          reminder_hours: 2,
          send_cancellation: true,
        },
      });
    });

    expect(screen.getByText('Conectado')).toBeInTheDocument();
    unmount();
    expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('deve iniciar pareamento invocando a edge function manage-instance', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'connecting',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true, qrcode: 'base64_qr' },
      error: null,
    });

    render(<Whatsapp />);

    fireEvent.click(await screen.findByRole('button', { name: 'Gerar QR Code de Conexão' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'connecting',
        qr_code: null,
        updated_at: expect.any(String),
      });
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/manage-instance', {
        body: {
          action: 'connect',
          instance_id: 'inst-123',
          instance_name: 'nav_estilo_123',
        },
      });
    });
  });

  it('deve exibir toast de erro se a chamada da edge function falhar ao gerar QR Code', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'pairing',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: 'VPS de WhatsApp indisponível no momento' },
    });

    render(<Whatsapp />);

    fireEvent.click(await screen.findByRole('button', { name: 'Gerar QR Code de Conexão' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('VPS de WhatsApp indisponível no momento', 'error');
    });
  });

  it('deve reconhecer conexao existente sem exibir erro falso ao solicitar novo QR Code', async () => {
    let statusCalls = 0;
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'connecting',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockImplementation((_name, options) => {
      if (options.body.action === 'connect') {
        return Promise.resolve({ data: null, error: { message: 'instancia ja conectada' } });
      }
      statusCalls += 1;
      return Promise.resolve({
        data: { success: true, status: statusCalls === 1 ? 'disconnected' : 'connected' },
        error: null,
      });
    });

    render(<Whatsapp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar QR Code de Conexão' }));

    await waitFor(() => {
      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(mockAddToast).toHaveBeenCalledWith('WhatsApp conectado com sucesso.', 'success');
    });
    expect(mockAddToast).not.toHaveBeenCalledWith('instancia ja conectada', 'error');
  });

  it('deve renderizar as chaves de configuracao do WhatsApp a partir dos dados do banco', async () => {
    // Simula o retorno de uma instancia conectada com configuracoes salvas
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        instance_token: 'key_123',
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
        instance_token: 'key_123',
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
        instance_token: 'key_123',
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
        instance_token: 'key_123',
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
          instance_token: 'key_123',
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

  it('deve ativar a integracao criando a instancia na VPS com action create', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-new-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_5555',
        instance_token: 'key_new_5555',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: true,
        instance: {
          id: 'inst-new-123',
          tenant_id: 'tenant-test-id',
          instance_name: 'nav_estilo_5555',
          status: 'disconnected',
          qr_code: null,
          send_confirmation: true,
          send_reminders: true,
          reminder_hours: 2,
          send_cancellation: true,
        },
      },
      error: null,
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByText('Ativar Integração do WhatsApp')).toBeInTheDocument();
    });

    const activateButton = screen.getByRole('button', { name: 'Ativar Integração do WhatsApp' });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/activate-instance', { body: {} });
      expect(mockSingle).not.toHaveBeenCalled();
    });

    expect(mockAddToast).toHaveBeenCalledWith('Instância criada com sucesso! Conecte seu celular.', 'success');
  });

  it('deve desconectar a instancia invocando action disconnect na VPS', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        instance_token: 'key_123',
        status: 'connected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'disconnected',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(screen.getByText('Desconectar Aparelho')).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole('button', { name: 'Desconectar Aparelho' });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/manage-instance', {
        body: {
          action: 'disconnect',
          instance_id: 'inst-123',
          instance_name: 'nav_estilo_123',
        },
      });
    });

    expect(mockAddToast).toHaveBeenCalledWith('WhatsApp desconectado da barbearia.', 'warning');
  });

  it('deve consultar temporariamente o status enquanto a instancia esta pareando', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'connecting',
        qr_code: 'base64_qr',
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true, status: 'connected' }, error: null });

    render(<Whatsapp />);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/manage-instance', {
        body: {
          action: 'status',
          instance_id: 'inst-123',
          instance_name: 'nav_estilo_123',
        },
      });
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });
  });

  it('deve retomar uma instancia pausada sem gerar novo QR Code', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'inst-123',
        tenant_id: 'tenant-test-id',
        instance_name: 'nav_estilo_123',
        status: 'hibernated',
        qr_code: null,
        send_confirmation: true,
        send_reminders: true,
        reminder_hours: 2,
        send_cancellation: true,
      },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true, status: 'connected' }, error: null });

    render(<Whatsapp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retomar Sessão' }));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/manage-instance', {
        body: {
          action: 'resume',
          instance_id: 'inst-123',
          instance_name: 'nav_estilo_123',
        },
      });
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });
  });

  describe('Personalização de Templates de Notificação', () => {
    const mockConnectedInstance = {
      id: 'inst-123',
      tenant_id: 'tenant-test-id',
      instance_name: 'nav_estilo_123',
      status: 'connected',
      qr_code: null,
      send_confirmation: true,
      send_reminders: true,
      reminder_hours: 2,
      send_cancellation: true,
      template_confirmation: 'Olá, {cliente}! Seu agendamento foi confirmado. Link: {link}',
      template_reschedule: null,
      template_cancellation: null,
      template_reminder: null,
      template_first_contact: null,
    };

    it('deve renderizar as 5 abas de eventos e o simulador do WhatsApp', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });

      render(<Whatsapp />);

      expect(await screen.findByRole('tab', { name: /Confirmação/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Reagendamento/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Cancelamento/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Lembrete/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Primeiro Contato/i })).toBeInTheDocument();

      // Live Preview Simulator
      expect(screen.getByText('Online agora')).toBeInTheDocument();
      expect(screen.getByText(/Lucas Silva/i)).toBeInTheDocument();
    });

    it('deve alternar entre abas e carregar o texto respectivo', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });

      render(<Whatsapp />);

      const rescheduleTab = await screen.findByRole('tab', { name: /Reagendamento/i });
      fireEvent.click(rescheduleTab);

      expect(screen.getByText('Confirmação de Reagendamento')).toBeInTheDocument();
      const textarea = screen.getByRole('textbox', { name: /Editor de mensagem para Confirmação de Reagendamento/i });
      expect(textarea).toBeInTheDocument();
    });

    it('deve exibir alerta visual e desabilitar salvar quando {link} for removido', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });

      render(<Whatsapp />);

      const textarea = await screen.findByRole('textbox', { name: /Editor de mensagem para Confirmação de Agendamento/i });
      fireEvent.change(textarea, { target: { value: 'Olá, seu horário está marcado sem link' } });

      expect(await screen.findByText('Tag obrigatória ausente')).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: /Salvar Modelo/i });
      expect(saveBtn).toBeDisabled();
    });

    it('deve inserir tag clicada no chip e permitir salvar', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: {
          ...mockConnectedInstance,
          template_confirmation: 'Olá, {cliente}! Link: {link} {horario}',
        },
        error: null,
      });

      render(<Whatsapp />);

      const textarea = await screen.findByRole('textbox', { name: /Editor de mensagem para Confirmação de Agendamento/i });
      fireEvent.change(textarea, { target: { value: 'Olá, {cliente}! Link: {link}' } });

      const horarioChip = screen.getByRole('button', { name: /Horário/i });
      fireEvent.click(horarioChip);

      const saveBtn = screen.getByRole('button', { name: /Salvar Modelo/i });
      expect(saveBtn).not.toBeDisabled();

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockAddToast).toHaveBeenCalledWith('Modelo de Confirmação salvo com sucesso!', 'success');
      });
    });

    it('deve restaurar o texto padrão ao clicar em Restaurar Padrão', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });

      render(<Whatsapp />);

      const textarea = await screen.findByRole('textbox', { name: /Editor de mensagem para Confirmação de Agendamento/i }) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Mensagem customizada antiga {link}' } });

      const resetBtn = screen.getByRole('button', { name: /Restaurar Padrão/i });
      fireEvent.click(resetBtn);

      expect(textarea.value).toContain('foi confirmado!');
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('Texto padrão de Confirmação restaurado'), 'info');
    });

    it('deve enviar teste do modelo de template diretamente via send-manual', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockConnectedInstance,
        error: null,
      });
      mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

      render(<Whatsapp />);

      const phoneInput = await screen.findByPlaceholderText('DDD + Número (ex: 11999999999)');
      fireEvent.change(phoneInput, { target: { value: '11988887777' } });

      const testBtn = screen.getByRole('button', { name: /Testar/i });
      fireEvent.click(testBtn);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith('whatsapp-integration/send-manual', {
          body: {
            tenant_id: 'tenant-test-id',
            number: '11988887777',
            text: expect.stringContaining('Lucas Silva'),
          },
        });
        expect(mockAddToast).toHaveBeenCalledWith('Teste do modelo disparado com sucesso para 11988887777!', 'success');
      });
    });
  });
});

