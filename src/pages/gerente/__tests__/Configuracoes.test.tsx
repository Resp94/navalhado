import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Configuracoes } from '../Configuracoes';

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

const { 
  mockAddToast, 
  mockSupabaseClient, 
  mockUpdate, 
  mockEqUpdate,
  mockSingle,
  mockRefreshTenant,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockUpdate = vi.fn();
  const mockSingle = vi.fn();
  const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
  const mockRefreshTenant = vi.fn().mockResolvedValue(undefined);

  const mockSupabaseClient = {
    from: vi.fn().mockImplementation((_table: string) => {
      return {
        select: vi.fn().mockReturnValue({ eq: mockEqSelect }),
        update: mockUpdate.mockReturnValue({ eq: mockEqUpdate }),
      };
    }),
  };

  return {
    mockAddToast, 
    mockSupabaseClient, 
    mockUpdate, 
    mockEqSelect,
    mockEqUpdate,
    mockSingle,
    mockRefreshTenant,
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
    refreshTenant: mockRefreshTenant,
  }),
}));

// Mock do Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Configuracoes Page - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar os dados cadastrais da barbearia do banco de dados e preencher o formulário', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });

    render(<Configuracoes />);

    // Verificar se os inputs estão preenchidos com os dados simulados
    await waitFor(() => {
      expect(screen.getByLabelText(/Nome da Barbearia/i)).toHaveValue('Barbearia Estilo');
      expect(screen.getByLabelText(/E-mail de Contato/i)).toHaveValue('contato@barbeariaestilo.com');
      expect(screen.getByLabelText(/Telefone/i)).toHaveValue('(92) 98888-8888');
      expect(screen.getByLabelText(/Endereço/i)).toHaveValue('Avenida Djalma Batista, 123');
      expect(screen.getByLabelText(/Fuso Horário/i)).toHaveValue('America/Manaus');
    });
  });

  it('deve atualizar os dados e disparar o update no Supabase ao salvar', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });
    mockEqUpdate.mockResolvedValue({ error: null });

    render(<Configuracoes />);

    // Esperar carregar dados
    await screen.findByLabelText(/Nome da Barbearia/i);

    // Alterar os campos
    fireEvent.change(screen.getByLabelText(/Nome da Barbearia/i), { target: { value: 'Novo Nome Barbearia' } });
    fireEvent.change(screen.getByLabelText(/Endereço/i), { target: { value: 'Rua Nova, 456' } });
    fireEvent.change(screen.getByLabelText(/Fuso Horário/i), { target: { value: 'America/Sao_Paulo' } });

    // Clicar em salvar
    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Verificar se a chamada do update foi feita com os novos valores
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Novo Nome Barbearia',
        address: 'Rua Nova, 456',
        timezone: 'America/Sao_Paulo',
      }));
      expect(mockAddToast).toHaveBeenCalledWith('Configurações atualizadas com sucesso.', 'success');
      expect(mockRefreshTenant).toHaveBeenCalled();
    });
  });

  it('exibe a mensagem do Supabase quando a configuração é rejeitada pela regra de escala', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });
    mockEqUpdate.mockResolvedValue({
      error: {
        code: '22023',
        message: 'A escala de segunda deve ficar entre 09:00 e 20:00',
      },
    });

    render(<Configuracoes />);
    await screen.findByLabelText(/Nome da Barbearia/i);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'A escala de segunda deve ficar entre 09:00 e 20:00',
        'error',
      );
    });
    expect(mockAddToast).not.toHaveBeenCalledWith('[object Object]', 'error');
  });

  it('normaliza chaves inglesas e dias parciais antes de editar o expediente', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'tenant-test-id',
        name: 'Barbearia Estilo',
        business_hours: {
          monday: { active: true, start: '08:00', end: '20:00' },
          tuesday: { close: '20:00' },
        },
      },
      error: null,
    });

    render(<Configuracoes />);

    await screen.findByLabelText('Terça-feira');
    expect(screen.getByLabelText('Abertura Terça-feira')).toHaveValue('09:00');
    expect(screen.getByLabelText('Fechamento Terça-feira')).toHaveValue('20:00');
    expect(screen.getByLabelText('Abertura Segunda-feira')).toHaveValue('08:00');
  });

  it('deve renderizar a seção de horário de funcionamento geral com todos os dias, checkboxes e inputs de horário', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
      business_hours: {
        segunda: { active: true, open: '09:00', close: '18:00' },
        terca: { active: true, open: '09:00', close: '18:00' },
        quarta: { active: true, open: '09:00', close: '18:00' },
        quinta: { active: true, open: '09:00', close: '18:00' },
        sexta: { active: true, open: '09:00', close: '18:00' },
        sabado: { active: false, open: '09:00', close: '15:00' },
        domingo: { active: false, open: '09:00', close: '12:00' },
      }
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });

    render(<Configuracoes />);

    // Verificar se o cabeçalho da seção está presente
    await screen.findByRole('heading', { name: /Horário de funcionamento geral/i });

    // Verificar se renderizou os dias da semana
    const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    
    for (const dia of dias) {
      expect(screen.getByText(dia)).toBeInTheDocument();
    }

    // Verificar se os inputs e checkboxes estão com os estados corretos do mock
    // Segunda-feira (Ativo, 09:00 às 18:00)
    const checkboxSegunda = screen.getByLabelText('Segunda-feira') as HTMLInputElement;
    expect(checkboxSegunda.checked).toBe(true);

    const inputAberturaSegunda = screen.getByLabelText('Abertura Segunda-feira') as HTMLInputElement;
    const inputFechamentoSegunda = screen.getByLabelText('Fechamento Segunda-feira') as HTMLInputElement;
    expect(inputAberturaSegunda.value).toBe('09:00');
    expect(inputFechamentoSegunda.value).toBe('18:00');

    // Sábado (Inativo, 09:00 às 15:00)
    const checkboxSabado = screen.getByLabelText('Sábado') as HTMLInputElement;
    expect(checkboxSabado.checked).toBe(false);
    
    const inputAberturaSabado = screen.getByLabelText('Abertura Sábado') as HTMLInputElement;
    expect(inputAberturaSabado).toBeDisabled();
  });

  it('deve atualizar os horários de funcionamento geral no Supabase ao salvar o formulário', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
      business_hours: {
        segunda: { active: true, open: '09:00', close: '18:00' },
        terca: { active: true, open: '09:00', close: '18:00' },
        quarta: { active: true, open: '09:00', close: '18:00' },
        quinta: { active: true, open: '09:00', close: '18:00' },
        sexta: { active: true, open: '09:00', close: '18:00' },
        sabado: { active: false, open: '09:00', close: '15:00' },
        domingo: { active: false, open: '09:00', close: '12:00' },
      }
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });
    mockEqUpdate.mockResolvedValue({ error: null });

    render(<Configuracoes />);

    // Esperar carregar os dados
    await screen.findByLabelText('Segunda-feira');

    // Alterar o horário de Segunda-feira para 10:00 às 19:00
    const inputAberturaSegunda = screen.getByLabelText('Abertura Segunda-feira');
    fireEvent.change(inputAberturaSegunda, { target: { value: '10:00' } });

    const inputFechamentoSegunda = screen.getByLabelText('Fechamento Segunda-feira');
    fireEvent.change(inputFechamentoSegunda, { target: { value: '19:00' } });

    // Ativar o Sábado e alterar o horário para 08:00 às 14:00
    const checkboxSabado = screen.getByLabelText('Sábado');
    fireEvent.click(checkboxSabado); // Clica para ativar

    const inputAberturaSabado = screen.getByLabelText('Abertura Sábado');
    fireEvent.change(inputAberturaSabado, { target: { value: '08:00' } });

    const inputFechamentoSabado = screen.getByLabelText('Fechamento Sábado');
    fireEvent.change(inputFechamentoSabado, { target: { value: '14:00' } });

    // Salvar as alterações
    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        business_hours: {
          segunda: { active: true, open: '10:00', close: '19:00' },
          terca: { active: true, open: '09:00', close: '18:00' },
          quarta: { active: true, open: '09:00', close: '18:00' },
          quinta: { active: true, open: '09:00', close: '18:00' },
          sexta: { active: true, open: '09:00', close: '18:00' },
          sabado: { active: true, open: '08:00', close: '14:00' },
          domingo: { active: false, open: '09:00', close: '12:00' },
        }
      }));
      expect(mockAddToast).toHaveBeenCalledWith('Configurações atualizadas com sucesso.', 'success');
    });
  });

  it('deve carregar as regras de agendamento e permitir alterar através dos chips rápidos', async () => {
    const mockTenantData = {
      id: 'tenant-test-id',
      name: 'Barbearia Estilo',
      email: 'contato@barbeariaestilo.com',
      phone: '(92) 98888-8888',
      address: 'Avenida Djalma Batista, 123',
      timezone: 'America/Manaus',
      slot_interval_minutes: 30,
      min_booking_lead_time_minutes: 15,
      min_cancellation_lead_time_minutes: 120,
    };

    mockSingle.mockResolvedValue({ data: mockTenantData, error: null });
    mockEqUpdate.mockResolvedValue({ error: null });

    render(<Configuracoes />);

    // Verificar se o cabeçalho das regras está presente
    await screen.findByRole('heading', { name: /Regras de agendamento online/i });

    // Verificar se os inputs numéricos estão com os valores iniciais do mock
    const slotInput = screen.getByLabelText(/Intervalo entre Horários na Grade/i) as HTMLInputElement;
    const bookingLeadInput = screen.getByLabelText(/Antecedência Mínima para Agendar/i) as HTMLInputElement;
    const cancelLeadInput = screen.getByLabelText(/Antecedência Mínima para Cancelar/i) as HTMLInputElement;

    expect(slotInput.value).toBe('30');
    expect(bookingLeadInput.value).toBe('15');
    expect(cancelLeadInput.value).toBe('120');

    // Clicar nos chips para alterar os valores
    const chip20min = screen.getByRole('button', { name: '20 min' });
    fireEvent.click(chip20min);
    expect(slotInput.value).toBe('20');

    const chipSemLead = screen.getByRole('button', { name: 'Sem antecedência' });
    fireEvent.click(chipSemLead);
    expect(bookingLeadInput.value).toBe('0');

    const chip4hCancel = screen.getByRole('button', { name: '4 horas' });
    fireEvent.click(chip4hCancel);
    expect(cancelLeadInput.value).toBe('240');

    // Salvar alterações
    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        slot_interval_minutes: 20,
        min_booking_lead_time_minutes: 0,
        min_cancellation_lead_time_minutes: 240,
      }));
      expect(mockAddToast).toHaveBeenCalledWith('Configurações atualizadas com sucesso.', 'success');
    });
  });
});
