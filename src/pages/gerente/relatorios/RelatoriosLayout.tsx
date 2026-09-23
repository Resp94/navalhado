import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartLineData01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { dateInZone } from '../../../lib/timezone';
import { SegmentedControl } from '../../../components/ui/navigation/SegmentedControl';
import { Badge } from '../../../components/ui/data-display/Badge';
import { Select } from '../../../components/ui/forms/Select';
import { DateRangePicker } from '../../../components/ui/navigation/DateRangePicker';
import {
  getRelatoriosPeriodShortcutRange,
  isRelatoriosGranularityWithinLimits,
  readRelatoriosPeriodoFromSearchParams,
  suggestRelatoriosGranularity,
  writeRelatoriosPeriodoToSearchParams,
  type RelatoriosPeriodShortcutId,
} from '../../../modules/relatorios/periodo';
import type { RelatoriosGranularity } from '../../../modules/relatorios/types';
import { useIsNarrowViewport } from './useIsNarrowViewport';

const SHORTCUT_OPTIONS: { id: RelatoriosPeriodShortcutId; label: string }[] = [
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: 'ultimos_30', label: 'Últimos 30 dias' },
  { id: 'ultimos_90', label: 'Últimos 90 dias' },
  { id: 'este_ano', label: 'Este ano' },
  { id: 'personalizado', label: 'Personalizado' },
];

const GRANULARITY_OPTIONS: { id: RelatoriosGranularity; label: string }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
];

/**
 * As cinco páginas do módulo (spec 038). Faturamento (ticket 01), Equipe e
 * Serviços (ticket 05), Agenda (ticket 07), Clientes (ticket 10) e Clientes
 * sem Retorno (ticket 09) já existem. `hidePeriodFilter` é a decisão
 * central de esconder o filtro de período compartilhado (spec: "a página
 * Clientes sem Retorno esconde o filtro de período e mostra os próprios
 * filtros") -- resolvida aqui, uma única vez, pelo mesmo princípio do gate
 * de desktop: a página filha não repete a checagem, só ganha os próprios
 * filtros no lugar. Clientes (ticket 10) usa o filtro compartilhado, como
 * Faturamento, Equipe e Serviços e Agenda -- só Clientes sem Retorno o
 * esconde.
 */
const REPORT_PAGES: { path: string; label: string; enabled: boolean; hidePeriodFilter?: boolean }[] = [
  { path: '/relatorios/faturamento', label: 'Faturamento', enabled: true },
  { path: '/relatorios/equipe-e-servicos', label: 'Equipe e Serviços', enabled: true },
  { path: '/relatorios/agenda', label: 'Agenda', enabled: true },
  { path: '/relatorios/clientes', label: 'Clientes', enabled: true },
  { path: '/relatorios/clientes-sem-retorno', label: 'Clientes sem Retorno', enabled: true, hidePeriodFilter: true },
];

export interface RelatoriosPeriodoContextValue {
  startDate: string;
  endDate: string;
  granularity: RelatoriosGranularity;
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

export interface RelatoriosOutletContextType extends TenantContextType {
  periodo: RelatoriosPeriodoContextValue;
}

/**
 * Layout do Módulo de Relatórios (spec 038, seção "Telas"): título,
 * navegação entre as cinco páginas e o filtro de período (atalho, datas,
 * granularidade), compartilhado pelas páginas 1, 4, 6 e 9 e sincronizado
 * com a URL para favoritar e navegar entre páginas sem perder o filtro.
 *
 * Exclusivo do desktop, decisão tomada uma única vez aqui: em largura de
 * celular (`useIsNarrowViewport`, mesmo limite de 768px do resto do
 * painel) devolve só o aviso, e nem monta o `Outlet` -- nenhuma página
 * filha, nem o catálogo, chega a existir, então nenhum repositório é
 * chamado. As páginas não repetem essa checagem.
 */
export const RelatoriosLayout: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNarrow = useIsNarrowViewport();

  const timezone = tenant?.timezone || 'America/Sao_Paulo';
  const today = useMemo(() => dateInZone(new Date(), timezone), [timezone]);

  const periodoState = useMemo(
    () => readRelatoriosPeriodoFromSearchParams(searchParams, today),
    [searchParams, today]
  );

