# 14: Cadastros e páginas de CRUD do gerente

**What to build:** as páginas principais do gerente ainda não cobertas (`Profissionais`, `Servicos`, `Produtos`, `Comandas`, `Configuracoes`, `CadastroAcesso`) passam a usar utilitários Tailwind, mantendo o comportamento de cada CRUD.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] Bloco `<style>` inline de cada página listada removido e convertido
- [ ] Criar, editar, arquivar/desarquivar e excluir em cada uma dessas telas verificados manualmente sem mudança de comportamento
- [ ] Testes existentes dessas telas continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
