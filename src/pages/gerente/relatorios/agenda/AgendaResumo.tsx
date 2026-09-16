import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { StatCard, type StatCardTrend } from '../../../../components/ui/data-display/StatCard';
import { calcularVariacaoPercentual } from '../../../../modules/relatorios/variacao';
import { formatPercent } from '../../../../modules/relatorios/formatacao';
import type { RelatorioAgendaStatusTotais } from '../../../../modules/relatorios/types';

function formatVariacaoContagem(atual: number, anterior: number): StatCardTrend | undefined {
  const variacao = calcularVariacaoPercentual(atual, anterior);
  if (variacao === null) return undefined;
  const percent = (variacao * 100).toFixed(1);
  return { value: `${variacao >= 0 ? '+' : ''}${percent}%`, isPositive: variacao >= 0 };
}

/**
 * Variação de uma taxa (comparecimento/cancelamento) contra o período
 * anterior, em pontos percentuais (não percentual relativo -- uma taxa que
 * vai de 80% para 88% é "+8pp", nunca "+10%", que sugeriria uma variação
 * bem maior do que a real). `undefined` (sem seta) quando qualquer um dos
 * dois lados é `null` (denominador zero em algum dos dois períodos) --
 * mesmo padrão null-safe de `formatVariacaoTicketMedio` do Faturamento por
 * período: sem os dois valores, não há variação que faça sentido mostrar.
 */
function formatVariacaoTaxa(atual: number | null, anterior: number | null): StatCardTrend | undefined {
  if (atual === null || anterior === null) return undefined;
  const diffPontos = (atual - anterior) * 100;
  const value = `${diffPontos >= 0 ? '+' : ''}${diffPontos.toFixed(1)}pp`;
  return { value, isPositive: diffPontos >= 0 };
}

export interface AgendaResumoProps {
  statusTotals: RelatorioAgendaStatusTotais | null;
  previousStatusTotals: RelatorioAgendaStatusTotais | null;
  loading: boolean;
}

/**
 * Cartões de status da Agenda (spec 038, ticket 07, histórias 42-49):
 * concluídos, faltas, cancelados, total, taxa de comparecimento e taxa de
 * cancelamento, com variação contra o período anterior. "Agendamento sem
 * Desfecho" (`unresolved`) fica FORA desta grade de cartões, num aviso à
 * parte (`Badge` grande, cor de alerta) -- não é uma métrica de
 * performance como as outras, é um lembrete de trabalho pendente da
 * recepção, e misturá-lo aos cartões de taxa faria parecer que ele entra
 * nas contas de comparecimento/cancelamento (não entra: a spec e o núcleo
 * do banco excluem `unresolved` das duas taxas).
 */
export const AgendaResumo: React.FC<AgendaResumoProps> = ({ statusTotals, previousStatusTotals, loading }) => {
  const hasComparison = Boolean(statusTotals && previousStatusTotals);

  return (
    <div className="relatorios-agenda-resumo">
      {statusTotals && statusTotals.unresolved > 0 && (
        <div className="relatorios-agenda-aviso-sem-desfecho" role="status">
          <HugeiconsIcon icon={Alert02Icon} size={20} />
          <div>
            <strong>
              {statusTotals.unresolved} agendamento{statusTotals.unresolved > 1 ? 's' : ''} sem desfecho
            </strong>
            <p>
              Agendamento pendente, confirmado ou em andamento com horário já passado. Não entra nas taxas de
              comparecimento nem de cancelamento -- a recepção precisa atualizar o status.
            </p>
          </div>
        </div>
      )}

      <div className="relatorios-faturamento-cards">
        <StatCard
          title="Agendamentos no período"
          value={statusTotals?.total ?? 0}
          loading={loading}
          trend={
            hasComparison ? formatVariacaoContagem(statusTotals!.total, previousStatusTotals!.total) : undefined
          }
        />
        <StatCard
          title="Concluídos"
          value={statusTotals?.completed ?? 0}
          loading={loading}
          trend={
            hasComparison
              ? formatVariacaoContagem(statusTotals!.completed, previousStatusTotals!.completed)
              : undefined
          }
        />
        <StatCard
          title="Faltas (no-show)"
          value={statusTotals?.no_show ?? 0}
          loading={loading}
          trend={
            hasComparison ? formatVariacaoContagem(statusTotals!.no_show, previousStatusTotals!.no_show) : undefined
          }
        />
        <StatCard
          title="Cancelados"
          value={statusTotals?.canceled ?? 0}
          loading={loading}
          trend={
            hasComparison ? formatVariacaoContagem(statusTotals!.canceled, previousStatusTotals!.canceled) : undefined
          }
        />
        <StatCard
          title="Taxa de comparecimento"
          value={formatPercent(statusTotals?.attendance_rate ?? null)}
          loading={loading}
          trend={
            hasComparison
              ? formatVariacaoTaxa(statusTotals!.attendance_rate, previousStatusTotals!.attendance_rate)
              : undefined
          }
        />
        <StatCard
          title="Taxa de cancelamento"
          value={formatPercent(statusTotals?.cancellation_rate ?? null)}
          loading={loading}
          trend={
            hasComparison
              ? formatVariacaoTaxa(statusTotals!.cancellation_rate, previousStatusTotals!.cancellation_rate)
              : undefined
          }
        />
      </div>

      <style>{`
        .relatorios-agenda-aviso-sem-desfecho {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background-color: var(--color-warning-bg, #FEF3C7);
          border: 1px solid var(--color-warning, #D97706);
          color: var(--color-warning-deep, #92400E);
          border-radius: var(--radius-lg, 12px);
          padding: 1rem 1.25rem;
        }

        .relatorios-agenda-aviso-sem-desfecho strong {
          display: block;
          font-size: var(--font-size-sm, 0.875rem);
          margin-bottom: 0.25rem;
        }

        .relatorios-agenda-aviso-sem-desfecho p {
          margin: 0;
          font-size: var(--font-size-xs, 0.75rem);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};
