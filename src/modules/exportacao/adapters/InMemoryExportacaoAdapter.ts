import type {
  AgendamentoParaExportar,
  ClienteParaExportar,
  ComandaParaExportar,
  DetalhesDaExportacao,
  IExportacaoAdapter,
  ItemDeComandaParaExportar,
  NomeParaExportar,
  PagamentoDeComandaParaExportar,
} from '../types';

/** Uma linha de uma barbearia: o que o banco filtra por tenant (RLS e `.eq('tenant_id')`), o adaptador em memória filtra aqui. */
type DoTenant<T> = T & { tenant_id: string };

export interface DadosEmMemoria {
  clientes?: DoTenant<ClienteParaExportar>[];
  agendamentos?: DoTenant<AgendamentoParaExportar>[];
  comandas?: DoTenant<ComandaParaExportar>[];
  itens?: DoTenant<ItemDeComandaParaExportar>[];
  pagamentos?: DoTenant<PagamentoDeComandaParaExportar>[];
  profissionais?: DoTenant<NomeParaExportar>[];
  servicos?: DoTenant<NomeParaExportar>[];
  produtos?: DoTenant<NomeParaExportar>[];
}

export class InMemoryExportacaoAdapter implements IExportacaoAdapter {
  private readonly dados: DadosEmMemoria;
  /** O que foi para a trilha de auditoria, na ordem. */
  readonly registros: DetalhesDaExportacao[] = [];

  constructor(dados: DadosEmMemoria = {}) {
    this.dados = dados;
  }

  private do<T>(linhas: DoTenant<T>[] | undefined, tenantId: string): T[] {
    return (linhas ?? [])
      .filter((linha) => linha.tenant_id === tenantId)
      .map(({ tenant_id: _tenantId, ...resto }) => resto as unknown as T);
  }

  async listarClientes(tenantId: string) {
    return this.do(this.dados.clientes, tenantId);
  }

  async listarAgendamentos(tenantId: string) {
    return this.do(this.dados.agendamentos, tenantId);
  }

  async listarComandas(tenantId: string) {
    return this.do(this.dados.comandas, tenantId);
  }

  async listarItensDeComandas(tenantId: string) {
    return this.do(this.dados.itens, tenantId);
  }

  async listarPagamentosDeComandas(tenantId: string) {
    return this.do(this.dados.pagamentos, tenantId);
  }

  async listarProfissionais(tenantId: string) {
    return this.do(this.dados.profissionais, tenantId);
  }

  async listarServicos(tenantId: string) {
    return this.do(this.dados.servicos, tenantId);
  }

  async listarProdutos(tenantId: string) {
    return this.do(this.dados.produtos, tenantId);
  }

  async registrarExportacao(detalhes: DetalhesDaExportacao) {
    this.registros.push(detalhes);
  }
}
