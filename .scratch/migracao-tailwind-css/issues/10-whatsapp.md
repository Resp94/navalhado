# 10: Configuração de WhatsApp

**What to build:** a tela de configuração de mensageria (`Whatsapp.css`, 1.118 linhas) passa a usar utilitários Tailwind, preservando os templates, status de conexão e QR code.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] `Whatsapp.css` removido, com toda regra convertida
- [x] Fluxo de conexão (QR code), edição de template e status verificados manualmente sem mudança de comportamento
- [x] Testes existentes continuam passando, com seletores por classe CSS removida reescritos
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando
