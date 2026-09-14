import React from 'react';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket, FluxoCaixaBucketKind } from '../../../../modules/fluxo-caixa/types';
import { FluxoCaixaValorEstimado } from './FluxoCaixaValorEstimado';

export interface FluxoCaixaTabelaProps {
  buckets: FluxoCaixaBucket[];
  loading: boolean;
}

const KIND_LABELS: Record<FluxoCaixaBucketKind, string> = {
  past: 'Passado',
  current: 'Atual',
  future: 'Futuro',
};

function formatBucketDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [, month, day] = parts;
  return `${day}/${month}`;
}

function formatBucketRange(bucket: FluxoCaixaBucket): string {
  if (bucket.start_date === bucket.end_date) return formatBucketDate(bucket.start_date);
  return `${formatBucketDate(bucket.start_date)} – ${formatBucketDate(bucket.end_date)}`;
}

/**
 * Tabela da aba Fluxo de Caixa Projetado (spec 037): uma linha por
 * agrupamento, com o recebido e a saída realizada (ticket 02). Em largura de
 * celular vira lista de cartões pela mesma composição responsiva (CSS em
 * FluxoCaixa.css), sem "MobileView" separada.
 */
export const FluxoCaixaTabela: React.FC<FluxoCaixaTabelaProps> = ({ buckets, loading }) => {
  return (
    <section className="card-panel fluxo-caixa-tabela-panel" aria-label="Agrupamentos do fluxo de caixa projetado">
      <h3 className="card-panel-title">Agrupamentos do período</h3>

      {loading && buckets.length === 0 ? (
        <p className="fluxo-caixa-tabela-mensagem">Carregando agrupamentos...</p>
      ) : buckets.length === 0 ? (
        <p className="fluxo-caixa-tabela-mensagem">Nenhum agrupamento para o período selecionado.</p>
      ) : (
        <table className="fluxo-caixa-tabela" aria-label="Uma linha por agrupamento do período, com o recebido, a saída realizada e a entrada estimada">
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Classificação</th>
              <th scope="col">Recebido</th>
              <th scope="col">Saída realizada</th>
              <th scope="col">Estimado</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={`${bucket.start_date}-${bucket.end_date}`}>
                <td data-label="Período">{formatBucketRange(bucket)}</td>
                <td data-label="Classificação">
                  <span className={`fluxo-caixa-kind fluxo-caixa-kind--${bucket.kind}`}>
                    {KIND_LABELS[bucket.kind]}
                  </span>
                </td>
                <td data-label="Recebido">{formatCurrency(bucket.inflow_realized)}</td>
                <td data-label="Saída realizada">{formatCurrency(bucket.outflow_realized)}</td>
                <td data-label="Estimado">
                  {bucket.kind === 'past' ? '—' : <FluxoCaixaValorEstimado value={bucket.inflow_estimated} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
