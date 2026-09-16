import React from 'react';
import type { RelatorioClientesBucket } from '../../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';

export interface ClientesGraficoProps {
  buckets: RelatorioClientesBucket[];
}

const HEIGHT = 260;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 32;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 16;
const BUCKET_WIDTH = 56;
const MIN_CHART_AREA_WIDTH = 480;

/** `aaaa-mm-dd` -> `dd/mm`, rótulo compacto do eixo: `formatDisplayDate` sem o ano. */
function formatEixoData(dateStr: string): string {
  return formatDisplayDate(dateStr).slice(0, 5);
}

/**
 * Gráfico de evolução de Novos x Recorrentes por agrupamento (spec 038,
 * ticket 10): barras agrupadas (uma para novos, uma para recorrentes) lado
 * a lado por dia/semana/mês -- diferente do `FaturamentoGrafico`
 * (empilhado), porque aqui os dois números não somam um "total" que faça
 * sentido visualmente empilhar; o gestor compara os dois lado a lado. SVG
 * feito à mão, mesmo precedente do painel administrativo, do Fluxo de
 * Caixa Projetado e do próprio `FaturamentoGrafico` -- nenhuma dependência
 * nova de gráficos.
 *
 * `ClientesTabela`, logo abaixo desta seção na página, é o equivalente
 * acessível dos mesmos dados -- este componente não duplica tabela
 * nenhuma, só referencia a de baixo.
 *
 * Em granularidade diária com muitos agrupamentos, o SVG cresce em largura
 * (largura fixa por agrupamento) e rola na horizontal dentro do próprio
 * contêiner (`.relatorios-faturamento-grafico-scroll`), nunca a página.
 */
export const ClientesGrafico: React.FC<ClientesGraficoProps> = ({ buckets }) => {
  if (buckets.length === 0) return null;

  const chartAreaWidth = Math.max(MIN_CHART_AREA_WIDTH, buckets.length * BUCKET_WIDTH);
  const width = chartAreaWidth + PADDING_LEFT + PADDING_RIGHT;
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const maxValor = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.new_customers, bucket.returning_customers)));

  const escalaY = (valor: number) => PADDING_TOP + chartHeight - (valor / maxValor) * chartHeight;
  const y0 = escalaY(0);

  const groupWidth = chartAreaWidth / buckets.length;
  const barWidth = Math.min(18, groupWidth * 0.28);
  const barGap = 4;

  const titulo = 'Gráfico de evolução de clientes novos e recorrentes por agrupamento do período';

  return (
    <section className="card-panel relatorios-faturamento-grafico-panel" aria-label="Gráfico de evolução de novos x recorrentes">
      <h3 className="card-panel-title">Evolução de novos x recorrentes</h3>

      <p className="relatorios-faturamento-grafico-legenda">
        <span className="relatorios-faturamento-legenda-item">
          <span className="relatorios-faturamento-legenda-swatch relatorios-faturamento-legenda-swatch--servicos" aria-hidden="true" />
          Novos
        </span>
        <span className="relatorios-faturamento-legenda-item">
          <span className="relatorios-faturamento-legenda-swatch relatorios-faturamento-legenda-swatch--produtos" aria-hidden="true" />
          Recorrentes
        </span>
      </p>

      <p className="relatorios-faturamento-grafico-nota">
        A tabela abaixo mostra os mesmos valores por agrupamento.
      </p>

      <div className="relatorios-faturamento-grafico-scroll">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={titulo}>
          <title>{titulo}</title>
          <defs>
            <pattern
              id="relatorios-clientes-hachura-recorrentes"
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--color-info, #3f83f8)" fillOpacity="0.25" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-info, #3f83f8)" strokeWidth="2" />
            </pattern>
          </defs>

          <line x1={PADDING_LEFT} y1={y0} x2={width - PADDING_RIGHT} y2={y0} stroke="var(--color-border)" strokeWidth="1" />

          {buckets.map((bucket, index) => {
            const groupX = PADDING_LEFT + groupWidth * index;
            const groupCenter = groupX + groupWidth / 2;
            const novosX = groupCenter - barGap / 2 - barWidth;
            const recorrentesX = groupCenter + barGap / 2;
            const rotulo = formatEixoData(bucket.start_date);

            return (
              <g key={`${bucket.start_date}-${bucket.end_date}`} className="relatorios-faturamento-grafico-grupo">
                <rect
                  x={novosX}
                  y={escalaY(bucket.new_customers)}
                  width={barWidth}
                  height={Math.max(0, y0 - escalaY(bucket.new_customers))}
                  fill="var(--color-brand-primary, #D96C00)"
                />
                <rect
                  x={recorrentesX}
                  y={escalaY(bucket.returning_customers)}
                  width={barWidth}
                  height={Math.max(0, y0 - escalaY(bucket.returning_customers))}
                  fill="url(#relatorios-clientes-hachura-recorrentes)"
                />
                <text
                  x={groupCenter}
                  y={HEIGHT - PADDING_BOTTOM + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-secondary)"
                >
                  {rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};
