# 04 — Templates de WhatsApp com Link Opcional e Editor Visual Flexível

**What to build:**
A flexibilização dos modelos customizados de WhatsApp no módulo `src/modules/whatsapp/templates.ts` e no editor visual do painel do gerente `src/pages/gerente/Whatsapp.tsx`: remover a obrigatoriedade estrita da tag `{link}` no salvamento dos modelos, adicionar aviso contextual ao usuário explicando o anexo automático na 1ª mensagem do dia caso a tag seja omitida, e manter a pré-visualização fidedigna no simulador.

**Blocked by:** 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function

**Status:** done

- [x] Atualizar `validateWhatsappTemplate` em `src/modules/whatsapp/templates.ts` tornando a tag `{link}` opcional (`isValid = isWithinLengthLimit`).
- [x] Atualizar o editor visual em `src/pages/gerente/Whatsapp.tsx` removendo o bloqueio do botão "Salvar Modelo" quando `{link}` não for fornecido.
- [x] Exibir card informativo no editor visual alertando que a tag `{link}` ausente será anexada automaticamente apenas na 1ª mensagem do dia ao cliente.
- [x] Atualizar testes de unidade em `templates.test.ts` e `Whatsapp.test.tsx`.
