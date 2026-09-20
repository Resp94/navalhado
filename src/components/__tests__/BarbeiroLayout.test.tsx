import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import { BarbeiroLayout } from '../BarbeiroLayout';
import type { BarbeiroContextType } from '../BarbeiroLayout';

const { mockAddToast, mockNavigate, mockGetUser, mockFrom, filters, tables } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
  tables: {} as Record<string, unknown>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../Toast', () => ({ useToast: () => ({ addToast: mockAddToast }) }));

vi.mock('../../lib/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args), signOut: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const ContextProbe = () => {
  const context = useOutletContext<BarbeiroContextType>();
  return (
    <div>
      <span data-testid="tenant-id">{context.tenantId}</span>
      <span data-testid="tenant-name">{context.tenantName}</span>
      <span data-testid="professional-id">{context.professionalId || 'sem-vinculo'}</span>
      <span data-testid="timezone">{context.timezone}</span>
    </div>
  );
};

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/minha-agenda']}>
      <Routes>
        <Route element={<BarbeiroLayout />}>
          <Route path="/minha-agenda" element={<ContextProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('BarbeiroLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filters.length = 0;
    tables.users = { name: 'Diego Barbeiro', role: 'barbeiro', tenant_id: 'tenant-alpha' };
    tables.tenants = {
      id: 'tenant-alpha',
      name: 'Barbearia Alpha',
      slug: 'alpha',
      logo_url: null,
      timezone: 'America/Manaus',
      business_hours: null,
      slot_interval_minutes: 40,
    };
    tables.professionals = { id: 'prof-diego' };
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-diego' } } });
    mockFrom.mockImplementation((table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      };
      const result = () => Promise.resolve({ data: tables[table] ?? null, error: null });
      builder.single = result;
      builder.maybeSingle = result;
      return builder;
    });
  });

  it('entrega a barbearia e o profissional do vínculo do usuário para as páginas', async () => {
    renderLayout();

    await waitFor(() => expect(screen.getByTestId('tenant-id')).toHaveTextContent('tenant-alpha'));
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('Barbearia Alpha');
    expect(screen.getByTestId('professional-id')).toHaveTextContent('prof-diego');
    expect(screen.getByTestId('timezone')).toHaveTextContent('America/Manaus');
  });

  it('busca a barbearia e o profissional pelo usuário logado, sem valor externo', async () => {
    renderLayout();

    await waitFor(() => expect(screen.getByTestId('tenant-id')).toBeInTheDocument());
    expect(filters).toEqual(
      expect.arrayContaining([
        { table: 'users', column: 'id', value: 'user-diego' },
        { table: 'tenants', column: 'id', value: 'tenant-alpha' },
        { table: 'professionals', column: 'user_id', value: 'user-diego' },
        { table: 'professionals', column: 'tenant_id', value: 'tenant-alpha' },
      ])
    );
  });

  it('sem cadastro de profissional na barbearia, entrega o vínculo vazio', async () => {
    tables.professionals = null;

    renderLayout();

    await waitFor(() => expect(screen.getByTestId('professional-id')).toHaveTextContent('sem-vinculo'));
  });

  it('barbeiro sem barbearia vinculada é mandado para o login', async () => {
    tables.users = { name: 'Diego Barbeiro', role: 'barbeiro', tenant_id: null };

    renderLayout();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(screen.queryByTestId('tenant-id')).not.toBeInTheDocument();
  });

  it('usuário que não é barbeiro é mandado para o login', async () => {
    tables.users = { name: 'Gerente', role: 'gerente', tenant_id: 'tenant-alpha' };

    renderLayout();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(mockAddToast).toHaveBeenCalledWith('Acesso restrito para colaboradores da barbearia.', 'warning');
    expect(screen.queryByTestId('tenant-id')).not.toBeInTheDocument();
  });
});
