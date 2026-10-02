import type { AvisoQueFalhou, DetalhesDoTenant, IProprietarioAdapter } from '../types';

export interface DadosEmMemoria {
  detalhes?: Record<string, DetalhesDoTenant>;
  avisos?: AvisoQueFalhou[];
}

export interface ChamadaRegistrada {
  acao: string;
  argumentos: unknown[];
}

/** Guarda o que o repositório pediu e devolve o que o teste preparou; quem confere estados e datas é o banco (pgTAP 78). */
export class InMemoryProprietarioAdapter implements IProprietarioAdapter {
  private readonly dados: DadosEmMemoria;
  private falha: unknown = null;
  readonly chamadas: ChamadaRegistrada[] = [];

  constructor(dados: DadosEmMemoria = {}) {
    this.dados = dados;
  }

  /** A próxima chamada, e as seguintes, falham com este erro (o que o banco devolveria). */
  falharCom(erro: unknown) {
    this.falha = erro;
  }

  private registrar(acao: string, ...argumentos: unknown[]) {
    this.chamadas.push({ acao, argumentos });
    if (this.falha !== null) throw this.falha;
  }

  async obterDetalhes(tenantId: string) {
    this.registrar('obterDetalhes', tenantId);
    const detalhes = this.dados.detalhes?.[tenantId];
    if (!detalhes) throw new Error('TENANT_NOT_FOUND');
    return detalhes;
  }

  async estenderTeste(tenantId: string, ate: string) {
    this.registrar('estenderTeste', tenantId, ate);
  }

  async darCortesia(tenantId: string, ate: string | null) {
    this.registrar('darCortesia', tenantId, ate);
  }

  async encerrarCortesia(tenantId: string) {
    this.registrar('encerrarCortesia', tenantId);
  }

  async desbloquear(tenantId: string, ate: string, motivo: string) {
    this.registrar('desbloquear', tenantId, ate, motivo);
  }

  async bloquear(tenantId: string, motivo: string) {
    this.registrar('bloquear', tenantId, motivo);
  }

  async listarAvisosQueFalharam(limite: number) {
    this.registrar('listarAvisosQueFalharam', limite);
    return this.dados.avisos ?? [];
  }
}
