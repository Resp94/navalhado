// Módulo Contas a Pagar (spec 036). Ticket 06: lançar conta avulsa e listar
// paginado. Série (colunas sempre nulas neste ticket), Baixa, Estorno de
// Baixa, cancelamento, edição, totais e alerta chegam nos tickets 07 a 15.
//
// Sem adaptador em memória: as regras que dariam profundidade a um adaptador
// falso (estado amarrado ao valor, calendário da Série, saldo da gaveta)
// vivem no banco. Os testes de repositório usam o adaptador simulado
// (`vi.fn()`), como nos demais módulos financeiros do projeto.

export type EstadoContaPagar = 'open' | 'partially_paid' | 'paid' | 'cancelled';

/** Estado devolvido pela lista: igual a `status`, exceto que vira 'overdue' quando vencida. */
export type SituacaoContaPagar = 'open' | 'partially_paid' | 'paid' | 'cancelled' | 'overdue';

/** Faixa de destaque da lista, calculada a partir do dia de negócio do tenant no servidor. */
export type FaixaDestaqueContaPagar = 'overdue' | 'due_today' | 'due_soon' | null;

/** Filtro de estado aceito pela leitura paginada. */
export type FiltroEstadoContaPagar = 'not_cancelled' | 'open' | 'overdue' | 'paid' | 'cancelled';

