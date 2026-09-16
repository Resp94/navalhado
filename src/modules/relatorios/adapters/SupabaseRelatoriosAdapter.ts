import { supabase } from '../../../lib/supabase';
import type {
  ObterEquipeEServicosInput,
  ObterFaturamentoPorPeriodoInput,
  ProfissionalRanking,
  RelatorioEquipeServicos,
  RelatorioEquipeServicosTotais,
  RelatorioFaturamento,
  RelatorioFaturamentoBucket,
  RelatorioFaturamentoTotais,
  RelatorioRecebidoPorForma,
  RelatorioRecebidoPorFormaBucket,
  RelatoriosAdapter,
  RelatoriosDataQualityStatus,
  ServicoRanking,
  TicketPorProfissional,
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

/**
 * Coerção numérica que preserva `null` (mesmo padrão de `share` do ticket
 * 02): usada para campos onde o banco devolve `jsonb null` de propósito
 * (ausência de denominador), nunca convertido para `0`.
 */
function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

type BucketTotais = Omit<RelatorioFaturamentoTotais, 'received_total'>;

function toBucketTotais(value: unknown): BucketTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    gross: toNumber(raw.gross),
    discounts: toNumber(raw.discounts),
    net: toNumber(raw.net),
    services_net: toNumber(raw.services_net),
    products_net: toNumber(raw.products_net),
    tips: toNumber(raw.tips),
    closed_comandas: toNumber(raw.closed_comandas),
    average_ticket: toNullableNumber(raw.average_ticket),
  };
}

function toTicketByProfessional(value: unknown): TicketPorProfissional[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      professional_id: raw.professional_id ? String(raw.professional_id) : '',
      name: raw.name ? String(raw.name) : '',
      is_active: raw.is_active === true,
      archived: raw.archived === true,
      net: toNumber(raw.net),
      comandas: toNumber(raw.comandas),
      average_ticket: toNullableNumber(raw.average_ticket),
    };
  });
}

function toTotais(value: unknown): RelatorioFaturamentoTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    ...toBucketTotais(raw),
    received_total: toNumber(raw.received_total),
  };
}

function toReceivedByMethodBucket(value: unknown): RelatorioRecebidoPorFormaBucket[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      method: raw.method ? String(raw.method) : '',
      label: raw.label ? String(raw.label) : '',
      amount: toNumber(raw.amount),
      payments_count: toNumber(raw.payments_count),
    };
  });
}

/**
 * `share` é `null` quando o período não teve recebimento (o núcleo do
 * banco devolve `null` em vez de dividir por zero) -- preservado como
 * `null`, nunca coagido para `0`, para a tela mostrar "--" e não "0%".
 */
function toReceivedByMethod(value: unknown): RelatorioRecebidoPorForma[] {
  if (!Array.isArray(value)) return [];
  return toReceivedByMethodBucket(value).map((item, index) => {
    const raw = ((value as unknown[])[index] || {}) as Record<string, unknown>;
    const share = raw.share === null || raw.share === undefined ? null : toNumber(raw.share);
    return { ...item, share };
  });
}

function toProfessionalsRanking(value: unknown): ProfissionalRanking[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      professional_id: raw.professional_id ? String(raw.professional_id) : '',
      name: raw.name ? String(raw.name) : '',
      is_active: raw.is_active === true,
      archived: raw.archived === true,
      net: toNumber(raw.net),
      gross: toNumber(raw.gross),
      share: toNullableNumber(raw.share),
      attendances: toNumber(raw.attendances),
      services_quantity: toNumber(raw.services_quantity),
      products_net: toNumber(raw.products_net),
      average_ticket: toNullableNumber(raw.average_ticket),
      commission: toNumber(raw.commission),
    };
  });
}

function toServicesRanking(value: unknown): ServicoRanking[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      service_id: raw.service_id ? String(raw.service_id) : '',
      name: raw.name ? String(raw.name) : '',
      category: raw.category ? String(raw.category) : '',
      archived: raw.archived === true,
      quantity: toNumber(raw.quantity),
      net: toNumber(raw.net),
      share: toNullableNumber(raw.share),
      average_unit_net: toNullableNumber(raw.average_unit_net),
    };
  });
}

function toEquipeServicosTotais(value: unknown): RelatorioEquipeServicosTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    net: toNumber(raw.net),
    services_net: toNumber(raw.services_net),
    attendances: toNumber(raw.attendances),
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
      received_by_method?: unknown;
      buckets?: Array<Record<string, unknown>>;
      ticket_by_professional?: unknown;
    };

    const dataQualityRaw = raw.data_quality || {};
    const status = DATA_QUALITY_STATUSES.includes(dataQualityRaw.status as RelatoriosDataQualityStatus)
      ? (dataQualityRaw.status as RelatoriosDataQualityStatus)
      : 'unavailable';

    const buckets: RelatorioFaturamentoBucket[] = (Array.isArray(raw.buckets) ? raw.buckets : []).map((bucket) => ({
      start_date: bucket?.start_date ? String(bucket.start_date) : '',
      end_date: bucket?.end_date ? String(bucket.end_date) : '',
      ...toBucketTotais(bucket),
      received: toNumber(bucket?.received),
      received_by_method: toReceivedByMethodBucket(bucket?.received_by_method),
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
      received_by_method: toReceivedByMethod(raw.received_by_method),
      buckets,
      ticket_by_professional: toTicketByProfessional(raw.ticket_by_professional),
    };
  }

  /**
   * Equipe e Serviços (`get_team_services_report`, spec 038, ticket 05):
   * `p_professional_id` é omitido (`undefined`) quando não filtrado -- a
   * RPC tem `default null` e filtra só `services[]`, nunca a lista de
   * profissionais.
   */
  async obterEquipeEServicos(input: ObterEquipeEServicosInput): Promise<RelatorioEquipeServicos> {
    const { data, error } = await supabase.rpc('get_team_services_report', {
      p_tenant_id: input.tenantId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_professional_id: input.professionalId || null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o relatório de Equipe e Serviços.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      period?: { start?: unknown; end?: unknown };
      data_quality?: {
        status?: unknown;
        confirmed_comandas?: unknown;
        estimated_comandas?: unknown;
        legacy_comandas?: unknown;
      };
      professionals?: unknown;
      services?: unknown;
      totals?: unknown;
    };

    const dataQualityRaw = raw.data_quality || {};
    const status = DATA_QUALITY_STATUSES.includes(dataQualityRaw.status as RelatoriosDataQualityStatus)
      ? (dataQualityRaw.status as RelatoriosDataQualityStatus)
      : 'unavailable';

    return {
      timezone: raw.timezone || 'America/Sao_Paulo',
      business_today: raw.business_today ? String(raw.business_today) : '',
      period: {
        start: raw.period?.start ? String(raw.period.start) : '',
        end: raw.period?.end ? String(raw.period.end) : '',
      },
      data_quality: {
        status,
        confirmed_comandas: toNumber(dataQualityRaw.confirmed_comandas),
        estimated_comandas: toNumber(dataQualityRaw.estimated_comandas),
        legacy_comandas: toNumber(dataQualityRaw.legacy_comandas),
      },
      professionals: toProfessionalsRanking(raw.professionals),
      services: toServicesRanking(raw.services),
      totals: toEquipeServicosTotais(raw.totals),
    };
  }
}
