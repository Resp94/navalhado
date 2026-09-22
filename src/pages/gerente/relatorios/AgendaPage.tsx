import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import type { RelatoriosOutletContextType } from './RelatoriosLayout';
import { RelatoriosRepository } from '../../../modules/relatorios/RelatoriosRepository';
import { SupabaseRelatoriosAdapter } from '../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter';
import { useAgenda } from '../../../modules/relatorios/useAgenda';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import type {
  RelatorioAgendaMotivosCancelamento,
  RelatorioAgendaOrigemTotais,
  RelatorioAgendaProfissionalTotais,
} from '../../../modules/relatorios/types';
import { formatPercent } from '../../../modules/relatorios/formatacao';
import { Button } from '../../../components/ui/forms/Button';
import { EmptyState } from '../../../components/ui/data-display/EmptyState';
import { Skeleton } from '../../../components/ui/data-display/Skeleton';
import { ExportarCsvButton } from '../../../components/ui/data-display/ExportarCsvButton';
import { AgendaResumo } from './agenda/AgendaResumo';
import { AgendaPorOrigem, formatOrigemLabel } from './agenda/AgendaPorOrigem';
import { AgendaPorProfissional } from './agenda/AgendaPorProfissional';
import { AgendaMotivosCancelamento } from './agenda/AgendaMotivosCancelamento';
import {
  AgendaMapaDeCalor,
  WEEKDAY_LABELS_FULL,
  construirLinhasMapaDeCalor,
  type AgendaMapaDeCalorLinha,
} from './agenda/AgendaMapaDeCalor';

const COLUNAS_CSV_ORIGEM: CsvColumn<RelatorioAgendaOrigemTotais>[] = [
  { header: 'Origem', accessor: (item) => formatOrigemLabel(item.origin) },
  { header: 'Total', accessor: (item) => String(item.total) },
  { header: 'Concluídos', accessor: (item) => String(item.completed) },
  { header: 'Faltas', accessor: (item) => String(item.no_show) },
  { header: 'Cancelados', accessor: (item) => String(item.canceled) },
  { header: 'Sem desfecho', accessor: (item) => String(item.unresolved) },
  { header: 'Taxa de comparecimento', accessor: (item) => formatPercent(item.attendance_rate) },
];

const COLUNAS_CSV_PROFISSIONAL: CsvColumn<RelatorioAgendaProfissionalTotais>[] = [
  { header: 'Profissional', accessor: (item) => item.name },
  { header: 'Total', accessor: (item) => String(item.total) },
  { header: 'Concluídos', accessor: (item) => String(item.completed) },
  { header: 'Faltas', accessor: (item) => String(item.no_show) },
  { header: 'Cancelados', accessor: (item) => String(item.canceled) },
  { header: 'Sem desfecho', accessor: (item) => String(item.unresolved) },
  { header: 'Taxa de comparecimento', accessor: (item) => formatPercent(item.attendance_rate) },
];

/** Linha achatada do CSV de motivos (spec 044, ticket 16): uma linha por (grupo, motivo). */
interface LinhaCsvMotivo {
  grupo: string;
  reason: string;
  count: number;
}

const ROTULO_GRUPO_MOTIVO: Record<keyof RelatorioAgendaMotivosCancelamento, string> = {
  shop: 'Barbearia',
  customer: 'Cliente',
  desconhecida: 'Desconhecido',
};

/** Achata os três grupos em linhas para o CSV, na mesma ordem em que a tela mostra os grupos. */
function achatarMotivosParaCsv(reasons: RelatorioAgendaMotivosCancelamento): LinhaCsvMotivo[] {
  return (['shop', 'customer', 'desconhecida'] as const).flatMap((grupo) =>
    reasons[grupo].map((motivo) => ({ grupo: ROTULO_GRUPO_MOTIVO[grupo], reason: motivo.reason, count: motivo.count }))
  );
}

const COLUNAS_CSV_MOTIVOS: CsvColumn<LinhaCsvMotivo>[] = [
  { header: 'Cancelado por', accessor: (item) => item.grupo },
  { header: 'Motivo', accessor: (item) => item.reason },
  { header: 'Cancelamentos', accessor: (item) => String(item.count) },
];

/**
 * Colunas do CSV do mapa de calor (ticket 08): uma linha por hora, uma
 * coluna por dia da semana -- o mesmo formato de linha (`AgendaMapaDeCalorLinha`)
 * que a grade visual e a tabela equivalente usam, para as três nunca
 * divergirem.
 */
const COLUNAS_CSV_MAPA_CALOR: CsvColumn<AgendaMapaDeCalorLinha>[] = [
  { header: 'Hora', accessor: (item) => `${item.hour}h` },
  ...WEEKDAY_LABELS_FULL.map((label, weekday) => ({
    header: label,
    accessor: (item: AgendaMapaDeCalorLinha) => String(item.counts[weekday]),
  })),
];

export interface AgendaPageProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: RelatoriosRepository;
}

