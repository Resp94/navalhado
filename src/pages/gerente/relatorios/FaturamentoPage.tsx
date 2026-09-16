import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartLineData01Icon, RefreshIcon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import type { RelatoriosOutletContextType } from './RelatoriosLayout';
import { RelatoriosRepository } from '../../../modules/relatorios/RelatoriosRepository';
import { SupabaseRelatoriosAdapter } from '../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter';
import { useRelatorioFaturamento } from '../../../modules/relatorios/useRelatorioFaturamento';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import type {
  RelatorioFaturamentoBucket,
  RelatorioRecebidoPorForma,
  TicketPorProfissional,
} from '../../../modules/relatorios/types';
import { formatCurrencyOrDash, formatDisplayDate, formatPercent } from '../../../modules/relatorios/formatacao';
import { formatCurrency } from '../../../lib/currency';
import { Badge } from '../../../components/ui/data-display/Badge';
import { Button } from '../../../components/ui/forms/Button';
import { EmptyState } from '../../../components/ui/data-display/EmptyState';
import { Skeleton } from '../../../components/ui/data-display/Skeleton';
import { ExportarCsvButton } from '../../../components/ui/data-display/ExportarCsvButton';
import { FaturamentoResumo } from './faturamento/FaturamentoResumo';
import { FaturamentoTabela } from './faturamento/FaturamentoTabela';
import { FaturamentoRecebidoPorForma } from './faturamento/FaturamentoRecebidoPorForma';
import { FaturamentoTicketPorProfissional } from './faturamento/FaturamentoTicketPorProfissional';
import { FaturamentoGrafico } from './faturamento/FaturamentoGrafico';
import './Relatorios.css';

function formatBucketPeriodo(bucket: RelatorioFaturamentoBucket): string {
  return bucket.start_date === bucket.end_date
    ? formatDisplayDate(bucket.start_date)
    : `${formatDisplayDate(bucket.start_date)} a ${formatDisplayDate(bucket.end_date)}`;
}

const COLUNAS_CSV_BUCKETS: CsvColumn<RelatorioFaturamentoBucket>[] = [
  { header: 'Período', accessor: formatBucketPeriodo },
  { header: 'Bruto', accessor: (bucket) => formatCurrency(bucket.gross) },
  { header: 'Descontos', accessor: (bucket) => formatCurrency(bucket.discounts) },
  { header: 'Líquido', accessor: (bucket) => formatCurrency(bucket.net) },
  { header: 'Serviços', accessor: (bucket) => formatCurrency(bucket.services_net) },
  { header: 'Produtos', accessor: (bucket) => formatCurrency(bucket.products_net) },
  { header: 'Gorjetas', accessor: (bucket) => formatCurrency(bucket.tips) },
  { header: 'Ticket médio', accessor: (bucket) => formatCurrencyOrDash(bucket.average_ticket) },
  { header: 'Recebido', accessor: (bucket) => formatCurrency(bucket.received) },
  { header: 'Comandas fechadas', accessor: (bucket) => String(bucket.closed_comandas) },
];

const COLUNAS_CSV_RECEBIDO_POR_FORMA: CsvColumn<RelatorioRecebidoPorForma>[] = [
  { header: 'Forma', accessor: (item) => item.label },
  { header: 'Valor', accessor: (item) => formatCurrency(item.amount) },
  { header: 'Participação', accessor: (item) => formatPercent(item.share) },
  { header: 'Pagamentos', accessor: (item) => String(item.payments_count) },
];

const COLUNAS_CSV_TICKET_PROFISSIONAL: CsvColumn<TicketPorProfissional>[] = [
  { header: 'Profissional', accessor: (item) => item.name },
  { header: 'Líquido', accessor: (item) => formatCurrency(item.net) },
  { header: 'Comandas', accessor: (item) => String(item.comandas) },
  { header: 'Ticket médio', accessor: (item) => formatCurrencyOrDash(item.average_ticket) },
];

const DATA_QUALITY_LABEL: Record<string, string> = {
  estimated: 'Parte dos dados deste período é estimada (Comandas sem todos os valores confirmados).',
  legacy: 'Este período é anterior ao registro histórico completo: os valores podem ser menos precisos.',
  mixed: 'Este período mistura dados confirmados, estimados e históricos.',
  unavailable: 'Não há dado suficiente para calcular a qualidade deste período.',
};

