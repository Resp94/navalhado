import { MS_PER_DAY, calendarExtentInDays, parseDateOnly as parseCalendarDate } from '../fluxo-caixa/calendario';
import type {
  ObterAgendaInput,
  ObterClientesInput,
  ObterClientesSemRetornoInput,
  ObterEquipeEServicosInput,
  ObterFaturamentoPorPeriodoInput,
  RelatorioAgenda,
  RelatorioClientes,
  RelatorioClientesSemRetorno,
  RelatorioClientesSemRetornoBand,
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
const OVERDUE_BANDS: RelatorioClientesSemRetornoBand[] = ['up_to_15', 'd16_30', 'd31_60', 'over_60'];

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

export interface ObterAgendaRepositoryInput extends ObterAgendaInput {
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

export interface ObterClientesRepositoryInput extends ObterClientesInput {
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

  /**
   * Contrato de Agenda (`get_schedule_report`, spec 038, ticket 07): mesma
   * validação de período do Faturamento e de Equipe e Serviços (730 dias
   * de olhar para trás, 366 dias de extensão máxima), sem granularidade --
   * relatório de período único, como Equipe e Serviços.
   */
  async obterAgenda(input: ObterAgendaRepositoryInput): Promise<RelatorioAgenda> {
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

    return await this.adapter.obterAgenda({ tenantId, startDate, endDate, professionalId });
  }

  /**
   * Contrato de Clientes sem Retorno (`get_customers_without_return`, spec
   * 038, ticket 09): SEM período -- é uma fotografia de hoje, a única
   * validação aqui é tenant, paginação (limite 1-100, deslocamento >= 0) e
   * faixa de atraso, os MESMOS limites do núcleo do banco, para o erro
   * aparecer em pt-BR antes da ida à rede (não só confiar na validação do
   * servidor).
   */
  async obterClientesSemRetorno(input: ObterClientesSemRetornoInput): Promise<RelatorioClientesSemRetorno> {
    const { tenantId, overdueBand, professionalId, limit, offset } = input;

    if (!tenantId || !tenantId.trim()) {
      throw new RelatoriosValidationError('ID da unidade (tenant) é obrigatório.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RelatoriosValidationError('O limite deve estar entre 1 e 100.');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RelatoriosValidationError('O deslocamento não pode ser negativo.');
    }
    if (overdueBand !== undefined && !OVERDUE_BANDS.includes(overdueBand)) {
      throw new RelatoriosValidationError(
        'Faixa de atraso desconhecida. Use até 15, 16 a 30, 31 a 60 ou mais de 60 dias.'
      );
    }

    return await this.adapter.obterClientesSemRetorno({ tenantId, overdueBand, professionalId, limit, offset });
  }

  /**
   * Contrato de Novos x recorrentes (`get_customer_report`, spec 038,
   * ticket 10, página "Clientes"): mesma validação de período E
   * granularidade do Faturamento por período (730 dias de olhar para trás,
   * 366 dias de extensão máxima, granularidade diária só até 92 dias) --
   * mesmos limites do núcleo do banco (`private.get_customer_report_core`),
   * reaproveitados aqui em vez de reescritos.
   */
  async obterClientes(input: ObterClientesRepositoryInput): Promise<RelatorioClientes> {
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

    return await this.adapter.obterClientes({ tenantId, startDate, endDate, granularity });
  }
}
