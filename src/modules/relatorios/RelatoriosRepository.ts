import { MS_PER_DAY, calendarExtentInDays, parseDateOnly as parseCalendarDate } from '../fluxo-caixa/calendario';
import type {
  ObterEquipeEServicosInput,
  ObterFaturamentoPorPeriodoInput,
  RelatorioEquipeServicos,
  RelatorioFaturamento,
  RelatoriosAdapter,
  RelatoriosGranularity,
} from './types';

export class RelatoriosValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RelatoriosValidationError';
  }
}

const GRANULARITIES: RelatoriosGranularity[] = ['day', 'week', 'month'];

function parseDateOnly(value: string): number {
  try {
    return parseCalendarDate(value);
  } catch {
    throw new RelatoriosValidationError('Data inválida. Use o formato AAAA-MM-DD.');
  }
}

export interface ObterFaturamentoPorPeriodoRepositoryInput extends ObterFaturamentoPorPeriodoInput {
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

export interface ObterEquipeEServicosRepositoryInput extends ObterEquipeEServicosInput {
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Módulo profundo do relatório de Faturamento por período (spec 038,
 * ticket 01). Valida período e granularidade com os MESMOS limites do
 * núcleo do banco (`private.get_revenue_report_core`), para que o erro
 * apareça em pt-BR antes da ida à rede. `today` é responsabilidade de quem
 * chama: o dia de hoje no fuso do tenant, nunca a data local do navegador.
 *
 * Os outros quatro contratos da spec (Equipe e Serviços, Agenda, Clientes,
 * Clientes sem Retorno) ganham seu próprio método aqui nos tickets
 * seguintes -- um repositório por módulo, um método por contrato, como já
 * é o Fluxo de Caixa Projetado.
 */
export class RelatoriosRepository {
  private adapter: RelatoriosAdapter;

  constructor(adapter: RelatoriosAdapter) {
    this.adapter = adapter;
  }

  async obterFaturamentoPorPeriodo(input: ObterFaturamentoPorPeriodoRepositoryInput): Promise<RelatorioFaturamento> {
    const { tenantId, startDate, endDate, granularity, today } = input;

    if (!tenantId || !tenantId.trim()) {
      throw new RelatoriosValidationError('ID da unidade (tenant) é obrigatório.');
    }
    if (!startDate || !endDate) {
      throw new RelatoriosValidationError('As datas de início e fim do período são obrigatórias.');
    }
    if (!today) {
      throw new RelatoriosValidationError('A data de hoje é obrigatória para validar o período.');
    }

    const startTs = parseDateOnly(startDate);
    const endTs = parseDateOnly(endDate);
    const todayTs = parseDateOnly(today);

    if (endTs < startTs) {
      throw new RelatoriosValidationError('A data final não pode ser anterior à data inicial.');
    }
    if (endTs > todayTs) {
      throw new RelatoriosValidationError('A data final não pode ser posterior a hoje.');
    }
    if (startTs < todayTs - 730 * MS_PER_DAY) {
      throw new RelatoriosValidationError('A data inicial não pode ser mais de 730 dias antes de hoje.');
    }

    const extent = calendarExtentInDays(startDate, endDate);
    if (extent > 366) {
      throw new RelatoriosValidationError('O período não pode ter mais de 366 dias.');
    }

    if (!GRANULARITIES.includes(granularity)) {
      throw new RelatoriosValidationError('Granularidade desconhecida. Use dia, semana ou mês.');
    }
    if (granularity === 'day' && extent > 92) {
      throw new RelatoriosValidationError('A granularidade diária só é permitida em períodos de até 92 dias.');
    }

    return await this.adapter.obterFaturamentoPorPeriodo({ tenantId, startDate, endDate, granularity });
  }

  /**
   * Contrato de Equipe e Serviços (spec 038, ticket 05): mesma validação de
   * período do Faturamento por período (730 dias de olhar para trás, 366
   * dias de extensão máxima), MENOS a regra de granularidade -- este
   * relatório é um ranking de período único, sem agrupamento por dia/
   * semana/mês.
   */
  async obterEquipeEServicos(input: ObterEquipeEServicosRepositoryInput): Promise<RelatorioEquipeServicos> {
    const { tenantId, startDate, endDate, professionalId, today } = input;

    if (!tenantId || !tenantId.trim()) {
      throw new RelatoriosValidationError('ID da unidade (tenant) é obrigatório.');
    }
    if (!startDate || !endDate) {
      throw new RelatoriosValidationError('As datas de início e fim do período são obrigatórias.');
    }
    if (!today) {
      throw new RelatoriosValidationError('A data de hoje é obrigatória para validar o período.');
    }

    const startTs = parseDateOnly(startDate);
    const endTs = parseDateOnly(endDate);
    const todayTs = parseDateOnly(today);

    if (endTs < startTs) {
      throw new RelatoriosValidationError('A data final não pode ser anterior à data inicial.');
    }
    if (endTs > todayTs) {
      throw new RelatoriosValidationError('A data final não pode ser posterior a hoje.');
    }
    if (startTs < todayTs - 730 * MS_PER_DAY) {
      throw new RelatoriosValidationError('A data inicial não pode ser mais de 730 dias antes de hoje.');
    }

    const extent = calendarExtentInDays(startDate, endDate);
    if (extent > 366) {
      throw new RelatoriosValidationError('O período não pode ter mais de 366 dias.');
    }

    return await this.adapter.obterEquipeEServicos({ tenantId, startDate, endDate, professionalId });
  }
}