export interface FaturamentoPageProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: RelatoriosRepository;
}

/**
 * Página "Faturamento" do Módulo de Relatórios (spec 038, ticket 01):
 * bruto, descontos, líquido, serviços, produtos e gorjetas do período,
 * agrupados por dia/semana/mês, com o total do período anterior e a
 * variação. Recebe o período já resolvido do `RelatoriosLayout`
 * (`useOutletContext`), que decide o filtro compartilhado e o gate de
 * desktop -- esta página nunca decide "hoje" nem largura de tela sozinha.
 */
export const FaturamentoPage: React.FC<FaturamentoPageProps> = ({ repository: injectedRepository }) => {
  const context = useOutletContext<RelatoriosOutletContextType>();
  const { periodo } = context;

  const [defaultRepository] = useState(() => new RelatoriosRepository(new SupabaseRelatoriosAdapter()));
  const repository = injectedRepository || defaultRepository;

  const { data, loading, error, reload } = useRelatorioFaturamento(repository, {
    tenantId: context?.tenantId || '',
    startDate: periodo.startDate,
    endDate: periodo.endDate,
    granularity: periodo.granularity,
    today: periodo.today,
  });

  const totals = data?.totals ?? null;
  const previousTotals = data?.previous_totals ?? null;
  const previousPeriod = data?.previous_period ?? null;
  const buckets = data?.buckets ?? [];
  const receivedByMethod = data?.received_by_method ?? [];
  const ticketByProfessional = data?.ticket_by_professional ?? [];
  const dataQualityWarning =
    data && data.data_quality.status !== 'confirmed' ? DATA_QUALITY_LABEL[data.data_quality.status] : null;
  const isEmpty = !loading && !error && data !== null && totals?.closed_comandas === 0;

  return (
    <div className="relatorios-faturamento">
      <header className="relatorios-faturamento-header">
        <div>
          <h2 className="card-panel-title">
            <HugeiconsIcon icon={ChartLineData01Icon} size={18} />
            Faturamento por período
          </h2>
          <p className="card-panel-subtitle">
            Bruto, descontos, líquido e a divisão entre serviços e produtos, com a comparação com o
            período anterior.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<HugeiconsIcon icon={RefreshIcon} size={16} />}
          onClick={() => void reload()}
          disabled={loading}
        >
          Atualizar
        </Button>
      </header>

      {error && (
        <div className="relatorios-faturamento-erro" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void reload()}>
            Tentar de novo
          </button>
        </div>
      )}

      {dataQualityWarning && (
        <Badge variant="warning" icon={<HugeiconsIcon icon={AlertCircleIcon} size={14} />}>
          {dataQualityWarning}
        </Badge>
      )}

      {loading && !data ? (
        <div className="relatorios-faturamento-cards">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Nenhuma Comanda fechada neste período"
          description="Não há faturamento para o período e o agrupamento escolhidos. Tente ampliar o período ou trocar o atalho."
        />
      ) : (
        <>
          <FaturamentoResumo
            totals={totals}
            previousTotals={previousTotals}
            previousPeriod={previousPeriod}
            loading={loading}
          />
          <FaturamentoGrafico buckets={buckets} />
          <div className="relatorios-faturamento-secao-header">
            <h3 className="card-panel-title">Faturamento por agrupamento</h3>
            <ExportarCsvButton
              columns={COLUNAS_CSV_BUCKETS}
              rows={buckets}
              reportSlug="faturamento"
              startDate={periodo.startDate}
              endDate={periodo.endDate}
            />
          </div>
          <FaturamentoTabela buckets={buckets} />
          <FaturamentoRecebidoPorForma
            receivedByMethod={receivedByMethod}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_RECEBIDO_POR_FORMA}
                rows={receivedByMethod}
                reportSlug="faturamento_recebido_por_forma"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />
          <FaturamentoTicketPorProfissional
            ticketByProfessional={ticketByProfessional}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_TICKET_PROFISSIONAL}
                rows={ticketByProfessional}
                reportSlug="faturamento_ticket_por_profissional"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />
        </>
      )}
    </div>
  );
};
