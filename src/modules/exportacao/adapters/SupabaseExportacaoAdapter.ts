import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgendamentoParaExportar,
  ClienteParaExportar,
  ComandaParaExportar,
  IExportacaoAdapter,
  ItemDeComandaParaExportar,
  NomeParaExportar,
  PagamentoDeComandaParaExportar,
} from '../types';

/** O PostgREST devolve no máximo 1000 linhas por pedido: a leitura anda de página em página até uma voltar curta. */
export const TAMANHO_DA_PAGINA = 1000;

// Só o que vai para o arquivo. O token de acesso do cliente (`token_acesso`) é credencial e fica de fora, por isso nenhuma
// leitura usa `*`.
const COLUNAS_DE_CLIENTES =
  'id, name, phone, email, cpf, birth_date, tags, acquisition_channel, registration_origin, cadastro_completo, notes, created_at';
const COLUNAS_DE_AGENDAMENTOS =
  'id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting, from_waiting_list, canceled_by, cancellation_reason, notes, created_at';
const COLUNAS_DE_COMANDAS =
  'id, appointment_id, customer_id, status, total_amount, discount_amount, discount_type, discount_percent, tip_amount, notes, created_at, closed_at';
const COLUNAS_DE_ITENS = 'comanda_id, item_type, service_id, product_id, quantity, unit_price, total_price';
const COLUNAS_DE_PAGAMENTOS = 'comanda_id, payment_method, amount, change_amount, paid_at';

type Linha = Record<string, any>;

/**
 * Lê com a sessão do Gerente que está logado: quem limita as linhas é a RLS por tenant, que não olha a assinatura (por isso o
 * Gerente de uma barbearia bloqueada também lê); o `eq('tenant_id', ...)` só repete, em voz alta, de quem são os dados.
 */
export class SupabaseExportacaoAdapter implements IExportacaoAdapter {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  private async lerTudo(tabela: string, colunas: string, tenantId: string): Promise<Linha[]> {
    const linhas: Linha[] = [];
    for (let de = 0; ; de += TAMANHO_DA_PAGINA) {
      const { data, error } = await this.supabase
        .from(tabela)
        .select(colunas)
        .eq('tenant_id', tenantId)
        .order('id')
        .range(de, de + TAMANHO_DA_PAGINA - 1);
      if (error) throw error;
      const pagina = (data ?? []) as unknown as Linha[];
      linhas.push(...pagina);
      if (pagina.length < TAMANHO_DA_PAGINA) return linhas;
    }
  }

  async listarClientes(tenantId: string): Promise<ClienteParaExportar[]> {
    const linhas = await this.lerTudo('customers', COLUNAS_DE_CLIENTES, tenantId);
    return linhas.map((linha) => ({ ...linha, tags: linha.tags ?? [] }) as ClienteParaExportar);
  }

  async listarAgendamentos(tenantId: string): Promise<AgendamentoParaExportar[]> {
    const linhas = await this.lerTudo('appointments', COLUNAS_DE_AGENDAMENTOS, tenantId);
    return linhas as AgendamentoParaExportar[];
  }

  async listarComandas(tenantId: string): Promise<ComandaParaExportar[]> {
    const linhas = await this.lerTudo('comandas', COLUNAS_DE_COMANDAS, tenantId);
    return linhas.map(
      (linha) =>
        ({
          ...linha,
          total_amount: Number(linha.total_amount),
          discount_amount: Number(linha.discount_amount),
          tip_amount: Number(linha.tip_amount),
          discount_percent: linha.discount_percent === null ? null : Number(linha.discount_percent),
        }) as ComandaParaExportar,
    );
  }

  async listarItensDeComandas(tenantId: string): Promise<ItemDeComandaParaExportar[]> {
    const linhas = await this.lerTudo('comanda_itens', COLUNAS_DE_ITENS, tenantId);
    return linhas.map(
      (linha) =>
        ({ ...linha, quantity: Number(linha.quantity), unit_price: Number(linha.unit_price), total_price: Number(linha.total_price) }) as ItemDeComandaParaExportar,
    );
  }

  async listarPagamentosDeComandas(tenantId: string): Promise<PagamentoDeComandaParaExportar[]> {
    const linhas = await this.lerTudo('comanda_pagamentos', COLUNAS_DE_PAGAMENTOS, tenantId);
    return linhas.map(
      (linha) => ({ ...linha, amount: Number(linha.amount), change_amount: Number(linha.change_amount) }) as PagamentoDeComandaParaExportar,
    );
  }

  listarProfissionais(tenantId: string): Promise<NomeParaExportar[]> {
    return this.lerTudo('professionals', 'id, name', tenantId) as Promise<NomeParaExportar[]>;
  }

  listarServicos(tenantId: string): Promise<NomeParaExportar[]> {
    return this.lerTudo('services', 'id, name', tenantId) as Promise<NomeParaExportar[]>;
  }

  listarProdutos(tenantId: string): Promise<NomeParaExportar[]> {
    return this.lerTudo('products', 'id, name', tenantId) as Promise<NomeParaExportar[]>;
  }
}
