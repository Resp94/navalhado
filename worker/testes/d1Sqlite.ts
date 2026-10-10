// D1 de teste: a mesma interface que o Worker usa, sobre o SQLite do próprio Node, para os testes rodarem o SQL de verdade.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../contatos';

// Cópia do schema da tabela `contatos` (migrations/0001_contatos.sql, no repositório do site). O app não cria nem altera a tabela.
const SCHEMA = `
CREATE TABLE contatos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
  nome        TEXT    NOT NULL,
  sobrenome   TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  barbearia   TEXT,
  assunto     TEXT    NOT NULL,
  mensagem    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'novo',
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX contatos_criado_em ON contatos (criado_em);
CREATE INDEX contatos_status ON contatos (status);
`;

export interface NovoContato {
  nome?: string;
  sobrenome?: string;
  email?: string;
  barbearia?: string | null;
  assunto?: string;
  mensagem?: string;
  status?: string;
  criado_em?: string;
}

export function criarD1DeTeste() {
  const banco = new DatabaseSync(':memory:');
  banco.exec(SCHEMA);

  const preparar = (sql: string, valores: SQLInputValue[] = []): D1PreparedStatement => ({
    bind: (...novos: unknown[]) => preparar(sql, novos as SQLInputValue[]),
    all: async <T>() => ({ results: banco.prepare(sql).all(...valores) as T[] }),
    first: async <T>() => (banco.prepare(sql).get(...valores) as T | undefined) ?? null,
    run: async () => {
      banco.prepare(sql).run(...valores);
    },
  });

  const d1: D1Database = { prepare: (sql) => preparar(sql) };

  const inserir = (c: NovoContato = {}) => {
    const r = banco
      .prepare(
        `INSERT INTO contatos (nome, sobrenome, email, barbearia, assunto, mensagem, status, criado_em, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '203.0.113.7', 'Mozilla/5.0 teste')`,
      )
      .run(
        c.nome ?? 'Ana',
        c.sobrenome ?? 'Souza',
        c.email ?? 'ana@exemplo.com',
        c.barbearia === undefined ? 'Barbearia da Ana' : c.barbearia,
        c.assunto ?? 'Quero começar a usar',
        c.mensagem ?? 'Olá!',
        c.status ?? 'novo',
        c.criado_em ?? '2026-10-09 12:00:00',
      );
    return Number(r.lastInsertRowid);
  };

  const statusDe = (id: number) => (banco.prepare('SELECT status FROM contatos WHERE id = ?').get(id) as { status: string }).status;

  return { d1, inserir, statusDe };
}