  if (isNarrow) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[60vh] px-6 py-8 text-text-primary">
        <HugeiconsIcon icon={ChartLineData01Icon} size={40} />
        <h2 className="m-0 text-lg font-extrabold">Os relatórios estão disponíveis apenas no computador</h2>
        <p className="m-0 max-w-[340px] text-text-secondary text-sm">
          Tabelas, rankings e o mapa de calor deste módulo são feitos para telas maiores. Abra o
          link num computador para analisar os números com espaço.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-[0.65rem] rounded-md border-none bg-brand-primary text-white font-bold cursor-pointer"
          onClick={() => navigate('/agenda')}
        >
          <HugeiconsIcon icon={Calendar03Icon} size={16} />
          Ir para a Agenda
        </button>
      </div>
    );
  }

  const normalizedPath = location.pathname.replace(/\/+$/, '');
  const isCatalogo = normalizedPath === '/relatorios';
  // Comparação exata, nunca `startsWith`: "/relatorios/clientes-sem-retorno"
  // começa com "/relatorios/clientes", que casaria com a entrada errada
  // (Clientes, sem `hidePeriodFilter`) se a checagem fosse por prefixo.
  const currentPage = REPORT_PAGES.find((page) => normalizedPath === page.path);
  const hidePeriodFilter = currentPage?.hidePeriodFilter === true;

  const handleShortcutChange = (shortcut: RelatoriosPeriodShortcutId) => {
    if (shortcut === periodoState.shortcut) return;
    if (shortcut === 'personalizado') {
      setSearchParams(
        writeRelatoriosPeriodoToSearchParams(searchParams, { ...periodoState, shortcut: 'personalizado' })
      );
      return;
    }
    const range = getRelatoriosPeriodShortcutRange(shortcut, today);
    setSearchParams(writeRelatoriosPeriodoToSearchParams(searchParams, { shortcut, ...range }));
  };

  const handleCustomDateChange = (nextStart: string, nextEnd: string) => {
    const granularity = isRelatoriosGranularityWithinLimits(periodoState.granularity, nextStart, nextEnd)
      ? periodoState.granularity
      : suggestRelatoriosGranularity(nextStart, nextEnd);
    setSearchParams(
      writeRelatoriosPeriodoToSearchParams(searchParams, {
        shortcut: 'personalizado',
        startDate: nextStart,
        endDate: nextEnd,
        granularity,
      })
    );
  };

  const handleGranularityChange = (granularity: RelatoriosGranularity) => {
    setSearchParams(writeRelatoriosPeriodoToSearchParams(searchParams, { ...periodoState, granularity }));
  };

  const outletContext: RelatoriosOutletContextType = {
    ...tenant,
    periodo: {
      startDate: periodoState.startDate,
      endDate: periodoState.endDate,
      granularity: periodoState.granularity,
      today,
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-text-primary">Relatórios</h1>
          <p className="mt-1 mb-0 text-text-secondary text-sm">
            Análise do que já aconteceu na barbearia: faturamento, equipe, agenda e clientes.
          </p>
        </div>
      </header>

      <nav className="flex items-center gap-2 flex-wrap border-b border-border pb-2" aria-label="Páginas de relatórios">
        {REPORT_PAGES.map((page) =>
          page.enabled ? (
            <NavLink
              key={page.path}
              to={{ pathname: page.path, search: searchParams.toString() }}
              className={({ isActive }) =>
                `inline-flex items-center gap-[0.4rem] px-[0.85rem] py-2 rounded-md text-sm font-semibold no-underline whitespace-nowrap ${
                  isActive
                    ? 'text-brand-primary bg-brand-lightest'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                }`
              }
            >
              {page.label}
            </NavLink>
          ) : (
            <span
              key={page.path}
              className="inline-flex items-center gap-[0.4rem] px-[0.85rem] py-2 rounded-md text-sm font-semibold whitespace-nowrap text-text-secondary opacity-60 cursor-default"
              aria-disabled="true"
            >
              {page.label}
              <Badge variant="neutral" size="xs">em breve</Badge>
            </span>
          )
        )}
      </nav>

      {!isCatalogo && !hidePeriodFilter && (
        <section
          className="flex flex-wrap items-end gap-4 p-4 bg-bg-secondary border border-border rounded-lg"
          aria-label="Filtro de período"
        >
          <SegmentedControl<RelatoriosPeriodShortcutId>
            aria-label="Atalho de período"
            value={periodoState.shortcut}
            onChange={handleShortcutChange}
            options={SHORTCUT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
            size="sm"
            fullWidth={false}
          />

          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>Período</span>
            <DateRangePicker
              ariaLabel="Selecionar período personalizado"
              from={periodoState.startDate}
              to={periodoState.endDate}
              onChange={({ from, to }) => handleCustomDateChange(from, to)}
            />
          </label>

          <Select
            label="Agrupar por"
            className="w-auto! max-w-[200px]"
            aria-label="Granularidade do agrupamento"
            value={periodoState.granularity}
            onChange={(event) => handleGranularityChange(event.target.value as RelatoriosGranularity)}
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </section>
      )}

      <Outlet context={outletContext} />
    </div>
  );
};
