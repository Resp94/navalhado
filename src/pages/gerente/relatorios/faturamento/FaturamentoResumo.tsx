import React from 'react';
import { StatCard } from '../../../../components/ui/data-display/StatCard';
import { formatCurrency } from '../../../../lib/currency';
import { calcularVariacaoPercentual } from '../../../../modules/relatorios/variacao';
import type { RelatorioFaturamentoTotais, RelatoriosPeriodo } from '../../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';

function formatVariacao(atual: number, anterior: number): { value: string; isPositive?: boolean } | undefined {
  const variacao = calcularVariacaoPercentual(atual, anterior);
  if (variacao === null) return undefined;
  const percent = (variacao * 100).toFixed(1);
  return { value: `${variacao >= 0 ? '+' : ''}${percent}%`, isPositive: variacao >= 0 };
}

export interface FaturamentoResumoProps {
  totals: RelatorioFaturamentoTotais | null;
  previousTotals: RelatorioFaturamentoTotais | null;
  previousPeriod: RelatoriosPeriodo | null;
  loading: boolean;
}

/**
 * Cartões de resumo do Faturamento por período (spec 038, ticket 01):
 * bruto, descontos, líquido, serviços, produtos, gorjetas e Comandas
 * fechadas, com a variação percentual contra o período anterior e as
 * datas dele no rótulo do cartão de líquido (o número que mais importa).
 */
export const FaturamentoResumo: React.FC<FaturamentoResumoProps> = ({
  totals,
  previousTotals,
  previousPeriod,
  loading,
}) => {
  const previousLabel =
    previousPeriod && previousPeriod.start && previousPeriod.end
      ? `vs ${formatDisplayDate(previousPeriod.start)} a ${formatDisplayDate(previousPeriod.end)}`
      : undefined;

  return (
    <div className="relatorios-faturamento-cards">
      <StatCard
        title="Faturamento bruto"
        value={formatCurrency(totals?.gross ?? 0)}
        loading={loading}
        trend={totals && previousTotals ? formatVariacao(totals.gross, previousTotals.gross) : undefined}
      />
      <StatCard title="Descontos" value={formatCurrency(totals?.discounts ?? 0)} loading={loading} />
      <StatCard
        title="Faturamento líquido"
        value={formatCurrency(totals?.net ?? 0)}
        loading={loading}
        trend={totals && previousTotals ? formatVariacao(totals.net, previousTotals.net) : undefined}
        subtext={previousLabel}
      />
      <StatCard
        title="Serviços"
        value={formatCurrency(totals?.services_net ?? 0)}
        loading={loading}
        trend={totals && previousTotals ? formatVariacao(totals.services_net, previousTotals.services_net) : undefined}
      />
      <StatCard
        title="Produtos"
        value={formatCurrency(totals?.products_net ?? 0)}
        loading={loading}
        trend={totals && previousTotals ? formatVariacao(totals.products_net, previousTotals.products_net) : undefined}
      />
      <StatCard title="Gorjetas" value={formatCurrency(totals?.tips ?? 0)} loading={loading} />
      <StatCard
        title="Recebido"
        value={formatCurrency(totals?.received_total ?? 0)}
        loading={loading}
        trend={
          totals && previousTotals
            ? formatVariacao(totals.received_total, previousTotals.received_total)
            : undefined
        }
      />
      <StatCard
        title="Comandas fechadas"
        value={totals?.closed_comandas ?? 0}
        loading={loading}
        trend={
          totals && previousTotals
            ? formatVariacao(totals.closed_comandas, previousTotals.closed_comandas)
            : undefined
        }
      />
    </div>
  );
};
