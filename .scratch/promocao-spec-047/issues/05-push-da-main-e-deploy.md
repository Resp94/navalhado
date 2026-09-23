# 05: Push da `main` e deploy

**What to build:** o front da spec 047 entra no ar em produção, só depois de banco e Edge Function de prod prontos, e só com o usuário confirmando o push no momento.

**Blocked by:** 02 (Migrations da spec 047 em prod), 03 (`create-barber-access` em prod), 04 (Merge `dev` em `main`, só local).

**Status:** done

- [x] Confirmação explícita do usuário antes do push
- [x] Push da `main` para `origin`
- [x] Produção servindo o bundle novo (conferido no navegador, não suposto)
- [x] Se o bundle novo não aparecer em até 30 minutos, deploy conferido na Cloudflare antes de seguir
- [x] CSP de produção liberando `cloudflare-dns.com` e `dns.google`
- [x] Horário do push e commit da `main` registrados na spec 048
