import React, { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Coins01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { dateInZone } from '../../../lib/timezone';
import { FluxoCaixaRepository } from '../../../modules/fluxo-caixa/FluxoCaixaRepository';
import { SupabaseFluxoCaixaAdapter } from '../../../modules/fluxo-caixa/adapters/SupabaseFluxoCaixaAdapter';
import { useFluxoCaixa } from '../../../modules/fluxo-caixa/useFluxoCaixa';
import {
  getFluxoCaixaPeriodShortcutRange,
  isGranularityWithinLimits,
  suggestFluxoCaixaGranularity,
  type FluxoCaixaPeriodShortcutId,
} from '../../../modules/fluxo-caixa/periodo';
import type { FluxoCaixaGranularity } from '../../../modules/fluxo-caixa/types';
import { FluxoCaixaFiltros } from './fluxo-caixa/FluxoCaixaFiltros';
import { FluxoCaixaResumo } from './fluxo-caixa/FluxoCaixaResumo';
import { FluxoCaixaTabela } from './fluxo-caixa/FluxoCaixaTabela';
import './fluxo-caixa/FluxoCaixa.css';

type ShortcutOrCustom = FluxoCaixaPeriodShortcutId | 'custom';

const DEFAULT_SHORTCUT: FluxoCaixaPeriodShortcutId = 'next_30_days';

/**
 * Aba "Fluxo de Caixa Projetado" do Hub Financeiro (spec 037, ticket 01):
 * montada como rota-filha direta de `/financeiro` (`/financeiro/fluxo-de-caixa`),
 * fora do layout do painel de Caixa e Comissões -- tem filtro de período
 * próprio, não o "Este mês / Últimos 30 dias / Últimos 90 dias" do painel.
 *
 * Composta por partes de responsabilidade única (filtros, resumo, tabela),
 * e não por um componente monolítico. O estado de filtro mora aqui; cada
 * parte recebe só o que exibe.
 *
 * Atalhos e datas iniciais usam o dia de hoje no fuso do tenant
 * (`dateInZone`), nunca a data local do navegador. A classificação de cada
 * agrupamento (passado/atual/futuro) usa `business_today`, devolvido pelo
 * contrato -- não o `today` calculado aqui, que só serve para os atalhos e
 * para a validação do repositório antes da ida à rede.
 */
export interface FluxoCaixaTabProps {
  /** Injetado nos testes; produção usa o repositório padrão com o adaptador Supabase. */
  repository?: FluxoCaixaRepository;
}

export const FluxoCaixaTab: React.FC<FluxoCaixaTabProps> = ({ repository: injectedRepository }) => {
  const tenant = useOutletContext<TenantContextType>();
  const timezone = tenant?.timezone || 'America/Sao_Paulo';
  const today = useMemo(() => dateInZone(new Date(), timezone), [timezone]);

  const [shortcut, setShortcut] = useState<ShortcutOrCustom>(DEFAULT_SHORTCUT);
  const initialRange = useMemo(() => getFluxoCaixaPeriodShortcutRange(DEFAULT_SHORTCUT, today), [today]);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [granularity, setGranularity] = useState<FluxoCaixaGranularity>(initialRange.granularity);

  const [defaultRepository] = useState(() => new FluxoCaixaRepository(new SupabaseFluxoCaixaAdapter()));
  const repository = injectedRepository || defaultRepository;

  const handleShortcutChange = useCallback(
    (id: ShortcutOrCustom) => {
      setShortcut(id);
      if (id === 'custom') return;
      const range = getFluxoCaixaPeriodShortcutRange(id, today);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setGranularity(range.granularity);
    },
    [today]
  );

  const handleCustomDateChange = useCallback(
    (nextStart: string, nextEnd: string) => {
      setStartDate(nextStart);
      setEndDate(nextEnd);
      // Primeira vez entrando em "personalizado" (a partir de um atalho):
      // sugere a granularidade. Já estando em "personalizado", o gestor pode
      // ter escolhido a granularidade a mão; só troca se a escolha atual
      // deixou de caber no novo período (ex.: dia acima de 92 dias).
      setGranularity((currentGranularity) =>
        shortcut === 'custom' && isGranularityWithinLimits(currentGranularity, nextStart, nextEnd)
          ? currentGranularity
          : suggestFluxoCaixaGranularity(nextStart, nextEnd)
      );
      setShortcut('custom');
    },
    [shortcut]
  );

  const { data, loading, error, reload } = useFluxoCaixa(repository, {
    tenantId: tenant?.tenantId || '',
    startDate,
    endDate,
    granularity,
    today,
  });

  const buckets = data?.buckets || [];
  const estimate = data?.estimate || null;

  return (
    <div className="fluxo-caixa-tab">
      <header className="fluxo-caixa-header">
        <div>
          <h3 className="card-panel-title">
            <HugeiconsIcon icon={Coins01Icon} size={18} />
            Fluxo de Caixa Projetado
          </h3>
          <p className="card-panel-subtitle">
            Quanto a barbearia recebeu de Comandas, agrupado por dia, semana ou mês.
          </p>
        </div>
        <button
          type="button"
          className="fluxo-caixa-refresh-btn"
          onClick={() => void reload()}
          disabled={loading}
        >
          <HugeiconsIcon icon={RefreshIcon} size={16} />
          Atualizar
        </button>
      </header>

      <FluxoCaixaFiltros
        shortcut={shortcut}
        onShortcutChange={handleShortcutChange}
        startDate={startDate}
        endDate={endDate}
        onCustomDateChange={handleCustomDateChange}
        granularity={granularity}
        onGranularityChange={setGranularity}
        timezone={timezone}
        isCustom={shortcut === 'custom'}
      />

      {error && (
        <p className="fluxo-caixa-error" role="alert">
          {error}
        </p>
      )}

      <FluxoCaixaResumo buckets={buckets} estimate={estimate} loading={loading} />

      <FluxoCaixaTabela buckets={buckets} loading={loading} />
    </div>
  );
};
