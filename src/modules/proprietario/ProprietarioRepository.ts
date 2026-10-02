import type { AvisoQueFalhou, DetalhesDoTenant, IProprietarioAdapter } from './types';

export class ProprietarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProprietarioError';
  }
}

const MENSAGEM_PADRAO = 'Não foi possível concluir. Tente de novo.';

// O que as funções `admin_*` do banco devolvem em `message` (raise exception 'CODIGO') e o que o Proprietário lê no lugar.
const MENSAGENS_DO_BANCO: Record<string, string> = {
  ADMIN_ONLY: 'Só o Proprietário pode fazer isso.',
  SUBSCRIPTION_NOT_FOUND: 'Esta barbearia não tem assinatura.',
  TENANT_NOT_FOUND: 'Barbearia não encontrada.',
  INVALID_DATE: 'A data precisa ser de hoje em diante e, para estender o teste, depois do fim dele.',
  REASON_REQUIRED: 'Informe o motivo.',
  NOT_IN_TRIAL: 'Só dá para estender o teste de quem está em teste ou teve o teste ou a cortesia vencidos.',
  NOT_COURTESY: 'Esta barbearia não está em cortesia.',
  NOT_BLOCKED: 'Esta barbearia não está bloqueada.',
  ALREADY_BLOCKED: 'Esta barbearia já está bloqueada.',
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O PostgREST devolve o erro como um objeto com `message`, e não como uma instância de Error. */
function codigoDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'object' && erro !== null && 'message' in erro) return String((erro as { message: unknown }).message);
  return '';
}

/**
 * Ferramentas do Proprietário (spec 052, ticket 15): estender o teste, dar e tirar a cortesia, desbloquear e bloquear uma barbearia
 * e ler os detalhes da assinatura. As datas são dias (AAAA-MM-DD) no fuso da barbearia, e quem confere o estado e a data é o banco;
 * aqui se recusa o que nem precisa ir lá (barbearia, dia e motivo em branco ou no formato errado) e se traduz o erro dele.
 */
export class ProprietarioRepository {
  private readonly adapter: IProprietarioAdapter;

  constructor(adapter: IProprietarioAdapter) {
    this.adapter = adapter;
  }

  private barbearia(tenantId: string): string {
    if (!tenantId?.trim()) throw new ProprietarioError('Barbearia não identificada.');
    return tenantId;
  }

  private dia(dia: string): string {
    if (!DIA.test(dia)) throw new ProprietarioError('Informe a data.');
    return dia;
  }

  private motivo(motivo: string): string {
    const limpo = motivo.trim();
    if (!limpo) throw new ProprietarioError('Informe o motivo.');
    return limpo;
  }

  private async executar<T>(chamada: () => Promise<T>): Promise<T> {
    try {
      return await chamada();
    } catch (erro) {
      if (erro instanceof ProprietarioError) throw erro;
      const mensagem = MENSAGENS_DO_BANCO[codigoDoErro(erro)];
      if (!mensagem) console.error('Erro nas ferramentas do Proprietário:', erro);
      throw new ProprietarioError(mensagem ?? MENSAGEM_PADRAO);
    }
  }

  detalhesDoTenant(tenantId: string): Promise<DetalhesDoTenant> {
    return this.executar(() => this.adapter.obterDetalhes(this.barbearia(tenantId)));
  }

  /** O teste vai até o fim do dia `ate`; só vale para quem está em teste, ou teve o teste ou a cortesia vencidos. */
  estenderTeste(tenantId: string, ate: string): Promise<void> {
    return this.executar(() => this.adapter.estenderTeste(this.barbearia(tenantId), this.dia(ate)));
  }

  /** Sem `ate`, a cortesia não tem fim. Não toca o Mercado Pago. */
  darCortesia(tenantId: string, ate: string | null): Promise<void> {
    return this.executar(() => this.adapter.darCortesia(this.barbearia(tenantId), ate === null ? null : this.dia(ate)));
  }

  /** A cortesia termina agora e a barbearia fica bloqueada. */
  encerrarCortesia(tenantId: string): Promise<void> {
    return this.executar(() => this.adapter.encerrarCortesia(this.barbearia(tenantId)));
  }

  /** Libera uma barbearia bloqueada até o fim do dia `ate`; o motivo fica na trilha de auditoria. */
  desbloquear(tenantId: string, ate: string, motivo: string): Promise<void> {
    return this.executar(() => this.adapter.desbloquear(this.barbearia(tenantId), this.dia(ate), this.motivo(motivo)));
  }

  /** Bloqueia na hora (no relógio do banco); o motivo fica na trilha de auditoria. */
  bloquear(tenantId: string, motivo: string): Promise<void> {
    return this.executar(() => this.adapter.bloquear(this.barbearia(tenantId), this.motivo(motivo)));
  }

  avisosQueFalharam(limite = 50): Promise<AvisoQueFalhou[]> {
    return this.executar(() => this.adapter.listarAvisosQueFalharam(limite));
  }
}
