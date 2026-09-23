# Especificação Técnica: Promoção de `dev` para `main` (specs 040 a 045)

## Problem Statement

A `dev` está 120 commits à frente da `main`. As duas se separaram no commit `3c90e6e` (17/09): a `main` recebeu o último merge da `dev` em 18/09 (`903b6e9`) e desde então só a `dev` andou. Nesse intervalo entraram as specs 040 (regras de agendamento e comanda no servidor), 041 (portal do barbeiro), 042, 043 (motivo de cancelamento visível), 044 (achados da 043) e 045 (agenda desktop do barbeiro), além das correções achadas nos testes de 22/09 (fuso horário em várias telas, período dos relatórios, Próximos horários do Canal do Cliente, rótulos da Central 360º, vínculo profissional-serviço na tela Equipe, trava do Bloquear para o barbeiro).

O gerente e o barbeiro em produção ainda não têm nada disso. O problema é que a promoção não é só um merge: o deploy do front na Cloudflare acontece sozinho a cada push na `main`, e as migrations do Supabase não. Produção parou na migration `038_relatorios_ticket11_origem_dos_clientes` e não tem nenhuma das 22 migrations das specs 040, 041, 043 e 044. O código da `dev` lê colunas que não existem em produção (`appointments.canceled_by`, `appointments.from_waiting_list`, `waiting_list.notes`, `comandas.discount_percent`) e chama RPCs que não existem lá (`mark_appointment_no_show`, `create_appointment_by_manager`, `cancel_appointment_by_manager`, `reschedule_appointment_by_manager`, `start_appointment_service`).

E o caminho inverso também quebra: duas dessas migrations tiram permissões que o front atual da `main` usa. A `044_ticket08` revoga o `update` direto em `appointments.cancellation_reason`, e a Agenda do gerente em produção cancela um Agendamento exatamente assim. A `044_ticket07` passa a exigir motivo em `cancel_comanda_appointment`, e a tela de Comandas em produção chama sem motivo.

Ou seja: não existe ordem em que front e banco fiquem compatíveis o tempo todo. Aplicar essas duas migrations antes deixa o front antigo sem conseguir cancelar; publicar o front antes deixa o front novo sem as colunas e RPCs de que depende. As outras 20 migrations não têm esse problema: o front da `main` não usa nada que elas removam ou restrinjam. A barbearia precisa de uma promoção com uma janela curta e planejada, em vez de descobrir isso no meio do expediente.

## Solution

Promover em duas etapas. Primeiro, fora da janela e em três lotes, as 20 migrations compatíveis com o front atual: spec 040; specs 041 e 043; e as quatro da spec 044 que não mexem no cancelamento (`ticket06`, `ticket09`, `ticket16`, `ticket17`). Depois de cada lote, conferência de esquema, pgTAP e log do Postgres, com o front antigo seguindo no ar sem perceber.

Depois, uma janela curta fora do horário de atendimento: as duas migrations que quebram o front antigo (`044_ticket07` e `044_ticket08`), o merge e o push da `main` (que dispara o deploy), a espera pelo bundle novo no ar e as provas depois do deploy. A janela vai da primeira dessas duas migrations até o bundle novo ser servido; no teste de 22/09 esse atraso do deploy chegou a cerca de 20 minutos. Durante a janela, cancelar um Agendamento pela Agenda e cancelar pela tela de Comandas falham para quem estiver com o front antigo aberto; nada mais do front antigo depende do que essas duas migrations removem.

Produção hoje tem só dois tenants (Barbearia Brooklyn e Barber Tester), 144 Agendamentos e 151 Comandas, o que torna a janela noturna aceitável. Os dados de produção já foram conferidos contra as duas regras novas que viram índice único (uma Comanda aberta por Agendamento; um Encaixe ativo por profissional e horário): nenhuma violação hoje.

Se algo falhar depois das migrations e antes do push, a promoção para ali: o front antigo segue no ar e o que quebra é só o cancelamento com motivo, até a correção. Não existe volta automática das migrations; a volta é uma migration nova, escrita para o problema encontrado.

