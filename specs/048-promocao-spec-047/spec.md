# Especificação Técnica: Promoção da spec 047 (e-mail válido) de `dev` para `main`

## Problem Statement

A spec 047 (e-mail válido) está pronta e verificada na `dev` e em `dev.navalhado.com.br`, mas o gerente, o barbeiro e o cliente em produção ainda aceitam qualquer e-mail: domínio inventado, TLD de uma letra, erro de digitação como `gmial.com`. Um e-mail assim nunca recebe o link de redefinição de senha, e o barbeiro criado pelo gerente entra sem nunca ter provado que o e-mail é dele.

A `dev` está 24 commits à frente da `main` (base comum `af67361`): 20 da spec 047, 3 só de documentação da spec 046 e o `2031945`, que é idêntico ao hotfix `5ea5b54` já presente na `main`. A promoção não é só um merge, por quatro motivos:

- **Banco.** Produção não tem as 4 migrations da spec 047 (`047_ticket01` a `047_ticket04`). O deploy do front na Cloudflare acontece sozinho a cada push na `main`; as migrations não.
- **Edge Function.** Produção roda a `create-barber-access` v1, a do hotfix: cria o acesso do barbeiro já confirmado (`email_confirm: true`) e não confere o domínio. O código novo (tickets 08 e 10) é publicado à parte do front.
- **Auth.** O ticket 10 só funciona com "Confirm email" ligado e um SMTP capaz de mandar para qualquer endereço. O SMTP padrão da Supabase só envia para e-mails do time da organização; com ele, o barbeiro nunca receberia o link.
- **Git.** O merge tem um conflito conhecido (add/add) na `create-barber-access`, porque a `main` e a `dev` criaram o mesmo arquivo pelo hotfix e a `dev` o alterou depois.

## Solution

Promover em ordem fixa, sem janela de indisponibilidade: Auth, banco, Edge Function, merge e push.

Ao contrário da spec 046, aqui existe uma ordem em que front e banco ficam compatíveis o tempo todo. As 4 migrations só acrescentam restrições de formato de e-mail: o front antigo continua funcionando, e um e-mail mal formado que ele deixasse passar é recusado pelo banco com erro. A Edge Function nova responde no mesmo contrato da v1 (mesmos campos de entrada, `success` e `userId` na saída), então o front antigo continua criando acesso de barbeiro; só a mensagem de sucesso é antiga. O front novo depende do banco e da Edge Function novos, então vai por último.

Estado conferido em 23/09, antes da promoção:

- **Auth de prod.** SMTP no Resend e "Confirm email" ligado, configurados pelo usuário no dashboard. `mailer_autoconfirm: false` conferido em `/auth/v1/settings`. Os 3 usuários de prod já estão confirmados, então ligar a confirmação não trava ninguém.
- **Dados de prod.** Nenhum e-mail fora da regra em `customers` (0 com e-mail), `suppliers` (0), `tenants` (2) e `users` (3). O `validate constraint` de cada migration passa.
- **Funções de prod.** `create_supplier`, `update_supplier` e `handle_new_user` têm corpo idêntico ao da `dev` fora da linha de e-mail (md5 igual com essas linhas removidas). O `create or replace` das migrations não apaga nada que só exista em prod.
- **Restrições de prod.** `suppliers_email_check` existe (o `drop constraint` da `047_ticket02` funciona); `email_valido`, `customers_email_format_check`, `tenants_email_format_check` e `users_email_format_check` ainda não existem.

Se algo falhar depois das migrations e antes do push, a promoção para ali. O front antigo segue no ar, com o banco mais rígido por baixo. Não existe volta automática das migrations; a volta é uma migration nova, escrita para o problema encontrado.

## User Stories

