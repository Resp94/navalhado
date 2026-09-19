import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mockRpc } }));

import { AgendaOperationError } from '../../AgendaRepository';
import { SupabaseAgendaAdapter } from '../SupabaseAgendaAdapter';

describe('SupabaseAgendaAdapter', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('inicia atendimento pela RPC start_appointment_service', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { appointment_id: 'ap-1', tenant_id: 't-1', status: 'in_progress' },
      error: null,
    });

    await expect(new SupabaseAgendaAdapter().iniciarAtendimento('t-1', 'ap-1')).resolves.toEqual({
      appointment_id: 'ap-1',
      status: 'in_progress',
    });
    expect(mockRpc).toHaveBeenCalledWith('start_appointment_service', {
      p_appointment_id: 'ap-1',
      p_tenant_id: 't-1',
    });
  });

  it('cancela pela RPC cancel_appointment_by_manager com o motivo', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { appointment_id: 'ap-1', tenant_id: 't-1', status: 'canceled' },
      error: null,
    });

    await new SupabaseAgendaAdapter().cancelar('t-1', 'ap-1', 'Cliente desistiu');

    expect(mockRpc).toHaveBeenCalledWith('cancel_appointment_by_manager', {
      p_appointment_id: 'ap-1',
      p_tenant_id: 't-1',
      p_reason: 'Cliente desistiu',
    });
  });

  it('reagenda pela RPC reschedule_appointment_by_manager', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        appointment_id: 'ap-1',
        tenant_id: 't-1',
        status: 'confirmed',
        start_time: '2026-09-21T14:00:00+00:00',
        end_time: '2026-09-21T14:30:00+00:00',
        professional_id: 'prof-2',
      },
      error: null,
    });

    await expect(
      new SupabaseAgendaAdapter().reagendar('t-1', 'ap-1', {
        startTimeIso: '2026-09-21T14:00:00.000Z',
        professionalId: 'prof-2',
      })
    ).resolves.toMatchObject({ appointment_id: 'ap-1', professional_id: 'prof-2', status: 'confirmed' });

    expect(mockRpc).toHaveBeenCalledWith('reschedule_appointment_by_manager', {
      p_appointment_id: 'ap-1',
      p_tenant_id: 't-1',
      p_new_start_time: '2026-09-21T14:00:00.000Z',
      p_new_professional_id: 'prof-2',
    });
  });

  it('envia profissional nulo quando o reagendamento mantém o mesmo profissional', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { appointment_id: 'ap-1', status: 'pending', start_time: 'x', end_time: 'y', professional_id: 'p' },
      error: null,
    });

    await new SupabaseAgendaAdapter().reagendar('t-1', 'ap-1', { startTimeIso: '2026-09-21T14:00:00.000Z' });

    expect(mockRpc).toHaveBeenCalledWith(
      'reschedule_appointment_by_manager',
      expect.objectContaining({ p_new_professional_id: null })
    );
  });

  it('marca falta pela RPC mark_appointment_no_show', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { appointment_id: 'ap-1', tenant_id: 't-1', status: 'no_show' },
      error: null,
    });

    await new SupabaseAgendaAdapter().marcarFalta('t-1', 'ap-1');

    expect(mockRpc).toHaveBeenCalledWith('mark_appointment_no_show', {
      p_appointment_id: 'ap-1',
      p_tenant_id: 't-1',
    });
  });

  it('traduz a recusa de regra (P0001) mantendo a mensagem do banco', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'O atendimento ainda não começou.' },
    });

    await expect(new SupabaseAgendaAdapter().marcarFalta('t-1', 'ap-1')).rejects.toMatchObject({
      name: 'AgendaOperationError',
      kind: 'regra',
      message: 'O atendimento ainda não começou.',
    });
  });

  it('traduz a recusa de acesso (42501) para o tipo acesso', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Acesso negado.' } });

    const promise = new SupabaseAgendaAdapter().iniciarAtendimento('t-1', 'ap-1');

    await expect(promise).rejects.toBeInstanceOf(AgendaOperationError);
    await expect(promise).rejects.toMatchObject({ kind: 'acesso' });
  });

  it('trata falha inesperada como tipo desconhecido', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'connection failure' } });

    await expect(new SupabaseAgendaAdapter().iniciarAtendimento('t-1', 'ap-1')).rejects.toMatchObject({
      kind: 'desconhecido',
    });
  });
});
