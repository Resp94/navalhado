# 03: Período de teste, Estado de Acesso e bloqueio do painel

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** toda barbearia tem 15 dias de teste. O painel avisa nos últimos 3 dias e, quando o teste vence sem assinatura, o Gerente e o Barbeiro veem só a tela de bloqueio.

- **Assinatura do tenant.**
  - `tenant_subscriptions` passa a ter uma linha por tenant, com unicidade.
  - As situações passam a ser: em teste, ativa, pagamento recusado, bloqueada, cancelada e cortesia. Os valores antigos são convertidos.
  - Campos novos: fim do teste, início e fim do período pago, data da primeira recusa, data do bloqueio, data do cancelamento, fim da cortesia, plano agendado, id da assinatura no Mercado Pago, e bandeira e final do cartão. Os campos antigos de início, fim e ciclo são absorvidos.
  - Só o Gerente lê a assinatura do próprio tenant (a linha guarda cartão e id do Mercado Pago); o Barbeiro não lê a tabela e recebe só o Estado de Acesso pela RPC. Nenhum dos dois escreve nela. (Ajustado na revisão do ticket: antes o Barbeiro também lia.)
- **Tenants existentes:** a migração coloca as assinaturas ativas e com pagamento recusado em teste, com fim em 15 dias a partir do dia em que roda em cada ambiente. Suspensas ficam bloqueadas e canceladas ficam canceladas. (Ajustado na revisão do ticket: antes toda linha virava teste, o que reabriria uma barbearia suspensa.)
- **Cadastro:** a barbearia nova nasce em teste, com fim em 15 dias.
- **Estado de Acesso:** uma função do banco devolve "liberado", "liberado com aviso" ou "bloqueado", com o motivo e a data relevante, seguindo as regras da spec para todas as situações. Nesta fatia, só o teste e a cortesia precisam funcionar de ponta a ponta. As outras situações ficam cobertas pelo pgTAP.
- **Rotina diária** (pg_cron, no modelo das rotinas do WhatsApp): grava o bloqueio do teste vencido e da cortesia vencida, com a data do bloqueio.
- **Porteiro:** nos layouts do Gerente e do Barbeiro, ao lado do redirecionamento atual para o onboarding.
  - Bloqueado: tela de bloqueio com o motivo. Para o Gerente, com o lugar reservado para "Pagar", que fica ativo no ticket 05. Para o Barbeiro, só a explicação de que o acesso da barbearia está suspenso.
  - Com aviso: faixa no topo com os dias restantes do teste.
- O painel não ganha regra de acesso nova no banco por causa da assinatura.
- O `CONTEXT.md` ganha os termos Assinatura do Tenant, Estado de Acesso e Período de Teste.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** done

- [x] pgTAP do Estado de Acesso em cada situação e nas bordas de data: último dia do teste, os 3 dias de aviso, dias 4 e 5 da recusa, fim do período da cancelada, cortesia com e sem fim
- [x] pgTAP da rotina: bloqueia o teste vencido e grava a data do bloqueio; não mexe em teste válido
- [x] pgTAP de leitura: o Gerente lê só a assinatura do próprio tenant, o Barbeiro não lê a tabela, e nenhum dos dois consegue alterá-la
- [x] Teste do layout do Gerente: bloqueado mostra a tela de bloqueio; com aviso mostra a faixa; liberado mostra o painel; o redirecionamento para o onboarding continua funcionando
- [x] Teste do layout do Barbeiro: bloqueado mostra a explicação
- [x] Conferido no DEV: toda assinatura existente em teste com fim em 15 dias; um cadastro novo nasce em teste
- [x] `npm run lint`, `npm test` e `npm run build` passam
- [x] Anotado no resultado: a partir deste ticket, o DEV bloqueia teste vencido sem caminho de pagamento até o ticket 05. Nada vai para prod antes do 05.

## Resultado (2026-09-29)

