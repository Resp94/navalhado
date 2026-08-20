# 09 — Validação Visual Contínua E2E e Não-Regressão Desktop (Porta 5173)

**What to build:**
Executar a auditoria e validação visual de ponta a ponta na porta 5173 (servidor ativo) através do Chrome DevTools MCP, garantindo conformidade total em dispositivos móveis (`390px × 844px` / iPhone e `360px × 800px` / Android), ausência de erros no console do navegador, e teste de não-regressão na resolução desktop (`1440px × 900px`).

**Blocked by:** 02 — Autenticação Mobile (Login, Teclado Virtual e Bottom Sheet de Recuperação), 03 — Agenda Mobile do Gerente (Carrossel de Barbeiros + Linha do Tempo Vertical), 04 — Aba Comandas Mobile e Gaveta de Checkout Rápido, 05 — Aba Caixa Operacional do Dia e Ações Rápidas, 06 — Aba Clientes Mobile com Busca Instantânea e Disparo WhatsApp, 07 — Gaveta Menu "Mais" (Hub de Atalhos do Gerente), 08 — Experiência Mobile do Barbeiro (Minha Agenda e Minhas Comissões)

**Status:** ready-for-agent

- [ ] Validação visual na porta 5173 de todas as 5 abas do Gerente no mobile (`390px × 844px`): alternância de abas, carrossel de barbeiros na agenda, criação de agendamento, checkout de comanda em Bottom Sheet, ações de caixa e busca de clientes com WhatsApp.
- [ ] Validação visual do fluxo de Login, Teclado Virtual e Bottom Sheet de recuperação de senha no mobile.
- [ ] Validação visual do fluxo do Barbeiro (`MinhaAgenda` e `MinhasComissoes`) no mobile.
- [ ] Auditoria de console do navegador: zero erros de execução de JavaScript ou alertas críticos.
- [ ] Teste de não-regressão na resolução desktop (`1440px × 900px`): comprovação de que a Navbar superior, a grade de colunas da agenda e os relatórios analíticos de financeiro continuam 100% intactos e funcionais.
- [ ] Execução da suite de testes automatizados (`npm test` / `deno test`) para certificar integridade de todas as camadas.
