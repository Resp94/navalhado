# 06 — Registrar no-show e bloquear movimentação financeira

**What to build:** Adicionar a ação operacional `Cliente não compareceu`, refletir `no_show` na agenda e impedir que uma comanda vinculada gere novos movimentos financeiros após a ausência.

**Blocked by:** None — can start immediately

**Status:** completed

- [x] A ação é diferente de `Cancelar agendamento` e usa o status `no_show` já existente.
- [x] A ação aparece somente depois do horário do atendimento no timezone do tenant e para estados `pending` ou `confirmed`.
- [x] A ação não aparece ou é rejeitada para `in_progress`, `completed`, `canceled` e `no_show`.
- [x] A atualização revalida o estado no momento da gravação para evitar sobrescrever uma alteração concorrente.
- [x] O atendimento permanece visível na Agenda desktop e mobile com identificação visual `Não compareceu`.
- [x] Somente comanda vinculada ainda aberta é alterada para cancelada; comanda já fechada e seu histórico são preservados.
- [x] O cliente impede checkout inválido com mensagem clara e o banco impede pagamentos ou fechamento posteriores para atendimento `no_show`.
- [x] A alteração de banco é uma migration versionada, aplicada e validada via MCP do Supabase, com teste pgtap e advisors verificados.
- [x] Existem testes de elegibilidade, timezone, transições concorrentes, comanda aberta, comanda fechada, pagamento bloqueado e idempotência.
