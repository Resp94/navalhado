# 03 — Restringir operações financeiras e de estoque

**What to build:** Operações sensíveis de estoque e financeiro passam a exigir usuário ativo, papel autorizado e tenant correto no próprio banco, sem retirar permissões necessárias dos fluxos funcionais existentes.

**Blocked by:** 01 — Congelar contratos e integridade atuais.

**Status:** ready-for-agent

- [ ] Inventariar no DEV, pelo MCP, os acessos efetivamente usados antes de alterar policies ou grants.
- [ ] Definir matriz explícita de leitura e escrita para barbeiro, gerente, proprietário global, usuário inativo, anônimo e backend.
- [ ] Criar migration nova e versionada para as mudanças de autorização.
- [ ] Exigir usuário ativo e tenant válido nas funções auxiliares usadas por operações sensíveis.
- [ ] Restringir escrita direta em movimentos de caixa, movimentos de produto e quitações ao mínimo necessário.
- [ ] Preservar tabelas deliberadamente privadas ao backend sem expô-las ao cliente.
- [ ] Manter funções privilegiadas com `search_path` fixo, schemas qualificados e grants mínimos.
- [ ] Provar isolamento entre tenants e bloqueio de usuários inativos por testes com papéis reais.
- [ ] Aplicar e validar a migration somente no DEV pelo MCP.
- [ ] Comparar advisors e fluxos funcionais antes e depois, sem introduzir novo alerta no escopo.
