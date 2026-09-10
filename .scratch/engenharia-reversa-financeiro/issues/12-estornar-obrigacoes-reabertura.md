# 12 — Estornar obrigações na reabertura

**What to build:** Ao reabrir uma comanda, as obrigações de comissão relacionadas são estornadas de forma auditável e o sistema impede uma posição financeira incoerente.

**Blocked by:** 06 — Reabrir comanda atomicamente; 10 — Registrar obrigações de comissão; 11 — Aplicar quitações às obrigações.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP os estados possíveis de obrigação e quitação no DEV.
- [ ] Definir e testar a regra para reabertura com comissão ainda aberta, parcialmente paga ou totalmente paga.
- [ ] Criar migration nova para registrar estornos referenciados em vez de apagar obrigações.
- [ ] Executar o estorno dentro da transação de reabertura da comanda.
- [ ] Restaurar corretamente o saldo quando a obrigação ainda não tiver pagamento.
- [ ] Bloquear ou tratar explicitamente reabertura com quitação já aplicada, sem fabricar saldo.
- [ ] Impedir duplicação em repetição ou concorrência.
- [ ] Manter tenant, profissional, comanda e origem rastreáveis.
- [ ] Refletir o estorno nas métricas e no extrato do profissional.
- [ ] Aplicar no DEV pelo MCP e validar todos os estados de pagamento e rollback.
