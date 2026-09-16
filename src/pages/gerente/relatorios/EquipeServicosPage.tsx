import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, RefreshIcon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import type { RelatoriosOutletContextType } from './RelatoriosLayout';
import { RelatoriosRepository } from '../../../modules/relatorios/RelatoriosRepository';
import { SupabaseRelatoriosAdapter } from '../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter';
import { useEquipeServicos } from '../../../modules/relatorios/useEquipeServicos';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import type { ProfissionalRanking, ServicoRanking } from '../../../modules/relatorios/types';
import { formatCurrencyOrDash, formatPercent } from '../../../modules/relatorios/formatacao';
import { formatCurrency } from '../../../lib/currency';
import { Badge } from '../../../components/ui/data-display/Badge';
import { Button } from '../../../components/ui/forms/Button';
import { EmptyState } from '../../../components/ui/data-display/EmptyState';
import { Skeleton } from '../../../components/ui/data-display/Skeleton';
import { ExportarCsvButton } from '../../../components/ui/data-display/ExportarCsvButton';
import { RankingProfissionais } from './equipeServicos/RankingProfissionais';
import { RankingServicos } from './equipeServicos/RankingServicos';

const COLUNAS_CSV_PROFISSIONAIS: CsvColumn<ProfissionalRanking>[] = [
  { header: 'Profissional', accessor: (item) => item.name },
  { header: 'Líquido', accessor: (item) => formatCurrency(item.net) },
  { header: 'Bruto', accessor: (item) => formatCurrency(item.gross) },
  { header: 'Participação', accessor: (item) => formatPercent(item.share) },
  { header: 'Atendimentos', accessor: (item) => String(item.attendances) },
  { header: 'Serviços executados', accessor: (item) => String(item.services_quantity) },
  { header: 'Produtos', accessor: (item) => formatCurrency(item.products_net) },
  { header: 'Ticket médio', accessor: (item) => formatCurrencyOrDash(item.average_ticket) },
  { header: 'Comissão gerada', accessor: (item) => formatCurrency(item.commission) },
];

const COLUNAS_CSV_SERVICOS: CsvColumn<ServicoRanking>[] = [
  { header: 'Serviço', accessor: (item) => item.name },
  { header: 'Categoria', accessor: (item) => item.category },
  { header: 'Quantidade', accessor: (item) => String(item.quantity) },
  { header: 'Líquido', accessor: (item) => formatCurrency(item.net) },
  { header: 'Participação', accessor: (item) => formatPercent(item.share) },
  { header: 'Valor médio', accessor: (item) => formatCurrencyOrDash(item.average_unit_net) },
];

const DATA_QUALITY_LABEL: Record<string, string> = {
  estimated: 'Parte dos dados deste período é estimada (Comandas sem todos os valores confirmados).',
  legacy: 'Este período é anterior ao registro histórico completo: os valores podem ser menos precisos.',
  mixed: 'Este período mistura dados confirmados, estimados e históricos.',
  unavailable: 'Não há dado suficiente para calcular a qualidade deste período.',
};

export interface EquipeServicosPageProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: RelatoriosRepository;
}

/**
 * Página "Equipe e Serviços" do Módulo de Relatórios (spec 038, ticket 05,
 * histórias 32-41): ranking de profissionais e ranking de serviços do
 * período. Recebe o período já resolvido do `RelatoriosLayout`
 * (`useOutletContext`) -- mas, diferente do Faturamento, ignora a
 * granularidade do filtro compartilhado: este relatório é um ranking de
 * período único, sem agrupamento por dia/semana/mês. O filtro de
 * profissional do ranking de serviços é estado próprio desta página (não
 * vai para a URL): muda `professionalId` do hook e refaz a busca no
 * servidor, sem afetar o ranking de profissionais.
 */
export const EquipeServicosPage: React.FC<EquipeServicosPageProps> = ({ repository: injectedRepository }) => {
  const context = useOutletContext<RelatoriosOutletContextType>();
  const { periodo } = context;

  const [defaultRepository] = useState(() => new RelatoriosRepository(new SupabaseRelatoriosAdapter()));
  const repository = injectedRepository || defaultRepository;

  const [professionalId, setProfessionalId] = useState('');

  const { data, loading, error, reload } = useEquipeServicos(repository, {
    tenantId: context?.tenantId || '',
    startDate: periodo.startDate,
    endDate: periodo.endDate,
    professionalId: professionalId || undefined,
    today: periodo.today,
  });

  const professionals = data?.professionals ?? [];
  const services = data?.services ?? [];

  // O filtro de profissional do ranking de serviços some do <Select> quando o
  // profissional escolhido não tem item no novo período (ex.: o gestor trocou
  // o período depois de filtrar) -- sem este efeito, o <select> mostraria
  // "Todos os profissionais" mas `professionalId` continuaria com o id
  // antigo, e o hook manteria filtrando por um profissional que a tela não
  // mostra mais como selecionado.
  useEffect(() => {
    if (professionalId && !professionals.some((p) => p.professional_id === professionalId)) {
      setProfessionalId('');
    }
  }, [professionalId, professionals]);
  const dataQualityWarning =
    data && data.data_quality.status !== 'confirmed' ? DATA_QUALITY_LABEL[data.data_quality.status] : null;
  const isEmpty = !loading && !error && data !== null && professionals.length === 0 && services.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="card-panel-title">
            <HugeiconsIcon icon={UserGroupIcon} size={18} />
            Equipe e Serviços
          </h2>
          <p className="card-panel-subtitle">
            Quem mais produz e quais serviços sustentam a barbearia no período selecionado.
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
        <div
          className="text-error bg-error-bg border border-[rgba(240,82,82,0.25)] rounded-md px-4 py-3 flex items-center justify-between gap-4"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className="border-none bg-error text-white rounded-sm px-3 py-[0.35rem] font-bold cursor-pointer"
            onClick={() => void reload()}
          >
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Nenhum item no período"
          description="Não há item de serviço ou produto reconhecido no período selecionado. Tente ampliar o período."
        />
      ) : (
        <>
          <RankingProfissionais
            professionals={professionals}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_PROFISSIONAIS}
                rows={professionals}
                reportSlug="equipe_e_servicos_profissionais"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />
          <RankingServicos
            services={services}
            professionals={professionals}
            professionalId={professionalId}
            onProfessionalIdChange={setProfessionalId}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_SERVICOS}
                rows={services}
                reportSlug="equipe_e_servicos_servicos"
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
