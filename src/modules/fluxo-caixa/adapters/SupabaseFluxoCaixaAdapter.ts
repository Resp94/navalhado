import { supabase } from '../../../lib/supabase';
import type {
  FluxoCaixaBucket,
  FluxoCaixaProjetado,
  IFluxoCaixaAdapter,
  ObterFluxoCaixaInput,
} from '../types';

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      buckets?: Array<Record<string, any>>;
    };

    const buckets: FluxoCaixaBucket[] = (Array.isArray(raw.buckets) ? raw.buckets : []).map((bucket) => {
      const detail = (bucket?.detail || {}) as { inflow_by_method?: Record<string, unknown> };
      const byMethod = detail.inflow_by_method || {};

      return {
        start_date: bucket?.start_date ? String(bucket.start_date) : '',
        end_date: bucket?.end_date ? String(bucket.end_date) : '',
        kind: (bucket?.kind as FluxoCaixaBucket['kind']) || 'current',
        inflow_realized: toNumber(bucket?.inflow_realized),
        pending_flow: toNumber(bucket?.pending_flow),
        detail: {
          inflow_by_method: {
            dinheiro: toNumber(byMethod.dinheiro),
            pix: toNumber(byMethod.pix),
            cartao: toNumber(byMethod.cartao),
            outros: toNumber(byMethod.outros),
          },
        },
      };
    });

    return {
      timezone: raw.timezone || 'America/Sao_Paulo',
      business_today: raw.business_today ? String(raw.business_today) : '',
      buckets,
    };
  }
}
