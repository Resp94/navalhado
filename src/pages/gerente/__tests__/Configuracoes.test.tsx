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
  mockEqSelect,
  mockEqUpdate,
  mockSingle,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockUpdate = vi.fn();
  const mockSingle = vi.fn();
  const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });

  const mockSupabaseClient = {
    from: vi.fn().mockImplementation((table: string) => {
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
    });
  });
});
