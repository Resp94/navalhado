# 05 — Passo 3 do Wizard: Catálogo Inicial de Serviços em 1 Clique

**What to build:**
A terceira etapa do Wizard de Onboarding responsável por montar o cardápio de serviços da barbearia de forma ultrarrápida: oferece chips de sugestão em 1 clique com os serviços clássicos brasileiros, pré-preenche o *"Corte Tradicional"* com o preço base definido no Passo 2, permite a inserção manual flexível de outros serviços (nome, preço, duração em múltiplos de 15 min e categoria), gerencia a tabela dinâmica de serviços e bloqueia o avanço caso a lista esteja vazia.

**Blocked by:** 04 — Passo 2 do Wizard: Segmentação Comercial e Inteligência de Negócio

**Status:** ready-for-agent

- [ ] Componente `StepServices` renderizado no terceiro passo do Wizard.
- [ ] Sugestão automática inicial do serviço *"Corte Tradicional"* com o valor herdado do `base_cut_price` do Passo 2 e duração de 30 minutos.
- [ ] Chips de adição rápida em 1 clique para *"Barba"* (ex: R$ 35, 30 min), *"Corte + Barba"* (ex: R$ 70, 50 min), *"Pezinho/Acabamento"* (ex: R$ 20, 15 min) e *"Sobrancelha"* (ex: R$ 15, 15 min).
- [ ] Formulário inline/modal para inclusão manual de serviços personalizados com Nome, Preço (R$), Duração (seletor de 15 a 300 minutos) e Categoria.
- [ ] Tabela/Lista visual de serviços adicionados com suporte a exclusão individual.
- [ ] Validação rigorosa exigindo no mínimo 1 serviço ativo cadastrado na lista para liberar o avanço para o Passo 4.
