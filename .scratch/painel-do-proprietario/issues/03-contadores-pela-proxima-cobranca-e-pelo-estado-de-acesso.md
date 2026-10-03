# 03: MRR pela próxima cobrança e barbearias liberadas e bloqueadas pelo Estado de Acesso

Parte da spec 054 (Painel do Proprietário).

**What to build:** os contadores de Admin > Dashboard passam a dizer o que vale agora.

- **Receita recorrente (MRR):** soma o valor que a próxima cobrança vai cobrar de cada assinatura `active` ou `past_due`, pelo preço do plano agendado quando há descida agendada e pelo do plano atual quando não há. Cortesia, teste, cancelada e bloqueada ficam fora.
- **Barbearias liberadas** (no lugar de "Barbearias ativas"): as barbearias com Estado de Acesso `allowed` ou `warning` agora, qualquer motivo (teste, pagante, cortesia, cancelada com período pago, Desbloqueio Manual).
- **Barbearias bloqueadas** (no lugar de "Inadimplentes / Suspensas"): as com Estado de Acesso `blocked` agora, mesmo antes de a rotina diária gravar o bloqueio.

A RPC devolve `released_tenants` e `blocked_tenants` no lugar de `active_tenants` e `suspended_tenants`, e a tela troca rótulos e textos ("com acesso liberado agora", "com acesso bloqueado agora"). Barbearia sem linha de assinatura não entra em contador.

**Blocked by:** 02 (Faturamento do mês e Evolução da receita vêm das cobranças aprovadas)

**Status:** ready-for-agent

- [ ] Migration aplicada só no DEV pelo MCP
- [ ] pgTAP (o arquivo do ticket 02): MRR com `active`, `past_due`, descida agendada (conta o plano menor) e as situações que ficam fora
- [ ] pgTAP: liberadas e bloqueadas com uma barbearia por caso: teste, ativa, cortesia, cancelada com e sem período pago, bloqueada, desbloqueada à mão (liberada) e teste vencido hoje sem bloqueio gravado (bloqueada)
- [ ] Vitest do Dashboard: os rótulos e textos novos com os campos novos do contrato; nenhum texto "Suspensas" ou "Inadimplentes"
- [ ] Nenhum outro chamador usa os campos antigos (conferido por busca)
- [ ] Gates de lint, Vitest e build passam
