import type { SupabaseClient } from '@supabase/supabase-js';
import { ContasPagarValidationError } from '../ContasPagarRepository';
import type {
  ContaPagar,
  ContaPagarListada,
  DadosContaPagarAvulsa,
  FiltroListaContasPagar,
  IContasPagarAdapter,
  ListaContasPagarResultado,
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
    });

    if (error) throw traduzirErro(error);
    const linhas = (data as ListaContasPagarRow[]) || [];
    return {
      contas: linhas.map(mapearLinhaLista),
      totalCount: linhas.length > 0 ? Number(linhas[0].total_count) || 0 : 0,
    };
  }
}
