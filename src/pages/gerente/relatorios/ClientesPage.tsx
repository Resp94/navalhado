import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import type { RelatoriosOutletContextType } from './RelatoriosLayout';
import { RelatoriosRepository } from '../../../modules/relatorios/RelatoriosRepository';
import { SupabaseRelatoriosAdapter } from '../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter';
import { useRelatorioClientes } from '../../../modules/relatorios/useRelatorioClientes';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import type { ClienteUmaVisita, RelatorioClientesBucket } from '../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../modules/relatorios/formatacao';
import { Button } from '../../../components/ui/forms/Button';
import { EmptyState } from '../../../components/ui/data-display/EmptyState';
import { Skeleton } from '../../../components/ui/data-display/Skeleton';
import { ExportarCsvButton } from '../../../components/ui/data-display/ExportarCsvButton';
import { ClientesResumo } from './clientes/ClientesResumo';
import { ClientesGrafico } from './clientes/ClientesGrafico';
import { ClientesTabela } from './clientes/ClientesTabela';
import { ClientesUmaVisitaLista } from './clientes/ClientesUmaVisitaLista';
import './Relatorios.css';

function formatBucketPeriodo(bucket: RelatorioClientesBucket): string {
  return bucket.start_date === bucket.end_date
    ? formatDisplayDate(bucket.start_date)
    : `${formatDisplayDate(bucket.start_date)} a ${formatDisplayDate(bucket.end_date)}`;
}

const COLUNAS_CSV_BUCKETS: CsvColumn<RelatorioClientesBucket>[] = [
  { header: 'Período', accessor: formatBucketPeriodo },
  { header: 'Novos', accessor: (bucket) => String(bucket.new_customers) },
  { header: 'Recorrentes', accessor: (bucket) => String(bucket.returning_customers) },
  { header: 'Total', accessor: (bucket) => String(bucket.new_customers + bucket.returning_customers) },
];

const COLUNAS_CSV_UMA_VISITA: CsvColumn<ClienteUmaVisita>[] = [
  { header: 'Cliente', accessor: (item) => item.name },
  { header: 'Telefone', accessor: (item) => item.phone ?? '' },
  { header: 'Data da visita', accessor: (item) => formatDisplayDate(item.visit_date) },
  { header: 'Profissional', accessor: (item) => item.professional_name ?? '' },
];

export interface ClientesPageProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: RelatoriosRepository;
}

/**
 * Página "Clientes" do Módulo de Relatórios (spec 038, ticket 10, histórias
 * 65-70): a QUARTA página, "Novos x recorrentes" -- quantos clientes
 * distintos visitaram a barbearia no período, separados em novos e
 * recorrentes, com a evolução ao longo do período, a comparação com o
 * período anterior, os Clientes de Uma Visita e os atendimentos sem
 * cliente identificado. Recebe o período já resolvido do
 * `RelatoriosLayout` (`useOutletContext`), que decide o filtro
 * compartilhado (esta página NÃO esconde o filtro, ao contrário de
 * Clientes sem Retorno) e o gate de desktop -- esta página nunca decide
 * "hoje" nem largura de tela sozinha.
 */
export const ClientesPage: React.FC<ClientesPageProps> = ({ repository: injectedRepository }) => {
  const context = useOutletContext<RelatoriosOutletContextType>();
  const { periodo } = context;

  const [defaultRepository] = useState(() => new RelatoriosRepository(new SupabaseRelatoriosAdapter()));
  const repository = injectedRepository || defaultRepository;

  const { data, loading, error, reload } = useRelatorioClientes(repository, {
    tenantId: context?.tenantId || '',
    startDate: periodo.startDate,
    endDate: periodo.endDate,
    granularity: periodo.granularity,
    today: periodo.today,
  });

  const visitors = data?.visitors ?? null;
  const previousVisitors = data?.previous_visitors ?? null;
  const buckets = data?.buckets ?? [];
  const singleVisitCustomers = data?.single_visit_customers ?? [];
  const isEmpty =
    !loading &&
    !error &&
    data !== null &&
    visitors?.unique_customers === 0 &&
    visitors?.unidentified_attendances === 0;

  return (
    <div className="relatorios-faturamento">
      <header className="relatorios-faturamento-header">
        <div>
          <h2 className="card-panel-title">
            <HugeiconsIcon icon={UserGroupIcon} size={18} />
            Clientes: novos x recorrentes
          </h2>
          <p className="card-panel-subtitle">
            Quantos clientes distintos visitaram a barbearia no período, separados em novos e
            recorrentes, com a evolução e a comparação com o período anterior.
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

      {loading && !data ? (
        <div className="relatorios-faturamento-cards">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Nenhum cliente visitou a barbearia neste período"
          description="Não há Visita nem atendimento sem cliente identificado para o período e o agrupamento escolhidos. Tente ampliar o período ou trocar o atalho."
        />
      ) : (
        <>
          <ClientesResumo visitors={visitors} previousVisitors={previousVisitors} loading={loading} />
          <ClientesGrafico buckets={buckets} />
          <div className="relatorios-faturamento-secao-header">
            <h3 className="card-panel-title">Novos x recorrentes por agrupamento</h3>
            <ExportarCsvButton
              columns={COLUNAS_CSV_BUCKETS}
              rows={buckets}
              reportSlug="clientes_novos_x_recorrentes"
              startDate={periodo.startDate}
              endDate={periodo.endDate}
            />
          </div>
          <ClientesTabela buckets={buckets} />

          <div className="relatorios-faturamento-secao-header">
            <div className="relatorios-faturamento-secao-titulo">
              <h3 className="card-panel-title">Clientes de Uma Visita</h3>
            </div>
            <ExportarCsvButton
              columns={COLUNAS_CSV_UMA_VISITA}
              rows={singleVisitCustomers}
              reportSlug="clientes_uma_visita"
              startDate={periodo.startDate}
              endDate={periodo.endDate}
            />
          </div>
          <ClientesUmaVisitaLista items={singleVisitCustomers} />
        </>
      )}
    </div>
  );
};
