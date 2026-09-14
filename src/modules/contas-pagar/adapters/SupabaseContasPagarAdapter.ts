import type { SupabaseClient } from '@supabase/supabase-js';
import { ContasPagarValidationError } from '../ContasPagarRepository';
import type {
  AlertaContasPagar,
  Baixa,
  ContaPagar,
  ContaPagarDetalhe,
  ContaPagarListada,
  DadosBaixa,
  DadosContaPagarAvulsa,
  DadosEdicaoContaPagar,
  FiltroListaContasPagar,
  FiltroTotaisContasPagar,
  IContasPagarAdapter,
  ListaContasPagarResultado,
  TotaisContasPagar,
} from '../types';

interface ErroPostgrest {
  code?: string;
  message?: string;
}

function traduzirErro(error: ErroPostgrest): Error {
  return new ContasPagarValidationError(error.message || 'Não foi possível concluir a operação.');
}

/** Linha bruta devolvida por `list_payables` (números como `numeric` do Postgres, string ou number). */
interface ListaContasPagarRow {
  id: string;
  description: string;
  category_id: string;
  category_name: string;
  category_archived: boolean;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_archived: boolean | null;
  amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  status: ContaPagarListada['status'];
  situation: ContaPagarListada['situation'];
  highlight: ContaPagarListada['highlight'];
  due_date: string;
  competence_date: string;
  document_number: string | null;
  notes: string | null;
  series_id: string | null;
  series_position: number | null;
  created_at: string;
  total_count: number | string;
}

