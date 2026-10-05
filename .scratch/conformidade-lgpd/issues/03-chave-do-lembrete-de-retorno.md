# 03: A barbearia liga e desliga o lembrete de retorno

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** os ajustes do WhatsApp ganham a chave "Lembrete de retorno", ao lado de confirmação, lembrete e cancelamento. Ela vem ligada, para preservar o comportamento de hoje. Com a chave desligada, o cron `/process-return-reminders` pula aquela barbearia.

Hoje o cron roda para toda instância `connected` (`whatsapp-integration/index.ts`, por volta da linha 2530), e a cláusula 8.4 dos Termos tem um `[A DEFINIR]` esperando este ticket.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Migration só no DEV: `send_return_reminders boolean not null default true` na tabela de instâncias, exposta onde as outras `send_*` são lidas e gravadas
- [ ] O cron filtra as instâncias pela coluna
- [ ] Tela `/whatsapp`: a chave, com o mesmo padrão das outras
- [ ] pgTAP: a coluna existe com o padrão `true`, e o Gerente só altera a da própria barbearia
- [ ] Vitest da tela: a chave lê e grava
- [ ] Publicar `whatsapp-integration` no DEV só com o OK do usuário
- [ ] Gates de lint, Vitest e build passam
