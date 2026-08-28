# 09 — Limpeza segura e verificação de regressão

**What to build:** O sistema elimina somente clientes provisórios órfãos e comprova, por testes e consultas operacionais, que os fluxos público, de cliente e interno permanecem íntegros.

**Blocked by:** 08 — Desativação segura do legado e endurecimento de permissões.

**Status:** ready-for-agent

- [ ] A limpeza identifica candidatos por critérios explícitos e exclui apenas clientes sem referências protegidas.
- [ ] Agendamentos, comandas e lista de espera são verificados antes de qualquer remoção.
- [ ] Não são removidos clientes completos, clientes vinculados ou registros necessários para auditoria.
- [ ] A suíte de testes, o build e as verificações de integração são executados com resultado registrado.
- [ ] O banco é consultado via MCP antes e depois da limpeza para confirmar contagens, constraints, funções, grants e advisors relevantes.
- [ ] São executados smoke tests dos fluxos público anônimo, cliente reconhecido, agendamento para terceiro, cancelamento, reagendamento e novo agendamento.
