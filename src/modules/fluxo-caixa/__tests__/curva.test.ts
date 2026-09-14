import { describe, expect, it } from 'vitest';
import { computeFluxoCaixaCurva } from '../curva';
import type { FluxoCaixaBucket, FluxoCaixaBucketKind } from '../types';

function bucket(overrides: Partial<FluxoCaixaBucket> & { start_date: string; kind: FluxoCaixaBucketKind }): FluxoCaixaBucket {
  return {
    end_date: overrides.start_date,
    inflow_realized: 0,
    inflow_estimated: null,
    outflow_realized: 0,
    pending_flow: 0,
    detail: {
      inflow_by_method: { dinheiro: 0, pix: 0, cartao: 0, outros: 0 },
      payouts_by_professional: [],
      advances_by_professional: [],
      estimated_days: 0,
      closed_days: 0,
    },
    ...overrides,
  };
}

describe('computeFluxoCaixaCurva', () => {
  it('sem saldo informado, e o Resultado Acumulado: soma corrida do resultado desde o primeiro agrupamento', () => {
    const buckets = [
      bucket({ start_date: '2026-06-01', kind: 'past', inflow_realized: 100, outflow_realized: 30 }),
      bucket({ start_date: '2026-06-02', kind: 'current', inflow_realized: 50, outflow_realized: 10 }),
      bucket({ start_date: '2026-06-03', kind: 'future', inflow_estimated: 40, outflow_realized: 0 }),
    ];

    const curva = computeFluxoCaixaCurva(buckets, 0);

    expect(curva.rotulo).toBe('Resultado acumulado');
    expect(curva.pontos.map((p) => p.saldo)).toEqual([70, 110, 150]);
  });

  it('com saldo informado, vira Saldo Projetado: comeca no agrupamento atual com saldo + pending_flow', () => {
    const buckets = [
      bucket({ start_date: '2026-06-01', kind: 'past', pending_flow: 999 }),
      bucket({ start_date: '2026-06-02', kind: 'current', pending_flow: 20 }),
      bucket({ start_date: '2026-06-03', kind: 'future', pending_flow: 30 }),
    ];

    const curva = computeFluxoCaixaCurva(buckets, 100);

    expect(curva.rotulo).toBe('Saldo projetado');
    expect(curva.pontos[1].saldo).toBe(120);
    expect(curva.pontos[2].saldo).toBe(150);
  });

  it('agrupamentos passados nao tem saldo projetado, mesmo com pending_flow preenchido', () => {
    const buckets = [
      bucket({ start_date: '2026-06-01', kind: 'past', pending_flow: 500 }),
      bucket({ start_date: '2026-06-02', kind: 'current', pending_flow: 10 }),
    ];

    const curva = computeFluxoCaixaCurva(buckets, 50);

    expect(curva.pontos[0].saldo).toBeNull();
    expect(curva.pontos[1].saldo).toBe(60);
  });

  it('o realizado de hoje nao e somado ao saldo informado -- so o pending_flow do agrupamento atual', () => {
    const buckets = [bucket({ start_date: '2026-06-02', kind: 'current', inflow_realized: 1000, pending_flow: 15 })];

    const curva = computeFluxoCaixaCurva(buckets, 100);

    expect(curva.pontos[0].saldo).toBe(115);
  });

  it('devolve o indice do primeiro agrupamento com saldo negativo', () => {
    const buckets = [
      bucket({ start_date: '2026-06-02', kind: 'current', pending_flow: -20 }),
      bucket({ start_date: '2026-06-03', kind: 'future', pending_flow: -10 }),
      bucket({ start_date: '2026-06-04', kind: 'future', pending_flow: 100 }),
    ];

    const curva = computeFluxoCaixaCurva(buckets, 10);

    expect(curva.primeiroNegativoIndex).toBe(0);
  });

  it('devolve null quando nenhum agrupamento fica negativo', () => {
    const buckets = [bucket({ start_date: '2026-06-02', kind: 'current', pending_flow: 10 })];

    const curva = computeFluxoCaixaCurva(buckets, 10);

    expect(curva.primeiroNegativoIndex).toBeNull();
  });

  it('o rotulo troca entre Resultado Acumulado e Saldo Projetado quando o saldo passa de zero para um valor informado e volta', () => {
    const buckets = [bucket({ start_date: '2026-06-02', kind: 'current', inflow_realized: 10 })];

    expect(computeFluxoCaixaCurva(buckets, 0).rotulo).toBe('Resultado acumulado');
    expect(computeFluxoCaixaCurva(buckets, 50).rotulo).toBe('Saldo projetado');
    expect(computeFluxoCaixaCurva(buckets, 0).rotulo).toBe('Resultado acumulado');
  });

  it('trata inflow_estimated ausente (null) como zero no resultado', () => {
    const buckets = [bucket({ start_date: '2026-06-02', kind: 'future', inflow_estimated: null, inflow_realized: 0 })];

    const curva = computeFluxoCaixaCurva(buckets, 0);

    expect(curva.pontos[0].resultado).toBe(0);
  });
});
