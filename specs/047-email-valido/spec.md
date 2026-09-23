# Especificação Técnica: aceitar apenas e-mails válidos

## Problem Statement

Hoje o Navalhado aceita e-mails que nunca vão receber mensagem nenhuma. A validação é irregular entre as telas:

- O cadastro do Acesso do barbeiro (tela e Edge Function que cria a conta) só confere se existe um `@`. Aceita `jon@x`, `@@` e e-mails com espaço.
- O e-mail de contato da barbearia em Configurações não tem validação nenhuma e pode até ser salvo vazio.
- Cadastro de barbearia, Cliente, Fornecedor e Login usam uma regex frouxa (`algo@algo.algo`), repetida em vários lugares, que aceita `jon@x.c` e pontos duplicados.
- Nenhuma tela confere se o domínio existe e recebe e-mails. Um domínio inventado (`jon@minhabarbeariafake.com.br`) ou digitado errado (`jon@gmial.com`) passa em todo lugar.
- No banco, só Fornecedor e o e-mail da barbearia no cadastro têm alguma verificação. Cliente, contato da barbearia e usuário não têm nenhuma.

A consequência mais grave é nos logins (gerente e barbeiro): com um e-mail inventado, o link de redefinição de senha nunca chega, e a pessoa fica sem conseguir recuperar o acesso. Além disso, "Confirm email" está desligado no Supabase Auth do dev e da produção. Nenhum login prova hoje que a caixa de e-mail existe, e a tela "Enviamos um link de confirmação" do cadastro de barbearia não corresponde ao que acontece.

## Solution

O trabalho tem duas fases.

**Fase 1 (entra agora): três camadas de validação em todo e-mail digitado.**

1. **Formato:** uma regra única e mais rígida, igual no front, na Edge Function e no banco.
2. **Sugestão de erro de digitação:** quando o domínio parece um provedor comum digitado errado, a tela pergunta "Você quis dizer joao@gmail.com?" e corrige com um clique. A sugestão nunca bloqueia.
3. **Domínio que recebe e-mail:** a tela consulta o DNS público (Cloudflare, com o Google como reserva) para saber se o domínio tem registro MX. Domínio sem MX, ou inexistente, é bloqueado com "Este domínio não recebe e-mails". Se a consulta não responder, o e-mail é liberado. Instabilidade de DNS nunca trava o balcão.

O banco passa a garantir o formato em todas as tabelas com e-mail. Nenhuma escrita direta pela API grava e-mail mal formado.

**Fase 2 (depois que o Resend estiver configurado como SMTP): confirmação por link nos logins.**

- Com "Confirm email" ligado, o gerente que cadastra a barbearia precisa clicar no link antes do primeiro login.
- O Acesso do barbeiro continua com e-mail e senha definidos pelo gerente, mas a conta nasce não confirmada. O barbeiro recebe um link de confirmação e só entra depois de clicar nele.
- Cliente, Fornecedor e contato da barbearia não são logins e continuam só com a fase 1.

## User Stories

