import { supabase } from '../../../lib/supabase';
import type {
  ObterFaturamentoPorPeriodoInput,
  RelatorioFaturamento,
  RelatorioFaturamentoBucket,
  RelatorioFaturamentoTotais,
  RelatoriosAdapter,
  RelatoriosDataQualityStatus,
} from '../types';

const DATA_QUALITY_STATUSES: RelatoriosDataQualityStatus[] = [
  'confirmed',
  'estimated',
  'legacy',
  'mixed',
  'unavailable',
];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTotais(value: unknown): RelatorioFaturamentoTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    gross: toNumber(raw.gross),
    discounts: toNumber(raw.discounts),
    net: toNumber(raw.net),
    services_net: toNumber(raw.services_net),
    products_net: toNumber(raw.products_net),
    tips: toNumber(raw.tips),
    closed_comandas: toNumber(raw.closed_comandas),
  };
}

/**
 * Adaptador Supabase do Faturamento por período (`get_revenue_report`,
 * spec 038, ticket 01): converte o `jsonb` da RPC em números e tipos do
 * domínio. Campos ausentes viram zero, string vazia ou lista vazia, nunca
 * `undefined` ou `NaN` -- mesma decisão do `SupabaseFluxoCaixaAdapter`.
 */
export class SupabaseRelatoriosAdapter implements RelatoriosAdapter {
  async obterFaturamentoPorPeriodo(input: ObterFaturamentoPorPeriodoInput): Promise<RelatorioFaturamento> {
    const { data, error } = await supabase.rpc('get_revenue_report', {
      p_tenant_id: input.tenantId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_granularity: input.granularity,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o faturamento por período.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      period?: { start?: unknown; end?: unknown };
      previous_period?: { start?: unknown; end?: unknown };
      data_quality?: {
        status?: unknown;
        confirmed_comandas?: unknown;
        estimated_comandas?: unknown;
        legacy_comandas?: unknown;
      };
      totals?: unknown;
      previous_totals?: unknown;
      buckets?: Array<Record<string, unknown>>;
    };

    const dataQualityRaw = raw.data_quality || {};
    const status = DATA_QUALITY_STATUSES.includes(dataQualityRaw.status as RelatoriosDataQualityStatus)
      ? (dataQualityRaw.status as RelatoriosDataQualityStatus)
      : 'unavailable';

    const buckets: RelatorioFaturamentoBucket[] = (Array.isArray(raw.buckets) ? raw.buckets : []).map((bucket) => ({
      start_date: bucket?.start_date ? String(bucket.start_date) : '',
      end_date: bucket?.end_date ? String(bucket.end_date) : '',
      ...toTotais(bucket),
    }));

    return {
      timezone: raw.timezone || 'America/Sao_Paulo',
      business_today: raw.business_today ? String(raw.business_today) : '',
      period: {
        start: raw.period?.start ? String(raw.period.start) : '',
        end: raw.period?.end ? String(raw.period.end) : '',
      },
      previous_period: {
        start: raw.previous_period?.start ? String(raw.previous_period.start) : '',
        end: raw.previous_period?.end ? String(raw.previous_period.end) : '',
      },
      data_quality: {
        status,
        confirmed_comandas: toNumber(dataQualityRaw.confirmed_comandas),
        estimated_comandas: toNumber(dataQualityRaw.estimated_comandas),
        legacy_comandas: toNumber(dataQualityRaw.legacy_comandas),
      },
      totals: toTotais(raw.totals),
      previous_totals: toTotais(raw.previous_totals),
      buckets,
    };
  }
}
