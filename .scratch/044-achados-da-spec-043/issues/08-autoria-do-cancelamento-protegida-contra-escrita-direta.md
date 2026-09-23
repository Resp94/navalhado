# 08: Autoria do cancelamento protegida contra escrita fora das funções

**What to build:** a autoria do cancelamento existe para responder quem desmarcou: a barbearia ou o cliente. Ela só tem valor se ninguém puder alterá-la fora das funções que cancelam.

Hoje a aplicação respeita isso, porque nenhuma tela escreve a coluna e as funções são o único caminho. O banco, porém, não impede: a política de atualização de Agendamento permite ao gerente alterar qualquer linha da própria barbearia, e a autoria está entre as colunas alcançadas. Quem tiver a chave de acesso do gerente pode reescrever a autoria de um cancelamento sem passar por nenhuma função.

Depois deste ticket, a autoria só muda pelo caminho que a define.

**Onde foi achado:** limite registrado no ticket 06 da spec 043. Confirmado em 2026-09-21: a política de atualização de Agendamento alcança a coluna da autoria.

**Blocked by:** 07 (Cancelamento pela tela de Comandas grava o Motivo de Cancelamento) — os dois mexem no mesmo conjunto de funções de cancelamento, e fazer este antes obrigaria a rever a proteção depois

**Status:** done

- [x] Uma atualização direta de Agendamento feita pelo gerente não consegue alterar a autoria do cancelamento
- [x] As quatro funções de cancelamento continuam gravando a autoria normalmente
- [x] Atualizações legítimas que o gerente faz hoje em Agendamento continuam funcionando; a proteção alcança apenas a coluna da autoria
- [x] O administrador do SaaS não ganha nem perde acesso por conta deste ticket
- [x] A abordagem é do agente que pegar o ticket, desde que a recusa venha do banco e não da aplicação; uma proteção que mora só no código da tela não cumpre o critério
- [x] pgTAP provando a recusa da escrita direta, uma asserção por papel que hoje alcança a linha, e provando que cada uma das quatro funções continua gravando
- [x] pgTAP de controle provando que o gerente continua conseguindo as atualizações legítimas de Agendamento
- [x] Vale avaliar, e registrar no ticket, se o Motivo de Cancelamento merece a mesma proteção
- [x] O pgTAP 17, que já cobre a função de cancelamento da Comanda, passa inteiro depois da mudança
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Abordagem escolhida:** privilégio de coluna do Postgres. `REVOKE UPDATE ON public.appointments FROM authenticated` (a autorização de tabela inteira que o Supabase concede por padrão) seguido de `GRANT UPDATE (<16 colunas, todas menos canceled_by e cancellation_reason>) ON public.appointments TO authenticated`. RLS restringe linha, não coluna — por isso a proteção teve que vir de fora da política `appointments_update_policy`, que continua igual.
- **Motivo de Cancelamento incluído na mesma proteção:** avaliado e decidido que sim. Nenhuma tela edita `cancellation_reason` fora das quatro funções de cancelamento, e reescrevê-lo direto é o mesmo risco de reescrever a autoria — forjar o registro de por que um Agendamento foi cancelado.
- **Vermelho provado por mutação, achado real:** a primeira tentativa foi só `REVOKE UPDATE (canceled_by, cancellation_reason) ON public.appointments FROM authenticated`, sem tocar a permissão de tabela. pgTAP 56 (novo) rodado contra essa versão continuou passando nas 4 asserções que deveriam falhar — a proteção não teve efeito nenhum. Causa: `authenticated` tinha `UPDATE` concedido no **nível da tabela** (`relacl`, o `GRANT ALL ON TABLE` padrão do Supabase), que autoriza `UPDATE` em qualquer coluna independente de qualquer `REVOKE` por coluna; `REVOKE` por coluna só revoga privilégio concedido no nível da coluna. Corrigido revogando o `UPDATE` de tabela inteiro e reconcedendo só nas 16 colunas que não são autoria nem motivo. Conferido depois via `pg_class.relacl` (authenticated perdeu o `w`) e `pg_attribute.attacl` (as 16 colunas ganharam `{authenticated=w/postgres}`; `canceled_by` e `cancellation_reason` ficaram com `attacl` nulo, sem `UPDATE` nenhum).
- Migration `supabase/migrations/20260922120000_044_ticket08_autoria_protegida_contra_escrita_direta.sql`, aplicada no ambiente de desenvolvimento. `anon` e `service_role` não foram tocados (permissão de tabela inteira preservada nos dois).
- pgTAP 56 (novo, 15 asserções): escrita direta na autoria e no motivo recusada para gerente e para proprietário (admin SaaS, via `is_saas_admin`); atualização legítima do gerente em outra coluna (`notes`) continua funcionando e realmente grava; as quatro funções de cancelamento (`cancel_appointment_by_manager`, `cancel_comanda_appointment`, `cancel_appointment_by_token`, `cancel_appointment_by_public_session`) continuam gravando autoria (e motivo, na do gestor) normalmente, porque rodam `SECURITY DEFINER` como dono da tabela (`postgres`), que ignora `GRANT`/`REVOKE` de coluna por ser dono. **15/15.**
- Barbeiro não foi testado separadamente na recusa direta porque `appointments_update_policy` já recusa esse papel na cláusula `USING` — não chega a alcançar a linha, então o privilégio de coluna nem entra em jogo para ele.
- pgTAP 53 (autoria, spec 043) e 17 (code review regressions) rerodados sem alteração: nenhum dos dois faz escrita direta em `canceled_by`/`cancellation_reason` como gerente ou proprietário (o único `UPDATE` direto em 53 é a checagem do domínio da coluna, que roda antes da troca de papel para `authenticated`, portanto como dono da tabela — não afetado). **53: 25/25. 17: 26/26.**
- Suíte completa da aplicação: 110 arquivos, 1198 testes (nenhuma tela escreve essas colunas direto; nenhum teste de aplicação mudou). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Contagens do banco no ambiente de desenvolvimento, conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01. Todo teste rodou dentro de transação desfeita; nada ficou para trás.
- Migration só aplicada no ambiente de desenvolvimento; a aplicação em produção fica adiada por decisão do responsável (ver Out of Scope da spec 044), sem ticket próprio enquanto ele não decidir promover.
