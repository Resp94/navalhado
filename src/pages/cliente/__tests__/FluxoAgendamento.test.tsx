import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FluxoAgendamento } from '../FluxoAgendamento';

const { mockAddToast, mockRpc } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

const incompleteDetails = {
  customer_id: 'customer-1',
  customer_name: 'Cliente',
  tenant_id: 'tenant-1',
  tenant_name: 'Barbearia Navalhado',
  tenant_phone: '5592999999999',
  cadastro_completo: false,
};

function renderBookingRoute(initialEntry = '/cliente/token-abc/agendar') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/cliente/:token/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FluxoAgendamento - cadastro inicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('bloqueia o catálogo quando o token da rota pertence a cadastro incompleto', async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [incompleteDetails], error: null };
      }

      throw new Error(`Catálogo carregado antes do cadastro: ${name}`);
    });

    renderBookingRoute();

    expect(
      await screen.findByRole('heading', { name: 'Como podemos chamar você?' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome/i)).toBeInTheDocument();
    expect(screen.queryByText('Selecione o Serviço')).not.toBeInTheDocument();
  });
  it('valida o nome antes de chamar a RPC de conclusão', async () => {
    mockRpc.mockResolvedValueOnce({ data: [incompleteDetails], error: null });

    renderBookingRoute();
    await screen.findByRole('heading', { name: 'Como podemos chamar você?' });

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um nome com 2 a 100 caracteres.',
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      'complete_customer_registration',
      expect.anything(),
    );
  });

  it('conclui com o token da rota e s� ent�o libera o cat�logo', async () => {
    const completedDetails = { ...incompleteDetails, customer_name: 'Maria Silva', cadastro_completo: true };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [incompleteDetails], error: null };
      }
      if (name === 'complete_customer_registration') {
        expect(params).toEqual({ p_token: 'token-abc', p_name: 'Maria Silva' });
        return { data: [completedDetails], error: null };
      }
      if (name === 'get_services_by_customer_token') {
        return { data: [service], error: null };
      }
      if (name === 'get_professionals_by_customer_token') {
        return { data: [], error: null };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    await screen.findByRole('heading', { name: 'Como podemos chamar você?' });
    fireEvent.change(screen.getByLabelText(/Nome/i), {
      target: { value: '  Maria Silva  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(await screen.findByRole('heading', { name: 'Selecione o Serviço' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Como podemos chamar você?' }),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).not.toBe('/cliente/agendar');
  });

  it('mantm o formulrio e mostra toast quando a concluso falha', async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [incompleteDetails], error: null };
      }
      if (name === 'complete_customer_registration') {
        return { data: null, error: { message: 'falhou' } };
      }
      throw new Error(`Catálogo não deveria carregar: ${name}`);
    });

    renderBookingRoute();
    await screen.findByRole('heading', { name: 'Como podemos chamar você?' });
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Maria Silva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(
      await screen.findByRole('heading', { name: 'Como podemos chamar você?' }),
    ).toBeInTheDocument();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('salvar seu nome'),
      'error',
    );
  });

  it('cliente completo pula o formul�rio e carrega o cat�logo', async () => {
    const completedDetails = { ...incompleteDetails, customer_name: 'Maria', cadastro_completo: true };
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();

    expect(await screen.findByRole('heading', { name: 'Selecione o Serviço' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Como podemos chamar você?' }),
    ).not.toBeInTheDocument();
  });

  it('carrega slots pela RPC protegida com o token do cliente', async () => {
    const completedDetails = { ...incompleteDetails, customer_name: 'Maria', cadastro_completo: true };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: [], error: null };
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_available_slots_by_token', {
        p_token: 'token-abc',
        p_service_id: 'service-1',
        p_professional_id: null,
        p_date: expect.any(String),
        p_exclude_appointment_id: null,
      });
    });
  });

  it('exibe mensagem amigável de expediente encerrado quando não há slots para a data de hoje', async () => {
    const completedDetails = { 
      ...incompleteDetails, 
      customer_name: 'Maria', 
      cadastro_completo: true,
      business_hours: {
        segunda: { active: true, open: '09:00', close: '18:00' },
        terca: { active: true, open: '09:00', close: '18:00' },
        quarta: { active: true, open: '09:00', close: '18:00' },
        quinta: { active: true, open: '09:00', close: '18:00' },
        sexta: { active: true, open: '09:00', close: '18:00' },
        sabado: { active: true, open: '09:00', close: '15:00' },
        domingo: { active: false, open: '09:00', close: '12:00' }
      }
    };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: [], error: null };
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    expect(await screen.findByText(/expediente da barbearia para o dia de hoje já foi encerrado|Nenhum horário disponível/i)).toBeInTheDocument();
  });
});
