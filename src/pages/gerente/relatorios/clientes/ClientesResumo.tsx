import React from 'react';
import { StatCard } from '../../../../components/ui/data-display/StatCard';
import { calcularVariacaoPercentual } from '../../../../modules/relatorios/variacao';
import type { RelatorioClientesVisitantes, RelatorioClientesVisitantesAnterior } from '../../../../modules/relatorios/types';

function formatVariacao(atual: number, anterior: number): { value: string; isPositive?: boolean } | undefined {
  const variacao = calcularVariacaoPercentual(atual, anterior);
  if (variacao === null) return undefined;
  const percent = (variacao * 100).toFixed(1);
  return { value: `${variacao >= 0 ? '+' : ''}${percent}%`, isPositive: variacao >= 0 };
}

export interface ClientesResumoProps {
  visitors: RelatorioClientesVisitantes | null;
  previousVisitors: RelatorioClientesVisitantesAnterior | null;
  loading: boolean;
}

/**
 * Cartões de totais da página Clientes (spec 038, ticket 10): únicos,
 * novos, recorrentes, novos de uma visita só e sem cliente identificado,
 * com a variação percentual contra o período anterior -- mesmo padrão do
 * `FaturamentoResumo`. "Novos de uma visita só" não tem variação: o
 * período anterior nunca traz `new_single_visit` (depende de "até hoje",
 * incompatível com um período anterior fixo -- ver
 * `RelatorioClientesVisitantesAnterior`).
 */
export const ClientesResumo: React.FC<ClientesResumoProps> = ({ visitors, previousVisitors, loading }) => {
  return (
    <div className="relatorios-faturamento-cards">
      <StatCard
        title="Clientes únicos"
        value={visitors?.unique_customers ?? 0}
        loading={loading}
        trend={
          visitors && previousVisitors
            ? formatVariacao(visitors.unique_customers, previousVisitors.unique_customers)
            : undefined
        }
      />
      <StatCard
        title="Clientes novos"
        value={visitors?.new_customers ?? 0}
        loading={loading}
        trend={
          visitors && previousVisitors
            ? formatVariacao(visitors.new_customers, previousVisitors.new_customers)
            : undefined
        }
      />
      <StatCard
        title="Clientes recorrentes"
        value={visitors?.returning_customers ?? 0}
        loading={loading}
        trend={
          visitors && previousVisitors
            ? formatVariacao(visitors.returning_customers, previousVisitors.returning_customers)
            : undefined
        }
      />
      <StatCard title="Novos de uma visita só" value={visitors?.new_single_visit ?? 0} loading={loading} />
      <StatCard
        title="Sem cliente identificado"
        value={visitors?.unidentified_attendances ?? 0}
        loading={loading}
        trend={
          visitors && previousVisitors
            ? formatVariacao(visitors.unidentified_attendances, previousVisitors.unidentified_attendances)
            : undefined
        }
      />
    </div>
  );
};
