# 01: Cabeçalho único do Admin que cabe no celular

Parte da spec 054 (Painel do Proprietário).

**What to build:** o Proprietário abre Admin > Dashboard e Admin > Barbearias no celular (375 px) sem a página rolar para o lado e com o botão Sair inteiro na tela. As duas telas usam o mesmo cabeçalho (logo, abas "Dashboard" e "Barbearias" com a atual marcada, nome e papel do usuário escondidos em tela estreita, Sair), em vez de uma cópia escrita à mão em cada página.

Hoje, em 375 px, o Sair termina em 397 px: a página ganha 22 px de rolagem horizontal (visto no site de DEV em 2026-10-03).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Um componente de cabeçalho do Admin, usado pelas duas páginas; nenhuma das duas mantém a cópia antiga
- [ ] A aba da página atual fica marcada; clicar na outra navega; Sair chama a saída como hoje
- [ ] Teste do front (Vitest): as duas páginas mostram o cabeçalho compartilhado, a aba certa marcada e o Sair funcionando
- [ ] No navegador, emulando 375 px, `document.documentElement.scrollWidth` igual a `clientWidth` em `/admin/dashboard` e `/admin/tenants`, e o Sair visível por inteiro
- [ ] O "Detalhes" da lista continua alcançável (a tabela rola dentro do cartão)
- [ ] `rtk proxy npx oxlint src supabase/functions`, Vitest completo (rodando sozinho) e `npm run build` passam
