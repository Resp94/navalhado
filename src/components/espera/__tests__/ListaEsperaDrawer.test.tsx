import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaEsperaDrawer } from '../ListaEsperaDrawer';
import { EsperaRepository } from '../../../modules/espera/EsperaRepository';
import type { IEsperaAdapter } from '../../../modules/espera/types';

describe('ListaEsperaDrawer', () => {
  const mockAdapter: IEsperaAdapter = {
    listarPorData: vi.fn(),
    adicionar: vi.fn(),
    atualizarStatus: vi.fn(),
    remover: vi.fn(),
  };

  const mockRepo = new EsperaRepository(mockAdapter);
  const mockOnClose = vi.fn();
  const mockOnEncaixar = vi.fn();

  const professionals = [
    { id: 'prof-1', name: 'Alisson Barber' },
  ];
  const services = [
    { id: 'srv-1', name: 'Corte', price: 35 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza se isOpen for false', () => {
    const { container } = render(
      <ListaEsperaDrawer
        isOpen={false}
        tenantId="t-1"
        currentDateIso="2026-08-16"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        esperaRepo={mockRepo}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza clientes na fila de espera', async () => {
    vi.mocked(mockAdapter.listarPorData).mockResolvedValueOnce([
      {
        id: 'w-1',
        tenant_id: 't-1',
        customer_name: 'Marcos Paulo',
        customer_phone: '11988887777',
        status: 'aguardando',
      },
    ]);

    render(
      <ListaEsperaDrawer
        isOpen={true}
        tenantId="t-1"
        currentDateIso="2026-08-16"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        esperaRepo={mockRepo}
      />
    );

    expect(screen.getByRole('heading', { name: /Fila de espera da barbearia/i })).toBeInTheDocument();
    expect(await screen.findByText('Marcos Paulo')).toBeInTheDocument();
  });

  it('aciona callback onEncaixar ao clicar em Puxar para a cadeira', async () => {
    const fakeEntry = {
      id: 'w-1',
      tenant_id: 't-1',
      customer_name: 'Marcos Paulo',
      customer_phone: '11988887777',
      status: 'aguardando' as const,
    };
    vi.mocked(mockAdapter.listarPorData).mockResolvedValueOnce([fakeEntry]);

    render(
      <ListaEsperaDrawer
        isOpen={true}
        tenantId="t-1"
        currentDateIso="2026-08-16"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        esperaRepo={mockRepo}
      />
    );

    const btnEncaixar = await screen.findByRole('button', { name: /Puxar para a cadeira/i });
    fireEvent.click(btnEncaixar);

    expect(mockOnEncaixar).toHaveBeenCalledWith(fakeEntry);
  });

  it('permite trocar a data da fila de espera pelo seletor de data', async () => {
    const mockOnDateChange = vi.fn();
    vi.mocked(mockAdapter.listarPorData).mockResolvedValue([
      {
        id: 'w-2',
        tenant_id: 't-1',
        customer_name: 'Lucas Ferreira',
        customer_phone: '11977776666',
        status: 'aguardando' as const,
      },
    ]);

    render(
      <ListaEsperaDrawer
        isOpen={true}
        tenantId="t-1"
        currentDateIso="2026-08-16"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        onDateChange={mockOnDateChange}
        esperaRepo={mockRepo}
      />
    );

    const dateInput = screen.getByLabelText(/Data da fila:/i);
    expect(dateInput).toHaveValue('2026-08-16');

    fireEvent.change(dateInput, { target: { value: '2026-08-18' } });

    expect(mockOnDateChange).toHaveBeenCalledWith('2026-08-18');
    expect(mockAdapter.listarPorData).toHaveBeenCalledWith('t-1', '2026-08-18');
  });

  it('renderiza o formulário NOVO CLIENTE NA FILA e o empty state exatamente como no mockup', async () => {
    vi.mocked(mockAdapter.listarPorData).mockResolvedValueOnce([]);

    render(
      <ListaEsperaDrawer
        isOpen={true}
        tenantId="t-1"
        currentDateIso="2026-09-03"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        esperaRepo={mockRepo}
      />
    );

    // Cabeçalho e Seletor de data
    expect(screen.getByRole('heading', { name: /Fila de espera da barbearia/i })).toBeInTheDocument();
    expect(screen.getByText(/Data da fila:/i)).toBeInTheDocument();
    expect(screen.getByText('03/09/2026')).toBeInTheDocument();

    // Card de Formulário
    expect(screen.getByText('NOVO CLIENTE NA FILA')).toBeInTheDocument();
    expect(screen.getByText('NOME DO CLIENTE *')).toBeInTheDocument();
    expect(screen.getByText('WHATSAPP OU CELULAR')).toBeInTheDocument();
    expect(screen.getByText('PROFISSIONAL')).toBeInTheDocument();
    expect(screen.getByText('SERVIÇO')).toBeInTheDocument();
    expect(screen.getByText('OBSERVAÇÕES')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar à fila de espera/i })).toBeInTheDocument();

    // Seção Aguardando na casa e Empty State
    expect(screen.getByText('AGUARDANDO NA CASA (0)')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum cliente na fila de espera hoje.')).toBeInTheDocument();

    // Botão Cancelar fecha o formulário e permite reabrir
    const cancelarBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelarBtn);
    expect(screen.queryByText('NOVO CLIENTE NA FILA')).toBeNull();

    const reabrirBtn = screen.getByRole('button', { name: /Novo cliente na fila/i });
    fireEvent.click(reabrirBtn);
    expect(screen.getByText('NOVO CLIENTE NA FILA')).toBeInTheDocument();
  });

  it('abre o CustomDatePicker ao clicar na caixa de data e permite selecionar novo dia', async () => {
    const mockOnDateChange = vi.fn();

    render(
      <ListaEsperaDrawer
        isOpen={true}
        tenantId="t-1"
        currentDateIso="2026-09-03"
        professionals={professionals}
        services={services}
        onClose={mockOnClose}
        onEncaixar={mockOnEncaixar}
        onDateChange={mockOnDateChange}
        esperaRepo={mockRepo}
      />
    );

    const datePickerBox = screen.getByLabelText(/Escolher data na agenda/i);
    expect(screen.queryByRole('dialog', { name: /Seletor de data/i })).toBeNull();

    // Clica para abrir o datepicker customizado
    fireEvent.click(datePickerBox);
    expect(screen.getByRole('dialog', { name: /Seletor de data/i })).toBeInTheDocument();

    // Clica no dia 15 no calendário
    const dayBtn = screen.getByRole('button', { name: '15' });
    fireEvent.click(dayBtn);

    // Deve acionar onDateChange e fechar o datepicker
    expect(mockOnDateChange).toHaveBeenCalledWith('2026-09-15');
    expect(screen.queryByRole('dialog', { name: /Seletor de data/i })).toBeNull();
  });
});


