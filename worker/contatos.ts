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

/** As mais novas primeiro (o id é autoincremento, então a ordem bate com `criado_em`). Lê uma a mais para saber se há outra página. */
export async function listarContatos(db: D1Database): Promise<{ contatos: ContatoDoSiteLinha[]; haMais: boolean }> {
  const { results } = await db
    .prepare(`SELECT ${CAMPOS} FROM contatos ORDER BY id DESC LIMIT ?`)
    .bind(TAMANHO_DA_PAGINA + 1)
    .all<ContatoDoSiteLinha>();
  return { contatos: results.slice(0, TAMANHO_DA_PAGINA), haMais: results.length > TAMANHO_DA_PAGINA };
}
