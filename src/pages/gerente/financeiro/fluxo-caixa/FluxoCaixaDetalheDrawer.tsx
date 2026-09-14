import React from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../../../../components/ui/feedback/Drawer';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket, FluxoCaixaInflowByMethod } from '../../../../modules/fluxo-caixa/types';
import { formatBucketDate } from './FluxoCaixaTabela';
import { FluxoCaixaValorEstimado } from './FluxoCaixaValorEstimado';

export interface FluxoCaixaDetalheDrawerProps {
  bucket: FluxoCaixaBucket | null;
  onClose: () => void;
}

const ROTULO_METODO: Record<keyof FluxoCaixaInflowByMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  outros: 'Outros',
};

function formatBucketRangeCompleto(bucket: FluxoCaixaBucket): string {
  if (bucket.start_date === bucket.end_date) return formatBucketDate(bucket.start_date);
  return `${formatBucketDate(bucket.start_date)} a ${formatBucketDate(bucket.end_date)}`;
}

/**
 * Detalhamento de um agrupamento (spec 037, ticket 06): aberto ao tocar numa
 * linha da tabela, num cartão de celular ou num grupo do gráfico. Sem
 * repositório próprio -- os dados já vêm no `bucket` da consulta do
 * contrato, não há nova ida à rede. O realizado aparece em totais, nunca
 * item a item (o próprio contrato de leitura já só devolve agregados).
 */
export const FluxoCaixaDetalheDrawer: React.FC<FluxoCaixaDetalheDrawerProps> = ({ bucket, onClose }) => {
  return (
    <Drawer
      isOpen={bucket !== null}
      onClose={onClose}
      title={bucket ? formatBucketRangeCompleto(bucket) : 'Detalhamento do agrupamento'}
      width="min(92vw, 480px)"
    >
      {bucket && (
        <div className="fluxo-caixa-detalhe">
          <section>
            <h4 className="fluxo-caixa-detalhe-subtitulo">Entradas realizadas por forma de pagamento</h4>
            <dl className="fluxo-caixa-detalhe-lista">
              {(Object.keys(ROTULO_METODO) as Array<keyof FluxoCaixaInflowByMethod>).map((metodo) => (
                <div key={metodo}>
                  <dt>{ROTULO_METODO[metodo]}</dt>
                  <dd>{formatCurrency(bucket.detail.inflow_by_method[metodo])}</dd>
                </div>
              ))}
            </dl>
          </section>

          {bucket.kind !== 'past' && (
            <section>
              <h4 className="fluxo-caixa-detalhe-subtitulo">Entrada estimada</h4>
              <FluxoCaixaValorEstimado value={bucket.inflow_estimated} />
              <p className="fluxo-caixa-detalhe-meta">
                {bucket.detail.estimated_days} {bucket.detail.estimated_days === 1 ? 'dia estimado' : 'dias estimados'}
                {bucket.detail.closed_days > 0 &&
                  ` · ${bucket.detail.closed_days} ${bucket.detail.closed_days === 1 ? 'dia fechado' : 'dias fechados'}`}
              </p>
            </section>
          )}

          <section>
            <h4 className="fluxo-caixa-detalhe-subtitulo">Quitações de Comissão por profissional</h4>
            {bucket.detail.payouts_by_professional.length === 0 ? (
              <p className="fluxo-caixa-detalhe-vazio">Nenhuma Quitação de Comissão no agrupamento.</p>
            ) : (
              <dl className="fluxo-caixa-detalhe-lista">
                {bucket.detail.payouts_by_professional.map((item) => (
                  <div key={item.professional_id}>
                    <dt>{item.professional_name}</dt>
                    <dd>{formatCurrency(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h4 className="fluxo-caixa-detalhe-subtitulo">Vales por profissional</h4>
            {bucket.detail.advances_by_professional.length === 0 ? (
              <p className="fluxo-caixa-detalhe-vazio">Nenhum vale dado no agrupamento.</p>
            ) : (
              <dl className="fluxo-caixa-detalhe-lista">
                {bucket.detail.advances_by_professional.map((item) => (
                  <div key={item.professional_id}>
                    <dt>{item.professional_name}</dt>
                    <dd>{formatCurrency(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <div className="fluxo-caixa-detalhe-subtitulo-header">
              <h4 className="fluxo-caixa-detalhe-subtitulo">Contas a Pagar previstas e vencidas</h4>
              <Link to="/financeiro/contas-a-pagar" className="fluxo-caixa-compromissos-link">
                Ver na aba de Contas a Pagar
              </Link>
            </div>
            {bucket.detail.payables_forecast.length === 0 ? (
              <p className="fluxo-caixa-detalhe-vazio">Nenhuma Conta a Pagar prevista ou vencida no agrupamento.</p>
            ) : (
              <dl className="fluxo-caixa-detalhe-lista">
                {bucket.detail.payables_forecast.map((item) => (
                  <div key={item.payable_id}>
                    <dt>
                      {item.description}
                      {item.overdue && <span className="fluxo-caixa-vencido-badge">vencido</span>}
                      <span className="fluxo-caixa-detalhe-meta"> · vencimento {formatBucketDate(item.due_date)}</span>
                    </dt>
                    <dd>{formatCurrency(item.remaining_amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h4 className="fluxo-caixa-detalhe-subtitulo">Totais do agrupamento</h4>
            <dl className="fluxo-caixa-detalhe-lista">
              <div>
                <dt>Recebido</dt>
                <dd>{formatCurrency(bucket.inflow_realized)}</dd>
              </div>
              <div>
                <dt>Saída realizada</dt>
                <dd>{formatCurrency(bucket.outflow_realized)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </Drawer>
  );
};
