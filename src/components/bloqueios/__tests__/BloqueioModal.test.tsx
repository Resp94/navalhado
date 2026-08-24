import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BloqueioModal } from '../BloqueioModal';
import { BloqueioRepository } from '../../../modules/bloqueios/BloqueioRepository';
import type { IBloqueioAdapter } from '../../../modules/bloqueios/types';

describe('BloqueioModal', () => {
  const mockAdapter: IBloqueioAdapter = {
    listarPorData: vi.fn(),
    criarBloqueio: vi.fn(),
    removerBloqueio: vi.fn(),
  };

  const mockRepo = new BloqueioRepository(mockAdapter);
  const mockOnClose = vi.fn();
  const mockOnBloqueioCriado = vi.fn();

  const professionals = [
    { id: 'prof-1', name: 'Alisson Barber' },
    { id: 'prof-2', name: 'Diego Navalha' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza se isOpen for false', () => {
    const { container } = render(
      <BloqueioModal
        isOpen={false}
        tenantId="t-1"
        professionals={professionals}
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('cria bloqueio de horário com sucesso selecionando horários da grade', async () => {
    const fakeBloqueio = {
      id: 'blk-1',
      tenant_id: 't-1',
      professional_id: 'prof-1',
      start_time: '2026-08-16T12:00:00.000Z',
      end_time: '2026-08-16T13:00:00.000Z',
      reason: 'Almoço',
      is_all_day: false,
    };
    vi.mocked(mockAdapter.criarBloqueio).mockResolvedValueOnce(fakeBloqueio);

    render(
      <BloqueioModal
        isOpen={true}
        tenantId="t-1"
        professionals={professionals}
        defaultDateIso="2026-08-17"
        defaultProfessionalId="prof-1"
        slotIntervalMinutes={30}
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    expect(screen.getByText(/Bloquear horário/i)).toBeInTheDocument();

    // Clicar no botão 'Todos' para selecionar todos os slots da grade
    const selectAllBtn = screen.getByRole('button', { name: /Todos/i });
    fireEvent.click(selectAllBtn);

    const submitBtn = screen.getByRole('button', { name: /Confirmar bloqueio/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAdapter.criarBloqueio).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't-1',
          professional_id: 'prof-1',
          reason: 'Almoço',
          is_all_day: false,
        })
      );
      expect(mockOnBloqueioCriado).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('cria bloqueio de dia inteiro quando selecionado', async () => {
    const fakeBloqueio = {
      id: 'blk-all-day',
      tenant_id: 't-1',
      professional_id: 'prof-1',
      start_time: '2026-08-17T03:00:00.000Z',
      end_time: '2026-08-18T02:59:00.000Z',
      reason: 'Folga do dia',
      is_all_day: true,
    };
    vi.mocked(mockAdapter.criarBloqueio).mockResolvedValueOnce(fakeBloqueio);

    render(
      <BloqueioModal
        isOpen={true}
        tenantId="t-1"
        professionals={professionals}
        defaultDateIso="2026-08-17"
        defaultProfessionalId="prof-1"
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    const allDayCheckbox = screen.getByLabelText(/Bloquear o expediente inteiro/i);
    fireEvent.click(allDayCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Confirmar bloqueio/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAdapter.criarBloqueio).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't-1',
          professional_id: 'prof-1',
          is_all_day: true,
        })
      );
    });
  });

  it('não exibe horários que já possuem agendamento ativo na lista de slots para bloquear', () => {
    const existingAppointments = [
      {
        id: 'app-1',
        start_time: '2026-08-17T13:00:00.000Z', // 10:00 no fuso de São Paulo
        end_time: '2026-08-17T13:30:00.000Z',   // 10:30 no fuso de São Paulo
        status: 'confirmed',
        professional_id: 'prof-1',
      },
    ];

    render(
      <BloqueioModal
        isOpen={true}
        tenantId="t-1"
        professionals={professionals}
        appointments={existingAppointments}
        defaultDateIso="2026-08-17"
        defaultProfessionalId="prof-1"
        slotIntervalMinutes={30}
        timezone="America/Sao_Paulo"
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    // O horário das 10:00 - 10:30 não deve aparecer porque está ocupado
    expect(screen.queryByText('10:00 - 10:30')).toBeNull();
    // Outros horários livres devem aparecer
    expect(screen.getByText('09:00 - 09:30')).toBeInTheDocument();
  });

  it('não exibe horários que já foram bloqueados na lista de slots para bloquear', () => {
    const existingBlockedSlots = [
      {
        id: 'blk-1',
        tenant_id: 't-1',
        professional_id: 'prof-1',
        start_time: '2026-08-17T15:00:00.000Z', // 12:00 no fuso de São Paulo
        end_time: '2026-08-17T16:00:00.000Z',   // 13:00 no fuso de São Paulo
        reason: 'Almoço',
        is_all_day: false,
      },
    ];

    render(
      <BloqueioModal
        isOpen={true}
        tenantId="t-1"
        professionals={professionals}
        blockedSlots={existingBlockedSlots}
        defaultDateIso="2026-08-17"
        defaultProfessionalId="prof-1"
        slotIntervalMinutes={30}
        timezone="America/Sao_Paulo"
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    // Os horários das 12:00 - 12:30 e 12:30 - 13:00 não devem aparecer como opção porque já estão bloqueados
    expect(screen.queryByText('12:00 - 12:30')).toBeNull();
    expect(screen.queryByText('12:30 - 13:00')).toBeNull();
    // Outros horários livres devem aparecer
    expect(screen.getByText('09:00 - 09:30')).toBeInTheDocument();
  });

  it('impede bloqueio de dia inteiro e exibe erro se houver agendamentos ativos na data', async () => {
    const existingAppointments = [
      {
        id: 'app-1',
        start_time: '2026-08-17T13:00:00.000Z',
        end_time: '2026-08-17T13:30:00.000Z',
        status: 'confirmed',
        professional_id: 'prof-1',
      },
    ];

    render(
      <BloqueioModal
        isOpen={true}
        tenantId="t-1"
        professionals={professionals}
        appointments={existingAppointments}
        defaultDateIso="2026-08-17"
        defaultProfessionalId="prof-1"
        slotIntervalMinutes={30}
        timezone="America/Sao_Paulo"
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    const allDayCheckbox = screen.getByLabelText(/Bloquear o expediente inteiro/i);
    fireEvent.click(allDayCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Confirmar bloqueio/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Não é possível bloquear o dia inteiro: existem 1 agendamento\(s\) ativo\(s\)/i)).toBeInTheDocument();
      expect(mockAdapter.criarBloqueio).not.toHaveBeenCalled();
    });
  });
});