1. Como gerente que cadastra a barbearia, quero ser avisado na hora se meu e-mail de acesso tem formato inválido, para não criar uma conta que não consigo recuperar.
2. Como gerente que cadastra a barbearia, quero ser impedido de usar um e-mail de acesso cujo domínio não existe, para garantir que o link de redefinição de senha chegue.
3. Como gerente que cadastra a barbearia, quero receber a sugestão "Você quis dizer gmail.com?" quando digito `gmial.com`, para corrigir o erro com um clique.
4. Como gerente que cadastra a barbearia, quero que o e-mail comercial da barbearia passe pelas mesmas verificações do e-mail de acesso, para que clientes e o próprio sistema consigam falar com a barbearia.
5. Como gerente, quero que o e-mail de um domínio próprio (por exemplo, uma caixa criada na Hostinger) seja aceito, para não ser obrigado a usar Gmail, Hotmail ou Outlook.
6. Como gerente, quero que a validação não trave meu cadastro quando o serviço de DNS estiver fora do ar, para não perder um atendimento no balcão por instabilidade externa.
7. Como gerente que cria o Acesso de um barbeiro, quero que o e-mail do barbeiro passe pelas mesmas verificações de formato e domínio, para que ele consiga recuperar a senha.
8. Como gerente que cria o Acesso de um barbeiro, quero ver o motivo exato da recusa ("formato inválido" ou "domínio não recebe e-mails"), para corrigir sem adivinhar.
9. Como gerente em Configurações, quero que o e-mail de contato da barbearia seja obrigatório e válido, para que o cadastro fique consistente com o que exigimos na criação da barbearia.
10. Como gerente cadastrando um Cliente, quero que o e-mail continue opcional, para não travar o cadastro de quem não quer informar e-mail.
11. Como gerente cadastrando um Cliente, quero que, se eu informar um e-mail, ele passe pelas verificações de formato e domínio, para não guardar contato que não funciona.
12. Como gerente cadastrando um Cliente, quero a sugestão de correção de domínio comum, para acertar o e-mail sem precisar perguntar de novo ao cliente.
13. Como gerente cadastrando um Fornecedor, quero as mesmas regras do Cliente (opcional, mas válido quando informado), para manter o cadastro de fornecedores confiável.
14. Como gerente ou barbeiro na tela de Login, quero ser avisado de formato inválido antes de enviar, para não perder uma tentativa de login por erro de digitação.
15. Como gerente ou barbeiro pedindo redefinição de senha, quero ser avisado de formato inválido antes de enviar o pedido.
16. Como gerente ou barbeiro no Login, quero que a tela não consulte DNS, para que a entrada no sistema não fique mais lenta.
17. Como gerente, quero que um e-mail digitado com maiúsculas (`JOAO@GMAIL.COM`) seja aceito, para não receber erro por algo que não importa.
18. Como gerente, quero que `joao.silva+agenda@empresa.com.br` seja aceito, para não recusar e-mails corporativos legítimos com subdomínio e tag.
19. Como gerente, quero ver o erro de formato ou domínio no próprio campo, ao sair dele, e não só ao salvar, para corrigir enquanto ainda estou no formulário.
20. Como gerente, quero que o botão de salvar confira o domínio de novo antes de gravar, para que um e-mail alterado depois da primeira checagem não escape.
21. Como responsável pelo produto, quero que o banco recuse e-mail mal formado em barbearia, Cliente, Fornecedor e usuário, mesmo quando alguém escreve direto pela API, para que a regra não dependa só da tela.
22. Como responsável pelo produto, quero uma única definição da regra de formato no banco, reaproveitada por todas as verificações, para que as regras não divirjam com o tempo.
23. Como responsável pelo produto, quero que apenas o domínio (nunca o e-mail completo) seja enviado ao serviço de DNS externo, para expor o mínimo de dado pessoal.
24. Como responsável pelo produto, quero que a falha na consulta de DNS fique registrada no console, para perceber se o serviço externo está instável.
25. Como responsável pelo produto, quero que a migration aborte inteira se a produção tiver algum e-mail fora do padrão, para corrigir os dados antes em vez de deixar a regra meio aplicada.
26. Como gerente que cadastra a barbearia (fase 2), quero receber de fato o link de confirmação prometido na tela, para ativar meu acesso.
27. Como barbeiro (fase 2), quero receber um link de confirmação no e-mail cadastrado pelo gerente, para provar que a caixa é minha antes do primeiro login.
28. Como gerente que cria o Acesso de um barbeiro (fase 2), quero ser avisado de que o barbeiro precisa confirmar o e-mail antes de entrar, para orientá-lo.
29. Como gerente ou barbeiro que ainda não confirmou o e-mail (fase 2), quero um botão "Reenviar link" no Login, para não depender de suporte quando o primeiro link se perder.
30. Como responsável pelo produto (fase 2), quero que os usuários já existentes continuem entrando normalmente depois de ligar a confirmação, porque todos já estão marcados como confirmados.

## Implementation Decisions

### Regra de formato (única, nas três camadas)

- A parte local aceita letras, dígitos e `_ % + -`, com pontos entre blocos: sem ponto no início, no fim ou dois seguidos.
- O domínio é uma sequência de rótulos alfanuméricos separados por ponto. O hífen só aparece no meio do rótulo, e o TLD final tem 2 ou mais letras.
- Maiúsculas e minúsculas são indiferentes. O valor é gravado com `trim` e em minúsculas, como já acontece em Cliente, Fornecedor e na Edge Function.
- A regra existe em três lugares com o mesmo texto: o módulo de e-mail do front, a Edge Function de Acesso do barbeiro e a função SQL. Os testes das três camadas usam a mesma tabela de casos, para pegar divergência.

### Módulo de e-mail no front (novo, sem repository/adapter)

O módulo não persiste nada, por isso não segue o par repository/adapter. Ele expõe funções puras e um hook:

