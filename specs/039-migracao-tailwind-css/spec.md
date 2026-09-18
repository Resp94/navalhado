# Spec 039 — Migração completa de CSS vanilla para Tailwind CSS

## Problem Statement

O Navalhado estiliza toda a interface em CSS vanilla, sem nenhum framework utilitário. O levantamento feito em `docs/migracao-tailwind-impacto.md` mede o tamanho real desse problema: **25.142 linhas de CSS** no total, sendo 6.289 em 10 arquivos `.css` dedicados e **18.853 dentro de blocos `<style>{...}</style>` soltos em 77 componentes `.tsx`** — quase quatro vezes mais CSS embutido em componente do que em arquivo dedicado.

Esse CSS não é escopado de verdade: os blocos `<style>` inline não usam `styled-jsx` nem CSS Modules, são apenas texto injetado global no DOM, com o isolamento dependendo só da convenção de nome de classe (`mobile-agenda__*`, `financeiro__*` etc.). Quando duas telas usam nomes parecidos, ou quando um componente é removido sem remover seu bloco de estilo, o CSS órfão fica no ar sem nenhum aviso de build — foi exatamente o que aconteceu ao remover o banner de estado vazio da Agenda mobile nesta mesma sessão: o JSX saiu, mas as regras `.mobile-agenda__empty-banner*` ficaram até serem removidas manualmente.

A briga por especificidade é generalizada: **346 usos de `!important`** (183 nos arquivos `.css`, 163 inline) indicam que seletores diferentes competem pelo mesmo elemento com frequência, e cada `!important` novo é uma aposta de que vai vencer o próximo conflito também. Cada tela nova exige escrever CSS do zero, reaproveitando tokens de cor (`var(--color-*)`) só por convenção, sem nenhuma garantia estrutural de consistência.

Não há nenhuma rede de segurança automatizada contra regressão visual: os testes existentes (`vitest` + React Testing Library, 51 arquivos `*.test.tsx`) rodam em `jsdom`, que não aplica CSS — eles protegem estrutura e comportamento, nunca aparência.

## Solution

Migrar integralmente a estilização do projeto para **Tailwind CSS v4**, via plugin nativo `@tailwindcss/vite` (sem `postcss.config` nem `tailwind.config.js` manual — configuração declarada em CSS com `@theme`). Os tokens hoje definidos em `:root` de `src/index.css` (`--color-brand-primary`, `--color-bg-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--radius-*`, `--font-family-base`) viram tokens do tema Tailwind, mantendo os mesmos nomes para não quebrar o vocabulário que a equipe já usa.

O modo escuro é **removido**, não migrado: o Navalhado passa a ter apenas o tema claro. Isso elimina de saída ~160 ocorrências da classe `.dark-theme` espalhadas por 33 arquivos, reduzindo o escopo real da migração frente ao que o relatório original estimava (que assumia preservar os dois temas).

A migração cobre **todo** o CSS do projeto — os 10 arquivos `.css` dedicados e os 77 blocos `<style>` inline —, não só telas novas. A ordem de execução segue tamanho crescente de arquivo (menor esforço primeiro, para validar o processo antes dos arquivos grandes), landando em PRs independentes por área, começando pela fundação (`index.css` → tokens do tema) antes de qualquer tela.

Não há ferramenta de regressão visual automatizada nesta spec (decisão explícita, ver Testing Decisions): a verificação é manual, tela por tela, só no tema claro, nas larguras em que cada tela realmente é usada (mobile para os módulos `mobile/*`, desktop para as demais).

## User Stories

### Fundação e tooling

1. Como desenvolvedor, quero o Tailwind CSS v4 instalado via `@tailwindcss/vite`, para que o projeto não dependa de `postcss.config.js` nem `tailwind.config.js` manual.
2. Como desenvolvedor, quero os tokens de `:root` em `src/index.css` (`--color-brand-primary`, `--color-bg-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--radius-sm/md/lg/xl/full`, `--font-family-base`) declarados como `@theme` do Tailwind, para que classes utilitárias (`bg-brand-primary`, `text-text-secondary`, `rounded-md` etc.) produzam exatamente as mesmas cores e medidas que o app já usa hoje.
3. Como desenvolvedor, quero que o nome de cada token Tailwind espelhe o nome do token CSS atual, para que a equipe não precise reaprender vocabulário de cor e espaçamento.
4. Como desenvolvedor, quero um reset/base mínimo (`@import "tailwindcss"`) aplicado uma única vez no entrypoint de estilos, para que não haja duplicação de reset entre o Tailwind e o CSS legado remanescente durante a transição.
5. Como desenvolvedor, quero que o build (`tsc -b && vite build`) e o `dev` continuem funcionando sem erro a cada etapa da migração, para que a transição nunca deixe o projeto em estado quebrado por mais que o tempo de um PR.
6. Como desenvolvedor, quero migrar por PRs pequenos e independentes por arquivo/componente, para que uma regressão visual seja fácil de isolar e reverter.