export interface ContaPagar {
  id: string;
  tenant_id: string;
  description: string;
  category_id: string;
  supplier_id: string | null;
  amount: number;
  paid_amount: number;
  status: EstadoContaPagar;
  due_date: string;
  competence_date: string;
  document_number: string | null;
  notes: string | null;
  series_id: string | null;
  series_position: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

/** Linha da lista paginada: a Conta a Pagar com o que o servidor já derivou para exibição. */
export interface ContaPagarListada {
  id: string;
  description: string;
  category_id: string;
  category_name: string;
  category_archived: boolean;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_archived: boolean | null;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: EstadoContaPagar;
  situation: SituacaoContaPagar;
  highlight: FaixaDestaqueContaPagar;
  due_date: string;
  competence_date: string;
  document_number: string | null;
  notes: string | null;
  series_id: string | null;
  series_position: number | null;
  created_at: string;
}

export interface ListaContasPagarResultado {
  contas: ContaPagarListada[];
  totalCount: number;
}

/** Detalhe de uma Conta a Pagar (ticket 07/036): a linha da lista, mais autoria completa. */
export interface ContaPagarDetalhe extends ContaPagarListada {
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
  /** Resumo da Série (ticket 11/036): presente só quando a conta pertence a uma. */
  seriesType: TipoSerie | null;
  seriesPeriodicity: PeriodicidadeSerie | null;
  seriesOccurrencesCount: number | null;
  /**
   * Aviso de fim próximo (ticket 14/036): true quando a Série é uma
   * Recorrência cuja última ocorrência não está cancelada e vence em até 60
   * dias do dia de negócio do tenant. Sempre null/false num Parcelamento ou
   * fora de uma Série.
   */
  seriesEndingSoon: boolean | null;
  seriesLastDueDate: string | null;
}

/** Tipo de Série (ticket 11/036): Recorrência aqui, Parcelamento chega no ticket 12/036. */
export type TipoSerie = 'installment' | 'recurring';

/** Periodicidade da Série. Quinzenal usa catorze dias, não quinze, para manter o dia da semana. */
export type PeriodicidadeSerie = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/** Uma linha da prévia (ticket 11/036): mesmo cálculo usado na criação, nunca replicado no navegador. */
export interface OcorrenciaPreviaSerie {
  position: number;
  dueDate: string;
  amount: number;
}

export interface FiltroPreviaSerie {
  seriesType: TipoSerie;
  periodicity: PeriodicidadeSerie;
  anchorDate: string;
  occurrences: number;
  amount: number;
}

/** Dados de criação de uma Recorrência (ticket 11/036): 1 a 60 ocorrências, mesmo valor. */
export interface DadosRecorrencia {
  description: string;
  categoryId: string;
  periodicity: PeriodicidadeSerie;
  anchorDate: string;
  occurrences: number;
  amount: number;
  supplierId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
}

/**
 * Dados de criação de um Parcelamento (ticket 12/036): 2 a 60 parcelas a
 * partir de um valor total, competência única (padrão: vencimento da
 * primeira parcela). A numeração "i/N" é derivada na leitura, nunca gravada.
 */
export interface DadosParcelamento {
  description: string;
  categoryId: string;
  periodicity: PeriodicidadeSerie;
  anchorDate: string;
  occurrences: number;
  /** Valor total da compra — dividido truncado em centavos, resíduo na última parcela. */
  totalAmount: number;
  competenceDate?: string | null;
  supplierId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
}

/** Forma de pagamento da Baixa (ticket 07/036): domínio próprio, não o de Comanda. */
export type FormaPagamentoBaixa =
  | 'cash'
  | 'pix'
  | 'transfer'
  | 'boleto'
  | 'credit_card'
  | 'debit_card'
  | 'automatic_debit'
  | 'other';

/** Origem do dinheiro de uma Baixa. `gaveta` só é aceita a partir do ticket 15/036. */
export type OrigemDinheiroBaixa = 'gaveta' | 'fora_do_caixa';

export interface Baixa {
  id: string;
  principal: number;
  interestAmount: number;
  discountAmount: number;
  paidAmount: number;
  paymentDate: string;
  paymentMethod: FormaPagamentoBaixa;
  source: OrigemDinheiroBaixa;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
  reversedByName: string | null;
  reversalReason: string | null;
}

export interface DadosBaixa {
  principal: number;
  paymentDate: string;
  paymentMethod: FormaPagamentoBaixa;
  interestAmount?: number;
  discountAmount?: number;
  source?: OrigemDinheiroBaixa;
  cashSessionId?: string | null;
}

/** Dados de edição individual (ticket 08/036): mesmos campos do lançamento avulso. */
export interface DadosEdicaoContaPagar {
  description: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  supplierId?: string | null;
  competenceDate?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
}

/** Alcance de uma edição ou cancelamento em Série (ticket 13/036). */
export type AlcanceOperacaoSerie = 'apenas_esta' | 'esta_e_seguintes';

/**
 * Dados de edição em lote de uma Série (ticket 13/036), a partir de uma
 * ocorrência escolhida: "esta e as seguintes em aberto". Vencimento,
 * documento e competência não se editam em lote -- só individualmente
 * (ticket 08/036). Valor só se aplica na Recorrência: a RPC recusa quando a
 * Série é um Parcelamento.
 */
export interface DadosEdicaoSerie {
  description: string;
  categoryId: string;
  supplierId?: string | null;
  notes?: string | null;
  amount?: number | null;
}

/**
 * Uma ocorrência atingida por uma operação em Série (ticket 13/036): paga,
 * parcialmente paga e já cancelada são sempre ignoradas, nunca alteradas.
 */
export interface OcorrenciaAtingidaSerie {
  id: string;
  seriesPosition: number;
  status: EstadoContaPagar;
  ignored: boolean;
  ignoreReason: string | null;
}

/**
 * Uma linha da prévia de extensão de uma Recorrência (ticket 14/036): mesmo
 * cálculo da extensão de fato, nunca replicado no navegador.
 */
export interface OcorrenciaPreviaExtensaoSerie {
  seriesPosition: number;
  dueDate: string;
  amount: number;
}

export interface FiltroListaContasPagar {
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  status?: FiltroEstadoContaPagar;
  page?: number;
  pageSize?: number;
  categoryId?: string | null;
  supplierId?: string | null;
}

/** Filtro de totais (ticket 09/036): período, categoria e fornecedor — ignora o estado. */
export interface FiltroTotaisContasPagar {
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
}

/**
 * Totais do filtro (ticket 09/036): saldo em aberto (destacando o vencido) e
 * pago no período. Ignora o filtro de estado — senão o pago zeraria ao
 * filtrar vencidas.
 */
export interface TotaisContasPagar {
  openBalance: number;
  overdueBalance: number;
  paidInPeriod: number;
}

/**
 * Alerta de vencidas (ticket 09/036): quantidade e saldo das contas vencidas
 * e das que vencem hoje, sem filtro de período.
 */
export interface AlertaContasPagar {
  overdueCount: number;
  overdueBalance: number;
  dueTodayCount: number;
  dueTodayBalance: number;
}

export interface DadosContaPagarAvulsa {
  description: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  supplierId?: string | null;
  competenceDate?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
}

/**
 * Interface do adaptador de Contas a Pagar, com métodos em português. O
 * repositório normaliza e valida a entrada antes de delegar: os adaptadores
 * recebem os dados já normalizados. A RPC do Supabase normaliza de novo,
 * como autoridade sob concorrência (mesmo padrão do Plano de Contas).
 */
export interface IContasPagarAdapter {
  criarContaAvulsa(tenantId: string, dados: DadosContaPagarAvulsa): Promise<ContaPagar>;
  listarContas(
    tenantId: string,
    filtro: FiltroListaContasPagar
  ): Promise<ListaContasPagarResultado>;
  obterConta(tenantId: string, payableId: string): Promise<ContaPagarDetalhe>;
  darBaixa(tenantId: string, payableId: string, dados: DadosBaixa): Promise<Baixa>;
  estornarBaixa(tenantId: string, settlementId: string, motivo: string): Promise<Baixa>;
  listarBaixas(tenantId: string, payableId: string): Promise<Baixa[]>;
  editarConta(tenantId: string, payableId: string, dados: DadosEdicaoContaPagar): Promise<ContaPagar>;
  cancelarConta(tenantId: string, payableId: string, motivo: string): Promise<ContaPagar>;
  obterTotais(tenantId: string, filtro: FiltroTotaisContasPagar): Promise<TotaisContasPagar>;
  obterAlerta(tenantId: string): Promise<AlertaContasPagar>;
  visualizarPreviaSerie(tenantId: string, filtro: FiltroPreviaSerie): Promise<OcorrenciaPreviaSerie[]>;
  criarRecorrencia(tenantId: string, dados: DadosRecorrencia): Promise<ContaPagar[]>;
  criarParcelamento(tenantId: string, dados: DadosParcelamento): Promise<ContaPagar[]>;
  editarSerie(
    tenantId: string,
    payableId: string,
    dados: DadosEdicaoSerie
  ): Promise<OcorrenciaAtingidaSerie[]>;
  cancelarSerie(tenantId: string, payableId: string, motivo: string): Promise<OcorrenciaAtingidaSerie[]>;
  visualizarPreviaExtensaoSerie(
    tenantId: string,
    seriesId: string,
    occurrences: number
  ): Promise<OcorrenciaPreviaExtensaoSerie[]>;
  estenderRecorrencia(
    tenantId: string,
    seriesId: string,
    occurrences: number
  ): Promise<ContaPagar[]>;
}
