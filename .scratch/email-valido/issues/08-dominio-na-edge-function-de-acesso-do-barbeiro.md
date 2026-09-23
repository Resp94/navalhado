# 08: Domínio que recebe e-mail na Edge Function de Acesso do barbeiro

**What to build:** a Edge Function que cria o Acesso do barbeiro passa a recusar, no servidor, e-mail de domínio sem MX, com 400 "Este domínio não recebe e-mails.". Ela usa a mesma política do front: Cloudflare, com o Google como reserva, e 2s cada. Se a consulta não responder, segue a criação e registra um aviso. Assim a regra vale também para quem chamar a função direto, sem passar pela tela.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] O arquivo de e-mail da Edge Function expõe a verificação de domínio, com `fetch` injetável, e devolve `valido`, `sem_mx` ou `indisponivel`
- [ ] A função responde 400 "Este domínio não recebe e-mails." para `sem_mx`, antes de criar qualquer usuário
- [ ] Com `indisponivel`, a função registra `console.warn` e cria o acesso normalmente
- [ ] Nada usa `Deno.resolveDns`, só `fetch`
- [ ] O teste Deno cobre MX presente, NXDOMAIN, Cloudflare fora com o Google respondendo e os dois fora
- [ ] O deploy é feito no DEV; uma chamada real com domínio inventado recebe 400 e uma com `gmail.com` passa da validação de e-mail
- [ ] `npm run lint`, `npm test` e `npm run build` passam
