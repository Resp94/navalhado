# 01: Cabeçalho único do Admin que cabe no celular

Parte da spec 054 (Painel do Proprietário).

**What to build:** o Proprietário abre Admin > Dashboard e Admin > Barbearias no celular (375 px) sem a página rolar para o lado e com o botão Sair inteiro na tela. As duas telas usam o mesmo cabeçalho (logo, abas "Dashboard" e "Barbearias" com a atual marcada, nome e papel do usuário escondidos em tela estreita, Sair), em vez de uma cópia escrita à mão em cada página.

Hoje, em 375 px, o Sair termina em 397 px: a página ganha 22 px de rolagem horizontal (visto no site de DEV em 2026-10-03).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Um componente de cabeçalho do Admin, usado pelas duas páginas; nenhuma das duas mantém a cópia antiga
- [x] A aba da página atual fica marcada; clicar na outra navega; Sair chama a saída como hoje
- [x] Teste do front (Vitest): as duas páginas mostram o cabeçalho compartilhado, a aba certa marcada e o Sair funcionando
- [x] No navegador, emulando 375 px, `document.documentElement.scrollWidth` igual a `clientWidth` em `/admin/dashboard` e `/admin/tenants`, e o Sair visível por inteiro
- [x] O "Detalhes" da lista continua alcançável (a tabela rola dentro do cartão)
- [x] `rtk proxy npx oxlint src supabase/functions`, Vitest completo (rodando sozinho) e `npm run build` passam

## Resultado

Commit f38e284, branch `feat/painel-do-proprietario`. Componente `src/components/admin/CabecalhoDoAdmin.tsx` (aba atual com `aria-current="page"`), usado por `Dashboard.tsx` e `Tenants.tsx`; as cópias antigas saíram. Vitest: `CabecalhoDoAdmin.test.tsx` (6) e um teste em cada página.

Prova no navegador, nas rotas reais, logado como Proprietário e com o CSS real, em 375 px: `scrollWidth` 375 = `clientWidth` 375 em `/admin/dashboard` e em `/admin/tenants`; o Sair termina em 363 px (largura 52). Em `/admin/tenants` a tabela rola dentro do cartão (335 px visíveis, 973 de conteúdo): rolada ao fim, o "Detalhes" fica em 253–328 px, dentro da tela, e a página não ganha rolagem lateral. Também medido em 320 px (Sair em 308) e em desktop.

Decisões que a spec não trazia: abaixo de 440 px o texto "Navalhado" do logo some (só o símbolo fica), porque com ele o Sair passa 31 px da tela em 375 px; as abas e o cabeçalho ficam mais estreitos abaixo de `md` e abaixo de 361 px.

Conferido também no site de DEV (`dev.navalhado.com.br`, depois do deploy do push), logado como Proprietário, em 2026-10-03: em 375 px `/admin/dashboard` e `/admin/tenants` sem rolagem lateral (`scrollWidth` 375 = `clientWidth` 375), Sair terminando em 363 px, "Detalhes" alcançável rolando a tabela dentro do cartão e a aba atual marcada.
