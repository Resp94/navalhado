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
  /** `filtro` nulo: todos os status. `antesDe`: o id da última mensagem já recebida (a página seguinte), ou nulo na primeira. */
  listar(filtro: StatusDoContato | null, antesDe: number | null): Promise<PaginaDeContatos>;
  /** Muda o status e devolve o contato como ficou. */
  marcar(id: number, status: StatusDoContato): Promise<ContatoDoSite>;
  /** Quantas mensagens estão como `novo`. */
  contarNovos(): Promise<number>;
}

export const STATUS_DO_CONTATO: readonly StatusDoContato[] = ['novo', 'lido', 'respondido'];

/**
 * `nao-autenticado`: sem sessão ou sessão recusada. `sem-permissao`: quem pediu não é o Proprietário. `nao-encontrado`: o contato
 * não existe mais. `status-invalido`: status fora da lista. `falha`: o resto.
 */
export type MotivoDoErro = 'nao-autenticado' | 'sem-permissao' | 'nao-encontrado' | 'status-invalido' | 'falha';

const MENSAGENS: Record<MotivoDoErro, string> = {
  'nao-autenticado': 'Sua sessão expirou. Entre de novo.',
  'sem-permissao': 'Só o Proprietário vê os contatos do site.',
  'nao-encontrado': 'Este contato não existe mais.',
  'status-invalido': 'Status inválido.',
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
