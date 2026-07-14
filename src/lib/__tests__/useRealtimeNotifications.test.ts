import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeNotifications } from '../useRealtimeNotifications';

// Usamos vi.hoisted para criar todas as variáveis mock que precisam ser acessadas pelos vi.mock hoisted.
const {
  mockSupabase,
  mockQueryBuilder,
  mockSelect,
  mockUpdate,
  mockEq,
  mockOrder,
  mockLimit,
  mockChannel,
  mockAddToast,
  setQueryResolveValue,
  getRealtimeCallback,
  setRealtimeCallback,
  mockAudioContext
} = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockAddToast = vi.fn();

  let queryResolveValue: any = { data: [], error: null };
  let realtimeCallback: ((payload: any) => void) | null = null;

  const mockQueryBuilder = {
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    then: vi.fn().mockImplementation((onfulfilled) => {
      return Promise.resolve(queryResolveValue).then(onfulfilled);
    }),
  };

  const mockChannel = {
    on: vi.fn().mockImplementation((event, filter, callback) => {
      realtimeCallback = callback;
      return mockChannel;
    }),
    subscribe: vi.fn().mockImplementation((callback) => {
      if (callback) callback('SUBSCRIBED');
      return mockChannel;
    }),
    unsubscribe: vi.fn().mockResolvedValue({}),
  };

  const mockSupabase = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn().mockResolvedValue({}),
  };

  const mockOscillator = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: {
      setValueAtTime: vi.fn(),
    },
    type: 'sine',
  };

  const mockGain = {
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  };

  const mockAudioContext = {
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
    currentTime: 0,
    close: vi.fn(),
    destination: {},
  };

  return {
    mockSupabase,
    mockQueryBuilder,
    mockSelect,
    mockUpdate,
    mockEq,
    mockOrder,
    mockLimit,
    mockChannel,
    mockAddToast,
    setQueryResolveValue: (val: any) => { queryResolveValue = val; },
    getRealtimeCallback: () => realtimeCallback,
    setRealtimeCallback: (cb: any) => { realtimeCallback = cb; },
    mockAudioContext
  };
});

// Mock do supabase e do useToast usando os mocks hoisted
vi.mock('../supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}));

// Mock do Web Audio API usando classe para evitar warnings de construtor do Vitest
class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator = mockAudioContext.createOscillator;
  createGain = mockAudioContext.createGain;
  close = mockAudioContext.close;
}
global.AudioContext = MockAudioContext as any;

describe('useRealtimeNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRealtimeCallback(null);
    setQueryResolveValue({ data: [], error: null });
  });

  const waitForEffects = async () => {
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  };

  it('deve inicializar com a lista de notificações vazia e unreadCount 0', async () => {
    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('deve buscar as últimas notificações não lidas para o tenant', async () => {
    const mockNotifications = [
      { id: '1', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_created', title: 'Novo Agendamento', message: 'Cliente agendou um corte', read: false, created_at: '2026-07-14T10:00:00Z' },
      { id: '2', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_canceled', title: 'Agendamento Cancelado', message: 'Cliente cancelou a reserva', read: false, created_at: '2026-07-14T10:30:00Z' },
    ];
    setQueryResolveValue({ data: mockNotifications, error: null });

    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockEq).toHaveBeenCalledWith('read', false);
    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(2);
  });

  it('deve buscar as notificações incluindo filtro de profissional se fornecido', async () => {
    setQueryResolveValue({ data: [], error: null });

    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1', profissionalId: 'prof-1' }));
    await waitForEffects();

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockEq).toHaveBeenCalledWith('profissional_id', 'prof-1');
  });

  it('deve marcar uma notificação específica como lida', async () => {
    const mockNotifications = [
      { id: '1', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_created', title: 'Notif 1', message: 'Msg 1', read: false, created_at: '2026-07-14T10:00:00Z' },
      { id: '2', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_created', title: 'Notif 2', message: 'Msg 2', read: false, created_at: '2026-07-14T10:30:00Z' },
    ];
    setQueryResolveValue({ data: mockNotifications, error: null });

    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    // Primeiro busca as notificações
    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.unreadCount).toBe(2);

    // Mock do update do Supabase
    setQueryResolveValue({ data: null, error: null });

    await act(async () => {
      await result.current.markAsRead('1');
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(mockUpdate).toHaveBeenCalledWith({ read: true });
    expect(mockEq).toHaveBeenCalledWith('id', '1');

    // Deve atualizar o estado local removendo a notificação marcada como lida
    expect(result.current.notifications.map(n => n.id)).toEqual(['2']);
    expect(result.current.unreadCount).toBe(1);
  });

  it('deve marcar todas as notificações do tenant como lidas', async () => {
    const mockNotifications = [
      { id: '1', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_created', title: 'Notif 1', message: 'Msg 1', read: false, created_at: '2026-07-14T10:00:00Z' },
      { id: '2', tenant_id: 'tenant-1', profissional_id: null, type: 'appointment_created', title: 'Notif 2', message: 'Msg 2', read: false, created_at: '2026-07-14T10:30:00Z' },
    ];
    setQueryResolveValue({ data: mockNotifications, error: null });

    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.unreadCount).toBe(2);

    setQueryResolveValue({ data: null, error: null });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(mockUpdate).toHaveBeenCalledWith({ read: true });
    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockEq).toHaveBeenCalledWith('read', false);

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('deve assinar o canal do Realtime e reagir a novos inserts', async () => {
    renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    expect(mockSupabase.channel).toHaveBeenCalledWith('public:notifications');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('deve adicionar toast e tocar som ao receber uma notificação pertinente pelo canal do Realtime', async () => {
    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    const realtimeCallback = getRealtimeCallback();
    expect(realtimeCallback).not.toBeNull();

    const newNotification = {
      id: '3',
      tenant_id: 'tenant-1',
      profissional_id: null,
      type: 'appointment_created',
      title: 'Novo Agendamento Realtime',
      message: 'Cliente agendou via app',
      read: false,
      created_at: '2026-07-14T11:00:00Z'
    };

    await act(async () => {
      // Dispara o callback simulado do canal de tempo real
      if (realtimeCallback) {
        realtimeCallback({ new: newNotification });
      }
    });

    // Deve ter tocado o som
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();

    // Deve disparar o toast
    expect(mockAddToast).toHaveBeenCalledWith('Cliente agendou via app', 'info');

    // Deve atualizar a lista de notificações locais e o contador
    expect(result.current.notifications).toContainEqual(newNotification);
    expect(result.current.unreadCount).toBe(1);
  });

  it('deve ignorar notificações de outros tenants no Realtime', async () => {
    const { result } = renderHook(() => useRealtimeNotifications({ tenantId: 'tenant-1' }));
    await waitForEffects();

    const realtimeCallback = getRealtimeCallback();

    const foreignNotification = {
      id: '4',
      tenant_id: 'tenant-outro',
      profissional_id: null,
      type: 'appointment_created',
      title: 'Novo Agendamento Realtime',
      message: 'Cliente agendou em outro salão',
      read: false,
      created_at: '2026-07-14T11:00:00Z'
    };

    await act(async () => {
      if (realtimeCallback) {
        realtimeCallback({ new: foreignNotification });
      }
    });

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});
