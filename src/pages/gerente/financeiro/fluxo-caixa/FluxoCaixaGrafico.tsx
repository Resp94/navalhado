import React from 'react';
import type { FluxoCaixaBucket } from '../../../../modules/fluxo-caixa/types';
import type { FluxoCaixaCurva } from '../../../../modules/fluxo-caixa/curva';
import { formatBucketDate } from './FluxoCaixaTabela';

export interface FluxoCaixaGraficoProps {
  buckets: FluxoCaixaBucket[];
  curva: FluxoCaixaCurva | null;
  onSelecionarBucket: (index: number) => void;
}

const HEIGHT = 280;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 32;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 16;
const BUCKET_WIDTH = 64;
const MIN_CHART_AREA_WIDTH = 520;

/**
 * Gráfico de barras (entrada realizada + estimada, saída realizada) e linha
 * da curva do período (spec 037, ticket 06). SVG feito à mão, mesmo
 * precedente do painel administrativo (`src/pages/admin/Dashboard.tsx`) --
 * nenhuma dependência nova de gráficos. A tabela continua sendo o
 * equivalente acessível; o `<title>` do SVG descreve o conteúdo.
 *
 * O preenchimento da entrada estimada usa uma hachura (`pattern`), não só
 * uma cor diferente, para a distinção não depender do daltonismo ou de modo
 * de alto contraste apagar a cor -- mesma exigência já aplicada na tabela
 * (`FluxoCaixaValorEstimado`).
 */
