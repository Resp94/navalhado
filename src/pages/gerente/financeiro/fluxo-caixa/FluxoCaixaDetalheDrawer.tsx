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

const SUBTITULO_CLASSES = 'mb-2 text-sm font-extrabold text-text-primary';
const LISTA_CLASSES = 'flex flex-col gap-[0.4rem] m-0';
const ITEM_CLASSES = 'flex items-center justify-between gap-3 text-sm';

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
        <div className="flex flex-col gap-5">
          <section>
            <h4 className={SUBTITULO_CLASSES}>Entradas realizadas por forma de pagamento</h4>
            <dl className={LISTA_CLASSES}>
              {(Object.keys(ROTULO_METODO) as Array<keyof FluxoCaixaInflowByMethod>).map((metodo) => (
                <div key={metodo} className={ITEM_CLASSES}>
                  <dt className="text-text-secondary">{ROTULO_METODO[metodo]}</dt>
                  <dd className="m-0 font-bold text-text-primary">{formatCurrency(bucket.detail.inflow_by_method[metodo])}</dd>
                </div>
              ))}
            </dl>
          </section>

          {bucket.kind !== 'past' && (
            <section>
              <h4 className={SUBTITULO_CLASSES}>Entrada estimada</h4>
              <FluxoCaixaValorEstimado value={bucket.inflow_estimated} />
              <p className="mt-[0.35rem] text-xs text-text-secondary">
                {bucket.detail.estimated_days} {bucket.detail.estimated_days === 1 ? 'dia estimado' : 'dias estimados'}
                {bucket.detail.closed_days > 0 &&
                  ` · ${bucket.detail.closed_days} ${bucket.detail.closed_days === 1 ? 'dia fechado' : 'dias fechados'}`}
              </p>
            </section>
          )}

          <section>
            <h4 className={SUBTITULO_CLASSES}>Quitações de Comissão por profissional</h4>
            {bucket.detail.payouts_by_professional.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma Quitação de Comissão no agrupamento.</p>
            ) : (
              <dl className={LISTA_CLASSES}>
                {bucket.detail.payouts_by_professional.map((item) => (
                  <div key={item.professional_id} className={ITEM_CLASSES}>
                    <dt className="text-text-secondary">{item.professional_name}</dt>
                    <dd className="m-0 font-bold text-text-primary">{formatCurrency(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h4 className={SUBTITULO_CLASSES}>Vales por profissional</h4>
            {bucket.detail.advances_by_professional.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhum vale dado no agrupamento.</p>
            ) : (
              <dl className={LISTA_CLASSES}>
                {bucket.detail.advances_by_professional.map((item) => (
                  <div key={item.professional_id} className={ITEM_CLASSES}>
                    <dt className="text-text-secondary">{item.professional_name}</dt>
                    <dd className="m-0 font-bold text-text-primary">{formatCurrency(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-extrabold text-text-primary">Contas a Pagar previstas e vencidas</h4>
              <Link to="/financeiro/contas-a-pagar" className="text-xs font-bold text-info no-underline hover:underline">
                Ver na aba de Contas a Pagar
              </Link>
            </div>
            {bucket.detail.payables_forecast.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma Conta a Pagar prevista ou vencida no agrupamento.</p>
            ) : (
              <dl className={LISTA_CLASSES}>
                {bucket.detail.payables_forecast.map((item) => (
                  <div key={item.payable_id} className={ITEM_CLASSES}>
                    <dt className="text-text-secondary">
                      {item.description}
                      {item.overdue && (
                        <span className="inline-flex items-center px-[0.4rem] py-[0.1rem] ml-[0.35rem] rounded-full text-[0.65rem] font-bold uppercase tracking-[0.03em] bg-[#c0392b]/[0.12] text-[#c0392b]">
                          vencido
                        </span>
                      )}
                      <span className="text-xs text-text-secondary"> · vencimento {formatBucketDate(item.due_date)}</span>
                    </dt>
                    <dd className="m-0 font-bold text-text-primary">{formatCurrency(item.remaining_amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h4 className={SUBTITULO_CLASSES}>Baixas pagas por Categoria de Despesa</h4>
            {bucket.detail.settlements_by_category.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma Baixa paga no agrupamento.</p>
            ) : (
              <dl className={LISTA_CLASSES}>
                {bucket.detail.settlements_by_category.map((item) => (
                  <div key={item.category_id} className={ITEM_CLASSES}>
                    <dt className="text-text-secondary">{item.category_name}</dt>
                    <dd className="m-0 font-bold text-text-primary">{formatCurrency(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h4 className={SUBTITULO_CLASSES}>Totais do agrupamento</h4>
            <dl className={LISTA_CLASSES}>
              <div className={ITEM_CLASSES}>
                <dt className="text-text-secondary">Recebido</dt>
                <dd className="m-0 font-bold text-text-primary">{formatCurrency(bucket.inflow_realized)}</dd>
              </div>
              <div className={ITEM_CLASSES}>
                <dt className="text-text-secondary">Saída realizada</dt>
                <dd className="m-0 font-bold text-text-primary">{formatCurrency(bucket.outflow_realized)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </Drawer>
  );
};
