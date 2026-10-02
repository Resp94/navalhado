import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgendamentoParaExportar,
  ClienteParaExportar,
  ComandaParaExportar,
  DetalhesDaExportacao,
  IExportacaoAdapter,
  ItemDeComandaParaExportar,
  NomeParaExportar,
  OpcoesDeLeitura,
  PagamentoDeComandaParaExportar,
} from '../types';

/** Quantas linhas se pedem por vez. O PostgREST limita o que devolve ("Max rows" da API do projeto, 1000 por padrão). */
export const TAMANHO_DA_PAGINA = 1000;

// Só o que vai para o arquivo. O token de acesso do cliente (`token_acesso`) é credencial e fica de fora, por isso nenhuma
// leitura usa `*`.
const COLUNAS_DE_CLIENTES =
  'id, name, phone, email, cpf, birth_date, tags, acquisition_channel, registration_origin, cadastro_completo, notes, created_at';
const COLUNAS_DE_AGENDAMENTOS =
  'id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting, from_waiting_list, canceled_by, cancellation_reason, notes, created_at';
const COLUNAS_DE_COMANDAS =
  'id, appointment_id, customer_id, status, total_amount, discount_amount, discount_type, discount_percent, tip_amount, tip_professional_id, notes, created_at, closed_at';
const COLUNAS_DE_ITENS = 'id, comanda_id, item_type, service_id, product_id, professional_id, quantity, unit_price';
const COLUNAS_DE_PAGAMENTOS = 'id, comanda_id, payment_method, amount, change_amount, paid_at';

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

  /**
   * Lê a tabela inteira da barbearia, em ordem de `id`, de página em página a partir do último `id` lido (e não por posição):
   * uma linha que entra ou sai no meio da leitura não faz outra se repetir nem se perder. Só uma página vazia termina a leitura:
   * uma página curta pode ser só o "Max rows" do servidor menor que a página pedida. Com o índice `(tenant_id, id)` cada página é
   * uma leitura de faixa.
   */
  private async lerTudo(tabela: string, colunas: string, tenantId: string, sinal?: AbortSignal): Promise<Linha[]> {
    const linhas: Linha[] = [];
    let ultimoId: string | null = null;
    for (;;) {
      if (sinal?.aborted) throw new Error('A leitura dos dados foi cancelada.');
      let consulta = this.supabase.from(tabela).select(colunas).eq('tenant_id', tenantId);
      if (ultimoId !== null) consulta = consulta.gt('id', ultimoId);
      consulta = consulta.order('id').limit(TAMANHO_DA_PAGINA);
      if (sinal) consulta = consulta.abortSignal(sinal);

      const { data, error } = await consulta;
      if (error) throw error;
      const pagina = (data ?? []) as unknown as Linha[];
      if (pagina.length === 0) return linhas;
      linhas.push(...pagina);
      ultimoId = String(pagina[pagina.length - 1].id);
    }
  }

  async listarClientes(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ClienteParaExportar[]> {
    const linhas = await this.lerTudo('customers', COLUNAS_DE_CLIENTES, tenantId, opcoes?.sinal);
    return linhas.map((linha) => ({ ...linha, tags: linha.tags ?? [] }) as ClienteParaExportar);
  }

  async listarAgendamentos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<AgendamentoParaExportar[]> {
    const linhas = await this.lerTudo('appointments', COLUNAS_DE_AGENDAMENTOS, tenantId, opcoes?.sinal);
    return linhas as AgendamentoParaExportar[];
  }

  async listarComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ComandaParaExportar[]> {
    const linhas = await this.lerTudo('comandas', COLUNAS_DE_COMANDAS, tenantId, opcoes?.sinal);
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

  async listarItensDeComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ItemDeComandaParaExportar[]> {
    const linhas = await this.lerTudo('comanda_itens', COLUNAS_DE_ITENS, tenantId, opcoes?.sinal);
    return linhas.map((linha) => ({ ...linha, quantity: Number(linha.quantity), unit_price: Number(linha.unit_price) }) as ItemDeComandaParaExportar);
  }

  async listarPagamentosDeComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<PagamentoDeComandaParaExportar[]> {
    const linhas = await this.lerTudo('comanda_pagamentos', COLUNAS_DE_PAGAMENTOS, tenantId, opcoes?.sinal);
    return linhas.map(
      (linha) => ({ ...linha, amount: Number(linha.amount), change_amount: Number(linha.change_amount) }) as PagamentoDeComandaParaExportar,
    );
  }

  listarProfissionais(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]> {
    return this.lerTudo('professionals', 'id, name', tenantId, opcoes?.sinal) as Promise<NomeParaExportar[]>;
  }

  listarServicos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]> {
    return this.lerTudo('services', 'id, name', tenantId, opcoes?.sinal) as Promise<NomeParaExportar[]>;
  }

  listarProdutos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]> {
    return this.lerTudo('products', 'id, name', tenantId, opcoes?.sinal) as Promise<NomeParaExportar[]>;
  }

  /**
   * `log_audit_event` grava em `audit_logs` a barbearia e o usuário da sessão (ninguém registra em nome de outra barbearia), e
   * serve também a barbearia bloqueada, que é quem mais precisa exportar.
   */
  async registrarExportacao(detalhes: DetalhesDaExportacao): Promise<void> {
    const { error } = await this.supabase.rpc('log_audit_event', {
      p_action: 'tenant_data_exported',
      p_resource: 'tenant',
      p_details: detalhes,
    });
    if (error) throw error;
  }
}
