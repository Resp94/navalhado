# 03: Período de teste, Estado de Acesso e bloqueio do painel

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** toda barbearia tem 15 dias de teste. O painel avisa nos últimos 3 dias e, quando o teste vence sem assinatura, o Gerente e o Barbeiro veem só a tela de bloqueio.

- **Assinatura do tenant.**
  - `tenant_subscriptions` passa a ter uma linha por tenant, com unicidade.
  - As situações passam a ser: em teste, ativa, pagamento recusado, bloqueada, cancelada e cortesia. Os valores antigos são convertidos.
  - Campos novos: fim do teste, início e fim do período pago, data da primeira recusa, data do bloqueio, data do cancelamento, fim da cortesia, plano agendado, id da assinatura no Mercado Pago, e bandeira e final do cartão. Os campos antigos de início, fim e ciclo são absorvidos.
  - Gerente e Barbeiro só leem a assinatura do próprio tenant e não escrevem nela.
- **Tenants existentes:** a migração coloca toda assinatura atual em teste, com fim em 15 dias a partir do dia em que roda em cada ambiente.
- **Cadastro:** a barbearia nova nasce em teste, com fim em 15 dias.
- **Estado de Acesso:** uma função do banco devolve "liberado", "liberado com aviso" ou "bloqueado", com o motivo e a data relevante, seguindo as regras da spec para todas as situações. Nesta fatia, só o teste e a cortesia precisam funcionar de ponta a ponta. As outras situações ficam cobertas pelo pgTAP.
- **Rotina diária** (pg_cron, no modelo das rotinas do WhatsApp): grava o bloqueio do teste vencido e da cortesia vencida, com a data do bloqueio.
- **Porteiro:** nos layouts do Gerente e do Barbeiro, ao lado do redirecionamento atual para o onboarding.
  - Bloqueado: tela de bloqueio com o motivo. Para o Gerente, com o lugar reservado para "Pagar", que fica ativo no ticket 05. Para o Barbeiro, só a explicação de que o acesso da barbearia está suspenso.
  - Com aviso: faixa no topo com os dias restantes do teste.
- O painel não ganha regra de acesso nova no banco por causa da assinatura.
- O `CONTEXT.md` ganha os termos Assinatura do Tenant, Estado de Acesso e Período de Teste.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** ready-for-agent

- [ ] pgTAP do Estado de Acesso em cada situação e nas bordas de data: último dia do teste, os 3 dias de aviso, dias 4 e 5 da recusa, fim do período da cancelada, cortesia com e sem fim
- [ ] pgTAP da rotina: bloqueia o teste vencido e grava a data do bloqueio; não mexe em teste válido
- [ ] pgTAP de leitura: o Gerente e o Barbeiro leem só a assinatura do próprio tenant e não conseguem alterá-la
- [ ] Teste do layout do Gerente: bloqueado mostra a tela de bloqueio; com aviso mostra a faixa; liberado mostra o painel; o redirecionamento para o onboarding continua funcionando
- [ ] Teste do layout do Barbeiro: bloqueado mostra a explicação
- [ ] Conferido no DEV: toda assinatura existente em teste com fim em 15 dias; um cadastro novo nasce em teste
- [ ] `npm run lint`, `npm test` e `npm run build` passam
- [ ] Anotado no resultado: a partir deste ticket, o DEV bloqueia teste vencido sem caminho de pagamento até o ticket 05. Nada vai para prod antes do 05.