### Remoção do modo escuro

7. Como desenvolvedor, quero remover a classe `.dark-theme` e toda a lógica que a aplica/alterna, para que o app fique exclusivamente no tema claro.
8. Como desenvolvedor, quero remover qualquer controle de interface (toggle, opção de configuração) que hoje alterna entre claro e escuro, para que não sobre um botão sem efeito.
9. Como gestor, quero que o aplicativo continue com a mesma aparência clara que uso hoje, já que nunca dependi do tema escuro para operar a barbearia.
10. Como desenvolvedor, quero remover testes que hoje cobrem exclusivamente o comportamento de `.dark-theme`, para que a suíte não afirme sobre um recurso que deixou de existir.

### Conversão dos arquivos `.css` dedicados (ordem crescente de tamanho)

11. Como desenvolvedor, quero migrar `src/pages/gerente/financeiro/PlanoContas.css` (90 linhas) primeiro, para validar o processo de conversão num arquivo pequeno antes de arriscar um grande.
12. Como desenvolvedor, quero migrar `src/pages/gerente/financeiro/ContasPagar.css` (126 linhas) na sequência, mantendo o mesmo processo validado no passo anterior.
13. Como desenvolvedor, quero migrar `src/pages/gerente/relatorios/Relatorios.css` (322 linhas), incluindo qualquer gráfico ou tabela que dependa de classes desse arquivo.
14. Como desenvolvedor, quero migrar os tokens e regras de base de `src/index.css` (357 linhas) para o `@theme` do Tailwind, mantendo o restante do reset global que não vira token.
15. Como desenvolvedor, quero migrar `src/pages/gerente/financeiro/fluxo-caixa/FluxoCaixa.css` (532 linhas), preservando os gráficos e indicadores do fluxo de caixa projetado.
16. Como desenvolvedor, quero migrar `src/components/GlassSidebar.css` (663 linhas), preservando o efeito de vidro (`backdrop-filter`) da barra lateral, que não é trivialmente substituível por utilitário puro e pode precisar de valor arbitrário Tailwind.
17. Como desenvolvedor, quero migrar `src/pages/gerente/Financeiro.css` (839 linhas), cobrindo todas as abas do Hub Financeiro.
18. Como desenvolvedor, quero migrar `src/components/cliente/cliente.css` (879 linhas), cobrindo a Central 360º do cliente.
19. Como desenvolvedor, quero migrar `src/pages/gerente/Whatsapp.css` (1.118 linhas), cobrindo configuração de mensageria e templates.
20. Como desenvolvedor, quero migrar `src/pages/gerente/Clientes.css` (1.363 linhas) por último entre os arquivos dedicados, por ser o maior e mais arriscado.

### Conversão dos 77 componentes com `<style>` inline

