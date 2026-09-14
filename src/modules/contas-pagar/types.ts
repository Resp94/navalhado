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

export interface FiltroListaContasPagar {
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  status?: FiltroEstadoContaPagar;
  page?: number;
  pageSize?: number;
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
}
