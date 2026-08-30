# 02 — Links públicos e gerenciamento da sessão

**What to build:** Todas as entradas públicas relacionadas ao cliente usam slug e sessão, mantendo compatibilidade com links legados tokenizados e apresentando uma entrada clara para gerenciamento dos agendamentos.

**Blocked by:** 01 — Entrada pública por slug e sessão do cliente.

**Status:** ready-for-agent

- [ ] Primeiro contato, confirmação, cancelamento, reagendamento e lembrete usam domínio e slug nos novos links.
- [ ] Novos links não expõem token em query string ou caminho.
- [ ] A sessão do cliente é iniciada ou recuperada após a identificação no tenant correto.
- [ ] O botão `Gerenciar meus agendamentos` permanece na tela inicial, separado do botão `Agendar`.
- [ ] Dentro do gerenciamento, `Novo agendamento` reutiliza a sessão e preenche nome e telefone na confirmação.
- [ ] `Sair` encerra a sessão e retorna ao catálogo público sem apagar dados persistidos.
- [ ] Links legados tokenizados continuam funcionando durante a transição.
- [ ] O link legado converte o contexto para a sessão pública sem criar uma segunda identidade.
- [ ] A entrada usa “Gerenciar agendamentos” ou “Meus agendamentos”, sem depender do termo isolado “Histórico”.
- [ ] O fluxo de gerenciamento não permite acessar agendamentos de outro tenant.
- [ ] Testes automatizados cobrem os cinco tipos de link e a compatibilidade legada.
- [ ] A validação manual em DEV confirma os links em desktop e mobile com prints sem dados sensíveis.