## User Stories

1. As a Gerente, I want the promotion to happen outside business hours, so that no customer is being attended while cancellations may fail.
2. As a Gerente, I want to be told the time window before it starts, so that I avoid cancelling Agendamentos during it.
3. As a Desenvolvedor, I want to confirm that `main` and `dev` locally match their remotes before starting, so that I do not promote a stale branch.
4. As a Desenvolvedor, I want to confirm that the merge-base is still `3c90e6e` and that `main` has no new commit, so that the promotion does not overwrite something done directly on `main`.
5. As a Desenvolvedor, I want to re-run the pre-flight data checks in production right before migrating, so that a duplicate open Comanda or a duplicate active Encaixe created since 22/09 does not abort a migration halfway.
6. As a Desenvolvedor, I want the two migrations that create unique indexes to keep their own guard that aborts with a clear message, so that a data conflict fails loudly instead of creating a half-applied state.
7. As a Desenvolvedor, I want the 20 compatible migrations applied before the window, in three batches in filename order, each batch followed by a schema check, its pgTAP tests and a look at the Postgres log, and the two migrations that break the old front left for the window, so that a problem shows up while the old front still works normally and the window stays as short as possible.
8. As a Desenvolvedor, I want each migration applied with its file name as the migration name, so that the production history matches the repository and the next comparison is by name, not by schema archaeology.
9. As a Desenvolvedor, I want the hotfix migration `094_fix_daily_financial_summary_guards` NOT applied in production, so that it does not overwrite the later tenant-null guard that `095` and `096` already reconciled there.
10. As a Desenvolvedor, I want to stop at the first failing migration and not continue, so that production never runs with a later migration applied on top of a missing earlier one.
11. As a Desenvolvedor, I want to verify in the schema that the new columns and RPCs exist after migrating, so that I know the database is ready before triggering the deploy.
12. As a Desenvolvedor, I want to run the pgTAP tests of specs 040 to 044 against production inside `begin; ... rollback;`, so that the server rules are proven on the real database without leaving data behind.
13. As a Desenvolvedor, I want the merge from `dev` into `main` to be a merge commit (`--no-ff`), so that the promotion is one identifiable point in `main`'s history.
14. As a Desenvolvedor, I want the push of `main` to happen only after the migrations and their checks pass, so that the new front never runs against the old schema.
15. As a Desenvolvedor, I want to watch the production site until it serves the new bundle, so that I know when the window ends instead of assuming.
16. As a Gerente, I want to cancel an Agendamento from the Agenda with a motivo right after the deploy, so that the most affected flow is proven first.
17. As a Gerente, I want to cancel from the Comandas screen with a motivo after the deploy, so that the second affected flow is proven.
18. As a Gerente, I want the Painel de Cancelados do Dia to show the autoria and the motivo in production, so that spec 043 is live.
19. As a Gerente, I want to mark a falta only after the start time in production, so that the new RPC from spec 040 is proven.
20. As a Gerente, I want percentual discounts and the Gorjeta recipient to work when closing a Comanda in production, so that spec 040's settlement rules are live.
21. As a Barbeiro, I want Minha Agenda on desktop to show the Grade Temporal locked to me in production, so that specs 041, 042 and 045 are live.
22. As a Barbeiro, I want the Bloquear horário to offer only myself in production, so that the fix found on 22/09 is live.
23. As a Gerente, I want the times in the Caixa, Comissões, Comanda, Lista de Espera and Central 360º to show the barbershop's time zone in production, so that the fuso fixes are live.
24. As a Cliente, I want Próximos horários in the Canal do Cliente to show only what is still ahead, so that the fix found on 22/09 is live.
25. As a Gerente, I want the Relatórios period to be kept when switching pages in production, so that the spec 038 fix is live.
26. As a Desenvolvedor, I want the post-deploy checks to avoid creating an Agendamento for a real customer with a phone, so that no real WhatsApp message is sent from a test.
27. As a Desenvolvedor, I want any test Agendamento in production to use Sem cadastro (Balcão) and be cancelled right after, so that the smoke test leaves no active record behind.
28. As a Desenvolvedor, I want to record in this spec when the promotion ran and which commit went to `main`, so that the next promotion starts from a known point.
29. As a Desenvolvedor, I want a clear rule for what to do if the deploy does not show up, so that the window is not silently extended.
30. As a Desenvolvedor, I want a clear rule for what to do if a post-deploy check fails, so that the fix is a new commit on `dev` promoted the same way, never a direct edit on `main`.