1. As a Gerente, I want e-mails de Cliente com domínio que não recebe e-mail recusados em produção, so that o cadastro 360º não guarde contato inútil.
2. As a Gerente, I want a sugestão "Você quis dizer ...?" ao digitar `gmial.com` em produção, so that eu corrija o erro de digitação com um clique.
3. As a Gerente, I want o e-mail de Fornecedor validado em produção, so that o Plano de Contas não guarde contato inválido.
4. As a Gerente, I want o e-mail de contato da barbearia em Configurações obrigatório e validado em produção, so that a barbearia sempre tenha um e-mail que recebe mensagens.
5. As a dono de barbearia se cadastrando, I want os e-mails comercial e de acesso validados no cadastro em produção, so that eu não crie a conta com um e-mail que não recebo.
6. As a Gerente, I want o acesso do barbeiro criado em produção recusado quando o domínio não recebe e-mail, so that o barbeiro não fique com um login impossível de recuperar.
7. As a Gerente, I want a mensagem de sucesso avisar que o barbeiro precisa confirmar o e-mail, so that eu saiba explicar a ele o próximo passo.
8. As a Barbeiro, I want receber em produção o link de confirmação no e-mail que o gerente cadastrou, so that eu consiga fazer o primeiro login.
9. As a Barbeiro, I want um botão "Reenviar link" no Login quando meu e-mail ainda não foi confirmado, so that eu não dependa do gerente se o primeiro e-mail sumir.
10. As a Gerente ou Barbeiro já cadastrado, I want continuar entrando normalmente depois da promoção, so that ligar a confirmação não me trave.
11. As a Desenvolvedor, I want confirmar antes de começar que `main` e `dev` locais batem com os remotos e que a `main` não ganhou commit novo além de `a13b1b3`, so that eu não promova uma branch velha nem sobrescreva algo feito direto na `main`.
12. As a Desenvolvedor, I want reconferir os dados de prod contra a regra de formato logo antes de migrar, so that um e-mail inválido gravado depois de 23/09 não aborte um `validate constraint` no meio.
13. As a Desenvolvedor, I want reconferir `mailer_autoconfirm: false` em prod antes de publicar a Edge Function, so that o ticket 10 nunca rode com a confirmação desligada.
14. As a Desenvolvedor, I want aplicar as 4 migrations na ordem dos arquivos, com o nome do arquivo como nome da migration, so that o histórico de prod bata com o repositório.
15. As a Desenvolvedor, I want parar na primeira migration que falhar, so that prod nunca rode com uma migration posterior sobre uma anterior ausente.
16. As a Desenvolvedor, I want rodar os pgTAP 58 a 61 em prod dentro de `begin; ... rollback;`, so that a regra fique provada no banco real sem deixar dados.
17. As a Desenvolvedor, I want publicar em prod a mesma `create-barber-access` da `dev` (index, email e account), so that os dois ambientes rodem o mesmo código.
18. As a Desenvolvedor, I want resolver o conflito do merge ficando com a versão da `dev`, so that o hotfix e os tickets 08 e 10 fiquem juntos.
19. As a Desenvolvedor, I want que o merge de `dev` em `main` seja um merge commit (`--no-ff`), so that a promoção seja um ponto identificável no histórico da `main`.
20. As a Desenvolvedor, I want rodar `npm run lint`, `npm test` e `npm run build` no resultado do merge antes do push, so that a `main` só receba código que passa.
21. As a Desenvolvedor, I want dar o push da `main` só depois do banco e da Edge Function prontos, so that o front novo nunca rode contra o backend antigo.
22. As a Desenvolvedor, I want acompanhar o site de produção até ele servir o bundle novo, so that eu saiba quando a promoção terminou em vez de supor.
23. As a Desenvolvedor, I want que o CSP de produção libere `cloudflare-dns.com` e `dns.google`, so that a conferência de domínio não seja bloqueada no navegador.
24. As a Desenvolvedor, I want que as provas em produção não criem Agendamento para cliente real com telefone, so that nenhum WhatsApp real seja enviado por um teste.
25. As a Desenvolvedor, I want remover em seguida todo dado criado pelas provas (Cliente de teste, acesso de barbeiro de teste), so that prod fique como estava.
26. As a Desenvolvedor, I want registrar nesta spec quando a promoção rodou e qual commit foi para a `main`, so that a próxima promoção comece de um ponto conhecido.
27. As a Desenvolvedor, I want uma regra clara para quando uma prova depois do deploy falhar, so that a correção seja um commit novo na `dev` promovido do mesmo jeito, nunca uma edição direta na `main`.

## Implementation Decisions

- **Ordem fixa.** (1) conferências de git, Auth e dados em prod; (2) as 4 migrations; (3) pgTAP 58 a 61 em prod e leitura do log do Postgres; (4) publicação da `create-barber-access`; (5) merge `dev` → `main` com `--no-ff`, conflito resolvido com a versão da `dev`, lint, test e build; (6) push da `main` e espera do bundle novo; (7) provas no navegador e limpeza. Nenhum passo começa sem o anterior ter passado.
- **As 4 migrations**, na ordem em que entram: `047_ticket01_formato_email_cliente` (cria `public.email_valido` e o CHECK em `customers`), `047_ticket02_formato_email_fornecedor` (troca o CHECK de `suppliers` e as RPCs `create_supplier`/`update_supplier`), `047_ticket03_formato_email_barbearia` (CHECK em `tenants` e trigger `handle_new_user`), `047_ticket04_formato_email_login` (CHECK em `users`). Cada CHECK entra `not valid` e é validado em seguida, como já está nos arquivos.
- **Nome no histórico.** Cada migration é aplicada pelo MCP com o nome do arquivo sem o timestamp, igual ao que a `dev` registrou.
- **Edge Function.** Publicação da `create-barber-access` pelo MCP a partir dos arquivos da `dev` (`index.ts`, `email.ts`, `account.ts`), com `verify_jwt: true`, como a v1. Os arquivos de teste não sobem. Nenhum segredo novo: a conferência de domínio usa DNS-over-HTTPS por `fetch`.
- **Spike da `dev`.** A função `spike-047-ticket09` existe só na `dev` e não é promovida.
- **Merge.** O conflito add/add é o único previsto; `git merge-tree` confirmou antes. A resolução é ficar com a versão da `dev` do arquivo, porque ela é o hotfix mais os tickets 08 e 10.
- **Documentação da spec 046.** Os 3 commits só de documentação da spec 046 que estão na `dev` vão junto no merge. Não mudam código.
- **Push.** O push da `main` é o gatilho do deploy do front na Cloudflare e só acontece com o usuário confirmando no momento.
- **Janela.** Não há janela de indisponibilidade: toda combinação intermediária de front, banco e Edge Function é compatível.

