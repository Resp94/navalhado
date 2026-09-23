# 05: Extrair o leitor de colunas duplicado nos testes

**What to build:** vários testes de adaptador usam um banco de mentira que aplica de verdade os filtros e devolve só as colunas pedidas na consulta. Sem isso, um teste passaria mesmo se o adaptador esquecesse de pedir uma coluna, que foi exatamente o defeito original do ticket 02 da spec 043.

A peça que interpreta a lista de colunas da consulta está copiada em dois arquivos de teste. Enquanto eram dois, deixar como estava foi decisão consciente. Vale extrair antes do terceiro, porque uma cópia que diverge silenciosamente faz o teste parar de cobrir o que promete, sem ficar vermelho.

Depois deste ticket, a peça tem um dono só.

**Onde foi achado:** limite registrado no ticket 04 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A peça que interpreta as colunas da consulta passa a existir em um lugar só, junto do apoio de teste do projeto
- [x] Os testes que a usam continuam verdes sem mudança de comportamento
- [x] A cobertura não regride: tirar uma coluna do que o adaptador pede continua deixando o teste vermelho, conferido por mutação em pelo menos um dos adaptadores
- [x] Nenhum código de produção é alterado por este ticket
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Peça extraída para `src/test/fakePostgrestColunas.ts`**, o único diretório de apoio de teste compartilhado do projeto (hoje só tinha `setup.ts`). Duas funções: `colunasDeTopo` (parser idêntico nos dois arquivos, com a variante `.split(':')[0]` que trata alias de relação — inofensiva para o caso sem alias, então uma função só cobre os dois usos) e `projetarColunas` (o `Object.fromEntries` de projeção que também se repetia).
- `SupabaseClienteAdapter.test.ts` e `SupabaseAgendaAdapter.test.ts` importam as duas funções; cada arquivo manteve seu próprio banco de mentira (`fakeSupabaseQueRespeitaSelect`, `bancoQueAplicaFiltros`) porque têm formatos e filtros diferentes (single-table simples vs. multi-tabela com `eq`/`neq`/`gte`/`lt`/erro por tabela) — só a peça de interpretação de colunas e a de projeção eram cópia de verdade.
- **Nenhum código de produção tocado**: `git status` confirma que só `src/test/fakePostgrestColunas.ts` (novo) e os dois arquivos `__tests__` mudaram.
- **Cobertura provada por mutação num adaptador real** (não no apoio de teste, que não é o que a checklist pede provar): removida a coluna `cancellation_reason` do `.select(...)` de `SupabaseClienteAdapter.buscarHistoricoVisitas` — os 2 testes que dependem dela ficaram vermelhos (`expected null to be 'Imprevisto no trabalho'`), confirmando que o fake ainda projeta só as colunas pedidas e não devolve a linha inteira por baixo do pano. Restaurado via `git restore`, os 4 testes do arquivo voltam a passar.
- Também tentei mutar `projetarColunas` para devolver a linha inteira (ignorando as colunas pedidas): passou verde — porque nenhum teste hoje verifica a AUSÊNCIA de uma coluna não pedida, só a presença das colunas pedidas. Esse ponto era verdade antes da extração também (não é regressão desta mudança) e fica fora do escopo deste ticket, que pede mutação no adaptador, não no apoio de teste.
- `npx tsc -b`: 0 erros. `npx oxlint`: exit 0 (avisos pré-existentes em arquivos não tocados). Suíte completa: 110 arquivos, 1209 testes, sem mudança de contagem (ticket não adiciona nem remove teste, só move onde a lógica mora). `npm run build`: build 0.
- Sem migration, sem leitura de banco: ticket é só de apoio de teste.