21. Como desenvolvedor, quero um inventário explícito dos 77 componentes com bloco `<style>{...}</style>` antes de começar, agrupado por módulo (mobile, gerente, financeiro, cadastros, comandas, bloqueios, espera etc.), para que a conversão siga ordem de módulo e não pule componentes.
22. Como desenvolvedor, quero migrar os componentes do diretório `src/pages/gerente/mobile/*` (ex.: `MobileAgendaView.tsx`, `MobileCaixaView.tsx`) com atenção especial, por serem os componentes tocados mais recentemente e com maior risco de conflito com mudanças em andamento na branch `feature/melhorias-design-mobile`.
23. Como desenvolvedor, quero migrar os modais de fluxo financeiro (`FechamentoCaixaModal`, `AberturaAssistidaCaixaModal`, `ExtratoSessaoCaixaModal`, `QuitacaoComissaoModal`, `BaixaDialog`, `LancarValeModal`, `EstenderSerieDialog`, `ExtratoContaProfissionalModal`, `ContaPagarForm`, `ContaPagarDetalheDrawer`, `EditarContaDialog`, `CategoriaDespesaForm`, `FornecedorForm`) preservando o comportamento de abertura/fechamento e validação de cada um.
24. Como desenvolvedor, quero migrar os modais de agenda e atendimento (`BloqueioModal`, `ComandaCheckoutModal`, `ListaEsperaDrawer`, `ConfirmSoftDeleteModal`) preservando os estados de erro e sucesso exibidos.
25. Como desenvolvedor, quero migrar os componentes de navegação mobile (`MobileHeader`, `MobileBottomNav`, `MobileBottomSheet`, `MobileMaisDrawer`) preservando safe-area insets e comportamento fixo/sticky.
26. Como desenvolvedor, quero migrar os componentes de UI compartilhados em `src/components/ui/*` (`Button`, `Input`, `Select`, `Switch`, `Textarea`, `Radio`, `Checkbox`, `IconButton`, `SearchInput`, `SegmentedControl`, `Pagination`, `Drawer`, `Card`, `ConfirmDialog`, `DataTable`, `PercentageBar`, `StatCard`, `EmptyBoxIllustration`, `EmptyState`, `Badge`) primeiro entre os componentes reutilizáveis, para que toda tela que os consome herde a conversão sem trabalho extra.
27. Como desenvolvedor, quero migrar os componentes de relatório (`FaturamentoGrafico`, `ClientesGrafico`, `ClientesOrigemDosClientes`, `ClientesSemRetornoTabela`, `RankingProfissionais`, `AgendaMapaDeCalor`, `AgendaPorProfissional`, `FluxoCaixaGrafico`) preservando a leitura visual dos gráficos e tabelas de dados.
28. Como desenvolvedor, quero migrar as páginas principais do gerente (`Profissionais`, `Servicos`, `Produtos`, `Comandas`, `Configuracoes`, `CadastroAcesso`, `CaixaTab`, `ComissoesTab`) mantendo o comportamento de cada CRUD.
29. Como desenvolvedor, quero migrar as páginas de autenticação e onboarding (`Login`, `ResetPassword`, `CadastroBarbearia`, `OnboardingWizard`, `AcessoExpirado`) preservando validação de formulário e mensagens de erro.
30. Como desenvolvedor, quero migrar os componentes restantes (`Toast`, `NotificationBell`, `Input`, `Modal`, `CustomDatePicker`, `AuthGuard`, `BarbeiroLayout`, `GerenteLayout`, páginas de `admin/*`, `barbeiro/*`, `cliente/*`) até fechar os 77 componentes do inventário.

### Casos técnicos transversais

31. Como desenvolvedor, quero que os 48 blocos `@keyframes` hoje espalhados pelos arquivos `.css` e os 41 blocos `@keyframes` inline sejam centralizados no tema Tailwind (`@theme` com `--animate-*`), para que animações duplicadas ou quase idênticas entre arquivos sejam unificadas numa só definição quando forem funcionalmente iguais.
32. Como desenvolvedor, quero que cada um dos 346 usos de `!important` seja resolvido removendo o seletor concorrente que o tornava necessário, para que a especificidade deixe de depender de sobrescrita forçada.
33. Como desenvolvedor, quero que, quando um `!important` for necessário por causa de um widget de terceiro ou comportamento padrão do navegador que o Tailwind não alcança, ele permaneça num CSS residual pequeno e documentado, em vez de forçado numa classe utilitária.
34. Como desenvolvedor, quero que estilos hoje calculados dinamicamente em JavaScript (cor, posição ou tamanho vindos de dado em runtime) usem sintaxe de valor arbitrário do Tailwind (`className` com `[valor]`) ou, quando isso não for expressável, o atributo `style` inline só para a propriedade dinâmica — nunca um bloco de estilo completo reescrito à mão.
35. Como desenvolvedor, quero que nenhuma nova biblioteca de componentes (shadcn/ui, Base UI, Radix) seja instalada como parte desta spec, para que a migração fique restrita ao mecanismo de estilização e não vire também uma adoção de design system de terceiro.
36. Como desenvolvedor, quero que o `.css` ou bloco `<style>` legado de um componente só seja apagado depois que sua versão em utilitário Tailwind for verificada visualmente, para que nunca exista uma janela em que o componente fique sem nenhum estilo aplicado.

### Verificação e regressão

