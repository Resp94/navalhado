# 01: Gerente que se inclui como barbeiro fica vinculado ao próprio login

**What to build:** o Gerente que marca "Me incluir como Barbeiro" no onboarding passa a ter o cadastro de profissional ligado ao próprio login. Ele deixa de aparecer em "Criar acesso", a Edge Function `create-barber-access` recusa criar acesso para ele (o profissional já tem login) e a lista da equipe mostra "já possui login". Os demais barbeiros cadastrados no onboarding continuam sem login. As barbearias que concluíram o onboarding antes desta correção são corrigidas uma vez, por migration de dados, vinculando gerente e profissional pelo nome só quando o par é único dos dois lados.

Reaproveita o stash `fix gerente-barbeiro e notificacoes (pre-spec)`: mudança no wizard, teste de componente e a migration `vincula_gerente_incluido_como_barbeiro`, que já foi aplicada no DEV em 24/09. O arquivo da migration entra no repositório com o nome da versão aplicada.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Teste de componente do wizard: o Gerente se inclui como barbeiro e cadastra mais um barbeiro; o insert em `professionals` leva o `user_id` do Gerente no cadastro dele e `user_id` nulo no outro. Falha antes da mudança, passa depois
- [x] Os testes atuais do wizard continuam passando
- [x] Migration de dados no repositório: vincula gerente ativo e profissional da mesma barbearia, mesmo nome (sem diferenciar maiúsculas nem espaços nas pontas), profissional sem login e não excluído; só com par único dos dois lados e Gerente ainda sem profissional vinculado
- [x] Conferência no DEV por consulta: Jonathas Teste e Carlos Alpha Gestor vinculados ao login do Gerente; nenhum outro gerente vinculado; nenhum caso ambíguo vinculado
- [x] No DEV, "Criar acesso" não lista mais o cadastro do Gerente
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-24)

Migration `vincula_gerente_incluido_como_barbeiro` aplicada no DEV (`selvxobcjbkligxighlp`). Conferido por consulta: Jonathas Teste (Barbearia Teste Navalhado) e Carlos Alpha Gestor (Barbearia Alpha Dev) vinculados ao próprio login; nenhum outro gerente vinculado; nenhum caso ambíguo. Nos dois tenants, `professionals` ativos sem login caiu a 0. `npm run lint`, `npm test` (1317 testes) e `npm run build` passam.
