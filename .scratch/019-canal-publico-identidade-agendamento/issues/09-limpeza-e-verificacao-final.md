# 09 — Limpeza segura e verificação de regressão

**What to build:** O sistema elimina somente clientes provisórios órfãos e comprova, por testes e consultas operacionais, que os fluxos público, de cliente e interno permanecem íntegros.

**Blocked by:** 08 — Desativação segura do legado e endurecimento de permissões.

**Status:** concluído

- [x] A limpeza identifica candidatos por critérios explícitos e exclui apenas clientes sem referências protegidas.
- [x] Agendamentos, comandas e lista de espera são verificados antes de qualquer remoção.
- [x] Não são removidos clientes completos, clientes vinculados ou registros necessários para auditoria.
- [x] A suíte de testes, o build e as verificações de integração são executados com resultado registrado.
- [x] O banco é consultado via MCP antes e depois da limpeza para confirmar contagens, constraints, funções, grants e advisors relevantes.
- [x] São executados smoke tests dos fluxos público anônimo, cliente reconhecido, agendamento para terceiro, cancelamento, reagendamento e novo agendamento.

## Validação registrada

- Supabase MCP antes da limpeza: 1 cliente, 0 provisórios, 0 órfãos; nenhum registro em agendamentos, comandas ou lista de espera.
- Supabase MCP depois da limpeza: 0 clientes, 0 provisórios, 0 órfãos; migration `cleanup_orphan_provisional_customers_065` e compatibilidade `allow_incomplete_customer_confirmation_066` registradas.
- Testes SQL: limpeza `ok 17`; identidade pública `ok 12`; permissões legadas `ok 10`; confirmação transacional `ok 16`.
- Smoke tests: 31 testes aprovados. Suíte completa: 50 arquivos e 267 testes aprovados. Build e `tsc -b` aprovados.
