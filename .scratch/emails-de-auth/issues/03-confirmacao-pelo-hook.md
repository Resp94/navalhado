# 03: Confirmação de e-mail chega com o e-mail novo no DEV

**What to build:** o dono de barbearia que se cadastra, o barbeiro cujo acesso o gerente criou e quem usa "Reenviar link" no Login recebem o e-mail "Confirme seu e-mail" com a marca do Navalhado, e o botão confirma e leva ao Login. Com isso o hook do DEV fica ligado de vez, e a volta atrás (desligar o hook) fica provada.

**Blocked by:** 02

**Status:** done

- [x] Template de confirmação com o texto único da spec 049, conferido no preview local
- [x] Testes Deno no handler cobrem `signup` com 200 e a chamada certa ao Resend (assunto de confirmação, link com `type=signup`) — 11 testes, todos passando
- [x] Função republicada no DEV (versão 4) e hook ligado
- [x] Prova com e-mail real nos três fluxos (cadastro de barbearia, "Reenviar link" e acesso de barbeiro criado pelo gerente): e-mail com o visual aprovado, um e-mail por pedido (rate limit de 25s do GoTrue observado e respeitado), clique confirma e cai no Login, login liberado depois — provado nos dois logins (gerente e barbeiro)
- [x] "Esqueci minha senha" continua funcionando com o hook ligado — já provado repetidamente no ticket 02 e nesta sessão
- [x] Volta atrás: provada no ticket 02 (hook off → SMTP com template antigo; hook on → template novo); não repetida aqui para não gerar instabilidade adicional no SMTP
- [x] Nenhum Agendamento criado; usuários de teste (tenant, professional, financial_categories, tenant_subscriptions, public.users, auth.identities, auth.users) removidos no fim
- [x] Resultado registrado na spec 049
- [x] `npm run lint`, `npm test` (1316 testes) e `npm run build` passam

## Resultado (2026-09-24)

Template de confirmação e suporte a `signup` publicados no DEV (função versão 4). Prova de ponta a ponta pelo navegador, direto em `dev.navalhado.com.br`, com contas reais (alias `+`):

1. **Cadastro de barbearia** (`/signup`): conta criada, e-mail "Confirme seu e-mail no Navalhado" chegou (`delivered`), link de verificação clicado de verdade (extraído do e-mail via Resend), `email_confirmed_at` gravado, login com e-mail e senha funcionou ("Login realizado").
2. **"Reenviar link" no Login**: primeira tentativa bateu no rate limit do GoTrue (429, 25s entre pedidos — esperado, não é bug); no reteste o `/resend` retornou 200 e o hook rodou de novo (`Hook ran successfully`), um e-mail novo por pedido.
3. **Acesso de barbeiro criado pelo gerente**: onboarding do tenant de teste marcado como concluído e um profissional de teste inseridos direto no banco (atalho só para chegar na tela de Acesso mais rápido; não faz parte do que está sendo testado). Acesso criado pela tela real (`/profissionais/cadastro-acesso`), "Login vinculado" exibido, e-mail de confirmação chegou, link clicado, login do barbeiro funcionou.

Nenhum problema novo de código encontrado nesta prova (o achado da logo já tinha sido corrigido no ticket 02). Tenant, profissional, categorias financeiras, assinatura, `public.users` e as duas contas (`auth.users`/`auth.identities`) do teste foram removidos ao final.

**Ticket 03 concluído. Spec 049 encerrada** (tickets 01, 02 e 03 completos).
