# 04: Plano de Contas e Contas a Pagar

**What to build:** as telas de Plano de Contas (`PlanoContas.css`, 90 linhas) e Contas a Pagar (`ContasPagar.css`, 126 linhas), incluindo os modais associados (`ContaPagarForm`, `ContaPagarDetalheDrawer`, `EditarContaDialog`, `CategoriaDespesaForm`, `FornecedorForm`, `EstenderSerieDialog`), passam a usar utilitários Tailwind, sem CSS dedicado nem `<style>` inline remanescente.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] `PlanoContas.css` e `ContasPagar.css` removidos, com toda regra convertida em utilitário Tailwind equivalente
- [ ] Bloco `<style>` inline dos modais listados removido e convertido
- [ ] Fluxo de criar/editar/excluir categoria de despesa, fornecedor e conta a pagar verificado manualmente sem mudança de comportamento
- [ ] Testes existentes desses componentes continuam passando, com seletores por classe CSS removida reescritos para role/texto/label
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
