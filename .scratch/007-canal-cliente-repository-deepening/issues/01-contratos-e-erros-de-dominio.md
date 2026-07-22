# 01 — Contratos de Tipos e Erros de Domínio do Canal do Cliente

**What to build:** As interfaces de contrato de dados (`PerfilClienteCanal`, `ServicoCanal`, `ProfissionalCanal`, `AgendamentoCanal`, DTOs de entrada) e a interface da costura (`ICanalClienteAdapter`), acompanhadas das classes de erro de domínio tipadas (`CanalClienteTokenError`, `CanalClienteValidationError`, `AgendamentoConflitoError`, `AgendamentoRegraCancelamentoError`).

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Interface `ICanalClienteAdapter` com assinaturas assíncronas para busca de perfil, catálogo, horários livres, agendamento, reagendamento e cancelamento.
- [x] Interfaces de dados unificadas em `types.ts` alinhadas ao glossário `CONTEXT.md`.
- [x] Erros de domínio tipados herdando de `Error` em `errors.ts` com mensagens amigáveis em Português.