- **Validar formato:** recebe o e-mail e devolve booleano.
- **Sugerir correção de domínio:** compara o domínio com uma lista local curta de provedores comuns (gmail, hotmail, outlook, live, yahoo, icloud, uol, bol, terra e variações `.com.br`) por distância de edição até 2. Devolve o e-mail corrigido ou nada. Domínio exato da lista, ou sem parecido, não gera sugestão.
- **Verificar domínio:** recebe o domínio e uma função `fetch` injetável, e devolve `valido`, `sem_mx` ou `indisponivel`.
  - Consulta o DNS-over-HTTPS da Cloudflare (formato JSON) com limite de 2s. Se houver falha ou timeout, consulta o DNS JSON do Google com mais 2s. As duas respostas têm o mesmo formato (`Status`, `Answer`) e passam pelo mesmo interpretador.
  - NXDOMAIN, resposta sem registro MX ou MX nulo (preferência 0 apontando para `.`) resultam em `sem_mx`.
  - Os dois provedores falhando resultam em `indisponivel`, com `console.warn`.
  - O resultado fica em cache em memória por domínio durante a sessão da página.
  - Domínio só com registro A e sem MX é tratado como `sem_mx`. É uma decisão consciente: a RFC permite esse caso, mas ele é raro na prática.
- **Hook de validação de e-mail para formulários**, com dois momentos:
  - **Ao sair do campo:** confere o formato, calcula a sugestão e, com formato válido, consulta o domínio. Expõe erro e sugestão para a tela, além de uma ação que aplica a sugestão.
  - **Ao salvar:** devolve se pode prosseguir. Bloqueia formato inválido e `sem_mx`, e libera `indisponivel`. A sugestão nunca bloqueia.
  - Campo vazio não dispara nada. Se o campo é obrigatório, isso continua sendo decidido pela tela.

### Onde cada camada se aplica

| Tela | Formato | Sugestão | Domínio (MX) | Obrigatório |
|---|---|---|---|---|
| Cadastro de barbearia: e-mail de acesso do gerente | sim | sim | sim | sim (já é) |
| Cadastro de barbearia: e-mail comercial | sim | sim | sim | sim (já é) |
| Acesso do barbeiro | sim | sim | sim | sim (já é) |
| Configurações: e-mail de contato | sim | sim | sim | **sim (novo)** |
| Cliente | sim | sim | sim | não |
| Fornecedor | sim | sim | sim | não |
| Login | sim | não | não | sim (já é) |
| Redefinição de senha | sim | não | não | sim (já é) |

- ClienteRepository e PlanoContasRepository trocam a regex local pela validação de formato do módulo. A consulta de domínio fica na tela, via hook, e não no repository, porque é assíncrona, externa e deve liberar quando falha.
- Configurações passa a exigir o e-mail de contato. A coluna já é `NOT NULL`, e o banco vai recusar string vazia.

### Política de segurança de conteúdo (CSP)

- O `connect-src` do Cloudflare Pages ganha `https://cloudflare-dns.com` e `https://dns.google`. O `https://*.cloudflare.com` atual não cobre `cloudflare-dns.com`, e sem essa inclusão o navegador bloqueia a consulta em produção.

### Edge Function de Acesso do barbeiro

- A validação por `@` é trocada pela regra de formato e, em seguida, pela verificação de domínio com a mesma política: Cloudflare, Google como reserva, 2s cada.
- `sem_mx` responde 400 com "Este domínio não recebe e-mails.". `indisponivel` registra aviso e segue.
- O código de e-mail fica num arquivo próprio dentro da função. Não existe pasta compartilhada entre Edge Functions, e só uma precisa desse código.
- O uso de `Deno.resolveDns` foi descartado. A documentação de limites do Supabase Edge Runtime não garante essa API, enquanto `fetch` externo é garantido (só as portas 25 e 587 são bloqueadas).

### Banco

- **Função única** `public.email_valido(text) returns boolean`: `language sql`, `immutable`, `set search_path = ''`, `security invoker` (padrão), com a regra de formato acima.
- **CHECK em quatro tabelas**, sempre criado com `not valid` e depois `validate constraint`, para evitar lock pesado durante a verificação:
  - `customers.email` e `suppliers.email`: nulo ou válido. O `suppliers_email_check` atual, com a regex antiga, é substituído.
  - `tenants.email` e `users.email`: válido. As duas colunas já são `NOT NULL`.
- `users` recebe CHECK porque hoje o e-mail de login do gerente só é validado no front. O trigger de criação de usuário valida o e-mail da barbearia, não o do login. Com o CHECK, um cadastro feito direto pela API com e-mail mal formado falha no trigger, e o Auth desfaz a criação.
- O trigger `handle_new_user` e as duas RPCs de Fornecedor (criar e atualizar) passam a chamar `public.email_valido` no lugar da regex copiada. Os códigos e mensagens de erro atuais continuam.
- **Sem pré-checagem separada em produção.** O `validate constraint` já é a verificação: se houver linha fora do padrão, a migration aborta inteira e os dados são corrigidos antes. No dev, as quatro tabelas foram consultadas em 2026-09-23 e estão todas dentro da regra nova.
- Depois da migration, os advisors de segurança e performance do Supabase rodam no dev.

### Fase 2: confirmação por link nos logins

- **Pré-requisito operacional:** o usuário configura o Resend como SMTP próprio no Auth do dev, verifica o domínio de envio e liga "Confirm email". Depois repete em produção.
  - Sem SMTP próprio, o Supabase só envia e-mail para membros da organização (mudança de 2024-09-26).
  - Desde 2026-06-03, projeto Free com SMTP padrão não customiza templates.
- **Spike no dev:** criar um usuário pelo admin com `email_confirm: false` e disparar o reenvio de confirmação do tipo `signup`, para provar que o e-mail chega nesse caso. A documentação só descreve o reenvio para uma confirmação "existente". Se não chegar, o plano B é gerar o link pelo admin e enviar pelo Resend.
- A Edge Function de Acesso do barbeiro passa a criar a conta não confirmada e a disparar o link. O gerente continua definindo a senha. A tela de Acesso avisa que o barbeiro precisa confirmar o e-mail antes do primeiro login.
- O cadastro de barbearia não muda: a tela que promete o link passa a ser verdadeira.
- O Login já traduz o erro de e-mail não confirmado e ganha a ação "Reenviar link".

## Testing Decisions

- **Critério de bom teste:** exercitar só o comportamento externo (entrada e saída das funções, o que aparece na tela e o que o banco aceita ou recusa), nunca detalhes internos como a lista de domínios ou o formato da URL consultada. Nenhum teste usa rede real: `fetch` é sempre injetado ou mockado.
- **Pontos de teste (seams), do mais alto para o mais baixo:**
  1. **Formulários (Testing Library):** testes de página que já existem para Cliente, Configurações e Cadastro de barbearia ganham um caso de e-mail bloqueado por domínio, um de sugestão aplicada e um de consulta indisponível que ainda salva. Seguem o padrão de Clientes, Configurações e Cadastro de barbearia.
  2. **Módulo de e-mail (Vitest):**
     - tabela de casos de formato (cerca de 20, entre aceitos e recusados);
     - sugestão de domínio;
     - verificação de domínio com `fetch` falso: MX presente, NXDOMAIN, sem MX, MX nulo, Cloudflare fora com Google respondendo, os dois fora, timeout e cache;
     - hook: bloqueia em `sem_mx`, libera em `indisponivel`, aplica a sugestão.
  3. **Repositories:** os testes existentes de ClienteRepository e PlanoContasRepository continuam válidos com a regra nova, e ganham casos dos formatos que antes passavam e agora são recusados.
  4. **Banco (pgTAP):** teste novo, numerado depois do último existente, rodado via MCP dentro de `begin; ... rollback;`. Cobre:
     - a função aceitando e recusando a mesma tabela de casos do front;
     - INSERT e UPDATE com e-mail mal formado sendo recusados nas quatro tabelas;
     - nulo aceito em Cliente e Fornecedor;
     - o trigger de criação de usuário recusando cadastro com e-mail mal formado.
     Segue o padrão dos testes 28 (Plano de Contas) e 29 (Contas a Pagar), que já cobrem a regra de Fornecedor.
  5. **Edge Function:** teste Deno do arquivo de e-mail com `fetch` falso, no padrão do teste da integração WhatsApp. Se o Deno não estiver disponível localmente, o teste é escrito e a validação é feita chamando a função depois do deploy no dev.
- **Verificação manual no navegador (dev):** cadastro de Cliente com domínio inventado (bloqueia) e com `gmial.com` (sugere), conferindo na aba Network que a consulta ao DNS passa. O CSP só vale no Pages, então a checagem do CSP usa o preview do Pages.

## Out of Scope

