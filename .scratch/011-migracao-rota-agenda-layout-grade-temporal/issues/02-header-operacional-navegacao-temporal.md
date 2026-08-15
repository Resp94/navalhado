# 02 — Header Operacional, Navegação Temporal e Filtro de Barbeiros

**What to build:**
A barra de ferramentas superior da agenda (`agenda-header-control`) com exibição de data por extenso em PT-BR, controles de navegação temporal (`<`, `Hoje`, `>`), seletor de data e filtro seletivo de profissionais para exibição de colunas.

**Blocked by:** 01 — Migração de Schema no Supabase e Infraestrutura de Roteamento Canônico.

**Status:** completed

- [x] Botão mestre **`+ Encaixe`** renderizado em destaque visual com tokens de marca (`--color-brand-primary` / terracota) e ícone `PlusSignIcon` do `@hugeicons/react`.
- [x] Título central com tipografia `Outfit` exibindo a data por extenso formatada em PT-BR com o fuso da barbearia.
- [x] Navegação de datas funcional via botões `<` (`ArrowLeft01Icon`), `Hoje` e `>` (`ArrowRight01Icon`).
- [x] Seletor de data nativo integrado com ícone `Calendar03Icon`.
- [x] Filtro seletivo de profissionais com ícone `FilterIcon` permitindo alternar a visibilidade das colunas da equipe.
- [x] Estilização consistente com o Design System do Navalhado (`index.css`) e glassmorphism límpido.
