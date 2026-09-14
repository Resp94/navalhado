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
}
