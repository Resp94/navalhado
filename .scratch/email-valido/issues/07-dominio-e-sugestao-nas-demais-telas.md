# 07: Domínio e sugestão nas demais telas

**What to build:** as outras telas que coletam e-mail passam a ter o mesmo comportamento do cadastro de Cliente: erro de formato e de domínio no campo, sugestão de correção, bloqueio ao salvar em `sem_mx` e liberação quando o DNS não responde. As telas são Fornecedor, cadastro de barbearia (e-mail comercial e e-mail de acesso do gerente), Configurações e Acesso do barbeiro. Login e redefinição de senha ficam só com o formato.

**Blocked by:** 02, 03, 04, 06

**Status:** ready-for-agent

- [ ] Fornecedor, cadastro de barbearia (os dois campos), Configurações e Acesso do barbeiro usam o hook de validação de e-mail
- [ ] Em cada uma dessas telas, domínio sem MX bloqueia com "Este domínio não recebe e-mails", a sugestão aparece e aplica, e DNS indisponível não bloqueia
- [ ] Login e redefinição de senha não consultam DNS
- [ ] Os testes de página de Configurações e do cadastro de barbearia cobrem o bloqueio por domínio e a sugestão
- [ ] Verificado no navegador (DEV) no cadastro de barbearia e em Configurações
- [ ] `npm run lint`, `npm test` e `npm run build` passam
