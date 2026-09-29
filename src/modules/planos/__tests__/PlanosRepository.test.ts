import { describe, expect, it } from 'vitest';
import { PlanosRepository } from '../PlanosRepository';
import { InMemoryPlanosAdapter } from '../adapters/InMemoryPlanosAdapter';
import type { Plano } from '../types';

const TESOURA: Plano = { id: 'plano-tesoura', name: 'Tesoura', price: 59.9, max_professionals: 1 };
const MAQUINA: Plano = { id: 'plano-maquina', name: 'Máquina', price: 89.9, max_professionals: 5 };
const BANCADA: Plano = { id: 'plano-bancada', name: 'Bancada', price: 159.9, max_professionals: 10 };
const PREMIUM: Plano = { id: 'plano-premium', name: 'Premium', price: 299.9, max_professionals: 30 };

const repositorioCom = (planos: Plano[]) => new PlanosRepository(new InMemoryPlanosAdapter(planos));

describe('PlanosRepository (spec 052, ticket 01)', () => {
  describe('listar', () => {
    it('devolve o catálogo do mais barato para o mais caro, qualquer que seja a ordem do adaptador', async () => {
      const repositorio = repositorioCom([BANCADA, TESOURA, MAQUINA]);

      const planos = await repositorio.listar();

      expect(planos.map((p) => p.name)).toEqual(['Tesoura', 'Máquina', 'Bancada']);
    });

    it('recusa um catálogo vazio, para a tela mostrar erro em vez de uma lista sem planos', async () => {
      await expect(repositorioCom([]).listar()).rejects.toThrow(/nenhum plano/i);
    });
  });

  describe('planoPadrao', () => {
    it('escolhe o plano do meio do catálogo ordenado por preço, sem depender do nome', async () => {
      const repositorio = repositorioCom([TESOURA, MAQUINA, BANCADA]);
      const planos = await repositorio.listar();

      expect(repositorio.planoPadrao(planos)?.id).toBe('plano-maquina');
    });

    it('com um único plano, escolhe esse plano', async () => {
      const repositorio = repositorioCom([TESOURA]);
      const planos = await repositorio.listar();

      expect(repositorio.planoPadrao(planos)?.id).toBe('plano-tesoura');
    });

    it('com dois planos, escolhe o mais caro (o do meio arredonda para cima)', async () => {
      const repositorio = repositorioCom([TESOURA, BANCADA]);
      const planos = await repositorio.listar();

      expect(repositorio.planoPadrao(planos)?.id).toBe('plano-bancada');
    });

    it('com quatro planos, escolhe o terceiro', async () => {
      const repositorio = repositorioCom([TESOURA, MAQUINA, BANCADA, PREMIUM]);
      const planos = await repositorio.listar();

      expect(repositorio.planoPadrao(planos)?.id).toBe('plano-bancada');
    });

    it('sem planos, não escolhe nenhum', () => {
      expect(repositorioCom([]).planoPadrao([])).toBeUndefined();
    });
  });
});