## Implementation Decisions

- **Ordem fixa da promoção.** (1) conferências de git e de dados em produção; (2) lote da spec 040; (3) lote das specs 041 e 043; (4) lote compatível da spec 044; cada lote seguido de conferência de esquema, pgTAP em produção dentro de `begin; ... rollback;` e leitura do log do Postgres; (5) janela: `044_ticket07`, `044_ticket08`, merge `dev` → `main` com `--no-ff`, push da `main`, espera do bundle novo; (6) provas no navegador. Nenhum passo começa sem o anterior ter passado. Os lotes (2) a (4) podem ser feitos em dias diferentes da janela; entre eles o front antigo segue normal.
- **As 22 migrations**, na ordem em que entram (nome do arquivo sem o timestamp):
  - Lote 040 (11): `ticket01_preco_do_catalogo_na_liquidacao`, `ticket02_destinatario_da_gorjeta_validado`, `ticket03_desconto_percentual_registrado`, `ticket03b_regras_de_liquidacao_em_funcoes_privadas`, `ticket04_iniciar_atendimento_por_rpc`, `ticket05_cancelar_agendamento_por_rpc`, `ticket06_marcar_falta_por_rpc`, `ticket07_comanda_aberta_unica_por_agendamento`, `ticket11_reagendar_agendamento_por_rpc`, `ticket08_10_criar_agendamento_por_rpc`, `ticket09_limite_de_encaixe_no_banco`.
  - Lote 041 e 043 (5): `041_ticket01_barbeiro_opera_a_propria_agenda`, `041_ticket03_comissoes_do_barbeiro`, `043_ticket01_observacao_na_lista_de_espera`, `043_ticket06_autoria_do_cancelamento`, `043_ticket07_agendamento_marcado_da_lista_de_espera`.
  - Lote 044 compatível (4): `ticket06_validacao_telefone_criacao_agendamento`, `ticket09_exclusao_de_bloqueio_chega_pelo_tempo_real`, `ticket16_relatorio_motivos_separa_autoria`, `ticket17_relatorio_conta_encaixes_da_lista_de_espera`.
  - Janela (2): `044_ticket07_comanda_grava_motivo_cancelamento`, `044_ticket08_autoria_protegida_contra_escrita_direta`.
- **Por que `044_ticket09`, `ticket16` e `ticket17` podem entrar antes de `ticket07` e `ticket08`, fora da ordem de nome:** a `ticket09` só muda a identidade de réplica de `blocked_slots`; a `ticket16` e a `ticket17` reescrevem o núcleo privado do relatório de Agenda, que depende de `canceled_by` (da `043_ticket06`, já aplicada no lote anterior) e não de nada que a `ticket07` ou a `ticket08` criem. A `044_ticket08` concede `update` em `from_waiting_list`, que já existe desde o lote da 043.
- **Aplicação pelo MCP do Supabase** (`apply_migration`, `project_id` de produção explícito), como manda o projeto: nunca CLI nem docker. O nome passado é o nome do arquivo sem o timestamp, para o histórico de produção casar com o repositório.
- **O que fica de fora do banco de produção:** a migration `094_fix_daily_financial_summary_guards`, trazida para a `dev` junto com o hotfix. Em produção o mesmo efeito já veio por `095_reconcile_daily_financial_summary_guards` e `096_reconcile_dev_prod_function_bodies`, e a função atual carrega a guarda de tenant nulo posterior; reaplicar o `094_fix` a desfaria.
- **As duas migrations que quebram o front antigo, e por quê a janela existe:**
  - `044_ticket07` troca `cancel_comanda_appointment` por uma versão com `p_reason` que recusa cancelamento sem motivo. A tela de Comandas da `main` chama sem motivo.
  - `044_ticket08` revoga o `update` de `authenticated` em `appointments` e devolve só colunas específicas, sem `cancellation_reason` nem `canceled_by`. A Agenda do gerente na `main` cancela com `update` direto em `cancellation_reason`.
  - Não dá para adiar essas duas até depois do deploy: o front novo chama `cancel_comanda_appointment` com `p_reason`, que só existe depois da `044_ticket07`.