function mapearLinhaLista(row: ListaContasPagarRow): ContaPagarListada {
  return {
    id: row.id,
    description: row.description,
    category_id: row.category_id,
    category_name: row.category_name,
    category_archived: row.category_archived,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier_name,
    supplier_archived: row.supplier_archived,
    amount: Number(row.amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    remaining_amount: Number(row.remaining_amount) || 0,
    status: row.status,
    situation: row.situation,
    highlight: row.highlight,
    due_date: row.due_date,
    competence_date: row.competence_date,
    document_number: row.document_number,
    notes: row.notes,
    series_id: row.series_id,
    series_position: row.series_position,
    created_at: row.created_at,
  };
}

/** Linha bruta devolvida por `get_payable` (mesmas colunas de `list_payables`, mais autoria). */
interface ContaPagarDetalheRow extends ListaContasPagarRow {
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancelled_by_name: string | null;
  cancellation_reason: string | null;
}

function mapearLinhaDetalhe(row: ContaPagarDetalheRow): ContaPagarDetalhe {
  return {
    ...mapearLinhaLista(row),
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancelledByName: row.cancelled_by_name,
    cancellationReason: row.cancellation_reason,
  };
}

/** Linha bruta devolvida por `settle_payable`/`reverse_payable_settlement`/`list_payable_settlements`. */
interface BaixaRow {
  id: string;
  principal: number | string;
  interest_amount: number | string;
  discount_amount: number | string;
  paid_amount: number | string;
  payment_date: string;
  payment_method: Baixa['paymentMethod'];
  source: Baixa['source'];
  created_at: string;
  created_by: string | null;
  created_by_name?: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversed_by_name?: string | null;
  reversal_reason: string | null;
}

function mapearBaixa(row: BaixaRow): Baixa {
  return {
    id: row.id,
    principal: Number(row.principal) || 0,
    interestAmount: Number(row.interest_amount) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    paidAmount: Number(row.paid_amount) || 0,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    reversedByName: row.reversed_by_name ?? null,
    reversalReason: row.reversal_reason,
  };
}

/** Linha bruta devolvida por `get_payables_totals`. */
interface TotaisRow {
  open_balance: number | string;
  overdue_balance: number | string;
  paid_in_period: number | string;
}

function mapearTotais(row: TotaisRow): TotaisContasPagar {
  return {
    openBalance: Number(row.open_balance) || 0,
    overdueBalance: Number(row.overdue_balance) || 0,
    paidInPeriod: Number(row.paid_in_period) || 0,
  };
}

/** Linha bruta devolvida por `get_payables_alert`. */
interface AlertaRow {
  overdue_count: number | string;
  overdue_balance: number | string;
  due_today_count: number | string;
  due_today_balance: number | string;
}

function mapearAlerta(row: AlertaRow): AlertaContasPagar {
  return {
    overdueCount: Number(row.overdue_count) || 0,
    overdueBalance: Number(row.overdue_balance) || 0,
    dueTodayCount: Number(row.due_today_count) || 0,
    dueTodayBalance: Number(row.due_today_balance) || 0,
  };
}

export class SupabaseContasPagarAdapter implements IContasPagarAdapter {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async criarContaAvulsa(tenantId: string, dados: DadosContaPagarAvulsa): Promise<ContaPagar> {
    const { data, error } = await this.supabase.rpc('create_payable', {
      p_description: dados.description,
      p_category_id: dados.categoryId,
      p_amount: dados.amount,
      p_due_date: dados.dueDate,
      p_supplier_id: dados.supplierId ?? null,
      p_competence_date: dados.competenceDate ?? null,
      p_document_number: dados.documentNumber ?? null,
      p_notes: dados.notes ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as ContaPagar;
  }

  async listarContas(
    tenantId: string,
    filtro: FiltroListaContasPagar
  ): Promise<ListaContasPagarResultado> {
    const { data, error } = await this.supabase.rpc('list_payables', {
      p_due_date_from: filtro.dueDateFrom ?? null,
      p_due_date_to: filtro.dueDateTo ?? null,
      p_status: filtro.status ?? 'not_cancelled',
      p_page: filtro.page ?? 1,
      p_page_size: filtro.pageSize ?? 20,
      p_tenant_id: tenantId,
      p_category_id: filtro.categoryId ?? null,
      p_supplier_id: filtro.supplierId ?? null,
    });

    if (error) throw traduzirErro(error);
    const linhas = (data as ListaContasPagarRow[]) || [];
    return {
      contas: linhas.map(mapearLinhaLista),
      totalCount: linhas.length > 0 ? Number(linhas[0].total_count) || 0 : 0,
    };
  }

  async obterConta(tenantId: string, payableId: string): Promise<ContaPagarDetalhe> {
    const { data, error } = await this.supabase.rpc('get_payable', {
      p_payable_id: payableId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    const linhas = (data as ContaPagarDetalheRow[]) || [];
    if (linhas.length === 0) {
      throw new ContasPagarValidationError('Conta a pagar não encontrada.');
    }
    return mapearLinhaDetalhe(linhas[0]);
  }

  async darBaixa(tenantId: string, payableId: string, dados: DadosBaixa): Promise<Baixa> {
    const { data, error } = await this.supabase.rpc('settle_payable', {
      p_payable_id: payableId,
      p_principal: dados.principal,
      p_payment_date: dados.paymentDate,
      p_payment_method: dados.paymentMethod,
      p_interest_amount: dados.interestAmount ?? 0,
      p_discount_amount: dados.discountAmount ?? 0,
      p_source: dados.source ?? 'fora_do_caixa',
      p_cash_session_id: dados.cashSessionId ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearBaixa(data as BaixaRow);
  }

  async estornarBaixa(tenantId: string, settlementId: string, motivo: string): Promise<Baixa> {
    const { data, error } = await this.supabase.rpc('reverse_payable_settlement', {
      p_settlement_id: settlementId,
      p_reason: motivo,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearBaixa(data as BaixaRow);
  }

  async listarBaixas(tenantId: string, payableId: string): Promise<Baixa[]> {
    const { data, error } = await this.supabase.rpc('list_payable_settlements', {
      p_payable_id: payableId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return ((data as BaixaRow[]) || []).map(mapearBaixa);
  }

  async editarConta(
    tenantId: string,
    payableId: string,
    dados: DadosEdicaoContaPagar
  ): Promise<ContaPagar> {
    const { data, error } = await this.supabase.rpc('update_payable', {
      p_payable_id: payableId,
      p_description: dados.description,
      p_category_id: dados.categoryId,
      p_amount: dados.amount,
      p_due_date: dados.dueDate,
      p_supplier_id: dados.supplierId ?? null,
      p_competence_date: dados.competenceDate ?? null,
      p_document_number: dados.documentNumber ?? null,
      p_notes: dados.notes ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as ContaPagar;
  }

  async cancelarConta(tenantId: string, payableId: string, motivo: string): Promise<ContaPagar> {
    const { data, error } = await this.supabase.rpc('cancel_payable', {
      p_payable_id: payableId,
      p_reason: motivo,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as ContaPagar;
  }

  async obterTotais(
    tenantId: string,
    filtro: FiltroTotaisContasPagar
  ): Promise<TotaisContasPagar> {
    const { data, error } = await this.supabase.rpc('get_payables_totals', {
      p_due_date_from: filtro.dueDateFrom ?? null,
      p_due_date_to: filtro.dueDateTo ?? null,
      p_category_id: filtro.categoryId ?? null,
      p_supplier_id: filtro.supplierId ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    const linhas = (data as TotaisRow[]) || [];
    return mapearTotais(linhas[0] || { open_balance: 0, overdue_balance: 0, paid_in_period: 0 });
  }

  async obterAlerta(tenantId: string): Promise<AlertaContasPagar> {
    const { data, error } = await this.supabase.rpc('get_payables_alert', {
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    const linhas = (data as AlertaRow[]) || [];
    return mapearAlerta(
      linhas[0] || { overdue_count: 0, overdue_balance: 0, due_today_count: 0, due_today_balance: 0 }
    );
  }
}
