# 12 — Estornar obrigações na reabertura

**What to build:** Ao reabrir uma comanda, as obrigações de comissão relacionadas são estornadas de forma auditável e o sistema impede uma posição financeira incoerente.

**Blocked by:** 06 — Reabrir comanda atomicamente; 10 — Registrar obrigações de comissão; 11 — Aplicar quitações às obrigações.

**Status:** completed

- [x] Consultar pelo MCP os estados possíveis de obrigação e quitação no DEV.
- [x] Definir e testar a regra para reabertura com comissão ainda aberta, parcialmente paga ou totalmente paga.
- [x] Criar migration nova para registrar estornos referenciados em vez de apagar obrigações.
- [x] Executar o estorno dentro da transação de reabertura da comanda.
- [x] Restaurar corretamente o saldo quando a obrigação ainda não tiver pagamento.
- [x] Bloquear ou tratar explicitamente reabertura com quitação já aplicada, sem fabricar saldo.
- [x] Impedir duplicação em repetição ou concorrência.
- [x] Manter tenant, profissional, comanda e origem rastreáveis.
- [x] Refletir o estorno nas métricas e no extrato do profissional.
- [x] Aplicar no DEV pelo MCP e validar todos os estados de pagamento e rollback.

**Evidências:** migration `20260910204244_estornar_obrigacoes_reabertura.sql` aplicada no DEV pelo MCP; teste `supabase/tests/database/12_estornar_obrigacoes_reabertura.test.sql` aprovado com 16/16 asserções. Obrigações abertas passam a `reversed`; obrigações parciais ou pagas bloqueiam a operação antes dos efeitos de estoque e pagamentos.
