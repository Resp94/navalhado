import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../../../lib/currency';
import type { FluxoCaixaBucket, FluxoCaixaEstimate, FluxoCaixaUndatedCommitments } from '../../../../modules/fluxo-caixa/types';
import type { FluxoCaixaCurva } from '../../../../modules/fluxo-caixa/curva';
import { formatBucketDate } from './FluxoCaixaTabela';

export interface FluxoCaixaResumoProps {
  buckets: FluxoCaixaBucket[];
  estimate: FluxoCaixaEstimate | null;
  undatedCommitments: FluxoCaixaUndatedCommitments | null;
  curva: FluxoCaixaCurva | null;
  loading: boolean;
}

/**
 * Resumo da aba Fluxo de Caixa Projetado (spec 037): cartões de entradas e
 * saídas realizadas (ticket 02: Quitações de Comissão e vales), de entradas
 * estimadas (ticket 03), e da curva -- Resultado Acumulado ou Saldo
 * Projetado, com destaque do primeiro período negativo (ticket 04).
 */
export const FluxoCaixaResumo: React.FC<FluxoCaixaResumoProps> = ({
  buckets,
  estimate,
  undatedCommitments,
  curva,
  loading,
}) => {
  const totalRealizado = buckets.reduce((sum, bucket) => sum + bucket.inflow_realized, 0);
  const totalSaidaRealizada = buckets.reduce((sum, bucket) => sum + bucket.outflow_realized, 0);
  const semDados = loading && buckets.length === 0;

  const estimativaOk = estimate?.status === 'ok';
  const totalEstimado = estimativaOk
    ? buckets.reduce((sum, bucket) => sum + (bucket.inflow_estimated || 0), 0)
    : null;

  const ultimoPonto = curva && curva.pontos.length > 0 ? curva.pontos[curva.pontos.length - 1] : null;
  const pontoNegativo =
    curva && curva.primeiroNegativoIndex !== null ? curva.pontos[curva.primeiroNegativoIndex] : null;

  // Compromissos sem Data (ticket 05): calculado no momento da consulta,
  // nunca distribuído entre agrupamentos nem somado ao pending_flow/curva.
  const valorAposCompromissos =
    ultimoPonto && ultimoPonto.saldo !== null && undatedCommitments
      ? ultimoPonto.saldo - undatedCommitments.net_due
      : null;
  // O líquido devido pode ser maior que "comissões + gorjetas − vales" só
  // quando algum profissional individualmente tem vale acima do que tem a
  // receber (piso zero por profissional, aplicado antes da soma) -- por
  // isso o aviso é uma comparação aritmética, não um campo novo do contrato.
  const somaSimplesPodeDivergir =
    undatedCommitments !== null &&
    undatedCommitments.net_due > undatedCommitments.commission_open + undatedCommitments.tips_open - undatedCommitments.advances_open;

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
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">{curva?.rotulo || 'Resultado acumulado'} ao fim do período</span>
          </div>
          <div>
            <h3 className={`kpi-value ${ultimoPonto && ultimoPonto.saldo !== null && ultimoPonto.saldo < 0 ? 'fluxo-caixa-saldo-negativo' : ''}`}>
              {semDados || !ultimoPonto || ultimoPonto.saldo === null ? '—' : formatCurrency(ultimoPonto.saldo)}
            </h3>
            <p className="kpi-meta">
              {curva?.rotulo === 'Saldo projetado'
                ? 'Saldo informado somado ao fluxo pendente do período'
                : 'Soma corrida de entradas menos saídas do período'}
            </p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Valor depois dos Compromissos sem Data</span>
          </div>
          <div>
            <h3 className={`kpi-value ${valorAposCompromissos !== null && valorAposCompromissos < 0 ? 'fluxo-caixa-saldo-negativo' : ''}`}>
              {semDados || valorAposCompromissos === null ? '—' : formatCurrency(valorAposCompromissos)}
            </h3>
            <p className="kpi-meta">
              {curva?.rotulo || 'Resultado acumulado'} ao fim do período menos o líquido devido à equipe
            </p>
          </div>
        </div>
      </section>

      {!semDados && undatedCommitments && (
        <section className="card-panel fluxo-caixa-compromissos" aria-label="Compromissos sem Data">
          <div className="fluxo-caixa-compromissos-header">
            <h3 className="card-panel-title">Compromissos sem Data</h3>
            <Link to="/financeiro/comissoes" className="fluxo-caixa-compromissos-link">
              Ver na aba de Comissões
            </Link>
          </div>
          <p className="kpi-meta">
            Quanto a barbearia deve hoje à equipe entre comissões e gorjetas em aberto, já descontados os vales a
            abater. Não é distribuído entre os agrupamentos nem entra no fluxo pendente ou na curva.
          </p>
          <div className="fluxo-caixa-compromissos-valores">
            <div>
              <span className="kpi-label">Comissões em aberto</span>
              <strong>{formatCurrency(undatedCommitments.commission_open)}</strong>
            </div>
            <div>
              <span className="kpi-label">Gorjetas em aberto</span>
              <strong>{formatCurrency(undatedCommitments.tips_open)}</strong>
            </div>
            <div>
              <span className="kpi-label">Vales a abater</span>
              <strong>{formatCurrency(undatedCommitments.advances_open)}</strong>
            </div>
            <div>
              <span className="kpi-label">Líquido devido</span>
              <strong>{formatCurrency(undatedCommitments.net_due)}</strong>
            </div>
          </div>
          {somaSimplesPodeDivergir && (
            <p className="fluxo-caixa-aviso">
              O líquido devido pode ser maior que "comissões + gorjetas − vales" quando algum profissional tem vale
              acima do que tem a receber: o vale em excesso não reduz o que a casa deve aos colegas.
            </p>
          )}
        </section>
      )}

      {!semDados && estimate && (
        <p className="fluxo-caixa-aviso">
          {estimativaOk
            ? 'A estimativa de entradas não desconta as comissões que essa receita futura vai gerar. O dia de hoje mostra apenas o realizado.'
            : 'O dia de hoje mostra apenas o realizado.'}
        </p>
      )}

      {!semDados && pontoNegativo && (
        <p className="fluxo-caixa-negativo-destaque" role="alert">
          {curva?.rotulo === 'Saldo projetado'
            ? `Saldo projetado negativo a partir de ${formatBucketDate(pontoNegativo.start_date)}.`
            : `Resultado acumulado negativo a partir de ${formatBucketDate(pontoNegativo.start_date)}.`}
        </p>
      )}
    </>
  );
};
