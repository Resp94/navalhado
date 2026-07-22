# 03 — Refatoração da Página `Clientes.tsx` para a Camada Visual Pura

**What to build:**
Refatoração total do componente `src/pages/gerente/Clientes.tsx`. Substituir as chamadas brutas ao Supabase e lógica de estado dispersa pela chamada limpa ao hook `useClientes`. Reduzir o arquivo de 1.270 linhas para aproximadamente 250-300 linhas de JSX focado estritamente em renderização e animações GSAP.

**Blocked by:** 02 — Adaptador Supabase Concreto e Hook React `useClientes`

**Status:** ready-for-agent

- [ ] Todas as chamadas diretas a `supabase.from('customers')` e `supabase.from('appointments')` removidas de `Clientes.tsx`.
- [ ] Componente `Clientes.tsx` conectado ao hook `useClientes`.
- [ ] Renderização dos modais de criação/edição e gaveta lateral de detalhes operando 100% com o novo repositório.
- [ ] Animações GSAP de entrada de cards e linhas da tabela preservadas e operantes.
- [ ] Testes de build (`npm run build` ou `npx tsc --noEmit`) passando sem erros de tipagem.
