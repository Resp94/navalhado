# 08: Hub Financeiro

**What to build:** o Hub Financeiro (`Financeiro.css`, 839 linhas, mais `CaixaTab`, `ComissoesTab` e os modais `FechamentoCaixaModal`, `AberturaAssistidaCaixaModal`, `ExtratoSessaoCaixaModal`, `QuitacaoComissaoModal`, `BaixaDialog`, `LancarValeModal`, `ExtratoContaProfissionalModal`) passa a usar utilitários Tailwind em todas as suas abas.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] `Financeiro.css` removido, com toda regra convertida
- [ ] Bloco `<style>` inline de cada modal e tab listado removido e convertido
- [ ] Fluxo de abertura/fechamento de caixa, quitação de comissão, baixa e vale verificado manualmente sem mudança de comportamento
- [ ] Testes existentes desses componentes continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