- Confirmar que a caixa existe em domínios reais (por exemplo, `qualquercoisa@gmail.com`). Isso só é possível por link de confirmação, e só entra na fase 2, e só para logins.
- Confirmação por link para Cliente, Fornecedor e contato da barbearia.
- Lista fixa de provedores permitidos. Domínios próprios (Hostinger e outros) precisam continuar aceitos.
- Bloqueio de provedores de e-mail descartável.
- Consulta de domínio no servidor para Cliente, Fornecedor e contato da barbearia. Quem chamar a API direto pula a checagem de MX nesses cadastros; o formato continua garantido pelo banco.
- Trocar o Acesso do barbeiro para convite, em que o barbeiro define a própria senha. Foi decidido manter a senha definida pelo gerente.
- Canal do Cliente: não coleta e-mail hoje.
- Corrigir e-mails já gravados em produção. Se a migration abortar, a correção é tratada à parte, antes de reaplicar.

## Further Notes

- **Decisões tomadas na conversa de 2026-09-23:**
  - validação em três camadas (formato, sugestão e MX) para todo e-mail;
  - confirmação por link só nos logins;
  - acesso do barbeiro com senha do gerente mais link de confirmação;
  - consulta de DNS feita direto do navegador, com a Cloudflare e o Google como reserva;
  - quando a consulta falha, o e-mail é liberado.
- `email.com` foi usado na conversa só como exemplo de domínio "que parece inventado". Ele é um provedor real, com MX, e continua aceito. A regra barra domínios que não recebem e-mail, não domínios pouco conhecidos.
- A redefinição de senha hoje também depende do SMTP. Até o Resend estar configurado, ela só chega para membros da organização no Supabase. A fase 2 resolve isso junto com a confirmação.
- **Ordem sugerida dos tickets:**
  1. Módulo de e-mail no front.
  2. Migration e pgTAP.
  3. Formulários.
  4. CSP.
  5. Edge Function.
  6. Fase 2: spike no dev.
  7. Fase 2: Acesso do barbeiro e "Reenviar link".
  8. Fase 2: produção.
- Produção (migration, deploy da Edge Function, SMTP e "Confirm email") só mediante pedido explícito.

## Resultado do spike (ticket 09, 2026-09-23)

**Pergunta:** um usuário criado pelo admin com `email_confirm: false` recebe o link de confirmação quando pedimos o reenvio do tipo `signup`?

**Método:** Edge Function descartável no DEV (`spike-047-ticket09`, nunca commitada), chamando `auth.admin.createUser({ email_confirm: false })` e, em seguida, `auth.resend({ type: 'signup' })`, com um e-mail real (`resplandesjonathas+spike047@gmail.com`, alias que cai na mesma caixa do usuário). Usuário de teste removido e função neutralizada (retorna 410) logo depois — só o dashboard do Supabase apaga a função de vez.

**Resultado:** `createUser` funcionou e criou o usuário não confirmado, como documentado. O `resend` **falhou** com `"Error sending confirmation email"`. O log do GoTrue (`auth_logs`) mostrou a causa exata:

```
gomail: could not send email 1: 550 "The gmail.com domain is not verified. Please, add and verify your domain on https://resend.com/domains"
```

**Causa raiz:** não é limitação do GoTrue nem do fluxo `createUser` + `resend` -- é configuração. O campo "Sender email" do SMTP do Supabase Auth (DEV) está com um endereço em `gmail.com`, e o Resend recusa enviar em nome de um domínio que a conta não verificou (não dá para verificar `gmail.com`, é do Google). O SMTP em si está corretamente apontado para o Resend -- o erro veio do próprio Resend, via GoTrue.

**Plano B não testado:** `generateLink` mais envio manual pelo Resend falharia pelo mesmo motivo (o remetente inválido é do lado do Resend, não do caminho `resend()` do GoTrue). Não faz sentido gastar outro teste nisso.

**Recomendação:** trocar o "Sender email" do SMTP (Authentication → Emails → SMTP Settings, nos dois projetos, DEV primeiro) para um endereço de um domínio verificado no Resend (por exemplo `no-reply@navalhado.com.br`, com os registros SPF/DKIM que o Resend pedir no DNS). Depois disso, o caminho já testado (`createUser` com `email_confirm: false` mais `resend`) deve funcionar sem mudança de código -- não é necessário implementar o plano B (`generateLink`). O ticket 10 pode seguir direto com esse caminho, uma vez corrigido o remetente.
