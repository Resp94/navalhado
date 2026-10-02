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
 * Este script reescreve o arquivo para que cada asserção pgTAP (as funções
 * da lista TAP_FUNCS, abaixo, que abrem uma linha com `select`) seja inserida
 * numa tabela temporária de coleta, e troca o `rollback;` final por um
 * `raise exception` que devolve o relatório inteiro (ok/not ok de cada
 * linha, na ordem) dentro da própria mensagem de erro. A transação ainda
 * desfaz tudo — nada persiste — mas o MCP mostra o relatório completo.
 *
 * A última linha do relatório diz `coletadas: N | plan: M`. N é o número de
 * resultados que a execução coletou (uma consulta com `from (values ...)` gera
 * várias); M é o `plan(...)` do arquivo. Se divergirem, alguma
 * asserção não foi coletada (a função falta em TAP_FUNCS, ou a chamada não
 * começa a linha com `select`) e uma falha dela ficaria sem nome no relatório.
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

// Lista explícita (e não um padrão como has_\w+): has_table_privilege e afins são funções do Postgres, não asserções.
// Acrescente aqui a função pgTAP nova que um teste passar a usar; o rodapé do relatório (coletadas | plan) acusa a falta.
const TAP_FUNCS = [
  'plan', 'finish',
  'is', 'isnt', 'ok', 'pass', 'fail', 'cmp_ok', 'isa_ok',
  'matches', 'doesnt_match', 'alike', 'unalike', 'like', 'unlike',
  'throws_ok', 'throws_like', 'throws_matching', 'lives_ok', 'dies_ok',
  'is_empty', 'isnt_empty', 'results_eq', 'results_ne', 'set_eq', 'set_ne', 'bag_eq', 'bag_ne', 'row_eq',
  'has_table', 'hasnt_table', 'has_view', 'has_function', 'hasnt_function', 'has_type', 'has_schema', 'has_role', 'has_extension',
  'has_column', 'hasnt_column', 'has_index', 'has_trigger', 'has_pk', 'has_fk',
  'col_type_is', 'col_not_null', 'col_is_null', 'col_default_is', 'col_has_default', 'col_is_pk', 'col_is_fk',
  'columns_are', 'tables_are', 'functions_are', 'policies_are',
  'is_definer', 'isnt_definer', 'is_strict', 'function_returns', 'volatility_is', 'trigger_is',
  'policy_cmd_is', 'policy_roles_are',
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

  const planos = [...sql.matchAll(/^\s*select\s+plan\s*\(\s*(\d+)\s*\)/gim)].map((m) => Number(m[1]));
  if (planos.length > 1) {
    // O script tira os rollback; e roda o arquivo numa transação só, e o pgTAP recusa o segundo plan (You tried to plan twice!).
    console.error(`AVISO: ${caminho} tem ${planos.length} blocos plan/finish; o relatório falha no segundo plan. Rode cada bloco à parte.`);
  }
  const plano = planos[0] ?? 0;
  const coletadas = "(select count(*) from _tap where line ~ '^(not )?ok')";
  const resumo = plano > 0
    ? `E'\\n-- coletadas: ' || ${coletadas} || ' | plan: ${plano}' || case when ${coletadas} = ${plano} then ' (confere)' else ' (DIVERGE: falta coletar alguma assercao ou o plan esta errado)' end`
    : `E'\\n-- coletadas: ' || ${coletadas} || ' | plan: ?'`;

  const rodape = [
    '',
    'reset role;',
    "do $$ begin",
    `  raise exception 'TAP_REPORT%', E'\\n' || (select string_agg(line, E'\\n' order by n) from _tap) || ${resumo};`,
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