## Testing Decisions

- **Seams.** Três, os mesmos já usados na spec 047 e na spec 046: o banco de prod (pgTAP), a Edge Function publicada (chamada pelo front) e a tela em produção (navegador). Nenhum seam novo.
- **pgTAP em prod.** Os testes 58 a 61 rodam em prod pelo `execute_sql` dentro de `begin; ... rollback;`. Eles provam a função `email_valido`, os 4 CHECKs, as RPCs de Fornecedor e os dois caminhos do `handle_new_user`, e não deixam linha nenhuma. Precedente: a spec 046 rodou os pgTAP das specs 040 a 044 em prod do mesmo jeito.
- **Conferência de esquema.** Depois das migrations: `email_valido` existe, é `immutable` e fixa `search_path` vazio; os 4 CHECKs existem e estão validados (`convalidated`).
- **Provas no navegador, em produção, depois do deploy:**
  - Clientes: domínio inventado recusado com "Este domínio não recebe e-mails."; `gmial.com` gera a sugestão, e aplicar a sugestão permite salvar. O Cliente de teste é criado sem Agendamento e apagado em seguida.
  - Console sem violação de CSP para `cloudflare-dns.com` e `dns.google`.
  - Acesso do barbeiro: criado para um profissional de teste com um e-mail real do usuário (alias `+`); a mensagem de sucesso fala da confirmação; o Login recusa antes da confirmação e mostra "Reenviar link"; depois do clique no link recebido, o Login entra. O log de Auth de prod mostra o envio com status 200. O acesso de teste é removido no fim.
  - Login de um gerente já existente continua funcionando.
- **Suíte local.** `npm run lint`, `npm test` e `npm run build` no resultado do merge, antes do push. Os testes Deno da `create-barber-access` (`email_test`, `account_test`) também.

## Out of Scope

- Qualquer mudança de código ou de regra da spec 047: esta spec só promove o que já está na `dev`.
- Apagar a função `spike-047-ticket09` da `dev` (só pelo dashboard; não afeta prod).
- Corrigir e-mails antigos em prod: a conferência mostrou que não há nenhum fora da regra.
- Levar a confirmação por link para o cadastro de barbearia ou para o Cliente (fora da spec 047).
- Configuração de SMTP e "Confirm email" em prod: feitas pelo usuário no dashboard antes desta spec.

## Further Notes

- Se uma migration falhar, a promoção para e nada mais é aplicado; o front antigo segue no ar. A correção é uma migration nova na `dev`, promovida pelo mesmo caminho.
- Se o bundle novo não aparecer em produção em até 30 minutos depois do push, conferir o deploy na Cloudflare antes de seguir com as provas. Na spec 046 o atraso chegou a cerca de 20 minutos.
- Se uma prova no navegador falhar, a correção é um commit novo na `dev`, promovido do mesmo jeito. Nunca uma edição direta na `main`.
- Commits de referência na montagem desta spec: `main` em `a13b1b3`, `dev` em `2e0e1a3`, base comum `af67361`.

## Resultado das conferências (ticket 01, 2026-09-23)

Tudo conforme o esperado. A promoção pode seguir.

- **Git.** Depois do `fetch`, `main` = `origin/main` = `a13b1b3` e `dev` = `origin/dev` = `7b9a198` (a spec 048 já está na `dev` remota). Base comum continua `af67361`.
- **Merge simulado.** `git merge-tree` entre `main` e `dev` mostra só o conflito add/add conhecido na `create-barber-access`. Nenhum outro arquivo em conflito.
- **Auth de prod.** `/auth/v1/settings` responde `mailer_autoconfirm: false` ("Confirm email" ligado).
- **Dados de prod.** Nenhum e-mail fora da regra da spec 047: `customers` 0 de 0, `suppliers` 0 de 0, `tenants` 0 de 2, `users` 0 de 3.
