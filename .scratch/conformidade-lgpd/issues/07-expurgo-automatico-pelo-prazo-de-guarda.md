# 07: Expurgo automático pelo prazo de guarda e das sessões anônimas vencidas

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** duas rotinas diárias de `pg_cron`.

- **Barbearias:** exclui, com a função do ticket 06, as barbearias cujo Estado de Acesso está `blocked` há mais do que o prazo de guarda. O prazo fica numa constante do banco.
- **Canal do Cliente:** apaga as `public_customer_sessions` vencidas há mais de 30 dias e os usuários anônimos do Auth que ficaram sem sessão.

Hoje nada é eliminado, e a Política (seção 8) promete um prazo.

**Blocked by:** 06; decisão do prazo de guarda (sugestão: 12 meses; diagnóstico, seção 3, item 1). A parte das sessões anônimas não depende de nada e pode sair antes

**Status:** blocked (decisão do prazo)

- [ ] Migration só no DEV: a constante, as duas funções e os dois agendamentos
- [ ] Como saber "bloqueada desde quando": pelo dado que a 052 já grava (fim do período pago, fim do teste, data do bloqueio). Anotar a regra escolhida
- [ ] pgTAP:
  - só a barbearia além do prazo é excluída;
  - a que voltou a pagar não é;
  - a sessão vencida há 31 dias some e a de 29 fica;
  - o usuário anônimo com sessão viva fica
- [ ] Gates de lint, Vitest e build passam
