import React from 'react';
import type { RelatorioFaturamentoBucket } from '../../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';

export interface FaturamentoGraficoProps {
  buckets: RelatorioFaturamentoBucket[];
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
 * Gráfico de evolução do faturamento líquido por agrupamento (spec 038,
 * ticket 04, história 14): barras empilhadas de líquido de serviços e
 * líquido de produtos por dia/semana/mês. SVG feito à mão, mesmo precedente
 * do painel administrativo e do Fluxo de Caixa Projetado
 * (`FluxoCaixaGrafico.tsx`) -- nenhuma dependência nova de gráficos.
 *
 * Serviços e produtos se distinguem sem depender só de cor: produtos usa
 * hachura (mesma técnica de `FluxoCaixaGrafico`), e a legenda rotula os dois
 * por texto. `FaturamentoTabela`, logo abaixo desta seção na página, é o
 * equivalente acessível dos mesmos dados -- este componente não duplica
 * tabela nenhuma, só referencia a de baixo.
 *
 * Em granularidade diária com muitos agrupamentos, o SVG cresce em largura
 * (largura fixa por agrupamento) e rola na horizontal dentro do próprio
 * contêiner (`overflow-x-auto`), nunca a página.
 */
export const FaturamentoGrafico: React.FC<FaturamentoGraficoProps> = ({ buckets }) => {
  if (buckets.length === 0) return null;

  const chartAreaWidth = Math.max(MIN_CHART_AREA_WIDTH, buckets.length * BUCKET_WIDTH);
  const width = chartAreaWidth + PADDING_LEFT + PADDING_RIGHT;
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const maxLiquido = Math.max(1, ...buckets.map((bucket) => bucket.services_net + bucket.products_net));

  const escalaY = (valor: number) => PADDING_TOP + chartHeight - (valor / maxLiquido) * chartHeight;
  const y0 = escalaY(0);

  const groupWidth = chartAreaWidth / buckets.length;
  const barWidth = groupWidth * 0.6;

  const titulo = 'Gráfico de evolução do faturamento líquido de serviços e de produtos por agrupamento do período';

  return (
    <section className="card-panel" aria-label="Gráfico de evolução do faturamento">
      <h3 className="card-panel-title">Evolução do faturamento líquido</h3>

      <p className="flex flex-wrap gap-x-4 gap-y-[0.35rem] mb-2 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-[0.35rem]">
          <span className="inline-block w-[0.85rem] h-[0.85rem] rounded-[3px] bg-brand-primary" aria-hidden="true" />
          Serviços
        </span>
        <span className="inline-flex items-center gap-[0.35rem]">
          <span
            className="inline-block w-[0.85rem] h-[0.85rem] rounded-[3px]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--color-info, #3f83f8) 0, var(--color-info, #3f83f8) 1.5px, transparent 1.5px, transparent 4px)',
              backgroundColor: 'rgba(63, 131, 248, 0.25)',
            }}
            aria-hidden="true"
          />
          Produtos
        </span>
      </p>

      <p className="mb-3 text-xs text-text-secondary">
        A tabela abaixo mostra os mesmos valores por agrupamento.
      </p>

      <div className="overflow-x-auto max-w-full">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={titulo}>
          <title>{titulo}</title>
          <defs>
            <pattern
              id="relatorios-faturamento-hachura-produtos"
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
            const barX = groupX + (groupWidth - barWidth) / 2;
            const rotulo = formatEixoData(bucket.start_date);

            return (
              <g key={`${bucket.start_date}-${bucket.end_date}`}>
                <rect
                  x={barX}
                  y={escalaY(bucket.services_net)}
                  width={barWidth}
                  height={Math.max(0, y0 - escalaY(bucket.services_net))}
                  fill="var(--color-brand-primary, #D96C00)"
                />
                {bucket.products_net > 0 && (
                  <rect
                    x={barX}
                    y={escalaY(bucket.services_net + bucket.products_net)}
                    width={barWidth}
                    height={Math.max(
                      0,
                      escalaY(bucket.services_net) - escalaY(bucket.services_net + bucket.products_net)
                    )}
                    fill="url(#relatorios-faturamento-hachura-produtos)"
                  />
                )}
                <text
                  x={groupX + groupWidth / 2}
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
