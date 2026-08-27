# 04 — Templates de WhatsApp com Link Opcional e Editor Visual Flexível

**What to build:**
A flexibilização dos modelos de mensagens de WhatsApp, permitindo que o gerente salve templates (como a Confirmação de Agendamento) com ou sem a tag `{link}`. Desacoplar a validação de domínio em `src/modules/whatsapp/templates.ts`, habilitar o salvamento e envio de testes no editor visual de `src/pages/gerente/Whatsapp.tsx` e exibir dica explicativa amigável sobre o funcionamento do primeiro contato diário.

**Blocked by:** 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function

**Status:** ready-for-agent

- [ ] Modificar `validateWhatsappTemplate` em `templates.ts` para que `isValid` dependa exclusivamente de `isWithinLengthLimit` (máximo 2000 caracteres), mantendo `hasLink` como flag descritiva.
- [ ] Atualizar `Whatsapp.tsx` para não desabilitar o botão "Salvar Modelo" na ausência de `{link}`.
- [ ] Substituir o banner vermelho de bloqueio por card informativo sutil com dica sobre o envio automático do link na 1ª mensagem do dia.
- [ ] Permitir envio de teste de mensagem sem a tag `{link}` para o WhatsApp do gerente.
- [ ] Atualizar testes em `templates.test.ts` e `Whatsapp.test.tsx` garantindo cobertura do novo comportamento.