37. Como desenvolvedor, quero que a suíte de testes `vitest`/React Testing Library (51 arquivos `*.test.tsx`) continue passando sem alteração de comportamento a cada componente convertido, para que a conversão de CSS não altere estrutura, texto ou interação.
38. Como desenvolvedor, quero atualizar qualquer teste que hoje consulte elemento por nome de classe CSS (ex.: `.mobile-agenda__empty-title`) para consultar por role, texto ou label acessível, já que a classe original deixa de existir após a conversão.
39. Como desenvolvedor, quero verificar manualmente cada tela convertida no navegador (tema claro), na largura em que ela é realmente usada — mobile para telas do módulo `mobile/*`, desktop para as demais —, comparando visualmente antes e depois de remover o CSS legado.
40. Como gestor, quero que nenhuma tela do painel mude de comportamento ou apresente elemento quebrado (texto cortado, botão sobreposto, cor ilegível) depois da migração, mesmo sem eu perceber que a tecnologia por trás mudou.
41. Como desenvolvedor, quero que o lint (`oxlint`) continue passando sem novas categorias de erro introduzidas por esta spec, para que a migração não exija mudar a política de lint do projeto.

## Implementation Decisions

- **Ferramenta:** Tailwind CSS v4 via plugin `@tailwindcss/vite`, sem `postcss.config.js` nem `tailwind.config.js` — configuração de tema em CSS via `@theme`, no arquivo que hoje é `src/index.css`.
- **Tokens:** cada custom property de `:root` em `src/index.css` (cores, raios, família de fonte) vira um token `@theme` com o mesmo nome semântico, para preservar o vocabulário existente (`brand-primary`, `bg-primary`, `bg-secondary`, `border`, `text-primary`, `text-secondary`).
- **Tema:** só claro. O mecanismo `.dark-theme` (classe aplicada via JS/contexto, hoje presente em 33 arquivos) é removido por completo, junto com qualquer controle de UI que alterne tema.
- **Escopo:** migração total — os 10 arquivos `.css` dedicados e os 77 blocos `<style>{...}</style>` inline. Nenhum CSS legado sobrevive ao final da spec, exceto o resíduo pequeno e documentado citado abaixo para `!important` de origem externa.
- **Ordem de execução:** por tamanho crescente de arquivo/bloco, começando pelos tokens de fundação (`index.css`) e pelos componentes de `src/components/ui/*` (para que telas consumidoras herdem a conversão), depois os arquivos `.css` dedicados do menor ao maior, depois os 77 componentes inline agrupados por módulo.
- **`@keyframes`:** centralizados no `@theme` do Tailwind; duplicatas funcionalmente idênticas entre arquivos são unificadas numa definição só.
- **`!important`:** removido resolvendo o conflito de especificidade subjacente; mantido apenas quando a causa é widget de terceiro ou comportamento nativo do navegador fora do alcance de utilitário — nesse caso, vira CSS residual pequeno e comentado, não uma classe utilitária forçada.
- **Estilo dinâmico:** valor calculado em runtime (JS) usa sintaxe de valor arbitrário do Tailwind ou, quando não expressável, `style` inline restrito à propriedade dinâmica — nunca um bloco de estilo completo à mão.
- **Sem biblioteca de componentes nova:** esta spec não instala shadcn/ui, Base UI ou Radix. A tentativa anterior de `npx shadcn add @aicanvas/glass-tab-bar` falhou porque o registry não existe e porque o projeto ainda não tinha Tailwind — a instalação do Tailwind aqui não reabre essa decisão, que continua separada.
- **Remoção segura:** o CSS legado de um componente (arquivo `.css` importado ou bloco `<style>` inline) só é apagado depois que a versão convertida for verificada visualmente conforme a seção de testes.
- **PRs:** um PR por arquivo `.css` dedicado, e um PR por grupo de componentes inline (por módulo), para manter cada mudança revisável e reversível isoladamente.

## Testing Decisions

Um bom teste aqui verifica **estrutura, texto e comportamento** — que o botão existe, que o clique dispara a ação certa, que a mensagem de erro aparece —, nunca o nome da classe CSS ou a lista de utilitários usada para estilizar. Nenhum teste afirma sobre qual classe Tailwind foi aplicada.

**Seam única, a mais alta possível: a suíte existente de React Testing Library (51 arquivos `*.test.tsx`, rodando via `vitest`).** Como a migração é puramente de mecanismo de estilo — o DOM, os textos e o comportamento não devem mudar —, essa suíte já é a rede de regressão correta e não precisa de seam nova. `jsdom` não renderiza CSS, então ela nunca vai pegar quebra visual — isso é aceito conscientemente (ver Out of Scope).

