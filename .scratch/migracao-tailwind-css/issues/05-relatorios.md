# 05: Módulo de Relatórios

**What to build:** o módulo de Relatórios (`Relatorios.css`, 322 linhas, mais os componentes de gráfico e tabela `FaturamentoGrafico`, `ClientesGrafico`, `ClientesOrigemDosClientes`, `ClientesSemRetornoTabela`, `RankingProfissionais`, `AgendaMapaDeCalor`, `AgendaPorProfissional`) passa a usar utilitários Tailwind, preservando a leitura visual de cada gráfico e tabela.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] `Relatorios.css` removido, com toda regra convertida
- [x] Bloco `<style>` inline de cada componente de gráfico/tabela listado removido e convertido
- [x] Cada um dos relatórios (Faturamento, Equipe e Serviços, Agenda, Clientes, Clientes sem Retorno) verificado manualmente sem mudança de leitura visual dos números, cores de série e legendas
- [x] Testes existentes desses componentes continuam passando, com seletores por classe CSS removida reescritos
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando
