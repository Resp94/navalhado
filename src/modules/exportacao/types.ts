/**
 * Exportação de Dados (spec 052, ticket 14): o Gerente baixa os clientes, os agendamentos e as comandas da barbearia em CSV, a
 * qualquer momento, inclusive com a barbearia bloqueada. A leitura é a do próprio Gerente (RLS por tenant, que não olha a
 * assinatura): o bloqueio do painel é só no front.
 *
 * As linhas abaixo são as do banco, só com o que vai para o arquivo. O token de acesso do cliente (`token_acesso`) fica de fora:
 * é credencial, não dado da barbearia.
 */

export interface ClienteParaExportar {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  tags: string[];
  acquisition_channel: string | null;
  registration_origin: string;
  cadastro_completo: boolean;
  notes: string | null;
  created_at: string;
}

export interface AgendamentoParaExportar {
  id: string;
  customer_id: string | null;
  professional_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  origin: string;
  is_fitting: boolean;
  from_waiting_list: boolean;
  canceled_by: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComandaParaExportar {
  id: string;
  appointment_id: string | null;
  customer_id: string | null;
  status: string;
  total_amount: number;
  discount_amount: number;
  discount_type: string;
  discount_percent: number | null;
  tip_amount: number;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ItemDeComandaParaExportar {
  comanda_id: string;
  item_type: string;
  service_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PagamentoDeComandaParaExportar {
  comanda_id: string;
  payment_method: string;
  amount: number;
  change_amount: number;
  paid_at: string;
}

/** Profissional, serviço ou produto: só o nome, para o arquivo dizer quem e o quê em vez de um identificador. */
export interface NomeParaExportar {
  id: string;
  name: string;
}

export interface IExportacaoAdapter {
  listarClientes(tenantId: string): Promise<ClienteParaExportar[]>;
  listarAgendamentos(tenantId: string): Promise<AgendamentoParaExportar[]>;
  listarComandas(tenantId: string): Promise<ComandaParaExportar[]>;
  listarItensDeComandas(tenantId: string): Promise<ItemDeComandaParaExportar[]>;
  listarPagamentosDeComandas(tenantId: string): Promise<PagamentoDeComandaParaExportar[]>;
  listarProfissionais(tenantId: string): Promise<NomeParaExportar[]>;
  listarServicos(tenantId: string): Promise<NomeParaExportar[]>;
  listarProdutos(tenantId: string): Promise<NomeParaExportar[]>;
}

/** Um arquivo CSV pronto para baixar. */
export interface ArquivoCsv {
  nome: string;
  conteudo: string;
}
