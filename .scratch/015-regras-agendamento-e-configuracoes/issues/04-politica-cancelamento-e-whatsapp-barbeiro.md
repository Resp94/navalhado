# 04 — Política de Cancelamento e Redirecionamento para WhatsApp do Barbeiro (/cliente/:token)

**What to build:** Exibição da política de cancelamento no card de agendamento ativo e, em caso de cancelamento com prazo expirado, exibição de aviso claro com botão direto de 1 clique para falar no WhatsApp do profissional responsável.

**Blocked by:** 01 — Motor de Banco de Dados, RPCs de Agendamento Dinâmico e Aplicação via MCP, 03 — Grade Dinâmica e Disclaimer de Política no Fluxo do Cliente (/cliente/:token/agendar)

**Status:** done

- [x] Atualizar `AgendamentoCanal` em `src/modules/canal-cliente/types.ts` incluindo `professional_phone?: string`.
- [x] Atualizar `SupabaseCanalClienteAdapter.ts` e `InMemoryCanalClienteAdapter.ts` para mapear `professional_phone` e tratar o erro de prazo expirado.
- [x] Exibir a política de cancelamento no card de agendamento ativo em `src/pages/cliente/MenuCliente.tsx`.
- [x] Ao clicar em cancelar/reagendar fora do prazo permitido, abrir modal informativo com botão direto de 1 clique para o WhatsApp do profissional (`https://wa.me/55...`).