- **O que é compatível com o front antigo e não abre janela:** `settle_comanda_idempotent` ganha `p_discount_percent` com default nulo, então a chamada da `main` continua valendo; o front da `main` não chama a `settle_comanda` sem idempotência, que a `040_ticket03` recria com outra assinatura; as colunas novas têm default; as RPCs novas só são chamadas pelo front novo; `blocked_slots` já estava na publicação de tempo real e a `044_ticket09` só muda a identidade de réplica. Os `update` diretos em `appointments` que o front da `main` faz fora do cancelamento (iniciar, concluir, marcar falta, reagendar) só gravam colunas que a `044_ticket08` mantém liberadas.
- **Guardas de dados nas migrations.** `040_ticket07` e `040_ticket09` abortam com mensagem clara se houver duplicidade antes de criar o índice único. Em 22/09 produção tinha zero duplicidades nas duas regras; a conferência prévia repete a mesma consulta imediatamente antes.
- **Sem Edge Function nem configuração de deploy.** Desde o merge-base nada mudou em `supabase/functions`, `wrangler.toml` ou `package.json`; a promoção não inclui deploy de Edge Function.
- **Merge e push.** O merge é `dev` → `main` com `--no-ff`, como o CLAUDE.md sugere, e confirmado com o usuário antes. O push da `main` dispara o deploy de produção na Cloudflare. A `dev` não recebe nada de volta: os seis commits só da `main` (cinco merges antigos e o hotfix `f6b28b8`) já estão representados na `dev`.
- **Fim da janela.** A janela termina quando o site de produção serve um bundle diferente do atual e o conteúdo dele contém um marcador do código novo (por exemplo, o texto "Horário não confirmado", que só existe depois de `cc37c45`).
- **Registro.** Ao terminar, esta spec ganha uma seção com data e hora da janela, o commit de merge na `main` e o resultado de cada prova.

## Testing Decisions

- **Um bom teste aqui prova comportamento em produção, não detalhe de implementação.** Nenhum teste novo de código entra nesta promoção: o código já foi testado na `dev`. O que se testa é se o banco de produção e o front publicado se comportam como a `dev`.
- **Primeira costura: o próprio banco de produção, por SQL de leitura.** Antes das migrations, as duas consultas de duplicidade. Depois de cada lote, a leitura do log do Postgres de produção, procurando erros novos vindos do front antigo. Ao fim dos lotes, a existência das colunas `canceled_by`, `from_waiting_list`, `waiting_list.notes` e `discount_percent` e das RPCs `mark_appointment_no_show`, `create_appointment_by_manager`, `cancel_appointment_by_manager`, `reschedule_appointment_by_manager` e `start_appointment_service`. Arte anterior: a comparação de esquema feita em 22/09 para montar este plano.
- **Segunda costura: pgTAP das specs 040 a 044, em produção, dentro de `begin; ... rollback;`.** São os arquivos de `supabase/tests/database/` adicionados ou alterados desde o merge-base. A extensão pgTAP já está ativa em produção (`enable_pgtap_database_tests`). O `rollback` desfaz inclusive linhas que os testes enfileirariam na outbox de WhatsApp. Arte anterior: os pgTAP rodados em dev pelo mesmo caminho, como o `daily_financial_summary.test.sql` em 22/09.
- **Terceira costura: o front publicado, no navegador**, depois do bundle novo no ar. Provas mínimas, na ordem de risco: cancelar pela Agenda com motivo; cancelar pela tela de Comandas com motivo; conferir o Painel de Cancelados do Dia; horário no fuso do tenant no cabeçalho do Caixa; Próximos horários do Canal do Cliente; período dos Relatórios entre páginas. Arte anterior: os testes de navegador de 22/09 no dev, cujas provas estão nesta conversa e nos commits das correções.
- **Restrição das provas em produção.** Nenhum Agendamento é criado para cliente com telefone, porque produção tem WhatsApp conectado e mandaria mensagem real. Agendamento de prova usa Sem cadastro (Balcão), é cancelado logo depois com motivo "Prova da promoção" e aparece assim no Painel de Cancelados.

## Out of Scope

- Qualquer mudança de código ou nova funcionalidade; a promoção leva exatamente o que está na `dev` em `cc37c45` mais o commit desta spec.
- Deploy de Edge Functions (nada mudou nelas desde o merge-base).
- Reconciliar os nomes das migrations antigas (028 a 045_fix, `timezone_support` e outras) que aparecem com nome diferente entre o repositório e o histórico de produção. Elas já estão na `main`, que já roda em produção, e não pesam nesta promoção.
- Uma estratégia de compatibilidade que eliminasse a janela (por exemplo, manter o `update` direto em `cancellation_reason` por um tempo e revogar numa segunda promoção). Com dois tenants em produção, a janela noturna custa menos que manter as duas formas.
- Limpeza dos dados de teste criados na Alpha Dev em 22/09.
- Correções de problemas achados durante a promoção; cada uma vira commit na `dev` e segue esta mesma sequência.

## Further Notes

- **Se uma migration falhar:** parar, não aplicar as seguintes e não fazer merge. O front antigo continua no ar. Nos lotes anteriores à janela, isso não afeta a barbearia. Se a falha for na janela, depois da `044_ticket07` ou da `044_ticket08`, o cancelamento com motivo continua quebrado no front antigo até a correção; avisar a barbearia.
- **Tickets:** `.scratch/046-promocao-dev-para-main/issues/`, de `01` (conferências prévias) a `06` (provas e registro), em cadeia linear.
- **Se o deploy não aparecer em 30 minutos:** conferir o painel da Cloudflare antes de qualquer outra ação. Não fazer push vazio para "reempurrar" sem entender o motivo.
- **Se uma prova depois do deploy falhar:** a correção é um commit na `dev`, testado, e promovido pela mesma sequência (sem migrations, se não houver). Nunca editar direto na `main`.
- **Números de referência (22/09):** merge-base `3c90e6e`; `dev` em `cc37c45`; 120 commits à frente; 221 arquivos alterados; 22 migrations pendentes; 29 arquivos de pgTAP adicionados ou alterados; produção com 185 migrations registradas, última `038_relatorios_ticket11_origem_dos_clientes`.
- **Vínculo profissional-serviço:** com a regra de vínculo obrigatório, um profissional sem vínculo fica sem horário livre. Em 22/09, todos os profissionais ativos de produção tinham vínculo; a promoção não tira horário de ninguém.

## Registro da promoção (2026-09-23)

- **Conferências prévias:** `dev` e `main` locais iguais aos remotos após `fetch`; `main` em `903b6e9`; merge-base `3c90e6e`; nenhuma duplicidade de Comanda aberta nem de Encaixe ativo em produção; última migration em produção ainda `038_relatorios_ticket11_origem_dos_clientes`; todo profissional ativo com vínculo habilitado. Detalhe por item: `.scratch/046-promocao-dev-para-main/issues/01-conferencias-previas-da-promocao.md`.
- **Lotes fora da janela:** as 20 migrations compatíveis (spec 040, specs 041+043, spec 044 compatível) aplicadas sem erro, cada lote com pgTAP e log conferidos. Detalhe: issues `02`, `03` e `04`. Três divergências de pgTAP nos testes `41`, `42` e `46`, esperadas nesse intermediário (dependiam da spec 041, aplicada no lote seguinte) e fechadas sozinhas depois — reproduzidas de forma idêntica no dev, não regressão da promoção.
- **Janela:** início `2026-09-23T11:26:20Z` (migration `044_ticket07`), fim `2026-09-23T11:33:38Z` (marcador "Horário não confirmado" confirmado no bundle novo `index-NKXcuz5Z.js`) — cerca de 7 minutos. `044_ticket07` e `044_ticket08` aplicadas sem erro; pgTAP `55` e `56` (30/30). Merge `dev` → `main` com `--no-ff`: commit **`af67361`** (`903b6e9..af67361`). Push da `main` confirmado pelo usuário antes de cada ação. Conflito de merge em `supabase/tests/database/daily_financial_summary.test.sql` (add/add: `main` esperava `search_path` `public,extensions`, `dev` esperava `search_path` vazio) resolvido mantendo a versão da `dev`, que corresponde ao endurecimento de segurança (`set search_path to ''`) usado em toda a promoção. Detalhe: issue `05`.
- **Provas no navegador, em produção (tenant Barber Tester), 2026-09-23:**
  1. ✅ Agendamento de prova via Sem cadastro (Balcão), sem telefone, cancelado logo depois com o motivo "Prova da promoção".
  2. ✅ Gerente cancelou um Agendamento a partir da Agenda (abre a Comanda do atendimento) informando o motivo; a RPC `cancel_comanda_appointment` de 4 parâmetros (com motivo obrigatório) respondeu.
  3. ✅ Gerente cancelou pela tela de Comandas informando o motivo.
  4. ✅ Painel de Cancelados do Dia mostrou os dois cancelamentos com "Cancelado por: Barbearia" e motivo "Prova da promoção".
  5. ✅ Cabeçalho do Caixa mostrou o horário no fuso do tenant (America/Manaus): sessão aberta às 18:13:26 UTC exibida como 14:13, não 15:13 (São Paulo) nem 18:13 (UTC).
  6. ✅ Minha Agenda do barbeiro (grade travada, Bloquear só ele) — confirmado depois de corrigido o bloqueio: a Edge Function `create-barber-access` (achado desta promoção, sinalizado como `task_fbfb3f65`) foi implementada, mesclada na `dev` e deployada em produção pelo MCP do Supabase. Testado com um login de barbeiro criado pela própria tela Equipe: a Minha Agenda mostrou só a grade do próprio profissional, e o Bloquear horário ofereceu só ele no seletor. Profissional e login de teste removidos depois; `auth.users` deletado em cascata limpou `public.users`, e `professionals.user_id` voltou a nulo.
  7. ✅ Canal do Cliente: cliente "Jonathas Santos" (com 1 Agendamento pendente já vencido) mostrou "Próximos horários (0)" e "Anteriores (2)" — o vencido caiu em Anteriores, não em Próximos. Verificado com dado já existente, sem criar Agendamento novo.
  8. ✅ Relatórios: período trocado para "Últimos 30 dias" na aba Equipe e Serviços permaneceu ao navegar para a aba Faturamento.
  9. ✅ Nenhum Agendamento ativo de prova sobrou: os dois criados (10:20 e 11:00) ficaram cancelados; nenhum cliente com telefone recebeu Agendamento de prova.
  - Detalhe: issue `06`.
- **Achado durante as provas, corrigido no mesmo dia:** a Edge Function `create-barber-access` estava ausente em produção e em dev (bug pré-existente, não causado por esta promoção) — sinalizado como tarefa separada (`task_fbfb3f65`), implementado, mesclado na `dev` (commit `2031945`) e deployado em produção antes do item 6 acima ser reverificado.
