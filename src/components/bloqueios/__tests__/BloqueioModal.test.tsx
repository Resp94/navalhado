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

  it('cria bloqueio de horário com sucesso', async () => {
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
        defaultDateIso="2026-08-16"
        defaultProfessionalId="prof-1"
        onClose={mockOnClose}
        onBloqueioCriado={mockOnBloqueioCriado}
        bloqueioRepo={mockRepo}
      />
    );

    expect(screen.getByText('Bloquear Horário na Grade')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Confirmar Bloqueio/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAdapter.criarBloqueio).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't-1',
          professional_id: 'prof-1',
          reason: 'Almoço',
        })
      );
      expect(mockOnBloqueioCriado).toHaveBeenCalledWith(fakeBloqueio);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
