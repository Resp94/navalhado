import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartLineData01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { dateInZone } from '../../../lib/timezone';
import { SegmentedControl } from '../../../components/ui/navigation/SegmentedControl';
import { Badge } from '../../../components/ui/data-display/Badge';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import {
  getRelatoriosPeriodShortcutRange,
  isRelatoriosGranularityWithinLimits,
  readRelatoriosPeriodoFromSearchParams,
  suggestRelatoriosGranularity,
  writeRelatoriosPeriodoToSearchParams,
  type RelatoriosPeriodShortcutId,
} from '../../../modules/relatorios/periodo';
import type { RelatoriosGranularity } from '../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../modules/relatorios/formatacao';
import { useIsNarrowViewport } from './useIsNarrowViewport';
import './Relatorios.css';

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
 * Serviços (ticket 05), Agenda (ticket 07) e Clientes sem Retorno (ticket
 * 09) já existem. `hidePeriodFilter` é a decisão central de esconder o
 * filtro de período compartilhado (spec: "a página Clientes sem Retorno
 * esconde o filtro de período e mostra os próprios filtros") -- resolvida
 * aqui, uma única vez, pelo mesmo princípio do gate de desktop: a página
 * filha não repete a checagem, só ganha os próprios filtros no lugar.
 */
const REPORT_PAGES: { path: string; label: string; enabled: boolean; hidePeriodFilter?: boolean }[] = [
  { path: '/relatorios/faturamento', label: 'Faturamento', enabled: true },
  { path: '/relatorios/equipe-e-servicos', label: 'Equipe e Serviços', enabled: true },
  { path: '/relatorios/agenda', label: 'Agenda', enabled: true },
  { path: '/relatorios/clientes', label: 'Clientes', enabled: false },
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
      <div className="relatorios-mobile-gate">
        <HugeiconsIcon icon={ChartLineData01Icon} size={40} />
        <h2>Os relatórios estão disponíveis apenas no computador</h2>
        <p>
          Tabelas, rankings e o mapa de calor deste módulo são feitos para telas maiores. Abra o
          link num computador para analisar os números com espaço.
        </p>
        <button type="button" className="relatorios-mobile-gate__btn" onClick={() => navigate('/agenda')}>
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
    <div className="relatorios-page">
      <header className="relatorios-header">
        <div>
          <h1 className="relatorios-header-title">Relatórios</h1>
          <p className="relatorios-header-subtitle">
            Análise do que já aconteceu na barbearia: faturamento, equipe, agenda e clientes.
          </p>
        </div>
      </header>

      <nav className="relatorios-nav-tabs" aria-label="Páginas de relatórios">
        {REPORT_PAGES.map((page) =>
          page.enabled ? (
            <NavLink
              key={page.path}
              to={page.path}
              className={({ isActive }) => `relatorios-nav-tab ${isActive ? 'relatorios-nav-tab--active' : ''}`}
            >
              {page.label}
            </NavLink>
          ) : (
            <span key={page.path} className="relatorios-nav-tab relatorios-nav-tab--disabled" aria-disabled="true">
              {page.label}
              <Badge variant="neutral" size="xs">em breve</Badge>
            </span>
          )
        )}
      </nav>

      {!isCatalogo && !hidePeriodFilter && (
        <section className="relatorios-filtro-periodo" aria-label="Filtro de período">
          <SegmentedControl<RelatoriosPeriodShortcutId>
            aria-label="Atalho de período"
            value={periodoState.shortcut}
            onChange={handleShortcutChange}
            options={SHORTCUT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
            size="sm"
            fullWidth={false}
          />

          <div className="relatorios-filtro-datas">
            <div className="relatorios-filtro-data-campo">
              <span>De</span>
              <RelatoriosDateField
                value={periodoState.startDate}
                timezone={timezone}
                position="right"
                onSelect={(newDate) =>
                  handleCustomDateChange(
                    newDate,
                    periodoState.endDate < newDate ? newDate : periodoState.endDate
                  )
                }
              />
            </div>
            <div className="relatorios-filtro-data-campo">
              <span>Até</span>
              <RelatoriosDateField
                value={periodoState.endDate}
                timezone={timezone}
                position="left"
                onSelect={(newDate) =>
                  handleCustomDateChange(
                    periodoState.startDate > newDate ? newDate : periodoState.startDate,
                    newDate
                  )
                }
              />
            </div>
          </div>

          <label className="relatorios-filtro-granularidade">
            <span>Agrupar por</span>
            <select
              aria-label="Granularidade do agrupamento"
              value={periodoState.granularity}
              onChange={(event) => handleGranularityChange(event.target.value as RelatoriosGranularity)}
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <Outlet context={outletContext} />
    </div>
  );
};

/** Campo de data com o `CustomDatePicker` já usado no Fluxo de Caixa Projetado. */
const RelatoriosDateField: React.FC<{
  value: string;
  timezone: string;
  position: 'left' | 'right';
  onSelect: (date: string) => void;
}> = ({ value, timezone, position, onSelect }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relatorios-filtro-data-wrap">
      <button type="button" className="relatorios-filtro-data-btn" onClick={() => setOpen((prev) => !prev)}>
        {formatDisplayDate(value)}
      </button>
      {open && (
        <CustomDatePicker
          selectedDate={value}
          timezone={timezone}
          position={position}
          onSelectDate={(newDate) => {
            setOpen(false);
            onSelect(newDate);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};
