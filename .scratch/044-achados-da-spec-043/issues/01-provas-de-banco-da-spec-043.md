# 01: Provas de banco da spec 043

**What to build:** a spec 043 foi declarada verde com testes de banco que não foram reexecutados depois da última mudança, e com a suíte da aplicação não repetida depois dos ajustes finais de dois tickets. Nenhuma dessas lacunas indica defeito conhecido, mas várias funções que elas cobrem vão ser alteradas por esta spec, e as mesmas migrations vão para produção.

Mexer numa função cujo teste ninguém executou mistura dois problemas: o que já estava quebrado e o que a mudança quebrou. Este ticket fixa a linha de base antes de qualquer alteração e antes de produção.

Depois deste ticket, sabe-se que o estado atual do banco de desenvolvimento passa nos testes que a spec 043 tocou, ou cada falha virou defeito registrado.

**Onde foi achado:** limites registrados nos tickets 02, 04, 06 e 07 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Todos os testes de banco que a spec 043 criou, alterou ou cujas funções ela alterou são executados inteiros no estado atual do ambiente de desenvolvimento: 17, 18, 32, 42, 46, 50, 51, 52, 53 e 54. Cada um passa ou vira defeito registrado
- [x] Em especial: o 46 depois do ajuste de mensagem do ticket 07 da spec 043; o 32 depois da migration de autoria; e o 17 inteiro, do qual o ticket 06 da spec 043 só conferiu as asserções da função da Comanda
- [x] A suíte completa de testes da aplicação é executada uma vez no estado atual da branch de desenvolvimento, e passa
- [x] Todo teste de banco roda dentro de `begin; ... rollback;`, e as contagens do banco são conferidas antes e depois para provar que nada ficou para trás
- [x] Nenhum teste de banco é executado contra produção
- [x] Toda falha encontrada vira defeito registrado, com o teste e a asserção que falharam; o ticket que alteraria a função coberta por esse teste não começa enquanto a falha não for resolvida ou explicada
- [x] O resultado de cada item é registrado neste ticket, inclusive os que falharem

**Resultado (2026-09-22):**

- Os 10 testes de banco tocados pela spec 043 foram executados inteiros pelo servidor MCP no ambiente de desenvolvimento, cada um dentro de `begin; ... rollback;`, com um coletor temporário que devolve o relatório completo na mensagem de erro do `rollback` (nenhuma linha persiste). Todos verdes, sem sobra:
  - 17 (`code_review_regressions`): 26/26
  - 18 (`code_review_behavioral_regressions`): 11/11
  - 32 (`bloqueia_gerente_tenant_nulo`): 19/19 — o fix do bypass de gerente com `tenant_id` nulo está aplicado no ambiente de desenvolvimento; a memória do projeto que dizia "não aplicado em nenhum ambiente" estava desatualizada e foi corrigida
  - 42 (`cancelar_agendamento_por_rpc`): 13/13
  - 46 (`criar_agendamento_por_rpc`): 24/24, já com o ajuste de mensagem do barbeiro do ticket 07 da spec 043
  - 50 (`observacao_na_lista_de_espera`): 7/7
  - 51 (`barbeiro_le_cancelados_do_proprio_profissional`): 7/7
  - 52 (`gerente_le_cancelados_da_propria_barbearia`): 8/8
  - 53 (`autoria_do_cancelamento`): 25/25
  - 54 (`agendamento_marcado_da_lista_de_espera`): 18/18
- Total: 158 asserções, 158 ok, nenhuma falha. Nenhum defeito precisou ser registrado.
- Suíte completa da aplicação: `npm test` — 109 arquivos, 1191 testes, todos verdes. `npx oxlint` — exit 0, 47 avisos preexistentes, 0 erros.
- Nenhum teste foi executado contra produção.

**Nota técnica:** os testes rodam por padrão com `select plan(n)` seguido de `select * from finish(true)`, que falha silenciosamente quanto a qual asserção específica falhou quando executado via `execute_sql` do MCP, porque só a última instrução volta. Para reexecutar cada arquivo inteiro com o relatório de cada asserção, cada `insert into pg_temp` e cada `throws_ok`/`is`/`ok`/`lives_ok`/`has_*`/`col_*`/`finish` foi envolvido num `insert into` uma tabela temporária de coleta, e o `rollback` final foi substituído por um `raise exception` que imprime o relatório completo na mensagem de erro — a transação ainda desfaz tudo, mas a mensagem de erro carrega o `ok`/`not ok` de cada linha. Nenhum arquivo de teste em `supabase/tests/database/` foi alterado.