- **Migrations** aplicadas no DEV (`selvxobcjbkligxighlp`): `052_ticket03_periodo_de_teste_e_estado_de_acesso`, versão `20260929185517`, e `052_ticket03_leitura_da_assinatura_so_para_o_gerente`, versão `20260929193127` (fecha a leitura da tabela para o Barbeiro, achado da revisão). A primeira teve a conversão dos valores antigos corrigida depois de aplicada (ver Conversão); o arquivo tem a versão final e o resultado no DEV é o mesmo, porque as 3 linhas eram `active`.
- **Aviso: a partir deste ticket, o DEV bloqueia teste vencido sem caminho de pagamento até o ticket 05. Nada vai para prod antes do 05.** Em prod, a migration coloca as assinaturas existentes em teste de 15 dias a partir do dia em que rodar; se ela subir antes do 05, o fim dos 15 dias bloqueia as barbearias sem ter como pagar.
- **`tenant_subscriptions`:** uma linha por tenant (`unique`), situações `trialing`, `active`, `past_due`, `blocked`, `canceled` e `courtesy`, campos novos da spec e `start_date`, `end_date` e `billing_cycle` removidos. A migration para se houver mais de uma linha por tenant, em vez de apagar uma delas em silêncio. Constraints: teste exige `trial_ends_at`, recusa exige `first_failed_at`, motivo de bloqueio só aceita os motivos conhecidos.
- **Campo além da spec: `blocked_reason`** (`trial_expired`, `payment_failed`, `canceled`, `courtesy_expired`). Sem ele, depois que a rotina grava `blocked`, a tela de bloqueio não saberia dizer se foi o teste, a recusa ou o cancelamento.
- **Conversão:** `active` e `past_due` viram `trialing` com fim em 15 dias; `suspended` vira `blocked` (data do bloqueio = última alteração da linha) e `canceled` continua `canceled` (com a data do cancelamento). Conferido no DEV: 3 assinaturas, todas `trialing`, fim em 14/10/2026. A conversão dos 4 valores antigos foi validada numa tabela temporária, com rollback.
- **Estado de Acesso:** `private.subscription_access_state(linha, agora)` calcula, `private.tenant_access_state(tenant, agora default now())` busca a assinatura, e a RPC `public.get_my_access_state()` devolve o estado da barbearia de quem chama (sem receber tenant; usuário sem tenant recebe zero linhas). Só a RPC é executável por `authenticated`. Bordas: teste com exatamente 3 dias restantes já avisa, 3 dias e 1 segundo não; no instante do fim do teste bloqueia; recusa avisa até o quinto dia e bloqueia a partir de `first_failed_at + 5 dias`; cancelada libera até o fim do período pago; cortesia sem fim libera sempre, vencida bloqueia; barbearia sem assinatura não é bloqueada.
- **Rotina diária** `private.block_expired_subscriptions(agora default now())`, agendada no pg_cron como `block-expired-subscriptions` às `5 3 * * *`. Chama SQL direto, sem Edge Function. A data do bloqueio é o instante em que o acesso acabou (fim do teste, quinto dia da recusa, fim do período), e não o da rotina, para valer igual ao estado que a função já devolvia. A rotina reavalia o estado dentro do próprio `UPDATE`, então assinatura que virou ativa no meio da execução não é bloqueada.
- **Cadastro** (`handle_new_user`): assinatura nasce `trialing` com fim em `now() + 15 dias`.
- **Admin:** `view_tenants_management` deixou de esconder a assinatura cancelada e o `subscription_end_date` passou a ser o fim do teste, da cortesia, o bloqueio ou o fim do período pago, conforme a situação. `get_admin_dashboard_metrics` soma o preço das ativas no MRR e conta as bloqueadas como suspensas.
- **Tela Admin > Tenants:** rótulos e badges das novas situações. "Ativar" virou "Dar cortesia" (grava `courtesy` sem data de fim, registrada como cortesia e tratada pelo Estado de Acesso), "Suspender" grava `blocked`. Continua gravando o status direto, de forma interina, até o ticket 15 trazer as ferramentas do Proprietário. Os campos gravados numa mudança manual saem de `camposDaMudancaManual`, com teste.
- **`AuthGuard`:** deixou de consultar `tenant_subscriptions` e de derrubar a sessão de tenant `suspended`. O bloqueio agora é do porteiro dos layouts, que não desloga: o usuário bloqueado precisa ficar logado para ver a tela e, no caso do Gerente, exportar os dados (ticket 14).
- **Front, módulo `src/modules/assinatura/`:** repositório, adaptadores Supabase e em memória, `useEstadoDeAcesso`, mensagens e situações. O hook não recebe tenant: a leitura sai assim que o layout monta, em paralelo com os dados da barbearia, e relê quando a aba volta a ficar visível. **Falha na leitura abre o painel**, porque o bloqueio de verdade não depende do front (canal do cliente e WhatsApp entram no ticket 04), e tenta de novo a cada 30 segundos até ler; se a releitura falha depois de um estado conhecido, mantém o último.
- **Porteiro nos layouts:** `GerenteLayout` mostra a tela de bloqueio (motivo, "Pagar" reservado e desativado, "Sair da conta") antes de qualquer rota, inclusive o onboarding, e a faixa de aviso com os dias restantes no topo do conteúdo. O texto do Gerente depende do motivo: teste ou cortesia vencidos pedem para assinar, pagamento recusado pede para atualizar o cartão, cancelada explica o cancelamento. `BarbeiroLayout` mostra só a explicação e "Sair da conta". Enquanto o estado não chega, os dois mostram o esqueleto, para o painel não piscar antes do bloqueio.
- **Testes:** pgTAP 65 (novo, 76 asserções, 76/76), pgTAP 64 atualizado para o esquema novo. Vitest: módulo `assinatura`, telas de bloqueio e faixa, hook, `AuthGuard`, `GerenteLayout` e `BarbeiroLayout`.
- `CONTEXT.md` ganhou Assinatura do Tenant, Período de Teste e Estado de Acesso.

