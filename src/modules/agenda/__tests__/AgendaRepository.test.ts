import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaOperationError, AgendaRepository, AgendaValidationError } from '../AgendaRepository';
import { InMemoryAgendaAdapter } from '../adapters/InMemoryAgendaAdapter';
import type { IAgendaAdapter } from '../types';

const TENANT = 'tenant-1';

describe('AgendaRepository', () => {
  let adapter: InMemoryAgendaAdapter;
  let repository: AgendaRepository;

  beforeEach(() => {
    adapter = new InMemoryAgendaAdapter();
    adapter.seed({ id: 'ap-pend', tenant_id: TENANT, status: 'pending', start_time: '2026-01-01T10:00:00Z' });
    adapter.seed({ id: 'ap-conf', tenant_id: TENANT, status: 'confirmed', start_time: '2026-01-01T10:00:00Z' });
    adapter.seed({ id: 'ap-done', tenant_id: TENANT, status: 'completed', start_time: '2026-01-01T10:00:00Z' });
    repository = new AgendaRepository(adapter);
  });

  describe('iniciarAtendimento', () => {
    it('leva um agendamento pendente para in_progress', async () => {
      await expect(repository.iniciarAtendimento(TENANT, 'ap-pend')).resolves.toMatchObject({
        appointment_id: 'ap-pend',
        status: 'in_progress',
      });
    });

    it('recusa ids em branco sem chamar o adaptador', async () => {
      const spy = vi.spyOn(adapter, 'iniciarAtendimento');

      await expect(repository.iniciarAtendimento(' ', 'ap-pend')).rejects.toBeInstanceOf(AgendaValidationError);
      await expect(repository.iniciarAtendimento(TENANT, '')).rejects.toBeInstanceOf(AgendaValidationError);
      expect(spy).not.toHaveBeenCalled();
    });

    it('propaga a recusa de regra do banco como AgendaOperationError', async () => {
      await expect(repository.iniciarAtendimento(TENANT, 'ap-done')).rejects.toMatchObject({
        name: 'AgendaOperationError',
        kind: 'regra',
        message: 'Somente atendimentos pendentes ou confirmados podem ser iniciados.',
      });
    });
  });

  describe('cancelar', () => {
    it('exige motivo e não chama o adaptador com motivo em branco', async () => {
      const spy = vi.spyOn(adapter, 'cancelar');

      await expect(repository.cancelar(TENANT, 'ap-pend', '   ')).rejects.toMatchObject({
        name: 'AgendaValidationError',
        message: 'Informe o motivo do cancelamento.',
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it('envia o motivo sem espaços nas pontas', async () => {
      const spy = vi.spyOn(adapter, 'cancelar');

      await repository.cancelar(TENANT, 'ap-conf', '  Cliente desistiu  ');

      expect(spy).toHaveBeenCalledWith(TENANT, 'ap-conf', 'Cliente desistiu');
      expect(adapter.get('ap-conf')?.status).toBe('canceled');
    });

    it('recusa cancelar um atendimento concluído', async () => {
      await expect(repository.cancelar(TENANT, 'ap-done', 'Motivo')).rejects.toBeInstanceOf(AgendaOperationError);
    });
  });

  describe('reagendar', () => {
    it('move o agendamento para o novo horário e profissional', async () => {
      const result = await repository.reagendar(TENANT, 'ap-conf', {
        startTimeIso: '2026-09-21T14:00:00.000Z',
        professionalId: 'prof-2',
      });

      expect(result).toMatchObject({
        appointment_id: 'ap-conf',
        start_time: '2026-09-21T14:00:00.000Z',
        professional_id: 'prof-2',
      });
      expect(adapter.get('ap-conf')?.start_time).toBe('2026-09-21T14:00:00.000Z');
    });

    it('recusa horário inválido sem chamar o adaptador', async () => {
      const spy = vi.spyOn(adapter, 'reagendar');

      await expect(repository.reagendar(TENANT, 'ap-conf', { startTimeIso: 'não é data' })).rejects.toMatchObject({
        name: 'AgendaValidationError',
        message: 'Informe o novo horário.',
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it('propaga a recusa de estado de origem do banco', async () => {
      await expect(
        repository.reagendar(TENANT, 'ap-done', { startTimeIso: '2026-09-21T14:00:00.000Z' })
      ).rejects.toMatchObject({
        kind: 'regra',
        message: 'Somente atendimentos pendentes ou confirmados podem ser reagendados.',
      });
    });
  });

  describe('listarHorariosLivres', () => {
    it('devolve os horários livres do profissional na data, excluindo o próprio agendamento', async () => {
      adapter.seedSlots(['09:00', '09:30']);
      const spy = vi.spyOn(adapter, 'listarHorariosLivres');

      await expect(
        repository.listarHorariosLivres(TENANT, {
          professionalId: 'prof-1',
          serviceId: 'srv-1',
          date: '2026-09-21',
          excludeAppointmentId: 'ap-conf',
        })
      ).resolves.toEqual(['09:00', '09:30']);
      expect(spy).toHaveBeenCalledWith(TENANT, expect.objectContaining({ excludeAppointmentId: 'ap-conf' }));
    });

    it('exige profissional, serviço e data', async () => {
      await expect(
        repository.listarHorariosLivres(TENANT, { professionalId: '', serviceId: 'srv-1', date: '2026-09-21' })
      ).rejects.toBeInstanceOf(AgendaValidationError);
    });

    it('propaga a falha da consulta em vez de inventar horários', async () => {
      adapter.failSlotsWith(new AgendaOperationError('Falha ao buscar horários.', 'desconhecido'));

      await expect(
        repository.listarHorariosLivres(TENANT, { professionalId: 'prof-1', serviceId: 'srv-1', date: '2026-09-21' })
      ).rejects.toMatchObject({ message: 'Falha ao buscar horários.' });
    });
  });

  describe('marcarFalta', () => {
    it('marca falta em agendamento que já começou', async () => {
      await expect(repository.marcarFalta(TENANT, 'ap-pend')).resolves.toMatchObject({ status: 'no_show' });
    });

    it('traduz recusa de acesso do banco em AgendaOperationError do tipo acesso', async () => {
      const denied: IAgendaAdapter = {
        iniciarAtendimento: vi.fn(),
        cancelar: vi.fn(),
        reagendar: vi.fn(),
        listarHorariosLivres: vi.fn(),
        marcarFalta: vi.fn().mockRejectedValue(new AgendaOperationError('Acesso negado.', 'acesso')),
      };

      await expect(new AgendaRepository(denied).marcarFalta(TENANT, 'ap-pend')).rejects.toMatchObject({
        kind: 'acesso',
      });
    });
  });
});