/**
 * Página "Agenda" do Módulo de Relatórios (spec 038, ticket 07, histórias
 * 42-49): comparecimento, cancelamento e no-show do período. Recebe o
 * período já resolvido do `RelatoriosLayout` (`useOutletContext`) -- mas,
 * como Equipe e Serviços, ignora a granularidade do filtro compartilhado:
 * este relatório é um conjunto de totais de período único, sem agrupamento
 * por dia/semana/mês.
 *
 * O filtro de profissional é estado próprio desta página (não vai para a
 * URL) e tem uma peculiaridade em relação ao ticket 05/06: aqui ele filtra
 * TUDO (cartões, origem, motivos), MENOS a tabela por profissional, que é
 * sempre a lista inteira -- o inverso da regra do ranking de serviços. Por
 * isso o `<Select>` mora dentro de `AgendaPorProfissional`, ao lado da
 * única tabela que ele não afeta, com um aviso textual explícito -- ver
 * comentário daquele componente para o raciocínio completo da decisão de
 * UI.
 *
 * O mesmo risco de "filtro apontando para profissional que sumiu da
 * lista" do ticket 05 existe aqui: como `by_professional` nunca é
 * filtrada por `p_professional_id`, uma troca de PERÍODO pode fazer o
 * profissional escolhido sumir da lista (não a troca de filtro em si,
 * que aqui não afeta esta lista) -- o mesmo efeito de correção é
 * reaplicado.
 */
export const AgendaPage: React.FC<AgendaPageProps> = ({ repository: injectedRepository }) => {
  const context = useOutletContext<RelatoriosOutletContextType>();
  const { periodo } = context;

  const [defaultRepository] = useState(() => new RelatoriosRepository(new SupabaseRelatoriosAdapter()));
  const repository = injectedRepository || defaultRepository;

  const [professionalId, setProfessionalId] = useState('');

  const { data, loading, error, reload } = useAgenda(repository, {
    tenantId: context?.tenantId || '',
    startDate: periodo.startDate,
    endDate: periodo.endDate,
    professionalId: professionalId || undefined,
    today: periodo.today,
  });

  const professionals = data?.by_professional ?? [];
  const origins = data?.by_origin ?? [];
  const reasons: RelatorioAgendaMotivosCancelamento = data?.cancellation_reasons ?? { shop: [], customer: [], desconhecida: [] };
  const reasonsCsvRows = achatarMotivosParaCsv(reasons);
  const heatmapRows = data?.heatmap ? construirLinhasMapaDeCalor(data.heatmap) : [];

  // O filtro de profissional some do <Select> quando o profissional
  // escolhido não tem mais Agendamento na tabela por profissional (ex.: o
  // gestor trocou o período depois de filtrar) -- mesmo efeito de
  // segurança do ticket 05 (EquipeServicosPage): sem isso, o <select>
  // mostraria "Todos os profissionais" mas `professionalId` continuaria
  // com o id antigo, e o hook manteria filtrando cartões/origem/motivos
  // por um profissional que a tabela já não mostra mais como opção.
  useEffect(() => {
    if (professionalId && !professionals.some((p) => p.professional_id === professionalId)) {
      setProfessionalId('');
    }
  }, [professionalId, professionals]);

  const isEmpty =
    !loading && !error && data !== null && data.status_totals.total === 0 && professionals.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="card-panel-title">
            <HugeiconsIcon icon={Calendar03Icon} size={18} />
            Agenda
          </h2>
          <p className="card-panel-subtitle">
            Quanto da agenda virou atendimento, cancelamento ou falta no período selecionado.
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

      {loading && !data ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Nenhum Agendamento no período"
          description="Não há Agendamento com início no período selecionado. Tente ampliar o período."
        />
      ) : (
        <>
          <AgendaResumo
            statusTotals={data?.status_totals ?? null}
            previousStatusTotals={data?.previous_status_totals ?? null}
            waitingList={data?.waiting_list ?? null}
            loading={loading}
          />

          <AgendaPorOrigem
            origins={origins}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_ORIGEM}
                rows={origins}
                reportSlug="agenda_por_origem"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />

          <AgendaPorProfissional
            professionals={professionals}
            professionalId={professionalId}
            onProfessionalIdChange={setProfessionalId}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_PROFISSIONAL}
                rows={professionals}
                reportSlug="agenda_por_profissional"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />

          <AgendaMotivosCancelamento
            reasons={reasons}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_MOTIVOS}
                rows={reasonsCsvRows}
                reportSlug="agenda_motivos_cancelamento"
                startDate={periodo.startDate}
                endDate={periodo.endDate}
              />
            }
          />

          <AgendaMapaDeCalor
            heatmap={data?.heatmap ?? null}
            exportButton={
              <ExportarCsvButton
                columns={COLUNAS_CSV_MAPA_CALOR}
                rows={heatmapRows}
                reportSlug="agenda_mapa_de_calor"
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
