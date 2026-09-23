# 06: Provas em produção, limpeza e registro

**What to build:** provar no navegador, em produção, que gerente e barbeiro têm a validação de e-mail da spec 047 funcionando de ponta a ponta, sem deixar dado de teste nem disparar WhatsApp real, e fechar a spec 048.

**Blocked by:** 05 (Push da `main` e deploy).

**Status:** ready-for-agent

- [ ] Clientes: domínio inventado recusado com "Este domínio não recebe e-mails."
- [ ] Clientes: `gmial.com` gera a sugestão, aplicar a sugestão permite salvar
- [ ] Console sem violação de CSP para `cloudflare-dns.com` e `dns.google`
- [ ] Nenhum Agendamento criado nas provas
- [ ] Acesso do barbeiro criado para um profissional de teste com alias `+` do usuário; mensagem de sucesso fala da confirmação
- [ ] Login recusa antes da confirmação e mostra "Reenviar link"
- [ ] Log de Auth de prod mostra o envio com status 200
- [ ] Depois do clique no link, o Login do barbeiro de teste entra
- [ ] Login de um gerente já existente continua funcionando
- [ ] Cliente de teste, acesso de barbeiro de teste e profissional de teste removidos de prod
- [ ] Spec 048 registra a data da promoção, o commit da `main` e o resultado de cada prova
