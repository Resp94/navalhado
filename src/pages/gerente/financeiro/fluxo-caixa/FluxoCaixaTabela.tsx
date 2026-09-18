import React from 'react';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket, FluxoCaixaBucketKind } from '../../../../modules/fluxo-caixa/types';
import type { FluxoCaixaCurva } from '../../../../modules/fluxo-caixa/curva';
import { FluxoCaixaValorEstimado } from './FluxoCaixaValorEstimado';
import { FluxoCaixaValorPrevisto } from './FluxoCaixaValorPrevisto';

export interface FluxoCaixaTabelaProps {
  buckets: FluxoCaixaBucket[];
  curva: FluxoCaixaCurva | null;
  loading: boolean;
  onSelecionarBucket: (index: number) => void;
}

const KIND_LABELS: Record<FluxoCaixaBucketKind, string> = {
  past: 'Passado',
  current: 'Atual',
  future: 'Futuro',
};

const KIND_CLASSES: Record<FluxoCaixaBucketKind, string> = {
  past: 'bg-[rgba(120,120,120,0.15)] text-text-secondary',
  current: 'bg-warning-bg text-warning',
  future: 'bg-info/[0.12] text-info',
};

// Cabeçalho e célula: mesma composição em telas largas; abaixo de 768px a
// tabela vira lista de cartões (cada <tr> um cartão, cada <td> uma linha com
// o rótulo via `data-label` renderizado por `before:content-[attr(...)]`),
// sem view mobile separada.
const TH_CLASSES =
  'text-left py-[0.65rem] px-3 text-xs uppercase tracking-[0.04em] text-text-secondary border-b border-border';
const TD_CLASSES =
  'text-left py-[0.65rem] px-3 text-sm border-b border-border ' +
  'max-md:flex max-md:justify-between max-md:items-center max-md:border-b-0 max-md:py-[0.35rem] ' +
  'max-md:before:content-[attr(data-label)] max-md:before:text-xs max-md:before:font-bold max-md:before:uppercase ' +
  'max-md:before:tracking-[0.04em] max-md:before:text-text-secondary max-md:before:mr-4';

export function formatBucketDate(dateStr: string): string {
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
 * celular vira lista de cartões pela mesma composição responsiva (utilities
 * Tailwind `max-md:*` abaixo), sem "MobileView" separada.
 */
export const FluxoCaixaTabela: React.FC<FluxoCaixaTabelaProps> = ({ buckets, curva, loading, onSelecionarBucket }) => {
  return (
    <section className="card-panel overflow-x-auto" aria-label="Agrupamentos do fluxo de caixa projetado">
      <h3 className="card-panel-title">Agrupamentos do período</h3>

      {loading && buckets.length === 0 ? (
        <p className="text-sm text-text-secondary py-4">Carregando agrupamentos...</p>
      ) : buckets.length === 0 ? (
        <p className="text-sm text-text-secondary py-4">Nenhum agrupamento para o período selecionado.</p>
      ) : (
        <table
          className="w-full border-collapse max-md:block"
          aria-label="Uma linha por agrupamento do período, com o recebido, a saída realizada, a entrada estimada, a saída prevista ou vencida e a curva"
        >
          <thead className="max-md:hidden">
            <tr>
              <th scope="col" className={TH_CLASSES}>Período</th>
              <th scope="col" className={TH_CLASSES}>Classificação</th>
              <th scope="col" className={TH_CLASSES}>Recebido</th>
              <th scope="col" className={TH_CLASSES}>Saída realizada</th>
              <th scope="col" className={TH_CLASSES}>Estimado</th>
              <th scope="col" className={TH_CLASSES}>Previsto</th>
              <th scope="col" className={TH_CLASSES}>{curva?.rotulo || 'Resultado acumulado'}</th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {buckets.map((bucket, index) => {
              const saldo = curva?.pontos[index]?.saldo ?? null;
              const negativo = curva?.primeiroNegativoIndex !== null && (curva?.primeiroNegativoIndex ?? -1) <= index;
              return (
                <tr
                  key={`${bucket.start_date}-${bucket.end_date}`}
                  className="cursor-pointer hover:bg-bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info max-md:block max-md:w-full max-md:border max-md:border-border max-md:rounded-md max-md:mb-3 max-md:py-2 max-md:px-3"
                  onClick={() => onSelecionarBucket(index)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalhamento de ${formatBucketRange(bucket)}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelecionarBucket(index);
                    }
                  }}
                >
                  <td data-label="Período" className={TD_CLASSES}>{formatBucketRange(bucket)}</td>
                  <td data-label="Classificação" className={TD_CLASSES}>
                    <span className={`inline-flex items-center py-[0.15rem] px-[0.55rem] rounded-full text-xs font-bold ${KIND_CLASSES[bucket.kind]}`}>
                      {KIND_LABELS[bucket.kind]}
                    </span>
                  </td>
                  <td data-label="Recebido" className={TD_CLASSES}>{formatCurrency(bucket.inflow_realized)}</td>
                  <td data-label="Saída realizada" className={TD_CLASSES}>{formatCurrency(bucket.outflow_realized)}</td>
                  <td data-label="Estimado" className={TD_CLASSES}>
                    {bucket.kind === 'past' ? '—' : <FluxoCaixaValorEstimado value={bucket.inflow_estimated} />}
                  </td>
                  <td data-label="Previsto" className={TD_CLASSES}>
                    <FluxoCaixaValorPrevisto forecast={bucket.outflow_forecast} overdue={bucket.outflow_overdue} />
                  </td>
                  <td data-label={curva?.rotulo || 'Resultado acumulado'} className={TD_CLASSES}>
                    {saldo === null ? (
                      '—'
                    ) : (
                      <span className={negativo ? 'text-[#c0392b] font-bold' : undefined}>
                        {formatCurrency(saldo)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};
