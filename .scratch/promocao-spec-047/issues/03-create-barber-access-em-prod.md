# 03: `create-barber-access` em prod

**What to build:** em prod, o acesso de barbeiro criado pelo gerente recusa domínio que não recebe e-mail e nasce não confirmado, com o link de confirmação enviado pelo Resend. O front antigo continua criando acesso sem perceber a troca, porque o contrato de entrada e saída é o mesmo da v1.

**Blocked by:** 02 (Migrations da spec 047 em prod).

**Status:** ready-for-agent

- [ ] Publicados em prod os mesmos arquivos de código da `dev` (index, validação de e-mail e criação de conta), sem os arquivos de teste
- [ ] `verify_jwt: true` mantido, como na v1
- [ ] Nova versão ativa em prod, com o conteúdo conferido contra o da `dev`
- [ ] `spike-047-ticket09` não é publicada em prod
- [ ] Resultado registrado na spec 048
