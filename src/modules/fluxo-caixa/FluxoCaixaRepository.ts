import { MS_PER_DAY, calendarExtentInDays, parseDateOnly as parseCalendarDate } from './calendario';
import type { FluxoCaixaGranularity, FluxoCaixaProjetado, IFluxoCaixaAdapter, ObterFluxoCaixaInput } from './types';

export class FluxoCaixaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FluxoCaixaValidationError';
  }
}

const GRANULARITIES: FluxoCaixaGranularity[] = ['day', 'week', 'month'];

function parseDateOnly(value: string): number {
  try {
    return parseCalendarDate(value);
  } catch {
    throw new FluxoCaixaValidationError('Data inválida. Use o formato AAAA-MM-DD.');
  }
}

export interface ObterFluxoCaixaProjetadoInput extends ObterFluxoCaixaInput {
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Módulo profundo do Fluxo de Caixa Projetado (spec 037, ticket 01). Valida
 * período e granularidade com os MESMOS limites do núcleo do banco
 * (`private.get_projected_cash_flow_core`), para que o erro apareça em
 * pt-BR antes da ida à rede. `today` é responsabilidade de quem chama: o
 * dia de hoje no fuso do tenant, nunca a data local do navegador.
 */
export class FluxoCaixaRepository {
  private adapter: IFluxoCaixaAdapter;

  constructor(adapter: IFluxoCaixaAdapter) {
    this.adapter = adapter;
  }

  async obterFluxoCaixaProjetado(input: ObterFluxoCaixaProjetadoInput): Promise<FluxoCaixaProjetado> {
    const { tenantId, startDate, endDate, granularity, today } = input;

    if (!tenantId || !tenantId.trim()) {
      throw new FluxoCaixaValidationError('ID da unidade (tenant) é obrigatório.');
    }
    if (!startDate || !endDate) {
      throw new FluxoCaixaValidationError('As datas de início e fim do período são obrigatórias.');
    }
    if (!today) {
      throw new FluxoCaixaValidationError('A data de hoje é obrigatória para validar o período.');
    }

    const startTs = parseDateOnly(startDate);
    const endTs = parseDateOnly(endDate);
    const todayTs = parseDateOnly(today);

    if (endTs < startTs) {
      throw new FluxoCaixaValidationError('A data final não pode ser anterior à data inicial.');
    }
    if (startTs > todayTs) {
      throw new FluxoCaixaValidationError('A data inicial não pode ser posterior a hoje.');
    }
    if (startTs < todayTs - 365 * MS_PER_DAY) {
      throw new FluxoCaixaValidationError('A data inicial não pode ser mais de 365 dias antes de hoje.');
    }
    if (endTs > todayTs + 365 * MS_PER_DAY) {
      throw new FluxoCaixaValidationError('A data final não pode ser mais de 365 dias depois de hoje.');
    }

    const extent = calendarExtentInDays(startDate, endDate);
    if (extent > 366) {
      throw new FluxoCaixaValidationError('O período não pode ter mais de 366 dias.');
    }

    if (!GRANULARITIES.includes(granularity)) {
      throw new FluxoCaixaValidationError('Granularidade desconhecida. Use dia, semana ou mês.');
    }
    if (granularity === 'day' && extent > 92) {
      throw new FluxoCaixaValidationError('A granularidade diária só é permitida em períodos de até 92 dias.');
    }

    return await this.adapter.obterFluxoCaixaProjetado({ tenantId, startDate, endDate, granularity });
  }
}
