import React from 'react';
import { StatCard } from '../../../../components/ui/data-display/StatCard';
import { formatCurrency } from '../../../../lib/currency';
import { calcularVariacaoPercentual } from '../../../../modules/relatorios/variacao';
import type { RelatorioFaturamentoTotais, RelatoriosPeriodo } from '../../../../modules/relatorios/types';
import { formatCurrencyOrDash } from '../../../../modules/relatorios/formatacao';

function formatVariacao(atual: number, anterior: number): { value: string; isPositive?: boolean } | undefined {
  const variacao = calcularVariacaoPercentual(atual, anterior);
  if (variacao === null) return undefined;
  const percent = (variacao * 100).toFixed(1);
  return { value: `${variacao >= 0 ? '+' : ''}${percent}%`, isPositive: variacao >= 0 };
}

/**
 * Variação do ticket médio: `undefined` (sem seta, sem "--" quebrado)
 * quando qualquer um dos dois lados é `null` -- não há variação que faça
 * sentido mostrar sem os dois valores.
 */
function formatVariacaoTicketMedio(
  atual: number | null,
  anterior: number | null
): { value: string; isPositive?: boolean } | undefined {
  if (atual === null || anterior === null) return undefined;
  return formatVariacao(atual, anterior);
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
  loading,
}) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
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
        title="Ticket médio"
        value={formatCurrencyOrDash(totals?.average_ticket ?? null)}
        loading={loading}
        trend={
          totals && previousTotals
            ? formatVariacaoTicketMedio(totals.average_ticket, previousTotals.average_ticket)
            : undefined
        }
      />
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
