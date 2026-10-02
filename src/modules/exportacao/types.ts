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
  tip_professional_id: string | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ItemDeComandaParaExportar {
  id: string;
  comanda_id: string;
  item_type: string;
  service_id: string | null;
  product_id: string | null;
  professional_id: string | null;
  quantity: number;
  unit_price: number;
}

export interface PagamentoDeComandaParaExportar {
  id: string;
  comanda_id: string;
  payment_method: string;
  amount: number;
  change_amount: number;
  paid_at: string;
}

/** Profissional, serviço ou produto: o ID e o nome, para o arquivo dizer quem e o quê e poder ser cruzado pelo ID. */
export interface NomeParaExportar {
  id: string;
  name: string;
}

/** `sinal` para uma leitura em andamento quando a exportação falha em outra tabela ou quem pediu saiu da tela. */
export interface OpcoesDeLeitura {
  sinal?: AbortSignal;
}

/** O que fica na trilha de auditoria: quantos arquivos e quantas linhas saíram, sem nenhum dado do cliente. */
export interface DetalhesDaExportacao {
  arquivos: number;
  linhas: { clientes: number; agendamentos: number; comandas: number };
}

export interface IExportacaoAdapter {
  listarClientes(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ClienteParaExportar[]>;
  listarAgendamentos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<AgendamentoParaExportar[]>;
  listarComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ComandaParaExportar[]>;
  listarItensDeComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<ItemDeComandaParaExportar[]>;
  listarPagamentosDeComandas(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<PagamentoDeComandaParaExportar[]>;
  listarProfissionais(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]>;
  listarServicos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]>;
  listarProdutos(tenantId: string, opcoes?: OpcoesDeLeitura): Promise<NomeParaExportar[]>;
  /** Deixa na trilha de auditoria (`audit_logs`) que a barbearia exportou os dados: quem, quando e quanto. */
  registrarExportacao(detalhes: DetalhesDaExportacao): Promise<void>;
}

/** O que `gerarArquivos` aceita além da barbearia e do fuso. */
export interface OpcoesDaExportacao {
  /** O instante da exportação (o dia do nome do arquivo); por padrão, agora. */
  agora?: Date;
  /** Cancela as leituras e a montagem quando quem pediu saiu da tela. */
  sinal?: AbortSignal;
}

/** Um arquivo CSV pronto para baixar. */
export interface ArquivoCsv {
  nome: string;
  conteudo: string;
}