### Decisões que valem lembrar

- **O bloqueio do painel é só no front.** Um Gerente ou Barbeiro bloqueado que chame a API direto ainda lê e escreve como antes. A spec quer assim (o Gerente exporta os dados). O que o servidor passa a impedir vem no ticket 04: agendamento pelo cliente e envio de WhatsApp.
- **Falha ao ler o estado não bloqueia ninguém.** É o contrário do "fail closed" de segurança, de propósito: travar todas as barbearias por uma falha de rede seria pior do que deixar uma bloqueada abrir o painel por alguns segundos.
- **"Dar cortesia" em Admin > Tenants** grava cortesia sem fim, que libera sempre. Para encerrar, "Suspender" ou "Bloquear". O ticket 15 traz cortesia com data de fim e o desbloqueio de verdade.
- **Cancelar em Admin > Tenants** sem período pago em andamento bloqueia na hora (cancelada sem período pago é bloqueada).
- **Exportar dados** aparece na tela de bloqueio só no ticket 14, e "Pagar" só fica ativo no 05.

### Revisão de código

Oito achados, todos aplicados: leitura da tabela só para o Gerente (migration nova e pgTAP), nova tentativa quando a primeira leitura falha, leitura do estado em paralelo com os dados da barbearia, texto de bloqueio por motivo, hook sem chave de tenant (o estado é do usuário logado, e o layout desmonta no logout; o achado da troca de tenant deixou de se aplicar), "Ativar" virou cortesia sem fim, conversão que preserva suspensas e canceladas, e o adaptador de planos e o glossário sem a ideia de "assinatura mais recente". A função do gatilho de limite (ticket 02) ainda escolhe a assinatura por `created_at desc limit 1`, o que é inofensivo com uma linha por tenant e não exigiu migration própria.

### Pendência de prod

- Confirmar que não há tenant com mais de uma assinatura antes de aplicar em prod (a migration para se houver).
