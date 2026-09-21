import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaOperationError, AgendaRepository, AgendaValidationError } from '../AgendaRepository';
import { InMemoryAgendaAdapter } from '../adapters/InMemoryAgendaAdapter';
import type { AgendamentoDoDia, IAgendaAdapter } from '../types';

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

  describe('criarAgendamento', () => {
    const base = { serviceId: 'srv-1', startTimeIso: '2026-09-21T14:00:00.000Z' };

    it('cria o agendamento com cliente existente e profissional', async () => {
      const result = await repository.criarAgendamento(TENANT, {
        ...base,
        professionalId: 'prof-1',
        cliente: { tipo: 'existente', id: 'cust-1' },
      });

      expect(result).toMatchObject({ status: 'confirmed', professional_id: 'prof-1', customer_id: 'cust-1' });
      expect(adapter.get(result.appointment_id)?.status).toBe('confirmed');
    });

    it('sem profissional envia Tanto faz e devolve o profissional resolvido pelo banco', async () => {
      const spy = vi.spyOn(adapter, 'criarAgendamento');

      const result = await repository.criarAgendamento(TENANT, { ...base, cliente: { tipo: 'nenhum' } });

      expect(spy).toHaveBeenCalledWith(TENANT, expect.objectContaining({ professionalId: null }));
      expect(result.professional_id).toBeTruthy();
    });

    it('exige nome e telefone válido para cliente novo, sem chamar o adaptador', async () => {
      const spy = vi.spyOn(adapter, 'criarAgendamento');

      await expect(
        repository.criarAgendamento(TENANT, { ...base, cliente: { tipo: 'novo', nome: '  ', telefone: '11999990000' } })
      ).rejects.toMatchObject({ name: 'AgendaValidationError', message: 'Informe o nome do cliente.' });
      await expect(
        repository.criarAgendamento(TENANT, { ...base, cliente: { tipo: 'novo', nome: 'Ana', telefone: '123' } })
      ).rejects.toMatchObject({ message: 'Telefone inválido (mínimo DDD + 8 dígitos).' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('recusa serviço ou horário inválidos', async () => {
      await expect(
        repository.criarAgendamento(TENANT, { serviceId: '', startTimeIso: base.startTimeIso, cliente: { tipo: 'nenhum' } })
      ).rejects.toBeInstanceOf(AgendaValidationError);
      await expect(
        repository.criarAgendamento(TENANT, { serviceId: 'srv-1', startTimeIso: 'x', cliente: { tipo: 'nenhum' } })
      ).rejects.toMatchObject({ message: 'Informe o horário do agendamento.' });
    });

    it('repassa a entrada da Lista de Espera para ser consumida na mesma operação', async () => {
      const spy = vi.spyOn(adapter, 'criarAgendamento');

      await repository.criarAgendamento(TENANT, {
        ...base,
        professionalId: 'prof-1',
        cliente: { tipo: 'nenhum' },
        waitingListId: 'wl-1',
      });

      expect(spy).toHaveBeenCalledWith(TENANT, expect.objectContaining({ waitingListId: 'wl-1' }));
    });

    it('propaga a recusa do banco como erro de regra', async () => {
      adapter.failCreateWith(new AgendaOperationError('O horário selecionado já está ocupado.', 'regra'));

      await expect(
        repository.criarAgendamento(TENANT, { ...base, professionalId: 'prof-1', cliente: { tipo: 'nenhum' } })
      ).rejects.toMatchObject({ kind: 'regra', message: 'O horário selecionado já está ocupado.' });
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
        criarAgendamento: vi.fn(),
        marcarFalta: vi.fn().mockRejectedValue(new AgendaOperationError('Acesso negado.', 'acesso')),
        carregarAgendamentosDoDia: vi.fn(),
        carregarBloqueiosDoDia: vi.fn(),
        carregarCadastrosDoProfissional: vi.fn(),
      };

      await expect(new AgendaRepository(denied).marcarFalta(TENANT, 'ap-pend')).rejects.toMatchObject({
        kind: 'acesso',
      });
    });
  });

  describe('carregarAgendamentosDoDia', () => {
    const agendamento = (overrides: Partial<AgendamentoDoDia>): AgendamentoDoDia => ({
      id: 'ap-x',
      start_time: '2026-09-21T13:00:00.000Z',
      end_time: '2026-09-21T13:30:00.000Z',
      status: 'confirmed',
      payment_status: 'pending',
      is_fitting: false,
      professional_id: 'prof-1',
      customer: { id: 'cust-1', name: 'Pedro', phone: '11988887777' },
      service: { id: 'srv-1', name: 'Corte', price: 50, duration_minutes: 30 },
      ...overrides,
    });
    const dia = { professionalId: 'prof-1', startIso: '2026-09-21T03:00:00.000Z', endExclusiveIso: '2026-09-22T03:00:00.000Z' };

    beforeEach(() => {
      adapter.seedAgendaDoDia({
        appointments: [
          agendamento({ id: 'ap-a', start_time: '2026-09-21T15:00:00.000Z' }),
          agendamento({ id: 'ap-b', start_time: '2026-09-21T13:00:00.000Z' }),
          agendamento({ id: 'ap-cancelado', status: 'canceled', cancellation_reason: 'Cliente desistiu' }),
          agendamento({ id: 'ap-cancelado-colega', status: 'canceled', professional_id: 'prof-2', start_time: '2026-09-21T12:00:00.000Z' }),
          agendamento({ id: 'ap-cancelado-limite', status: 'canceled', start_time: '2026-09-22T03:00:00.000Z' }),
          agendamento({ id: 'ap-colega', professional_id: 'prof-2' }),
          agendamento({ id: 'ap-outro-dia', start_time: '2026-09-22T13:00:00.000Z' }),
        ],
        blockedSlots: [
          {
            id: 'blk-1',
            tenant_id: TENANT,
            professional_id: 'prof-1',
            start_time: '2026-09-21T12:00:00.000Z',
            end_time: '2026-09-21T12:30:00.000Z',
            reason: 'Almoço',
            is_all_day: false,
          },
          {
            id: 'blk-outro-dia',
            tenant_id: TENANT,
            professional_id: 'prof-1',
            start_time: '2026-09-23T12:00:00.000Z',
            end_time: '2026-09-23T12:30:00.000Z',
            reason: 'Folga',
            is_all_day: false,
          },
        ],
      });
    });

    it('devolve só os Agendamentos do profissional no dia, em ordem e sem os cancelados', async () => {
      const agenda = await repository.carregarAgendamentosDoDia(TENANT, dia);

      expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-b', 'ap-a']);
    });

    it('não traz Bloqueios de Horário junto: eles têm leitura própria', async () => {
      const agenda = await repository.carregarAgendamentosDoDia(TENANT, dia);

      expect(Object.keys(agenda)).not.toContain('blockedSlots');
    });

    describe('carregarBloqueiosDoDia (spec 043, ticket 08)', () => {
      const intervalo = { startIso: dia.startIso, endExclusiveIso: dia.endExclusiveIso };

      it('devolve os Bloqueios de Horário do dia e deixa de fora os de outro dia', async () => {
        const bloqueios = await repository.carregarBloqueiosDoDia(TENANT, intervalo);

        expect(bloqueios.map((b) => b.id)).toEqual(['blk-1']);
      });

      it('recusa barbearia ou intervalo inválido sem consultar o adaptador', async () => {
        const spy = vi.spyOn(adapter, 'carregarBloqueiosDoDia');

        await expect(repository.carregarBloqueiosDoDia(' ', intervalo)).rejects.toBeInstanceOf(AgendaValidationError);
        await expect(
          repository.carregarBloqueiosDoDia(TENANT, { ...intervalo, endExclusiveIso: intervalo.startIso })
        ).rejects.toBeInstanceOf(AgendaValidationError);
        await expect(
          repository.carregarBloqueiosDoDia(TENANT, { ...intervalo, startIso: 'não é data' })
        ).rejects.toBeInstanceOf(AgendaValidationError);
        expect(spy).not.toHaveBeenCalled();
      });

      it('a falha de uma leitura não impede a outra', async () => {
        vi.spyOn(adapter, 'carregarBloqueiosDoDia').mockRejectedValue(new AgendaOperationError('falhou', 'desconhecido'));

        await expect(repository.carregarBloqueiosDoDia(TENANT, intervalo)).rejects.toBeInstanceOf(AgendaOperationError);
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, dia);
        expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-b', 'ap-a']);
      });

      it('a falha na leitura de Agendamentos não impede a de Bloqueios', async () => {
        vi.spyOn(adapter, 'carregarAgendamentosDoDia').mockRejectedValue(new AgendaOperationError('falhou', 'desconhecido'));

        await expect(repository.carregarAgendamentosDoDia(TENANT, dia)).rejects.toBeInstanceOf(AgendaOperationError);
        const bloqueios = await repository.carregarBloqueiosDoDia(TENANT, intervalo);
        expect(bloqueios.map((b) => b.id)).toEqual(['blk-1']);
      });
    });

    describe('sem informar o profissional (spec 043, ticket 03)', () => {
      const barbearia = { startIso: dia.startIso, endExclusiveIso: dia.endExclusiveIso };

      it('devolve os Agendamentos de toda a barbearia no dia, em ordem e sem os cancelados', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, barbearia);

        expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-b', 'ap-colega', 'ap-a']);
      });

      it('continua recusando profissional em branco, que não é o mesmo que omitido', async () => {
        const spy = vi.spyOn(adapter, 'carregarAgendamentosDoDia');

        await expect(
          repository.carregarAgendamentosDoDia(TENANT, { ...barbearia, professionalId: '   ' })
        ).rejects.toBeInstanceOf(AgendaValidationError);
        expect(spy).not.toHaveBeenCalled();
      });

      it('mantém o filtro quando o profissional é informado', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, { ...barbearia, professionalId: 'prof-2' });

        expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-colega']);
      });
    });

    describe('cancelados do dia (spec 043, ticket 04)', () => {
      it('sem pedir cancelados, a coleção deles vem vazia e os ativos ficam como antes', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, dia);

        expect(agenda.canceledAppointments).toEqual([]);
        expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-b', 'ap-a']);
      });

      it('pedindo cancelados, eles chegam em coleção própria e continuam fora dos ativos', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, { ...dia, incluirCancelados: true });

        expect(agenda.canceledAppointments.map((a) => a.id)).toEqual(['ap-cancelado']);
        expect(agenda.appointments.map((a) => a.id)).toEqual(['ap-b', 'ap-a']);
      });

      it('leva o Motivo de Cancelamento da escrita até a leitura', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, { ...dia, incluirCancelados: true });

        expect(agenda.canceledAppointments[0].cancellation_reason).toBe('Cliente desistiu');
      });

      it('mantém exclusivo o limite superior do intervalo também para cancelado', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, { ...dia, incluirCancelados: true });

        expect(agenda.canceledAppointments.map((a) => a.id)).not.toContain('ap-cancelado-limite');
      });

      it('sem informar o profissional, traz os cancelados de todos, em ordem de horário', async () => {
        const agenda = await repository.carregarAgendamentosDoDia(TENANT, {
          startIso: dia.startIso,
          endExclusiveIso: dia.endExclusiveIso,
          incluirCancelados: true,
        });

        expect(agenda.canceledAppointments.map((a) => a.id)).toEqual(['ap-cancelado-colega', 'ap-cancelado']);
      });
    });

    it('recusa barbearia, profissional ou intervalo inválido sem consultar o adaptador', async () => {
      const spy = vi.spyOn(adapter, 'carregarAgendamentosDoDia');

      await expect(repository.carregarAgendamentosDoDia(' ', dia)).rejects.toBeInstanceOf(AgendaValidationError);
      await expect(repository.carregarAgendamentosDoDia(TENANT, { ...dia, professionalId: '' })).rejects.toBeInstanceOf(
        AgendaValidationError
      );
      await expect(
        repository.carregarAgendamentosDoDia(TENANT, { ...dia, endExclusiveIso: dia.startIso })
      ).rejects.toBeInstanceOf(AgendaValidationError);
      await expect(
        repository.carregarAgendamentosDoDia(TENANT, { ...dia, startIso: 'não é data' })
      ).rejects.toBeInstanceOf(AgendaValidationError);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('carregarCadastrosDoProfissional', () => {
    const servico = (id: string) => ({ id, name: `Serviço ${id}`, price: 50, duration_minutes: 30 });

    beforeEach(() => {
      adapter.seedCadastros({
        professional: {
          id: 'prof-1',
          name: 'Diego',
          is_active: true,
          professional_services: [
            { service_id: 'srv-off', custom_duration_minutes: null, is_enabled: false },
            { service_id: 'srv-on', custom_duration_minutes: 20, is_enabled: true },
          ],
        },
        services: [servico('srv-on'), servico('srv-off'), servico('srv-livre')],
        customers: [{ id: 'cust-1', name: 'Pedro', phone: '11988887777' }],
      });
    });

    it('tira da lista os serviços que o profissional não executa', async () => {
      const cadastros = await repository.carregarCadastrosDoProfissional(TENANT, 'prof-1');

      expect(cadastros.services.map((s) => s.id)).toEqual(['srv-on', 'srv-livre']);
    });

    it('devolve o profissional com as durações próprias e os clientes da barbearia', async () => {
      const cadastros = await repository.carregarCadastrosDoProfissional(TENANT, 'prof-1');

      expect(cadastros.professional?.professional_services).toContainEqual({
        service_id: 'srv-on',
        custom_duration_minutes: 20,
        is_enabled: true,
      });
      expect(cadastros.customers).toHaveLength(1);
    });

    it('devolve profissional nulo quando o cadastro não existe ou é de outro', async () => {
      adapter.seedCadastros({ professional: null, services: [], customers: [] });

      const cadastros = await repository.carregarCadastrosDoProfissional(TENANT, 'prof-1');

      expect(cadastros.professional).toBeNull();
    });

    it('recusa barbearia ou profissional em branco sem consultar o adaptador', async () => {
      const spy = vi.spyOn(adapter, 'carregarCadastrosDoProfissional');

      await expect(repository.carregarCadastrosDoProfissional('', 'prof-1')).rejects.toBeInstanceOf(
        AgendaValidationError
      );
      await expect(repository.carregarCadastrosDoProfissional(TENANT, ' ')).rejects.toBeInstanceOf(
        AgendaValidationError
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
