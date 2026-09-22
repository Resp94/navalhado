# 04: Extrair a repetição entre a Agenda Geral e a Minha Agenda

**What to build:** a spec 043 entregou o Painel de Cancelados do Dia nas duas agendas, e no caminho duplicou código. O botão do cabeçalho que abre o painel repete, colada, a lista de classes de estilo do botão vizinho. O trio de estados que controla o painel (o que carregou, se falhou, se está aberto) existe igual nas duas páginas.

Duplicação assim envelhece mal: a próxima mudança no painel precisa ser feita em dois lugares, e a segunda é a que se esquece.

Depois deste ticket, o painel tem um ponto só de controle, e o botão do cabeçalho não copia estilo de ninguém. É prefactor: os tickets 13 e 15 mexem no mesmo estado, e ficam mais simples com ele num lugar só.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** None (can start immediately). É prefactor dos tickets 13 e 15

**Status:** done

- [x] O botão que abre o Painel de Cancelados do Dia deixa de copiar a lista de classes do botão vizinho
- [x] O trio de estados do painel passa a ter uma definição só, usada pelas duas páginas
- [x] Nenhum comportamento visível muda: os testes de tela das duas páginas continuam verdes sem serem reescritos para acomodar a extração
- [x] A extração não cria abstração para um caso só: o que for particular de uma das páginas continua nela
- [x] O componente extraído, se houver, fica no lugar que o projeto usa para componentes de agenda, não na biblioteca de interface
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Trio de estados:** novo hook `src/components/agenda/useCanceladosDoDia.ts`, mesmo diretório e convenção do `useMarcarNaoCompareceu.ts` já existente (hook de agenda, fora da biblioteca de interface). Ele guarda `cancelados`, `canceladosComErro`, `isCanceladosOpen` e devolve `registrarCancelados(lista | 'falhou')` — que substitui o par `setCancelados` + `setCanceladosComErro` chamado sempre junto, nos dois sentidos, nas duas páginas — além de `abrirCancelados`/`fecharCancelados`. `Agenda.tsx` e `MinhaAgenda.tsx` passaram a chamar o hook; os três `useState` diretos saíram das duas.
- **Botão do cabeçalho:** cada página ganhou a própria constante `HEADER_SECONDARY_BUTTON_CLASS`, com o valor que já tinha (não unificado entre páginas, porque os estilos de desktop e celular são legitimamente diferentes: `w-32 h-9` na Agenda Geral, `flex-1 min-h-11` na Minha Agenda). Em `Agenda.tsx`, o botão "Cancelados" parou de copiar a string do botão "Espera" — os dois agora leem a constante. Em `MinhaAgenda.tsx`, três botões ("Encaixe", "Bloquear horário", "Cancelados") compartilhavam a mesma string colada; os três passaram a ler a mesma constante.
- **Sem abstração para caso único:** o hook é usado por dois call sites de verdade (Agenda Geral e Minha Agenda), com o mesmo formato de leitura (sucesso/falha) nos dois — não é abstração especulativa. A classe do botão ficou deliberadamente local a cada página, porque os valores divergem e "o que for particular de uma página continua nela".
- **Nenhum comportamento visível mudou:** `git diff --stat` dos dois arquivos de teste de tela (`Agenda.test.tsx`, `MinhaAgenda.test.tsx`) está vazio — nenhum precisou ser tocado. Os dois seguem verdes: 72 testes juntos, mesmo total de antes.
- Suíte completa: 109 arquivos, 1193 testes (mesmo total do ticket 03, nenhum teste novo neste ticket, que é puro refactor). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0, os mesmos 47 avisos preexistentes (a ordem de listagem varia entre execuções, o conteúdo não). `npm run build`: build 0.
- Escopo respeitado: nenhum arquivo fora de `src/pages/gerente/Agenda.tsx`, `src/pages/barbeiro/MinhaAgenda.tsx` e o hook novo foi tocado.
