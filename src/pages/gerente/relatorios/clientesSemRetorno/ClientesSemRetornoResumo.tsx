import React from 'react';
import { StatCard } from '../../../../components/ui/data-display/StatCard';
import type { RelatorioClientesSemRetornoTotais } from '../../../../modules/relatorios/types';

export interface ClientesSemRetornoResumoProps {
  totals: RelatorioClientesSemRetornoTotais | null;
  loading: boolean;
}

/**
 * Cartões de totais da página Clientes sem Retorno (spec 038, ticket 09):
 * sem retorno, dentro do prazo e nunca veio -- os três ignoram paginação e
 * o filtro de faixa, mas respeitam o filtro de profissional (pela última
 * Visita), a mesma regra do relatório inteiro. Sempre os três juntos: "sem
 * retorno" sozinho não deixa claro que a base de clientes é maior.
 */
export const ClientesSemRetornoResumo: React.FC<ClientesSemRetornoResumoProps> = ({ totals, loading }) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      <StatCard title="Sem retorno" value={totals?.without_return ?? 0} loading={loading} />
      <StatCard title="Dentro do prazo" value={totals?.within_return ?? 0} loading={loading} />
      <StatCard title="Nunca veio" value={totals?.no_visit_ever ?? 0} loading={loading} />
    </div>
  );
};
