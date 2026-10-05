# 01: Registro de acesso guardado por 6 meses (Marco Civil, art. 15)

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** cada entrada no painel (Gerente, Barbeiro, Proprietário) e cada sessão aberta no Canal do Cliente gravam data, hora, IP, o usuário do Auth, o tipo (`painel` ou `canal_cliente`) e a barbearia, quando houver. O servidor lê o IP do cabeçalho da requisição (`cf-connecting-ip`, depois o primeiro item de `x-forwarded-for`). O navegador não informa o IP e não lê a tabela. Uma rotina diária apaga o que passou de 6 meses.

Hoje `audit_logs.ip_address` existe, mas nunca é preenchido, e nada guarda o IP por 6 meses.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Migration só no DEV (`selvxobcjbkligxighlp`), pelo MCP: a tabela, sem privilégio para `anon` e `authenticated`; a RPC `security definer` (`search_path` vazio, `EXECUTE` só para `authenticated`) que grava a partir de `request.headers`; e o `pg_cron` do expurgo
- [ ] Front: chama a RPC quando a sessão começa (login e retomada da sessão), uma vez por sessão, sem travar a tela se falhar
- [ ] `public-customer-session`: grava o acesso do cliente com o IP que já lê para o Turnstile
- [ ] pgTAP (próximo número livre, hoje 81) em `begin; ... rollback;`:
  - a gravação usa o IP do cabeçalho, e não um parâmetro;
  - sem cabeçalho, grava com IP nulo e não falha;
  - `anon` e `authenticated` não leem, não alteram e não apagam;
  - o expurgo apaga só o que tem mais de 6 meses
- [ ] Conferido no DEV: um login no localhost grava uma linha com o IP público certo
- [ ] Anotar no resultado: a porta lógica de origem e o user agent ficaram de fora (decisão do advogado)
- [ ] Gates de lint, Vitest e build passam
