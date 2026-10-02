import { describe, expect, it, vi } from 'vitest';
import { InMemoryProprietarioAdapter } from '../adapters/InMemoryProprietarioAdapter';
import { ProprietarioError, ProprietarioRepository } from '../ProprietarioRepository';
import type { DetalhesDoTenant } from '../types';

const detalhes = (id: string): DetalhesDoTenant => ({
  barbearia: { id, nome: 'Barbearia Alpha', email: 'a@exemplo.com', telefone: '92999990001', fuso: 'America/Manaus', criadaEm: new Date('2026-01-10T15:30:00Z') },
  assinatura: null,
  acesso: { nivel: 'allowed', motivo: 'no_subscription', dataRelevante: null },
  profissionaisAtivos: 0,
  cobrancas: [],
  desbloqueio: null,
  acoes: [],
});

function montar() {
  const adaptador = new InMemoryProprietarioAdapter({ detalhes: { 'tenant-1': detalhes('tenant-1') } });
  return { adaptador, repositorio: new ProprietarioRepository(adaptador) };
}

describe('ProprietarioRepository', () => {
  describe('o que vai ao banco', () => {
    it('lê os detalhes de uma barbearia', async () => {
      const { repositorio } = montar();

      expect((await repositorio.detalhesDoTenant('tenant-1')).barbearia.nome).toBe('Barbearia Alpha');
    });

    it.each([
      ['estenderTeste', (r: ProprietarioRepository) => r.estenderTeste('tenant-1', '2040-03-10'), ['tenant-1', '2040-03-10']],
      ['darCortesia', (r: ProprietarioRepository) => r.darCortesia('tenant-1', '2040-06-30'), ['tenant-1', '2040-06-30']],
      ['darCortesia', (r: ProprietarioRepository) => r.darCortesia('tenant-1', null), ['tenant-1', null]],
      ['encerrarCortesia', (r: ProprietarioRepository) => r.encerrarCortesia('tenant-1'), ['tenant-1']],
      ['desbloquear', (r: ProprietarioRepository) => r.desbloquear('tenant-1', '2040-03-10', 'pagamento em análise'), ['tenant-1', '2040-03-10', 'pagamento em análise']],
      ['bloquear', (r: ProprietarioRepository) => r.bloquear('tenant-1', 'uso indevido'), ['tenant-1', 'uso indevido']],
    ])('%s pede ao adaptador a barbearia e o que ela precisa', async (acao, executar, argumentos) => {
      const { adaptador, repositorio } = montar();

      await executar(repositorio);

      expect(adaptador.chamadas).toEqual([{ acao, argumentos }]);
    });

    it('o motivo vai sem os espaços das pontas', async () => {
      const { adaptador, repositorio } = montar();

      await repositorio.desbloquear('tenant-1', '2040-03-10', '  o cliente paga na segunda  ');
      await repositorio.bloquear('tenant-1', '\n uso indevido \t');

      expect(adaptador.chamadas.map((chamada) => chamada.argumentos.at(-1))).toEqual(['o cliente paga na segunda', 'uso indevido']);
    });

    // Pede um a mais do que mostra: o banco não devolve o total, e a tela precisa saber se há mais do que cabe nela.
    it('os avisos que falharam vêm com um limite que o repositório escolhe quando ninguém pede, e pedem um a mais para saber se há mais', async () => {
      const { adaptador, repositorio } = montar();

      await repositorio.avisosQueFalharam();
      await repositorio.avisosQueFalharam(10);

      expect(adaptador.chamadas).toEqual([
        { acao: 'listarAvisosQueFalharam', argumentos: [51] },
        { acao: 'listarAvisosQueFalharam', argumentos: [11] },
      ]);
    });

    describe('quantos avisos que falharam cabem', () => {
      const avisos = (quantos: number) =>
        Array.from({ length: quantos }, (_, indice) => ({
          id: `aviso-${indice}`,
          tenantId: 'tenant-1',
          barbearia: 'Barbearia Alpha',
          tipo: 'trial_ending',
          referenciaEm: new Date('2026-09-20T12:00:00Z'),
          tentativas: 3,
          motivo: null,
          criadoEm: new Date('2026-09-29T12:00:00Z'),
        }));

      it('com menos do que o limite, mostra todos e não diz que há mais', async () => {
        const repositorio = new ProprietarioRepository(new InMemoryProprietarioAdapter({ avisos: avisos(3) }));

        const lidos = await repositorio.avisosQueFalharam(10);

        expect(lidos.avisos).toHaveLength(3);
        expect(lidos.haMais).toBe(false);
      });

      it('com exatamente o limite, mostra todos e não diz que há mais', async () => {
        const repositorio = new ProprietarioRepository(new InMemoryProprietarioAdapter({ avisos: avisos(10) }));

        const lidos = await repositorio.avisosQueFalharam(10);

        expect(lidos.avisos).toHaveLength(10);
        expect(lidos.haMais).toBe(false);
      });

      it('com um a mais do que o limite, mostra o limite e diz que há mais', async () => {
        const repositorio = new ProprietarioRepository(new InMemoryProprietarioAdapter({ avisos: avisos(11) }));

        const lidos = await repositorio.avisosQueFalharam(10);

        expect(lidos.avisos.map((aviso) => aviso.id)).toEqual(avisos(10).map((aviso) => aviso.id));
        expect(lidos.haMais).toBe(true);
      });
    });
  });

  describe('o que o repositório recusa antes de ir ao banco', () => {
    it.each([
      ['sem a barbearia', (r: ProprietarioRepository) => r.estenderTeste('', '2040-03-10'), 'Barbearia não identificada.'],
      ['sem a barbearia (só espaços)', (r: ProprietarioRepository) => r.encerrarCortesia('   '), 'Barbearia não identificada.'],
      ['sem a barbearia ao ler', (r: ProprietarioRepository) => r.detalhesDoTenant(''), 'Barbearia não identificada.'],
      ['dia vazio', (r: ProprietarioRepository) => r.estenderTeste('tenant-1', ''), 'Informe a data.'],
      ['dia no formato errado', (r: ProprietarioRepository) => r.estenderTeste('tenant-1', '10/03/2040'), 'Informe a data.'],
      ['dia sem os zeros', (r: ProprietarioRepository) => r.desbloquear('tenant-1', '2040-3-1', 'motivo'), 'Informe a data.'],
      ['cortesia com o dia errado', (r: ProprietarioRepository) => r.darCortesia('tenant-1', 'amanhã'), 'Informe a data.'],
      ['desbloqueio sem motivo', (r: ProprietarioRepository) => r.desbloquear('tenant-1', '2040-03-10', ''), 'Informe o motivo.'],
      ['desbloqueio com o motivo em branco', (r: ProprietarioRepository) => r.desbloquear('tenant-1', '2040-03-10', '   '), 'Informe o motivo.'],
      ['bloqueio sem motivo', (r: ProprietarioRepository) => r.bloquear('tenant-1', ' '), 'Informe o motivo.'],
    ])('%s', async (_caso, executar, mensagem) => {
      const { adaptador, repositorio } = montar();

      await expect(executar(repositorio)).rejects.toThrow(new ProprietarioError(mensagem));
      expect(adaptador.chamadas).toEqual([]);
    });
  });

  describe('o erro do banco vira uma mensagem para o Proprietário', () => {
    // O que o banco devolve em `message` (supabase/migrations/..._052_ticket15_...: raise exception 'CODIGO').
    it.each([
      ['ADMIN_ONLY', 'Só o Proprietário pode fazer isso.'],
      ['SUBSCRIPTION_NOT_FOUND', 'Esta barbearia não tem assinatura.'],
      ['TENANT_NOT_FOUND', 'Barbearia não encontrada.'],
      ['INVALID_DATE', 'A data precisa ser de hoje em diante (e dentro de 20 anos) e, para estender o teste, depois do fim dele.'],
      ['REASON_REQUIRED', 'Informe o motivo.'],
      ['NOT_IN_TRIAL', 'Só dá para estender o teste de quem está em teste ou teve o teste ou a cortesia vencidos.'],
      ['NOT_COURTESY', 'Esta barbearia não está em cortesia.'],
      ['NOT_BLOCKED', 'Esta barbearia não está bloqueada.'],
      ['ALREADY_BLOCKED', 'Esta barbearia já está bloqueada.'],
    ])('%s', async (codigo, mensagem) => {
      const { adaptador, repositorio } = montar();
      // O PostgREST devolve um objeto com `message`, e não uma instância de Error.
      adaptador.falharCom({ message: codigo, code: '55000' });

      await expect(repositorio.desbloquear('tenant-1', '2040-03-10', 'motivo')).rejects.toThrow(new ProprietarioError(mensagem));
    });

    it('um erro de verdade (Error) com o mesmo código também é traduzido', async () => {
      const { adaptador, repositorio } = montar();
      adaptador.falharCom(new Error('NOT_BLOCKED'));

      await expect(repositorio.bloquear('tenant-1', 'motivo')).rejects.toThrow('Esta barbearia não está bloqueada.');
    });

    it('um erro que o repositório não conhece vira a mensagem padrão, e o texto do banco fica no log', async () => {
      const { adaptador, repositorio } = montar();
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      adaptador.falharCom({ message: 'canceling statement due to statement timeout', code: '57014' });

      await expect(repositorio.detalhesDoTenant('tenant-1')).rejects.toThrow(
        new ProprietarioError('Não foi possível concluir. Tente de novo.'),
      );
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it('a leitura dos detalhes também traduz', async () => {
      const { repositorio } = montar();

      await expect(repositorio.detalhesDoTenant('tenant-que-nao-existe')).rejects.toThrow('Barbearia não encontrada.');
    });
  });
});
