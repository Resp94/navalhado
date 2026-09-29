import { describe, expect, it } from 'vitest';
import { AssinaturaRepository } from '../AssinaturaRepository';
import { InMemoryAssinaturaAdapter } from '../adapters/InMemoryAssinaturaAdapter';
import type { EstadoDeAcesso } from '../types';

// Spec 052, ticket 03: o front lê o Estado de Acesso que o banco calculou. Aqui
// só se testa o que o repositório faz com ele: repassar e contar dias.

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date('2026-10-01T12:00:00Z');

const estado = (dataRelevante: Date | null): EstadoDeAcesso => ({
  acesso: 'aviso',
  motivo: 'trial',
  dataRelevante,
});

describe('AssinaturaRepository', () => {
  describe('obterEstadoDeAcesso', () => {
    it('devolve o estado que o adaptador leu', async () => {
      const fim = new Date('2026-10-04T12:00:00Z');
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(estado(fim)));

      await expect(repo.obterEstadoDeAcesso()).resolves.toEqual(estado(fim));
    });

    it('devolve nulo quando o usuário não tem barbearia', async () => {
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(null));

      await expect(repo.obterEstadoDeAcesso()).resolves.toBeNull();
    });

    it('propaga a falha do adaptador, para o chamador decidir o que fazer', async () => {
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(new Error('sem rede')));

      await expect(repo.obterEstadoDeAcesso()).rejects.toThrow('sem rede');
    });
  });

  describe('diasRestantes', () => {
    const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(null));

    it('conta 3 dias quando faltam exatamente 3 dias', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 3 * DIA)), agora)).toBe(3);
    });

    it('arredonda para cima: 2 dias e 1 hora contam como 3', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 2 * DIA + 3600_000)), agora)).toBe(3);
    });

    it('falta menos de um dia: conta 1', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 60_000)), agora)).toBe(1);
    });

    it('data já passada: conta 0, nunca negativo', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() - 2 * DIA)), agora)).toBe(0);
    });

    it('sem data relevante: nulo', () => {
      expect(repo.diasRestantes(estado(null), agora)).toBeNull();
    });
  });

  // Spec 052, ticket 05: o repositório só deixa o front abrir link https.
  describe('assinar', () => {
    it('devolve a assinatura criada pelo adaptador', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      const repo = new AssinaturaRepository(adapter);

      const criada = await repo.assinar();

      expect(criada.linkDePagamento).toBe('https://provider.test/checkout/assinatura-1');
      expect(adapter.assinaturasSolicitadas).toBe(1);
    });

    it('recusa um link que não seja https, para o front nunca navegar para um endereço estranho', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      adapter.respostaDeAssinar = {
        linkDePagamento: 'javascript:alert(1)',
        assinaturaId: 'a',
        primeiraCobrancaEm: null,
      };
      const repo = new AssinaturaRepository(adapter);

      await expect(repo.assinar()).rejects.toThrow('Não foi possível iniciar a assinatura. Tente de novo.');
    });

    it('repassa a falha do adaptador', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      adapter.respostaDeAssinar = new Error('A barbearia já tem uma assinatura ativa.');
      const repo = new AssinaturaRepository(adapter);

      await expect(repo.assinar()).rejects.toThrow('A barbearia já tem uma assinatura ativa.');
    });
  });
});
