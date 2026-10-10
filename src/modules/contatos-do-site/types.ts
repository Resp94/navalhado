/**
 * Contatos do Site (spec 056): as mensagens do formulário de contato do site do Navalhado, guardadas no D1 do site. O Proprietário
 * lê e marca o andamento (`novo`, `lido`, `respondido`) pela aba Contatos do painel dele, pelo Worker do app (`/api/admin/contatos`).
 */

export type StatusDoContato = 'novo' | 'lido' | 'respondido';

export interface ContatoDoSite {
  id: number;
  recebidoEm: Date;
  nome: string;
  sobrenome: string;
  email: string;
  /** A barbearia é opcional no formulário. */
  barbearia: string | null;
  assunto: string;
  mensagem: string;
  status: StatusDoContato;
}

export interface PaginaDeContatos {
  contatos: ContatoDoSite[];
  /** Há mensagens mais antigas além das que vieram. */
  haMais: boolean;
}

export interface IContatosDoSiteAdapter {
  listar(): Promise<PaginaDeContatos>;
}

/** `nao-autenticado`: sem sessão ou sessão recusada. `sem-permissao`: quem pediu não é o Proprietário. `falha`: o resto. */
export type MotivoDoErro = 'nao-autenticado' | 'sem-permissao' | 'falha';

const MENSAGENS: Record<MotivoDoErro, string> = {
  'nao-autenticado': 'Sua sessão expirou. Entre de novo.',
  'sem-permissao': 'Só o Proprietário vê os contatos do site.',
  falha: 'Não foi possível carregar os contatos.',
};

export class ContatosDoSiteError extends Error {
  readonly motivo: MotivoDoErro;

  constructor(motivo: MotivoDoErro) {
    super(MENSAGENS[motivo]);
    this.name = 'ContatosDoSiteError';
    this.motivo = motivo;
  }
}
