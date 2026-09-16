import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserRemove01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { supabase } from '../../../lib/supabase';
import type { RelatoriosOutletContextType } from './RelatoriosLayout';
import { RelatoriosRepository } from '../../../modules/relatorios/RelatoriosRepository';
import { SupabaseRelatoriosAdapter } from '../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter';
import { useClientesSemRetorno } from '../../../modules/relatorios/useClientesSemRetorno';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import type { ClienteSemRetornoItem } from '../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../modules/relatorios/formatacao';
import { Button } from '../../../components/ui/forms/Button';
import { Select } from '../../../components/ui/forms/Select';
import { EmptyState } from '../../../components/ui/data-display/EmptyState';
import { Skeleton } from '../../../components/ui/data-display/Skeleton';
import { ExportarCsvButton } from '../../../components/ui/data-display/ExportarCsvButton';
import { ClientesSemRetornoResumo } from './clientesSemRetorno/ClientesSemRetornoResumo';
import { ClientesSemRetornoFaixas, TODAS_AS_FAIXAS, type FiltroFaixa } from './clientesSemRetorno/ClientesSemRetornoFaixas';
import { ClientesSemRetornoTabela } from './clientesSemRetorno/ClientesSemRetornoTabela';
import './Relatorios.css';

/** Tamanho de página fixo (dentro do limite de 100 do contrato): 20 linhas por vez -- razoável para uma lista de reativação lida em detalhe, sem exigir muito scroll. */
const PAGE_SIZE = 20;

const COLUNAS_CSV: CsvColumn<ClienteSemRetornoItem>[] = [
  { header: 'Cliente', accessor: (item) => item.name },
  { header: 'Telefone', accessor: (item) => (item.has_phone && item.phone ? item.phone : '') },
  { header: 'Última visita', accessor: (item) => formatDisplayDate(item.last_visit_date) },
  { header: 'Último serviço', accessor: (item) => item.last_service_name ?? '' },
  { header: 'Profissional', accessor: (item) => item.last_professional_name ?? '' },
  { header: 'Prazo (dias)', accessor: (item) => String(item.return_period_days) },
  { header: 'Dias desde', accessor: (item) => String(item.days_since) },
  { header: 'Dias de atraso', accessor: (item) => String(item.days_overdue) },
];

export interface ClientesSemRetornoPageProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: RelatoriosRepository;
}

/**
 * Página "Clientes sem Retorno" do Módulo de Relatórios (spec 038, ticket
 * 09, histórias 56-64): a QUINTA página, a única sem período -- fotografia
 * de hoje. `RelatoriosLayout` já esconde o filtro de período compartilhado
 * nesta rota (decisão central, não repetida aqui); esta página só monta os
 * próprios filtros (faixa de atraso e profissional) e a paginação, que são
 * estado próprio dela.
 *
 * A troca de faixa ou de profissional volta a página para a primeira --
 * manter a página atual ao trocar de filtro poderia pedir um `offset` que
 * não existe mais no novo conjunto filtrado.
 */
export const ClientesSemRetornoPage: React.FC<ClientesSemRetornoPageProps> = ({ repository: injectedRepository }) => {
  const context = useOutletContext<RelatoriosOutletContextType>();

  const [defaultRepository] = useState(() => new RelatoriosRepository(new SupabaseRelatoriosAdapter()));
  const repository = injectedRepository || defaultRepository;

  const [overdueBand, setOverdueBand] = useState<FiltroFaixa>(TODAS_AS_FAIXAS);
  const [professionalId, setProfessionalId] = useState('');
  const [page, setPage] = useState(1);

  // Opções do filtro de profissional: o contrato de Clientes sem Retorno
  // não devolve lista de profissionais (diferente de Equipe e Serviços/
  // Agenda, cujo próprio ranking já traz `professional_id`+`name`) -- só
  // `last_professional_name` por item, sem id, então não dá para montar as
  // opções a partir da página carregada. Busca direta em `professionals`
  // pelo tenant, mesmo padrão já usado em outras telas do painel do
  // gestor (ex. `CadastroAcesso.tsx`) para preencher um `<select>` de
  // profissionais sem um hook de módulo dedicado.
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const tenantId = context?.tenantId;
    if (!tenantId) return;
    let active = true;
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) return;
        setProfessionals((data || []) as { id: string; name: string }[]);
      });
    return () => {
      active = false;
    };
  }, [context?.tenantId]);

  useEffect(() => {
    setPage(1);
  }, [overdueBand, professionalId]);

  const { data, loading, error, reload } = useClientesSemRetorno(repository, {
    tenantId: context?.tenantId || '',
    overdueBand: overdueBand || undefined,
    professionalId: professionalId || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const isEmpty =
    !loading &&
    !error &&
    data !== null &&
    data.total_count === 0 &&
    data.totals.without_return === 0 &&
    overdueBand === TODAS_AS_FAIXAS &&
    !professionalId;

  return (
    <div className="relatorios-faturamento">
      <header className="relatorios-faturamento-header">
        <div>
          <h2 className="card-panel-title">
            <HugeiconsIcon icon={UserRemove01Icon} size={18} />
            Clientes sem Retorno
          </h2>
          <p className="card-panel-subtitle">
            Fotografia de hoje: clientes que passaram do prazo de retorno e não têm Agendamento futuro marcado.
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
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Nenhum cliente sem retorno hoje"
          description="Todos os clientes com Visita registrada estão dentro do prazo de retorno ou já têm Agendamento futuro marcado."
        />
      ) : (
        <>
          <ClientesSemRetornoResumo totals={data?.totals ?? null} loading={loading} />

          <div className="relatorios-faturamento-secao-header relatorios-clientes-sem-retorno-filtros">
            <div className="relatorios-faturamento-secao-titulo">
              <ClientesSemRetornoFaixas bands={data?.bands ?? null} value={overdueBand} onChange={setOverdueBand} />

              <Select
                aria-label="Filtrar por profissional"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
                className="relatorios-clientes-sem-retorno-filtro-profissional"
                selectSize="sm"
              >
                <option value="">Todos os profissionais</option>
                {professionals.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.name}
                  </option>
                ))}
              </Select>
            </div>

            <ExportarCsvButton
              columns={COLUNAS_CSV}
              rows={items}
              reportSlug="clientes_sem_retorno"
              startDate={data?.business_today ?? ''}
              endDate={data?.business_today ?? ''}
            />
          </div>

          <ClientesSemRetornoTabela
            items={items}
            totalCount={data?.total_count ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <style>{`
        .relatorios-clientes-sem-retorno-filtros {
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .relatorios-clientes-sem-retorno-filtro-profissional {
          max-width: 240px;
        }
      `}</style>
    </div>
  );
};
