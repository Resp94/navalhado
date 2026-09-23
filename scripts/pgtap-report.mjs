#!/usr/bin/env node
/**
 * Gera, a partir de um arquivo pgTAP de supabase/tests/database/, uma versão
 * "relatório completo" para colar no servidor MCP do Supabase (execute_sql).
 *
 * O harness padrão do projeto roda select plan(n) ... select * from finish(true)
 * dentro de begin/rollback. Isso prova que a suíte passou, mas quando alguma
 * asserção falha, o MCP só devolve o resultado da ÚLTIMA instrução — a
 * mensagem de erro não diz qual asserção falhou. E rodar via MCP fora de um
 * cliente psql não imprime a saída de cada `select` intermediário.
 *
 * Este script reescreve o arquivo para que cada asserção pgTAP (plan, is,
 * isnt, ok, throws_ok, lives_ok, has_column, has_function, has_table,
 * col_type_is, col_not_null, col_default_is, finish) seja inserida numa
 * tabela temporária de coleta, e troca o `rollback;` final por um
 * `raise exception` que devolve o relatório inteiro (ok/not ok de cada
 * linha, na ordem) dentro da própria mensagem de erro. A transação ainda
 * desfaz tudo — nada persiste — mas o MCP mostra o relatório completo.
 *
 * Uso:
 *   node scripts/pgtap-report.mjs supabase/tests/database/46_criar_agendamento_por_rpc.test.sql
 *   node scripts/pgtap-report.mjs 46
 *
 * Sem argumento de arquivo, aceita só o número do prefixo e resolve o nome
 * dentro de supabase/tests/database/. Escreve o resultado em stdout — copie
 * e cole no MCP (execute_sql), ou redirecione para um arquivo com `>`.
 *
 * Referência: ticket 01 da spec 044 (.scratch/044-achados-da-spec-043/issues/
 * 01-provas-de-banco-da-spec-043.md, seção "Nota técnica"), commit af57c1d.
 * Não altera nenhum arquivo de tests/database/; só lê e imprime.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'tests', 'database');

const TAP_FUNCS = [
  'plan', 'is', 'isnt', 'ok', 'throws_ok', 'lives_ok',
  'has_column', 'has_function', 'col_type_is', 'has_table',
  'col_not_null', 'col_default_is', 'finish',
];
const ASSERT_LINE = new RegExp(
  `^(\\s*)select\\s+(\\*\\s+from\\s+)?(${TAP_FUNCS.join('|')})\\s*\\(`,
  'i'
);

function resolveArquivo(arg) {
  if (/^\d+$/.test(arg)) {
    const alvo = readdirSync(TESTS_DIR).find((f) => f.startsWith(`${arg}_`));
    if (!alvo) throw new Error(`Nenhum arquivo em ${TESTS_DIR} começa com "${arg}_"`);
    return join(TESTS_DIR, alvo);
  }
  return resolve(arg);
}

function gerarRelatorio(caminho) {
  let sql = readFileSync(caminho, 'utf8');

  // Remove o begin/rollback do arquivo original: o harness controla a transação.
  sql = sql.replace(/^\s*begin\s*;\s*$/im, '');
  sql = sql.replace(/^\s*rollback\s*;\s*$/gim, '');
  // finish(true) nomeia a suíte no erro; aqui o relatório já mostra cada linha.
  sql = sql.replace(/finish\(true\)/g, 'finish()');

  const linhas = sql.split('\n').map((linha) => {
    const m = linha.match(ASSERT_LINE);
    if (!m) return linha;
    const [, indent, selectAll, funcName] = m;
    return linha.replace(
      ASSERT_LINE,
      `${indent}insert into _tap(line) select ${selectAll || ''}${funcName}(`
    );
  });

  const cabecalho = [
    'begin;',
    'create temp table _tap(n bigserial primary key, line text);',
    'grant all on _tap to public;',
    'grant all on sequence _tap_n_seq to public;',
    '',
  ].join('\n');

  const rodape = [
    '',
    'reset role;',
    "do $$ begin",
    "  raise exception 'TAP_REPORT%', E'\\n' || (select string_agg(line, E'\\n' order by n) from _tap);",
    'end $$;',
  ].join('\n');

  return cabecalho + linhas.join('\n') + rodape;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node scripts/pgtap-report.mjs <numero-ou-caminho-do-teste>');
    process.exit(1);
  }
  process.stdout.write(gerarRelatorio(resolveArquivo(arg)) + '\n');
}

main();
