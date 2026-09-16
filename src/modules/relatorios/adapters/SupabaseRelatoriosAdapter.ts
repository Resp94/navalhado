import { supabase } from '../../../lib/supabase';
import type {
  ClienteSemRetornoItem,
  ClienteUmaVisita,
  ObterAgendaInput,
  ObterClientesInput,
  ObterClientesSemRetornoInput,
  ObterEquipeEServicosInput,
  ObterFaturamentoPorPeriodoInput,
  ProfissionalRanking,
  RelatorioAgenda,
  RelatorioAgendaHeatmap,
  RelatorioAgendaMotivoCancelamento,
  RelatorioAgendaOrigem,
  RelatorioAgendaOrigemTotais,
  RelatorioAgendaProfissionalTotais,
  RelatorioAgendaStatusTotais,
  RelatorioClientes,
  RelatorioClientesBucket,
  RelatorioClientesSemRetorno,
  RelatorioClientesSemRetornoFaixas,
  RelatorioClientesSemRetornoTotais,
  RelatorioClientesVisitantes,
  RelatorioClientesVisitantesAnterior,
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

const AGENDA_ORIGINS: RelatorioAgendaOrigem[] = ['manual', 'whatsapp', 'client_channel', 'online'];

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

/**
 * Coerção de texto que preserva `null` (spec 038, ticket 09): usada para
 * `phone`/`last_service_name`/`last_professional_name`, onde o núcleo do
 * banco devolve `null` de propósito (cliente sem telefone, última Visita
 * sem serviço/profissional identificável) -- nunca convertido para string
 * vazia, que apagaria a distinção na tela (badge "sem telefone" etc).
 */
function toNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
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
 * Totais por status da Agenda (spec 038, ticket 07): `attendance_rate` e
 * `cancellation_rate` preservam `null` (denominador zero no núcleo do
 * banco), nunca coagidos para `0` -- mesmo padrão de `share`/`average_ticket`.
 */
function toAgendaStatusTotais(value: unknown): RelatorioAgendaStatusTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    total: toNumber(raw.total),
    completed: toNumber(raw.completed),
    no_show: toNumber(raw.no_show),
    canceled: toNumber(raw.canceled),
    unresolved: toNumber(raw.unresolved),
    future: toNumber(raw.future),
    attendance_rate: toNullableNumber(raw.attendance_rate),
    cancellation_rate: toNullableNumber(raw.cancellation_rate),
  };
}

function toAgendaByOrigin(value: unknown): RelatorioAgendaOrigemTotais[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    const origin = AGENDA_ORIGINS.includes(raw.origin as RelatorioAgendaOrigem)
      ? (raw.origin as RelatorioAgendaOrigem)
      : 'manual';
    return {
      origin,
      total: toNumber(raw.total),
      completed: toNumber(raw.completed),
      no_show: toNumber(raw.no_show),
      canceled: toNumber(raw.canceled),
      unresolved: toNumber(raw.unresolved),
      attendance_rate: toNullableNumber(raw.attendance_rate),
    };
  });
}

function toAgendaByProfessional(value: unknown): RelatorioAgendaProfissionalTotais[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      professional_id: raw.professional_id ? String(raw.professional_id) : '',
      name: raw.name ? String(raw.name) : '',
      is_active: raw.is_active === true,
      archived: raw.archived === true,
      total: toNumber(raw.total),
      completed: toNumber(raw.completed),
      no_show: toNumber(raw.no_show),
      canceled: toNumber(raw.canceled),
      unresolved: toNumber(raw.unresolved),
      attendance_rate: toNullableNumber(raw.attendance_rate),
    };
  });
}

function toAgendaCancellationReasons(value: unknown): RelatorioAgendaMotivoCancelamento[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      reason: raw.reason ? String(raw.reason) : '',
      count: toNumber(raw.count),
    };
  });
}

/**
 * Mapa de calor da Agenda (spec 038, ticket 08): `hours` e `count` são
 * sempre inteiros presentes (nunca `null`) -- diferente de `share`/
 * `average_ticket`, aqui `0` é uma contagem real, não ausência de dado.
 * `cells` só traz combinações com pelo menos 1 Agendamento; o núcleo do
 * banco nunca devolve célula zerada (ver comentário da migração do ticket
 * 08).
 */
