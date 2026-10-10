// Contatos do Site: as mensagens do formulário de contato do site, na tabela `contatos` do D1 do site (binding CONTATOS).
// O schema e as migrations são do repositório do site; o app só lê e atualiza `status`. `ip` e `user_agent` nunca saem daqui.

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface ContatoDoSiteLinha {
  id: number;
  criado_em: string;
  nome: string;
  sobrenome: string;
  email: string;
  barbearia: string | null;
  assunto: string;
  mensagem: string;
  status: string;
}

export const TAMANHO_DA_PAGINA = 50;

const CAMPOS = 'id, criado_em, nome, sobrenome, email, barbearia, assunto, mensagem, status';

export const STATUS_DO_CONTATO = ['novo', 'lido', 'respondido'] as const;
export type StatusDoContato = (typeof STATUS_DO_CONTATO)[number];

export const ehStatusDoContato = (valor: string): valor is StatusDoContato =>
  (STATUS_DO_CONTATO as readonly string[]).includes(valor);

export interface FiltroDaLista {
  /** Nulo: todos os status. */
  status: StatusDoContato | null;
  /** Só os contatos com id menor que este (a página seguinte). Nulo: a primeira página. */
  antesDe: number | null;
}

/** As mais novas primeiro (o id é autoincremento, então a ordem bate com `criado_em`). Lê uma a mais para saber se há outra página. */
export async function listarContatos(
  db: D1Database,
  { status, antesDe }: FiltroDaLista = { status: null, antesDe: null },
): Promise<{ contatos: ContatoDoSiteLinha[]; haMais: boolean }> {
  const { results } = await db
    .prepare(`SELECT ${CAMPOS} FROM contatos WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR id < ?2) ORDER BY id DESC LIMIT ?3`)
    .bind(status, antesDe, TAMANHO_DA_PAGINA + 1)
    .all<ContatoDoSiteLinha>();
  return { contatos: results.slice(0, TAMANHO_DA_PAGINA), haMais: results.length > TAMANHO_DA_PAGINA };
}
