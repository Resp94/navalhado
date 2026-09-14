import type { FluxoCaixaBucket, FluxoCaixaBucketKind } from './types';

export type FluxoCaixaCurvaRotulo = 'Resultado acumulado' | 'Saldo projetado';

export interface FluxoCaixaCurvaPonto {
  start_date: string;
  end_date: string;
  kind: FluxoCaixaBucketKind;
  /** entradas realizadas + estimadas − saídas realizadas − previstas − vencidas (campos ainda ausentes contam como zero). */
  resultado: number;
  /**
   * `null` em agrupamentos passados quando há saldo informado: reconstruir
   * saldo passado fingiria conhecer dinheiro que o sistema não registra.
   * Sem saldo informado, é a mesma soma corrida de `resultado` -- nunca nulo.
   */
  saldo: number | null;
}

export interface FluxoCaixaCurva {
  rotulo: FluxoCaixaCurvaRotulo;
  pontos: FluxoCaixaCurvaPonto[];
  /** Índice, em `pontos`, do primeiro agrupamento com saldo negativo; `null` se nenhum for negativo. */
  primeiroNegativoIndex: number | null;
}

function resultadoDoBucket(bucket: FluxoCaixaBucket): number {
  return (
    bucket.inflow_realized +
    (bucket.inflow_estimated ?? 0) -
    bucket.outflow_realized -
    bucket.outflow_forecast -
    bucket.outflow_overdue
  );
}

/**
 * Curva do Fluxo de Caixa Projetado (spec 037, ticket 04), composta no
 * navegador -- o saldo informado é entrada só de tela, nunca gravado, nunca
 * enviado ao banco. Chamada a cada tecla do campo de saldo, sem refazer a
 * consulta ao contrato de leitura.
 *
 * Sem saldo informado (zero, o padrão): **Resultado Acumulado**, soma
 * corrida do resultado de cada agrupamento desde o primeiro do período.
 *
 * Com saldo informado (maior que zero): **Saldo Projetado**, começa no
 * agrupamento atual com `saldoInformado + pending_flow` desse agrupamento e
 * soma o `pending_flow` de cada agrupamento seguinte -- o realizado até hoje
 * já está dentro do saldo informado, e agrupamentos passados não têm saldo.
 */
export function computeFluxoCaixaCurva(buckets: FluxoCaixaBucket[], saldoInformado: number): FluxoCaixaCurva {
  const informado = saldoInformado > 0;
  const rotulo: FluxoCaixaCurvaRotulo = informado ? 'Saldo projetado' : 'Resultado acumulado';

  let acumulado = 0;
  let saldoCorrente: number | null = null;

  const pontos: FluxoCaixaCurvaPonto[] = buckets.map((bucket) => {
    const resultado = resultadoDoBucket(bucket);
    let saldo: number | null;

    if (!informado) {
      acumulado += resultado;
      saldo = acumulado;
    } else if (bucket.kind === 'past') {
      saldo = null;
    } else if (saldoCorrente === null) {
      saldoCorrente = saldoInformado + bucket.pending_flow;
      saldo = saldoCorrente;
    } else {
      saldoCorrente += bucket.pending_flow;
      saldo = saldoCorrente;
    }

    return { start_date: bucket.start_date, end_date: bucket.end_date, kind: bucket.kind, resultado, saldo };
  });

  const primeiroNegativoIndex = pontos.findIndex((ponto) => ponto.saldo !== null && ponto.saldo < 0);

  return {
    rotulo,
    pontos,
    primeiroNegativoIndex: primeiroNegativoIndex === -1 ? null : primeiroNegativoIndex,
  };
}
