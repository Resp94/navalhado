import React from 'react';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket, FluxoCaixaEstimate } from '../../../../modules/fluxo-caixa/types';

export interface FluxoCaixaResumoProps {
  buckets: FluxoCaixaBucket[];
  estimate: FluxoCaixaEstimate | null;
  loading: boolean;
}

/**
 * Resumo da aba Fluxo de Caixa Projetado (spec 037): cartões de entradas e
 * saídas realizadas (ticket 02: Quitações de Comissão e vales) e de
 * entradas estimadas (ticket 03). Sempre usa "recebido", nunca
 * "faturamento".
 */
export const FluxoCaixaResumo: React.FC<FluxoCaixaResumoProps> = ({ buckets, estimate, loading }) => {
  const totalRealizado = buckets.reduce((sum, bucket) => sum + bucket.inflow_realized, 0);
  const totalSaidaRealizada = buckets.reduce((sum, bucket) => sum + bucket.outflow_realized, 0);
  const semDados = loading && buckets.length === 0;

  const estimativaOk = estimate?.status === 'ok';
  const totalEstimado = estimativaOk
    ? buckets.reduce((sum, bucket) => sum + (bucket.inflow_estimated || 0), 0)
    : null;

  return (
    <>
      <section className="kpi-cards-grid fluxo-caixa-resumo" aria-label="Resumo do fluxo de caixa projetado">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Entradas recebidas</span>
          </div>
          <div>
            <h3 className="kpi-value">{semDados ? '—' : formatCurrency(totalRealizado)}</h3>
            <p className="kpi-meta">Recebido de Comandas fechadas no período selecionado</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Saídas realizadas</span>
          </div>
          <div>
            <h3 className="kpi-value">{semDados ? '—' : formatCurrency(totalSaidaRealizada)}</h3>
            <p className="kpi-meta">Quitações de Comissão e vales pagos no período selecionado</p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Entradas estimadas</span>
          </div>
          <div>
            <h3 className="kpi-value">
              {semDados ? '—' : totalEstimado === null ? 'Histórico insuficiente' : formatCurrency(totalEstimado)}
            </h3>
            <p className="kpi-meta">
              {estimate?.status === 'insufficient_history'
                ? 'Histórico insuficiente para estimar entradas'
                : estimate
                  ? `Estimativa baseada em ${estimate.weeks_used} ${estimate.weeks_used === 1 ? 'semana' : 'semanas'} de histórico`
                  : 'Média do recebido por dia da semana nos dias futuros do período'}
            </p>
          </div>
        </div>
      </section>

      {!semDados && estimate && (
        <p className="fluxo-caixa-aviso">
          {estimativaOk
            ? 'A estimativa de entradas não desconta as comissões que essa receita futura vai gerar. O dia de hoje mostra apenas o realizado.'
            : 'O dia de hoje mostra apenas o realizado.'}
        </p>
      )}
    </>
  );
};
