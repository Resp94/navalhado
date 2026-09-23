# 05: Domínio que recebe e-mail, no cadastro de Cliente

**What to build:** o cadastro de Cliente recusa e-mail de domínio inventado ou que não recebe e-mail, como `jon@dominioinventadoxyz123.com.br`, com a mensagem "Este domínio não recebe e-mails". O fluxo:
- a tela consulta o registro MX do domínio pelo DNS público da Cloudflare, com o Google como reserva, com 2s de limite em cada um;
- só o domínio sai do navegador, nunca o e-mail completo;
- se a consulta não responder, o e-mail é liberado e fica um aviso no console.

É a fatia que prova o caminho do MX de ponta a ponta, do módulo à tela, e inclui o CSP de produção.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O módulo de e-mail expõe a verificação de domínio, com `fetch` injetável, e devolve `valido`, `sem_mx` ou `indisponivel`
- [ ] NXDOMAIN, resposta sem MX e MX nulo resultam em `sem_mx`; a Cloudflare fora com o Google respondendo usa o Google; os dois fora ou timeout resultam em `indisponivel`, com `console.warn`
- [ ] O resultado fica em cache por domínio durante a sessão da página
- [ ] O hook de validação de e-mail checa formato e domínio ao sair do campo e confere de novo ao salvar: bloqueia formato inválido e `sem_mx`, libera `indisponivel`, e não faz nada com o campo vazio
- [ ] A tela de Clientes usa o hook: domínio inventado bloqueia com erro no campo, e DNS indisponível ainda salva
- [ ] O `connect-src` do CSP inclui `https://cloudflare-dns.com` e `https://dns.google`
- [ ] Os testes cobrem a verificação de domínio e o hook com `fetch` falso, sem rede real, e o teste de página de Clientes cobre bloqueio e liberação
- [ ] Verificado no navegador pelo preview do Pages: domínio inventado bloqueia, e a consulta ao DNS aparece no Network sem erro de CSP
- [ ] `npm run lint`, `npm test` e `npm run build` passam