function toAgendaHeatmap(value: unknown): RelatorioAgendaHeatmap {
  const raw = (value || {}) as Record<string, unknown>;
  const hours = Array.isArray(raw.hours) ? raw.hours.map((hour) => toNumber(hour)) : [];
  const cells = Array.isArray(raw.cells)
    ? raw.cells.map((item) => {
        const cellRaw = (item || {}) as Record<string, unknown>;
        return {
          weekday: toNumber(cellRaw.weekday),
          hour: toNumber(cellRaw.hour),
          count: toNumber(cellRaw.count),
        };
      })
    : [];
  return { hours, cells };
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

  /**
   * Agenda (`get_schedule_report`, spec 038, tickets 07-08): comparecimento,
   * cancelamento, no-show e mapa de calor. `p_professional_id` é omitido
   * (`undefined`) quando não filtrado -- a RPC tem `default null` e filtra
   * status_totals/by_origin/cancellation_reasons/heatmap, mas NUNCA
   * by_professional (inverso da regra do ticket 05/06).
   */
  async obterAgenda(input: ObterAgendaInput): Promise<RelatorioAgenda> {
    const { data, error } = await supabase.rpc('get_schedule_report', {
      p_tenant_id: input.tenantId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_professional_id: input.professionalId || null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o relatório de Agenda.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      period?: { start?: unknown; end?: unknown };
      previous_period?: { start?: unknown; end?: unknown };
      status_totals?: unknown;
      previous_status_totals?: unknown;
      by_origin?: unknown;
      by_professional?: unknown;
      cancellation_reasons?: unknown;
      heatmap?: unknown;
    };

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
      status_totals: toAgendaStatusTotais(raw.status_totals),
      previous_status_totals: toAgendaStatusTotais(raw.previous_status_totals),
      by_origin: toAgendaByOrigin(raw.by_origin),
      by_professional: toAgendaByProfessional(raw.by_professional),
      cancellation_reasons: toAgendaCancellationReasons(raw.cancellation_reasons),
      heatmap: toAgendaHeatmap(raw.heatmap),
    };
  }

  /**
   * Clientes sem Retorno (`get_customers_without_return`, spec 038, ticket
   * 09): SEM período -- `p_overdue_band`/`p_professional_id` são omitidos
   * (`undefined` -> `null`) quando não filtrados. `phone`,
   * `last_service_name` e `last_professional_name` preservam `null`
   * (`toNullableString`): telefone ausente e última Visita sem
   * serviço/profissional identificável são casos reais do contrato, nunca
   * string vazia.
   */
  async obterClientesSemRetorno(input: ObterClientesSemRetornoInput): Promise<RelatorioClientesSemRetorno> {
    const { data, error } = await supabase.rpc('get_customers_without_return', {
      p_tenant_id: input.tenantId,
      p_overdue_band: input.overdueBand || null,
      p_professional_id: input.professionalId || null,
      p_limit: input.limit,
      p_offset: input.offset,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o relatório de Clientes sem Retorno.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      totals?: unknown;
      bands?: unknown;
      items?: unknown;
      total_count?: unknown;
    };

    return {
      timezone: raw.timezone || 'America/Sao_Paulo',
      business_today: raw.business_today ? String(raw.business_today) : '',
      totals: toClientesSemRetornoTotais(raw.totals),
      bands: toClientesSemRetornoFaixas(raw.bands),
      items: toClientesSemRetornoItems(raw.items),
      total_count: toNumber(raw.total_count),
    };
  }

  /**
   * Novos x recorrentes (`get_customer_report`, spec 038, ticket 10):
   * visitantes únicos/novos/recorrentes/novos-de-uma-visita/sem-cliente do
   * período e do anterior, agrupamento por dia/semana/mês e lista de
   * Clientes de Uma Visita (até 200). `previous_visitors` nunca ganha
   * `new_single_visit` aqui -- o backend não envia essa chave para o
   * período anterior (ver comentário do tipo `RelatorioClientesVisitantesAnterior`).
   */
  async obterClientes(input: ObterClientesInput): Promise<RelatorioClientes> {
    const { data, error } = await supabase.rpc('get_customer_report', {
      p_tenant_id: input.tenantId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_granularity: input.granularity,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar o relatório de Clientes.');
    }

    const raw = (data || {}) as {
      timezone?: string;
      business_today?: string;
      period?: { start?: unknown; end?: unknown };
      previous_period?: { start?: unknown; end?: unknown };
      visitors?: unknown;
      previous_visitors?: unknown;
      buckets?: unknown;
      single_visit_customers?: unknown;
    };

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
      visitors: toClientesVisitantes(raw.visitors),
      previous_visitors: toClientesVisitantesAnterior(raw.previous_visitors),
      buckets: toClientesBuckets(raw.buckets),
      single_visit_customers: toClientesUmaVisita(raw.single_visit_customers),
    };
  }
}

function toClientesSemRetornoTotais(value: unknown): RelatorioClientesSemRetornoTotais {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    without_return: toNumber(raw.without_return),
    within_return: toNumber(raw.within_return),
    no_visit_ever: toNumber(raw.no_visit_ever),
  };
}

