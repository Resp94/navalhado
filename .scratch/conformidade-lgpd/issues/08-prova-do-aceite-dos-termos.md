# 08: O aceite guarda IP e user agent, sobrevive à exclusão e o texto fica amarrado à versão

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:**

- `terms_acceptances` ganha `ip`, `user_agent` e `email`. `accept_terms` e o gatilho do cadastro os leem dos cabeçalhos da requisição e congelam o e-mail.
- A chave estrangeira para o usuário passa a `on delete set null`: apagar o usuário não apaga o aceite.
- Um teste do Vitest guarda o hash de cada versão publicada dos textos e falha se o texto da versão atual mudar sem a versão mudar.

Hoje o aceite só guarda a versão e a data, some com o usuário, e nada amarra o texto à versão (limitações do ticket 16 da 052).

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Migration só no DEV. Os aceites que já existem ficam com IP e user agent nulos e o e-mail preenchido a partir de `public.users`
- [ ] A unicidade `(user_id, version)` continua valendo para o usuário vivo; o aceite órfão (`user_id` nulo) não colide
- [ ] pgTAP 79 atualizado (ou um novo):
  - IP e user agent gravados;
  - o aceite fica, com o e-mail, depois de apagar o usuário;
  - o navegador continua sem escrever direto
- [ ] Vitest: o hash da versão `2026-10-02` está registrado, e mudar o texto falha o teste com uma mensagem que manda trocar a versão
- [ ] Gates de lint, Vitest e build passam
