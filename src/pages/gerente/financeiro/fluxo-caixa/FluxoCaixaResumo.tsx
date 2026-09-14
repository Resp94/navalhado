import React from 'react';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket } from '../../../../modules/fluxo-caixa/types';

export interface FluxoCaixaResumoProps {
  buckets: FluxoCaixaBucket[];
  loading: boolean;
}

/**
 * Resumo da aba Fluxo de Caixa Projetado (spec 037): cartões de entradas e
 * saídas realizadas (ticket 02: Quitações de Comissão e vales). Sempre usa
 * "recebido", nunca "faturamento".
 */
export const FluxoCaixaResumo: React.FC<FluxoCaixaResumoProps> = ({ buckets, loading }) => {
  const totalRealizado = buckets.reduce((sum, bucket) => sum + bucket.inflow_realized, 0);
  const totalSaidaRealizada = buckets.reduce((sum, bucket) => sum + bucket.outflow_realized, 0);

  return (
    <section className="kpi-cards-grid fluxo-caixa-resumo" aria-label="Resumo do fluxo de caixa projetado">
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Entradas recebidas</span>
        </div>
        <div>
          <h3 className="kpi-value">{loading && buckets.length === 0 ? '—' : formatCurrency(totalRealizado)}</h3>
          <p className="kpi-meta">Recebido de Comandas fechadas no período selecionado</p>
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Saídas realizadas</span>
        </div>
        <div>
          <h3 className="kpi-value">{loading && buckets.length === 0 ? '—' : formatCurrency(totalSaidaRealizada)}</h3>
          <p className="kpi-meta">Quitações de Comissão e vales pagos no período selecionado</p>
        </div>
      </div>
    </section>
  );
};
