import { describe, expect, it } from 'vitest';
import { intervaloDeComissao } from '../periodo';

// 20/09/2026 às 22:30 em São Paulo (UTC-3) já é 21/09 01:30 em UTC.
const AGORA = new Date('2026-09-21T01:30:00.000Z');

describe('intervaloDeComissao', () => {
  it('"hoje" começa à meia-noite do dia da barbearia, não do dia UTC', () => {
    expect(intervaloDeComissao('today', AGORA, 'America/Sao_Paulo')).toEqual({
      startIso: '2026-09-20T03:00:00.000Z',
      endIso: '2026-09-21T01:30:00.000Z',
    });
  });

  it('"7 dias" volta sete dias a partir do dia da barbearia', () => {
    expect(intervaloDeComissao('7days', AGORA, 'America/Sao_Paulo').startIso).toBe('2026-09-13T03:00:00.000Z');
  });

  it('"mês" começa no dia 1 do mês da barbearia', () => {
    expect(intervaloDeComissao('month', AGORA, 'America/Sao_Paulo').startIso).toBe('2026-09-01T03:00:00.000Z');
  });

  it('respeita o fuso da barbearia', () => {
    // Em Manaus (UTC-4) ainda é 20/09 às 21:30.
    expect(intervaloDeComissao('today', AGORA, 'America/Manaus').startIso).toBe('2026-09-20T04:00:00.000Z');
  });

  it('o mês vira junto com o dia da barbearia', () => {
    // 01/10 00:30 em São Paulo ainda é 30/09 03:30 UTC... e já é outubro na barbearia.
    const virada = new Date('2026-10-01T03:30:00.000Z');

    expect(intervaloDeComissao('month', virada, 'America/Sao_Paulo').startIso).toBe('2026-10-01T03:00:00.000Z');
  });
});