- **Antes de converter um componente:** confirmar que ele tem teste cobrindo sua estrutura e interação; se não tiver e for um componente com lógica de interação relevante (modal, formulário, ação), considerar isso um sinal de risco a mais para checar com calma na verificação manual — não é bloqueante escrever teste novo como parte desta spec.
- **Durante a conversão:** qualquer teste que hoje selecione elemento por seletor de classe CSS (`container.querySelector('.mobile-agenda__empty-title')` ou similar) precisa ser reescrito para selecionar por role/texto/label (`getByRole`, `getByText`, `getByLabelText`), já que a classe original some.
- **Depois de cada componente convertido:** a suíte inteira (`npm run test`) roda e precisa passar sem alteração de asserção de comportamento — só ajustes de seletor por classe removida são esperados.
- **Verificação manual (não automatizada), por tela:** abrir a rota real no navegador (`npm run dev`), tema claro, na largura em que a tela é usada de fato (mobile para `src/pages/gerente/mobile/*`, desktop para o restante), e comparar visualmente contra o estado antes da conversão. Prática já usada nesta sessão para validar a troca do datepicker nativo pelo `CustomDatePicker` na Agenda mobile — abrir o dev server, logar com as credenciais de `docs/credenciais_teste.md`, navegar até a tela e tirar screenshot antes/depois.
- **Regressão de lint/build:** `oxlint` e `tsc -b && vite build` continuam fazendo parte do critério de pronto de cada PR desta migração, sem exceção nova.

## Out of Scope

- **Modo escuro.** Removido, não migrado — decisão explícita do usuário para esta spec. Nenhum teste ou token de tema escuro é preservado.
- **Regressão visual automatizada** (Playwright, screenshot diffing ou qualquer ferramenta equivalente). Decisão explícita do usuário: a verificação fica manual, tela por tela.
- **Nova biblioteca de componentes** (shadcn/ui, Base UI, Radix ou qualquer outra). Esta spec troca só o mecanismo de estilização (CSS vanilla → utilitário Tailwind), não adota um design system de terceiro.
- **Redesenho visual.** Esta é uma migração de mecanismo, não de aparência — o objetivo é reproduzir a interface atual 1:1 em utilitários Tailwind. As três opções de layout de Agenda mobile e o protótipo de glass tab bar explorados nesta mesma sessão são iniciativas de design separadas, não fazem parte desta spec.
- **Casos de `!important` de origem externa** (widget de terceiro, comportamento nativo do navegador) que não tenham conversão estrutural possível — ficam como CSS residual pequeno, documentado, fora do escopo de "converter para utilitário".
- **Ferramenta de lint/formatação específica de Tailwind** (`prettier-plugin-tailwindcss`, eslint plugin de ordenação de classe) — não instalada nesta spec.
- **Otimização de performance de CSS** (tree-shaking além do que o Tailwind já faz nativamente, crítica de CSS, etc.) além do que a própria adoção do Tailwind já entrega por padrão.

## Further Notes

**Origem.** Esta spec nasce do relatório `docs/migracao-tailwind-impacto.md`, que mediu o CSS existente antes de qualquer decisão de migração, e da escolha explícita do usuário pela **Opção B** (migração completa) em vez da Opção A (convivência, só telas novas) originalmente recomendada no relatório.

**Números de referência (antes da remoção do modo escuro):** 25.142 linhas de CSS combinadas (6.289 em 10 arquivos dedicados + 18.853 em 77 componentes inline), 346 usos de `!important`, 89 blocos `@keyframes`, projeção de 70–75% de redução de linhas de CSS ao final (~17.600–18.900 linhas economizadas). Remover o modo escuro reduz ainda mais o esforço real frente a essa projeção, já que elimina as ~160 ocorrências de `.dark-theme` em 33 arquivos que o relatório original assumia ter que preservar.

**Sem rastreador de issues configurado.** Este projeto não tem vocabulário de issue tracker/triage configurado (`/setup-matt-pocock-skills` não foi executado). Esta spec vive só como arquivo Markdown, seguindo a mesma convenção das specs 005 a 038 já existentes em `specs/`.

**Risco maior aceito conscientemente:** sem regressão visual automatizada e sem modo escuro para comparar contra si mesmo, a única defesa real contra quebra visual é a disciplina de verificar cada tela manualmente antes de apagar o CSS legado correspondente. Pular essa verificação para ganhar velocidade é o jeito mais provável desta migração introduzir bug visual silencioso.
