# 01: Testes pgTAP legados da Instância WhatsApp voltam a rodar

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** os arquivos pgTAP que chamam `has_constraint`, função que o pgTAP 1.3.3 do DEV não tem, passam a rodar de ponta a ponta. Assim as asserções de token que já existem neles são executadas e servem de linha de base antes do fechamento.

- `supabase/tests/database/whatsapp_neutral_persistence.test.sql`: as oito chamadas de `has_constraint` (linhas 15 a 62) viram `select ok(exists(select 1 from pg_constraint where conrelid = '<tabela>'::regclass and conname = '<nome>'), '<descrição que já existe>')`. É uma troca por uma, então `plan(45)` não muda. Os oito nomes de constraint existem no DEV (conferido em 2026-10-01).
- `supabase/tests/database/whatsapp_balcao_outbox.test.sql`: as duas chamadas (linhas 10 e 16), mesma troca. Antes, confirmar no DEV que `whatsapp_message_outbox_key_unique` e `whatsapp_message_outbox_status_check` existem; se algum nome mudou, ajustar o nome, não a asserção.
- Nenhuma asserção de token muda. As de `whatsapp_neutral_persistence.test.sql` (token não legível e não gravável) e a 7 de `security_hardening.test.sql` já pedem o fechamento certo e passam no ticket 02.
- Se, ao rodar de ponta a ponta, aparecer outra asserção velha que o `has_constraint` escondia, corrige-se só o teste, sem mudar o que ele verifica, e o resultado registra o porquê.
- A linha de base fica registrada no resultado: o que passa e o que falha, nos três arquivos, antes do ticket 02.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `whatsapp_neutral_persistence.test.sql` roda inteiro no DEV (por `execute_sql`, dentro do `begin; ... rollback;` do próprio arquivo). Esperado antes do ticket 02: falha só nas duas asserções do token (43/45; falham a 25 e a 26)
- [x] `whatsapp_balcao_outbox.test.sql` roda inteiro (12/12)
- [x] `security_hardening.test.sql` rodado só para registrar a linha de base: a 7 (token) falha; a 12 (`comanda_pagamentos`) é o achado antigo e conhecido e fica como está (10/12)
- [x] Resultado registrado neste ticket, com a contagem de cada arquivo
- [x] `npm run lint`, `npm test` e `npm run build` passam (a rodada completa do vitest teve 1 falha, a instabilidade conhecida de `MinhaAgenda`, que passa isolada; detalhes no resultado)

## Resultado (2026-10-01)

**A troca.** As 8 chamadas de `has_constraint` de `whatsapp_neutral_persistence.test.sql` e as 2 de `whatsapp_balcao_outbox.test.sql` viraram `ok(exists(select 1 from pg_constraint where conrelid = '<tabela>'::regclass and conname = '<nome>'), '<descrição>')`, uma por uma, com as mesmas descrições. Os planos (45 e 12) não mudaram. Os 10 nomes de constraint existem no DEV. O `has_constraint` está nos dois arquivos desde o primeiro commit (`aebe494` e `cabe071`), então nenhum dos dois tinha rodado até o fim. A troca foi aplicada por um script que preserva o fim de linha CRLF da árvore de trabalho (`core.autocrlf=true`).

**Duas asserções velhas apareceram e foram corrigidas, só no teste.** Eram falsos negativos que o `has_constraint` escondia:

- `whatsapp_neutral_persistence` 40 (`non-Uazapi provider is rejected`) inseria `provider = 'uazapi'`, que é um valor válido. A asserção pegava o `23505` do `UNIQUE (tenant_id)` (o tenant 2 já tem instância) em vez do `23514` do `CHECK` de provedor. O valor original era `'evolution'`; o commit `15acdc3` (remoção da Evolution, 2026-08-01) o trocou por `'uazapi'` no dia seguinte à criação do teste. Agora usa `'unsupported_provider'`. Continua inserindo no tenant 2 e o `CHECK` dispara antes do índice único, como a asserção pede.
- `whatsapp_balcao_outbox` 12 (`claim function has an explicit empty search path`) procurava o texto `search_path = ''` na definição da função, mas o Postgres imprime `SET search_path TO ''`. A função tem o `search_path` vazio de fato (`proconfig = {search_path=""}`). Agora a asserção confere `'search_path=""' = any(proconfig)`, o mesmo estilo catalográfico que `security_hardening` usa com `reloptions`.

**Linha de base no DEV, antes do ticket 02.** Gerada por `scripts/pgtap-report.mjs`, que devolve cada `ok` e `not ok` dentro do erro do MCP e desfaz a transação:

- `whatsapp_neutral_persistence`: 43/45. Falham só a 25 (`instance token is not browser-readable`) e a 26 (`instance token is not browser-writable`).
- `whatsapp_balcao_outbox`: 12/12.
- `security_hardening`: 10/12. Falham a 7 (`token da instância não é legível pelo navegador`) e a 12 (`comanda_pagamentos`, achado antigo e conhecido, fora da spec).

Conferido depois das rodadas: nenhum tenant de teste restante, uma instância no DEV e a ACL de `whatsapp_instances` intacta (`authenticated=rw/postgres`).

**Para o ticket 02.** Os critérios "`whatsapp_neutral_persistence` 45/45" e "a 7 de `security_hardening` passa" passam a depender só do fechamento. A 12 de `security_hardening` continua vermelha, como o ticket 02 já diz.

**Gates.** Nenhum arquivo de `src/` mudou neste ticket (só dois `.sql` de teste e documentação). Mesmo assim, rodados em sequência: `oxlint` com exit 0 (só avisos antigos) e `npm run build` com exit 0. O `vitest run` completo passou 1942 de 1943 testes (143 de 144 arquivos), em 1000 s. A falha foi `MinhaAgenda.test.tsx` ("marca não compareceu pela RPC quando o horário já passou", timeout de `waitFor`), a instabilidade sob carga que já se conhece; o arquivo rodado isolado passa 27/27.

### Decisões que valem lembrar

- **O script do repositório não captura `has_index` nem `has_trigger`.** `scripts/pgtap-report.mjs` só registra as funções da sua lista (`plan`, `is`, `ok`, `throws_ok`, `lives_ok`, `has_table`, `has_column` e outras). Os três arquivos usam `has_index` e `has_trigger`, então as rodadas acima usaram uma cópia local do script com esses dois nomes acrescentados (fora do repositório). Com o script como está, essas linhas somem do relatório, embora o `finish()` ainda conte as falhas. Acrescentar os dois nomes à lista do script é uma linha e não foi feito aqui para não ampliar o ticket.
- **Rodadas com o `ok(exists(...))` no lugar do `has_constraint`** passam a aparecer no relatório, porque `ok` está na lista do script.
