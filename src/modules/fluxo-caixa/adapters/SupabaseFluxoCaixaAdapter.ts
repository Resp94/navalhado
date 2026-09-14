import { supabase } from '../../../lib/supabase';
import {
  FLUXO_CAIXA_WEEKDAY_KEYS,
  type FluxoCaixaBucket,
  type FluxoCaixaEstimate,
  type FluxoCaixaProjetado,
  type FluxoCaixaUndatedCommitments,
  type FluxoCaixaValorPorProfissional,
  type FluxoCaixaWeekdayAverages,
  type IFluxoCaixaAdapter,
  type ObterFluxoCaixaInput,
} from '../types';

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toWeekdayAverages(value: unknown): FluxoCaixaWeekdayAverages {
  const raw = (value || {}) as Record<string, unknown>;
  return FLUXO_CAIXA_WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = toNumber(raw[key]);
    return acc;
  }, {} as FluxoCaixaWeekdayAverages);
}

function toEstimate(value: unknown): FluxoCaixaEstimate {
  const raw = (value || {}) as { status?: unknown; weeks_used?: unknown; weekday_averages?: unknown };
  return {
    status: raw.status === 'ok' ? 'ok' : 'insufficient_history',
    weeks_used: toNumber(raw.weeks_used),
    weekday_averages: toWeekdayAverages(raw.weekday_averages),
  };
}

function toUndatedCommitments(value: unknown): FluxoCaixaUndatedCommitments {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    commission_open: toNumber(raw.commission_open),
    tips_open: toNumber(raw.tips_open),
    advances_open: toNumber(raw.advances_open),
    net_due: toNumber(raw.net_due),
  };
}

function toValoresPorProfissional(value: unknown): FluxoCaixaValorPorProfissional[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      professional_id: raw.professional_id ? String(raw.professional_id) : '',
      professional_name: raw.professional_name ? String(raw.professional_name) : '',
      amount: toNumber(raw.amount),
    };
  });
}

/**
 * Adaptador Supabase do Fluxo de Caixa Projetado (spec 037, ticket 01):
 * converte o JSON de `get_projected_cash_flow` em números e tipos do
 * domínio. Campos ausentes no retorno viram zero ou lista vazia, nunca
 * `undefined` ou `NaN`.
 */
export class SupabaseFluxoCaixaAdapter implements IFluxoCaixaAdapter {
  async obterFluxoCaixaProjetado(input: ObterFluxoCaixaInput): Promise<FluxoCaixaProjetado> {
    const { data, error } = await supabase.rpc('get_projected_cash_flow', {
      p_tenant_id: input.tenantId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_granularity: input.granularity,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o fluxo de caixa projetado.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      estimate?: unknown;
      undated_commitments?: unknown;
      buckets?: Array<Record<string, any>>;
    };

    const buckets: FluxoCaixaBucket[] = (Array.isArray(raw.buckets) ? raw.buckets : []).map((bucket) => {
      const detail = (bucket?.detail || {}) as {
        inflow_by_method?: Record<string, unknown>;
        payouts_by_professional?: unknown;
        advances_by_professional?: unknown;
        estimated_days?: unknown;
        closed_days?: unknown;
      };
      const byMethod = detail.inflow_by_method || {};

      return {
        start_date: bucket?.start_date ? String(bucket.start_date) : '',
        end_date: bucket?.end_date ? String(bucket.end_date) : '',
        kind: (bucket?.kind as FluxoCaixaBucket['kind']) || 'current',
        inflow_realized: toNumber(bucket?.inflow_realized),
        inflow_estimated: toNullableNumber(bucket?.inflow_estimated),
        outflow_realized: toNumber(bucket?.outflow_realized),
        pending_flow: toNumber(bucket?.pending_flow),
        detail: {
          inflow_by_method: {
            dinheiro: toNumber(byMethod.dinheiro),
            pix: toNumber(byMethod.pix),
            cartao: toNumber(byMethod.cartao),
            outros: toNumber(byMethod.outros),
          },
          payouts_by_professional: toValoresPorProfissional(detail.payouts_by_professional),
          advances_by_professional: toValoresPorProfissional(detail.advances_by_professional),
          estimated_days: toNumber(detail.estimated_days),
          closed_days: toNumber(detail.closed_days),
        },
      };
    });

    return {
      timezone: raw.timezone || 'America/Sao_Paulo',
      business_today: raw.business_today ? String(raw.business_today) : '',
      estimate: toEstimate(raw.estimate),
      undated_commitments: toUndatedCommitments(raw.undated_commitments),
      buckets,
    };
  }
}