export const FluxoCaixaGrafico: React.FC<FluxoCaixaGraficoProps> = ({ buckets, curva, onSelecionarBucket }) => {
  if (buckets.length === 0) return null;

  const chartAreaWidth = Math.max(MIN_CHART_AREA_WIDTH, buckets.length * BUCKET_WIDTH);
  const width = chartAreaWidth + PADDING_LEFT + PADDING_RIGHT;
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const entradasTotais = buckets.map((bucket) => bucket.inflow_realized + (bucket.inflow_estimated ?? 0));
  const saidas = buckets.map((bucket) => bucket.outflow_realized + bucket.outflow_forecast + bucket.outflow_overdue);
  const saldosValidos = curva
    ? curva.pontos.map((ponto) => ponto.saldo).filter((saldo): saldo is number => saldo !== null)
    : [];

  const maxValor = Math.max(1, ...entradasTotais, ...saidas, ...saldosValidos);
  const minValor = Math.min(0, ...saldosValidos);
  const dominio = maxValor - minValor;

  const escalaY = (valor: number) => PADDING_TOP + chartHeight - ((valor - minValor) / dominio) * chartHeight;
  const y0 = escalaY(0);

  const groupWidth = chartAreaWidth / buckets.length;
  const barGap = groupWidth * 0.12;
  const barWidth = (groupWidth - barGap * 3) / 2;

  const primeiroNegativoIndex = curva?.primeiroNegativoIndex ?? null;

  const pontosLinha = curva
    ? curva.pontos.map((ponto, index) => ({
        x: PADDING_LEFT + groupWidth * index + groupWidth / 2,
        y: ponto.saldo === null ? null : escalaY(ponto.saldo),
      }))
    : [];

  const linePath = pontosLinha.reduce((acc, ponto) => {
    if (ponto.y === null) return acc;
    return acc === '' ? `M ${ponto.x} ${ponto.y}` : `${acc} L ${ponto.x} ${ponto.y}`;
  }, '');

  const rotuloCurva = curva?.rotulo || 'Resultado acumulado';
  const titulo = `Gráfico de entradas, saídas realizadas, previstas e vencidas por agrupamento, com a linha de ${rotuloCurva.toLowerCase()} do período`;

  return (
    <section className="card-panel fluxo-caixa-grafico-panel" aria-label="Gráfico do fluxo de caixa projetado">
      <h3 className="card-panel-title">Gráfico do período</h3>

      <p className="fluxo-caixa-grafico-legenda">
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-swatch fluxo-caixa-legenda-swatch--entrada" aria-hidden="true" />
          Entrada realizada
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-swatch fluxo-caixa-legenda-swatch--estimado" aria-hidden="true" />
          Entrada estimada
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-swatch fluxo-caixa-legenda-swatch--saida" aria-hidden="true" />
          Saída realizada
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-swatch fluxo-caixa-legenda-swatch--previsto" aria-hidden="true" />
          Saída prevista
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-swatch fluxo-caixa-legenda-swatch--vencido" aria-hidden="true" />
          Conta vencida
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-linha" aria-hidden="true" />
          {rotuloCurva}
        </span>
      </p>

      <div className="fluxo-caixa-grafico-scroll">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={titulo}>
          <title>{titulo}</title>
          <defs>
            <pattern
              id="fluxo-caixa-hachura-estimado"
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--color-info, #3f83f8)" fillOpacity="0.22" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-info, #3f83f8)" strokeWidth="2" />
            </pattern>
            <pattern
              id="fluxo-caixa-hachura-previsto"
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--color-warning, #b45309)" fillOpacity="0.22" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-warning, #b45309)" strokeWidth="2" />
            </pattern>
            <pattern
              id="fluxo-caixa-hachura-vencido"
              width="6"
              height="6"
              patternTransform="rotate(-45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--color-danger, #c0392b)" fillOpacity="0.3" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-danger, #c0392b)" strokeWidth="2" />
            </pattern>
          </defs>

          <line
            x1={PADDING_LEFT}
            y1={y0}
            x2={width - PADDING_RIGHT}
            y2={y0}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {buckets.map((bucket, index) => {
            const negativo = primeiroNegativoIndex !== null && primeiroNegativoIndex <= index;
            const groupX = PADDING_LEFT + groupWidth * index;
            const entradaRealizada = bucket.inflow_realized;
            const entradaEstimada = bucket.inflow_estimated ?? 0;
            const entradaX = groupX + barGap;
            const saidaX = entradaX + barWidth + barGap;
            const rotuloBucket = formatBucketDate(bucket.start_date);

            return (
              <g
                key={`${bucket.start_date}-${bucket.end_date}`}
                className="fluxo-caixa-grafico-grupo"
                onClick={() => onSelecionarBucket(index)}
                role="button"
                tabIndex={0}
                aria-label={`Ver detalhamento de ${rotuloBucket}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelecionarBucket(index);
                  }
                }}
              >
                {negativo && (
                  <rect
                    x={groupX}
                    y={PADDING_TOP}
                    width={groupWidth}
                    height={chartHeight}
                    fill="rgba(192, 57, 43, 0.08)"
                  />
                )}

                <rect
                  x={entradaX}
                  y={escalaY(entradaRealizada)}
                  width={barWidth}
                  height={Math.max(0, y0 - escalaY(entradaRealizada))}
                  fill="var(--color-success, #2f9e44)"
                />
                {entradaEstimada > 0 && (
                  <rect
                    x={entradaX}
                    y={escalaY(entradaRealizada + entradaEstimada)}
                    width={barWidth}
                    height={Math.max(0, escalaY(entradaRealizada) - escalaY(entradaRealizada + entradaEstimada))}
                    fill="url(#fluxo-caixa-hachura-estimado)"
                  />
                )}

                <rect
                  x={saidaX}
                  y={escalaY(bucket.outflow_realized)}
                  width={barWidth}
                  height={Math.max(0, y0 - escalaY(bucket.outflow_realized))}
                  fill="var(--color-danger, #c0392b)"
                  fillOpacity="0.75"
                />
                {bucket.outflow_forecast > 0 && (
                  <rect
                    x={saidaX}
                    y={escalaY(bucket.outflow_realized + bucket.outflow_forecast)}
                    width={barWidth}
                    height={Math.max(
                      0,
                      escalaY(bucket.outflow_realized) - escalaY(bucket.outflow_realized + bucket.outflow_forecast)
                    )}
                    fill="url(#fluxo-caixa-hachura-previsto)"
                  />
                )}
                {bucket.outflow_overdue > 0 && (
                  <rect
                    x={saidaX}
                    y={escalaY(bucket.outflow_realized + bucket.outflow_forecast + bucket.outflow_overdue)}
                    width={barWidth}
                    height={Math.max(
                      0,
                      escalaY(bucket.outflow_realized + bucket.outflow_forecast) -
                        escalaY(bucket.outflow_realized + bucket.outflow_forecast + bucket.outflow_overdue)
                    )}
                    fill="url(#fluxo-caixa-hachura-vencido)"
                  />
                )}

                <text
                  x={groupX + groupWidth / 2}
                  y={HEIGHT - PADDING_BOTTOM + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-secondary)"
                >
                  {rotuloBucket}
                </text>
              </g>
            );
          })}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-text-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {pontosLinha.map((ponto, index) =>
            ponto.y === null ? null : (
              <circle key={index} cx={ponto.x} cy={ponto.y} r="3" fill="var(--color-text-primary)" />
            )
          )}
        </svg>
      </div>
    </section>
  );
};
