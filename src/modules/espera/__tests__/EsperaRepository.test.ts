import { beforeEach, describe, expect, it } from 'vitest';
import { EsperaRepository } from '../EsperaRepository';
import { InMemoryEsperaAdapter } from '../adapters/InMemoryEsperaAdapter';

describe('EsperaRepository', () => {
  const DIA = '2026-09-21';
  let adapter: InMemoryEsperaAdapter;
  let repo: EsperaRepository;

  beforeEach(() => {
    adapter = new InMemoryEsperaAdapter([], () => new Date(`${DIA}T10:00:00.000Z`));
    repo = new EsperaRepository(adapter);
  });

  it('lista entradas por data', async () => {
    await repo.addEntry({
      tenant_id: 't-1',
      customer_name: 'Paulo Vieira',
      customer_phone: '11999998888',
      status: 'aguardando',
    });

    const res = await repo.listByDate('t-1', DIA);
    expect(res).toHaveLength(1);
    expect(res[0].customer_name).toBe('Paulo Vieira');
  });

  it('adiciona entrada validando nome', async () => {
    await expect(
      repo.addEntry({
        tenant_id: 't-1',
        customer_name: '',
        customer_phone: '11999998888',
        status: 'aguardando',
      })
    ).rejects.toThrow('Nome do cliente é obrigatório');
  });

  describe('observação da entrada (spec 043, ticket 01)', () => {
    it('devolve a observação gravada ao listar a entrada', async () => {
      await repo.addEntry({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
        notes: 'Só pode depois das 18h, quer o Marcos',
      });

      const [entrada] = await repo.listByDate('t-1', DIA);
      expect(entrada.notes).toBe('Só pode depois das 18h, quer o Marcos');
    });

    it('devolve ausência de observação sem inventar texto quando nada foi anotado', async () => {
      await repo.addEntry({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
      });

      const [entrada] = await repo.listByDate('t-1', DIA);
      expect(entrada.notes).toBeNull();
    });

    it('preserva a observação quando a entrada muda de status', async () => {
      const criada = await repo.addEntry({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
        notes: 'Vai trazer o filho junto',
      });

      const atualizada = await repo.setStatus(criada.id, 'atendido');

      expect(atualizada.status).toBe('atendido');
      expect(atualizada.notes).toBe('Vai trazer o filho junto');
    });

    it('leva a observação da recepção para a nota do Agendamento no encaixe', () => {
      const nota = repo.notaDeEncaixe({ notes: 'Só pode depois das 18h, quer o Marcos' });

      expect(nota).toContain('Só pode depois das 18h, quer o Marcos');
      expect(nota).toContain('Fila de Espera');
    });

    it('usa só o marcador de origem quando a entrada não tem observação', () => {
      expect(repo.notaDeEncaixe({ notes: null })).toBe('[Fila de Espera]');
    });
  });

  it('sugere profissional correto no rodízio de balcão (menor número de atendimentos)', () => {
    const profs = [
      { id: 'p1', name: 'Alisson' },
      { id: 'p2', name: 'Diego' },
      { id: 'p3', name: 'Carlos' },
    ];

    const counts = {
      p1: 5,
      p2: 2,
      p3: 4,
    };

    const suggested = repo.suggestRotationProfessional(profs, counts);
    expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
  });

  describe('suggestRotationFromAppointments (spec 040)', () => {
    const profs = [
      { id: 'p1', name: 'Carlos' },
      { id: 'p2', name: 'Diego' },
    ];

    it('conta os agendamentos do dia por profissional e sugere quem tem menos', () => {
      const suggested = repo.suggestRotationFromAppointments(profs, [
        { professional_id: 'p1' },
        { professional_id: 'p1' },
        { professional_id: 'p2' },
      ]);

      expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
    });

    it('ignora agendamentos cancelados e com falta na contagem', () => {
      const suggested = repo.suggestRotationFromAppointments(profs, [
        { professional_id: 'p2', status: 'canceled' },
        { professional_id: 'p2', status: 'no_show' },
        { professional_id: 'p1', status: 'confirmed' },
      ]);

      expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
    });

    it('mantém o primeiro da lista em caso de empate e devolve nulo sem profissionais', () => {
      expect(repo.suggestRotationFromAppointments(profs, [])).toEqual({ id: 'p1', name: 'Carlos' });
      expect(repo.suggestRotationFromAppointments([], [{ professional_id: 'p1' }])).toBeNull();
    });
  });
});
