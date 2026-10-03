# 03: MRR pela próxima cobrança e barbearias liberadas e bloqueadas pelo Estado de Acesso

Parte da spec 054 (Painel do Proprietário).

**What to build:** os contadores de Admin > Dashboard passam a dizer o que vale agora.

- **Receita recorrente (MRR):** soma o valor que a próxima cobrança vai cobrar de cada assinatura `active` ou `past_due`, pelo preço do plano agendado quando há descida agendada e pelo do plano atual quando não há. Cortesia, teste, cancelada e bloqueada ficam fora.
- **Barbearias liberadas** (no lugar de "Barbearias ativas"): as barbearias com Estado de Acesso `allowed` ou `warning` agora, qualquer motivo (teste, pagante, cortesia, cancelada com período pago, Desbloqueio Manual).
- **Barbearias bloqueadas** (no lugar de "Inadimplentes / Suspensas"): as com Estado de Acesso `blocked` agora, mesmo antes de a rotina diária gravar o bloqueio.

A RPC devolve `released_tenants` e `blocked_tenants` no lugar de `active_tenants` e `suspended_tenants`, e a tela troca rótulos e textos ("com acesso liberado agora", "com acesso bloqueado agora"). Barbearia sem linha de assinatura não entra em contador.

**Blocked by:** 02 (Faturamento do mês e Evolução da receita vêm das cobranças aprovadas)

**Status:** done

- [x] Migration aplicada só no DEV pelo MCP
- [x] pgTAP (o arquivo do ticket 02): MRR com `active`, `past_due`, descida agendada (conta o plano menor) e as situações que ficam fora
- [x] pgTAP: liberadas e bloqueadas com uma barbearia por caso: teste, ativa, cortesia, cancelada com e sem período pago, bloqueada, desbloqueada à mão (liberada) e teste vencido hoje sem bloqueio gravado (bloqueada)
- [x] Vitest do Dashboard: os rótulos e textos novos com os campos novos do contrato; nenhum texto "Suspensas" ou "Inadimplentes"
- [x] Nenhum outro chamador usa os campos antigos (conferido por busca)
- [x] Gates de lint, Vitest e build passam

## Resultado

Commit 0850798. Migration `20261003204455_054_ticket03_mrr_e_barbearias_liberadas_e_bloqueadas.sql`, aplicada só no DEV. O MRR usa `coalesce(scheduled_plan_id, plan_id)` das assinaturas `active` e `past_due`; liberadas e bloqueadas contam por `private.subscription_access_state(sub, now())` por linha de `tenant_subscriptions` (a mesma regra de `tenant_access_state`, sem reler a assinatura), então barbearia sem assinatura fica fora. pgTAP 80: uma barbearia por caso (13), cada uma provando liberadas/bloqueadas/MRR por diferença.

Outro chamador dos campos antigos: o pgTAP `65_periodo_de_teste_e_estado_de_acesso.test.sql` (4 asserções) foi acompanhado ao contrato novo; 76/76 no DEV. Nenhum outro leitor de `active_tenants`/`suspended_tenants` no front, nas Edge Functions nem nos docs.

No localhost contra o DEV, logado como Proprietário: MRR R$ 0,00, 4 liberadas, 0 bloqueadas, igual à consulta independente (1 cancelada com período pago e 3 em teste; nenhuma `active`).

Texto da tela: o subtítulo do MRR passou de "Valor total das assinaturas ativas" para "Valor da próxima cobrança das assinaturas pagantes", porque "ativas" deixou de ser verdade (entram as `past_due` e o plano agendado).

Fora da regra do ticket, anotado para decisão: a cancelada que assinou de novo está liberada e vai ser cobrada, mas fica fora do MRR (o status ainda é `canceled`); a `past_due` com 5 dias ou mais conta em bloqueadas e segue no MRR (coberto agora por um caso no pgTAP 80, para o comportamento não mudar sem aviso).
