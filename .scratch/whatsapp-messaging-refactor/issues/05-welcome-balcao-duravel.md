# 05 — Welcome de balcão durável

**What to build:** Um cliente criado no balcão com telefone válido recebe exatamente um welcome, enquanto outras origens não recebem essa mensagem; falhas temporárias permanecem pendentes para reprocessamento automático.

**Blocked by:** 01 — Seam de despacho e baseline de regressão; 03 — Contrato canônico de templates

**Status:** ready-for-agent

- [ ] A criação de cliente com origem balcão registra um evento durável na mesma transação do cadastro.
- [ ] Origens agenda, online, importação, canal do cliente e WhatsApp não geram welcome de balcão.
- [ ] O handler revalida tenant, origem, telefone, instância conectada e configuração de envio antes de despachar.
- [ ] O evento possui idempotência por cliente e tipo de welcome.
- [ ] Falha de timeout, indisponibilidade da Edge Function ou erro temporário do provider mantém o evento reprocessável.
- [ ] Worker com lease e backoff não permite dois processadores enviarem a mesma mensagem simultaneamente.
- [ ] `welcome_sent_at` só é preenchido após aceite de envio pelo provider.
- [ ] Uma execução repetida após sucesso não gera novo envio.
