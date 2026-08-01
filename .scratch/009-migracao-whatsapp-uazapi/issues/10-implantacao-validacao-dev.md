# 10 — Implantar e validar no ambiente Dev

**What to build:** Disponibilizar a integração completa no Ambiente Dev Completo e Isolado, configurar a conta definitiva da Uazapi e executar o aceite automatizado e real com a única instância piloto. O ambiente Prod deve permanecer integralmente intocado.

**Blocked by:** 09 — Atualizar domínio, ADRs e documentação vigente.

**Status:** ready-for-agent

- [ ] URL base e `admintoken` da conta definitiva são configurados somente como segredos do Supabase Dev.
- [ ] Migrações, Edge Function, triggers e cron necessários são aplicados no Dev.
- [ ] Frontend Dev usa a integração atualizada e a URL Pública Dev.
- [ ] Ativação cria exatamente uma instância Uazapi para o tenant de teste.
- [ ] QR Code conecta um WhatsApp Business e atualiza o estado.
- [ ] Mensagem nova cria ou reutiliza Cliente Provisório e envia o link uma única vez.
- [ ] Confirmação, cancelamento, lembrete e envio de teste chegam ao destinatário esperado.
- [ ] Desconexão exige novo QR Code e uma pausa pode ser retomada.
- [ ] Webhook forjado é rejeitado e reentrega não duplica efeitos.
- [ ] Falha temporária simulada respeita a política de tentativas.
- [ ] Tokens não aparecem no navegador, nos logs revisados ou em mensagens de erro.
- [ ] Suítes frontend, Deno e SQL passam no contexto do Dev.
- [ ] O build de produção passa antes do aceite.
- [ ] Nenhum segredo, webhook, função, migration, trigger, cron ou frontend de Prod é alterado.
- [ ] O resultado do aceite e as etapas futuras de promoção são registrados em um runbook, sem executar a promoção.
