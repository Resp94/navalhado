# 03 — Integração do Hook useClientes e Atualização da Interface (Clientes.tsx)

**What to build:** Atualizar o React Hook `useClientes` para absorver o novo `ClienteConstraintError` e encapsular filtros/cálculos de apresentação da UI, ajustar a página `Clientes.tsx` para usar os rótulos canônicos de domínio (*Cliente Provisório*, *Cliente Completo*, *Acesso Tokenizado*) e garantir 100% de passagem nos testes da suíte global.

**Blocked by:** 02 — Exceções de Domínio Tipadas (ClienteConstraintError) e Resolução no Adaptador

**Status:** done

- [x] Hook `useClientes` atualizado para tratar `ClienteConstraintError` sem inspecionar a string de erro SQL `'23503'`
- [x] Funções auxiliares de busca por texto e totais integradas ao hook `useClientes`
- [x] Página `Clientes.tsx` atualizada com rótulos canônicos de domínio do `CONTEXT.md`
- [x] `Clientes.test.tsx` e demais 16 arquivos de teste passando 100% (66/66 testes)
- [x] `npx tsc --noEmit` sem erros de compilação