function toClientesSemRetornoFaixas(value: unknown): RelatorioClientesSemRetornoFaixas {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    up_to_15: toNumber(raw.up_to_15),
    d16_30: toNumber(raw.d16_30),
    d31_60: toNumber(raw.d31_60),
    over_60: toNumber(raw.over_60),
  };
}

function toClientesSemRetornoItems(value: unknown): ClienteSemRetornoItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      customer_id: raw.customer_id ? String(raw.customer_id) : '',
      name: raw.name ? String(raw.name) : '',
      phone: toNullableString(raw.phone),
      has_phone: raw.has_phone === true,
      last_visit_date: raw.last_visit_date ? String(raw.last_visit_date) : '',
      last_service_name: toNullableString(raw.last_service_name),
      last_professional_name: toNullableString(raw.last_professional_name),
      return_period_days: toNumber(raw.return_period_days),
      days_since: toNumber(raw.days_since),
      days_overdue: toNumber(raw.days_overdue),
    };
  });
}

function toClientesVisitantes(value: unknown): RelatorioClientesVisitantes {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    unique_customers: toNumber(raw.unique_customers),
    new_customers: toNumber(raw.new_customers),
    returning_customers: toNumber(raw.returning_customers),
    new_single_visit: toNumber(raw.new_single_visit),
    unidentified_attendances: toNumber(raw.unidentified_attendances),
  };
}

/**
 * `previous_visitors` nunca tem `new_single_visit` no jsonb (decisão da
 * migração do ticket 10) -- a conversão aqui simplesmente não lê essa
 * chave, refletindo fielmente o contrato.
 */
function toClientesVisitantesAnterior(value: unknown): RelatorioClientesVisitantesAnterior {
  const raw = (value || {}) as Record<string, unknown>;
  return {
    unique_customers: toNumber(raw.unique_customers),
    new_customers: toNumber(raw.new_customers),
    returning_customers: toNumber(raw.returning_customers),
    unidentified_attendances: toNumber(raw.unidentified_attendances),
  };
}

function toClientesBuckets(value: unknown): RelatorioClientesBucket[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      start_date: raw.start_date ? String(raw.start_date) : '',
      end_date: raw.end_date ? String(raw.end_date) : '',
      new_customers: toNumber(raw.new_customers),
      returning_customers: toNumber(raw.returning_customers),
    };
  });
}

function toClientesUmaVisita(value: unknown): ClienteUmaVisita[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const raw = (item || {}) as Record<string, unknown>;
    return {
      customer_id: raw.customer_id ? String(raw.customer_id) : '',
      name: raw.name ? String(raw.name) : '',
      phone: toNullableString(raw.phone),
      visit_date: raw.visit_date ? String(raw.visit_date) : '',
      professional_name: toNullableString(raw.professional_name),
    };
  });
}
