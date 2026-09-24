# Especificação Técnica: E-mails de Auth com React Email (confirmação e redefinição de senha)

## Problem Statement

Os e-mails de Auth do Navalhado ainda saem com o template padrão do Supabase: em inglês ("Confirm your email address"), sem a marca, com um link cru. O gerente que cadastra a barbearia, o barbeiro cujo acesso o gerente criou e quem pede "Esqueci minha senha" recebem uma mensagem que não parece vir do Navalhado. Isso gera desconfiança e parece spam.

Os templates vivem num campo de texto do dashboard do Supabase, fora do git, e precisam ser copiados à mão entre dev e prod. Não há revisão, histórico nem preview.

Estado conferido em 23/09, pelo conector do Resend e pelos e-mails enviados:

- **Envio atual.** SMTP próprio no Resend, nos dois projetos. Remetente do dev: `"Navalhado" <noreply@dev.navalhado.com.br>`. Remetente de prod: `"Navalhado" <noreply@app.navalhado.com.br>`.
- **Domínios.** `dev.navalhado.com.br` e `app.navalhado.com.br` verificados no Resend, com envio ligado, região `sa-east-1`.
- **Site URL.** O `redirect_to` dos e-mails enviados mostra `https://dev.navalhado.com.br/` no dev e `https://app.navalhado.com.br/` em prod. `/` é a tela de Login.
- **Tipos de e-mail em uso.** `signup` (cadastro de barbearia, acesso do barbeiro criado pelo gerente, "Reenviar link" no Login) e `recovery` ("Esqueci minha senha", com destino na tela de redefinição). Nenhum fluxo usa magic link, convite, troca de e-mail ou reautenticação.

## Solution

Trocar o envio do Supabase pelo **Send Email Hook**. Com o hook ligado, o Supabase Auth deixa de usar o SMTP e chama uma Edge Function nova a cada e-mail de Auth. A função verifica a assinatura do hook, escolhe o template React Email pelo tipo de e-mail, gera HTML e texto puro, e envia pela API do Resend. É o caminho documentado pela própria Supabase ("Custom Auth Emails with React Email and Resend").

Os templates passam a viver no repositório, com preview local, e seguem o visual aprovado nos protótipos: fundo branco, marca à esquerda, título grande, bloco em destaque creme com o botão cobre, aviso de segurança, link reserva e rodapé com a marca pequena, sem links.

Nada muda no front nem na Edge Function de acesso do barbeiro. Cadastro, reenvio e redefinição chamam o Supabase Auth como hoje; só o que ele faz depois muda.

A volta atrás é desligar o hook no dashboard: o Auth volta na hora ao SMTP do Resend. Por isso a configuração de SMTP e os templates atuais do dashboard ficam intocados.

## User Stories

1. As a dono de barbearia se cadastrando, I want receber o e-mail de confirmação em português e com a marca do Navalhado, so that eu reconheça a mensagem e confie no link.
2. As a Barbeiro cujo acesso o gerente criou, I want um texto de confirmação que não suponha que fui eu quem criou a conta, so that a mensagem faça sentido para mim.
3. As a usuário que esqueceu a senha, I want um e-mail "Redefina sua senha" com a marca do Navalhado e um botão claro, so that eu troque a senha sem desconfiar do link.
4. As a usuário que não pediu nada, I want um aviso dizendo que posso ignorar o e-mail, so that eu não me assuste com uma mensagem inesperada.
5. As a usuário cujo cliente de e-mail bloqueia o botão, I want o link por extenso para copiar e colar, so that eu consiga concluir mesmo assim.
6. As a usuário que confirma o e-mail, I want cair na tela de Login depois do clique, so that eu entre com e-mail e senha em seguida.
7. As a usuário que pede redefinição, I want cair na tela de redefinição de senha depois do clique, so that eu escolha a nova senha.
8. As a usuário que abre o e-mail no celular, I want o conteúdo legível sem zoom, so that eu conclua a ação no próprio telefone.
9. As a usuário que recebe o e-mail, I want ver o remetente "Navalhado" no mesmo endereço de sempre, so that a mensagem não caia em spam nem pareça golpe.
10. As a Gerente que reenvia o link a um barbeiro, I want que ele receba exatamente um e-mail por pedido, so that a caixa dele não encha de mensagens repetidas.
11. As a Desenvolvedor, I want os templates versionados no repositório com preview local, so that mudar um texto seja um commit revisado e não uma edição no dashboard.
12. As a Desenvolvedor, I want que dev e prod usem o mesmo template e mudem só o remetente e o endereço da logo, so that o que eu testo no dev é o que vai para prod.
13. As a Desenvolvedor, I want que um e-mail de tipo não usado (magic link, convite, troca de e-mail, reautenticação) falhe com erro explícito e log, so that um fluxo novo não mande um e-mail errado sem ninguém perceber.
14. As a Desenvolvedor, I want que a função recuse chamadas sem assinatura válida do hook, so that ninguém use a função para mandar e-mail em nome do Navalhado.
15. As a Desenvolvedor, I want que uma falha passageira do Resend gere retry do Supabase sem duplicar o e-mail, so that o usuário receba exatamente uma mensagem.
16. As a Desenvolvedor, I want que uma recusa definitiva do Resend (endereço inválido, remetente não autorizado) volte como erro ao front sem retry, so that o usuário veja a falha na hora.
17. As a Desenvolvedor, I want que nenhum log contenha token, hash ou link de verificação, so that os logs não deem acesso a conta alguma.
18. As a Desenvolvedor, I want que a função recuse o envio com log claro quando faltar um secret, so that uma configuração incompleta apareça logo no primeiro teste.
19. As a Desenvolvedor, I want provar antes que o React Email 6 roda no Deno das Edge Functions dentro do limite de 5 s do hook, so that o desenho não dependa de uma suposição.
20. As a Desenvolvedor, I want voltar ao SMTP só desligando o hook, sem reverter código, so that uma falha em produção tenha saída imediata.
21. As a Desenvolvedor, I want uma chave do Resend só para o hook em cada ambiente, so that eu revogue a do hook sem derrubar o SMTP de reserva.
22. As a Desenvolvedor, I want que a chave do Resend nunca passe por conversa, log ou repositório, so that ela não vaze.

## Implementation Decisions

### Módulos

- **Edge Function de envio de e-mail de Auth** (nova, `send-auth-email`). Handler fino: lê o corpo cru, verifica a assinatura, monta o e-mail, envia pelo Resend e traduz o resultado em resposta HTTP.
- **Módulo de montagem do e-mail**, dentro da função. Interface: recebe o payload do hook e a URL do Supabase; devolve assunto, HTML e texto puro, ou erro de tipo não suportado. Esconde a escolha do template, a montagem do link e o endereço da logo.
- **Templates React Email**, dentro da função: um layout compartilhado (marca, bloco em destaque, aviso, link reserva, rodapé) e um template por tipo de e-mail. Cada template recebe só o que exibe: o link da ação e o endereço do site.
- **Imagem da logo** entre os arquivos públicos do app, publicada pelo Cloudflare junto com o front.

### Contratos

- **Entrada: Send Email Hook do Supabase.** Payload com `user` e `email_data` (`token_hash`, `redirect_to`, `email_action_type`, `site_url`), assinado no padrão Standard Webhooks (cabeçalhos `webhook-id`, `webhook-timestamp`, `webhook-signature`).
- **Link de verificação**, o contrato com o Supabase Auth:

  ```
  <SUPABASE_URL>/auth/v1/verify?token=<token_hash>&type=<email_action_type>&redirect_to=<redirect_to codificado>
  ```

  O `redirect_to` vem do payload, então o destino depois do clique continua sendo o que o front pediu: Login na confirmação, tela de redefinição na redefinição.
- **Saída: API REST do Resend** (`POST /emails`) por `fetch`, sem o SDK: é uma chamada só, e fica uma dependência a menos. Campos `from`, `to`, `subject`, `html`, `text`. Cabeçalho `Idempotency-Key` com o `webhook-id` do hook, para que um retry do Supabase não duplique o e-mail.
- **Respostas ao hook.** Toda resposta, inclusive de erro, com `Content-Type: application/json`; sem isso o Auth devolve 500 genérico.

  | Situação | Resposta | Efeito no Supabase |
  | --- | --- | --- |
  | Enviado | 200 com `{}` | segue o fluxo |
  | Resend 5xx ou 429, ou falha de rede | 503 com `retry-after` | até 3 retries dentro de 5 s |
  | Assinatura inválida, tipo não suportado, secret ausente, Resend 4xx | erro com `{ error: { http_code, message } }` | falha sem retry, erro volta ao front |

### Decisões

- **Tipos suportados.** `signup` usa o template de confirmação, com o assunto "Confirme seu e-mail no Navalhado". `recovery` usa o template de redefinição, com o assunto "Redefina sua senha do Navalhado". Qualquer outro tipo devolve erro explícito, com log do tipo recebido. Nenhum fluxo do app dispara outro tipo; um template genérico seria código morto.
- **Assinatura.** Biblioteca `standardwebhooks`, com o secret do hook sem o prefixo `v1,whsec_`. A rotação com vários secrets fica fora.
- **Sem verificação de JWT na função.** O hook não manda JWT; a assinatura cumpre esse papel. O deploy passa isso explicitamente.
- **Mesmo código nos dois runtimes.** Os templates rodam no Node (preview) e no Deno (função). Por isso importam `react-email` sem prefixo de runtime. O Node resolve pelo `node_modules`; a função, por um mapa de imports próprio que fixa as versões de `react-email`, `react` e `standardwebhooks` e configura o JSX. As versões ficam fixas nos dois lados.
- **Logo.** PNG de 192 px, o mesmo do ícone do app; SVG não aparece no Gmail nem no Outlook. O endereço vem da origem de `redirect_to` (`new URL(redirect_to).origin + '/email/logo.png'`): o dev busca em `dev.navalhado.com.br`, prod em `app.navalhado.com.br`, sem variável nova. **Não usa `site_url`** — provado no ticket 02 que esse campo é a URL da própria API do GoTrue (`.../auth/v1`), não o site do app; usá-lo gerava um link de logo quebrado.
- **Texto puro.** Sai do mesmo template que o HTML.
- **Logs.** Só `email_action_type`, `user.id` e o status do Resend. Nunca `token`, `token_hash`, o link nem o corpo do e-mail.
- **Secrets**, cadastrados pelo usuário no dashboard de cada projeto: `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET` e `AUTH_EMAIL_FROM`.
  - `AUTH_EMAIL_FROM` do dev: `Navalhado <noreply@dev.navalhado.com.br>`. De prod: `Navalhado <noreply@app.navalhado.com.br>`. São os mesmos remetentes do SMTP de hoje, então a reputação dos domínios não muda.
  - `RESEND_API_KEY`: chave nova, só do hook. `hook.dev` no dev e `hook.prod` em prod, com "Sending access" restrito ao domínio do ambiente, criadas pelo usuário no dashboard do Resend. As chaves atuais (`nav.dev` e `prod.nav`) continuam no SMTP de reserva.
- **Preview local.** `react-email` como devDependency com versão fixa e um script npm que abre o preview dos templates da função.

### Visual e texto

- Visual aprovado nos protótipos. A base é o template de confirmação do Slack do repositório de demos do React Email. Conteúdo alinhado à esquerda, largura máxima de 600 px, fonte Helvetica ou Arial (fonte web não carrega no Gmail nem no Outlook).
- **Cores da marca**, dos tokens do app:
  - botão `#B85900`, a variante `-solid`, que passa 4.5:1 com texto branco;
  - bloco em destaque `#FFF1E6`;
  - texto `#2D231E`;
  - texto secundário `#70625B`;
  - rodapé `#A8998F`.
- **Confirmação.**
  - Título: "Confirme seu e-mail".
  - Introdução: "Seu acesso ao Navalhado está quase pronto. Clique no botão abaixo para confirmar este e-mail. Depois é só entrar com seu e-mail e senha."
  - Botão: "Confirmar e-mail".
  - Aviso: "Se você não esperava este e-mail, não precisa se preocupar: pode ignorá-lo com segurança."
  - Texto único para o gerente e para o barbeiro.
- **Redefinição.**
  - Título: "Redefina sua senha".
  - Introdução: "Recebemos um pedido para trocar a senha da sua conta no Navalhado. Clique no botão abaixo para escolher uma nova senha."
  - Botão: "Criar nova senha".
  - Aviso: "Se você não pediu a troca, não precisa se preocupar: ignore este e-mail e sua senha atual continua valendo."
- **Nos dois.**
  - Link reserva por extenso: "Se o botão não funcionar, copie e cole este endereço no navegador:".
  - Rodapé com a marca pequena, "Você recebeu este e-mail porque há uma conta Navalhado com este endereço." e "© <ano> Navalhado. Todos os direitos reservados.".
  - Sem links no rodapé: o site e o Login levam à mesma tela, e um "Entrar" competiria com o botão de confirmação.

### Ordem

(1) spike no dev; (2) fatia completa para `recovery` no dev; (3) `signup` e a volta atrás no dev. Entre (2) e (3), o hook do dev só fica ligado durante as provas: com ele ligado e só `recovery` suportado, a confirmação no dev falharia. Prod fica numa spec de promoção à parte, só com pedido explícito.

## Testing Decisions

- **Bom teste:** exercita só o comportamento externo da função. Uma requisição assinada entra, como o Supabase manda; saem a chamada ao Resend e a resposta HTTP. O teste não verifica o HTML exato, a estrutura dos templates nem funções internas. Ele verifica o que o Supabase e o Resend enxergam.
- **Um seam automatizado: o handler da Edge Function.** Testes Deno sobem o handler com um `fetch` falso no lugar do Resend e assinam as requisições com a própria `standardwebhooks`. Não há teste separado do módulo de montagem; ele é detalhe interno, coberto pelo handler. Casos:
  - `recovery`: resposta 200 com `Content-Type: application/json`. O Resend recebe o remetente de `AUTH_EMAIL_FROM`, o assunto de redefinição e um HTML e um texto que contêm o link com `type=recovery`. O `redirect_to` sai codificado e a logo sai com a origem de `redirect_to`.
  - `signup`: mesma coisa, com o assunto de confirmação e `type=signup`.
  - Tipo não suportado: erro sem retry, e o Resend não é chamado.
  - Assinatura inválida: erro sem retry, e o Resend não é chamado.
  - Secret ausente: erro, e o Resend não é chamado.
  - Resend 500 ou 429: 503 com `retry-after`. Resend 422: erro sem retry.
  - O `Idempotency-Key` enviado é o `webhook-id`.
  - Nenhuma saída de log contém o token, o hash ou o link.
- **Prior art.** Os testes Deno da Edge Function de acesso do barbeiro, que isolam o Supabase atrás de dependências injetadas e rodam com `deno test`.
- **Spike, concluído em 24/09.** Função descartável no dev, nunca commitada. Confirmou:
  - o import de `react-email`, `react` e `standardwebhooks` pelo mapa de imports funciona no deploy;
  - o render gera HTML e texto no Deno, com `Tailwind` e `pixelBasedPreset`;
  - o tempo de render fica em torno de 85 ms (HTML mais texto puro), estável entre a primeira chamada e as seguintes — bem abaixo dos 5 s do hook. O envio real ao Resend não foi medido de dentro da função (sem secret ainda; fica para o ticket 02), mas a soma continua folgada.

  Sem necessidade do plano B (`@react-email/components`). **Achado que muda a implementação:** o entrypoint precisa ser `.tsx`, não `.ts` — um `.ts` com JSX falha o bundling mesmo com `compilerOptions.jsx` no mapa de imports, porque a extensão do arquivo decide se o parser aceita JSX, não só a configuração. A função é neutralizada depois (responde 410; só o dashboard apaga de vez), e o resultado está registrado no ticket 01.
- **Prova de ponta a ponta no dev**, com e-mails reais do usuário (alias `+` no Gmail), em cada fluxo: "Esqueci minha senha", cadastro de barbearia, "Reenviar link" e acesso de barbeiro criado pelo gerente. Em cada fluxo, conferir:
  - o e-mail chega com o visual aprovado e com a logo;
  - o botão leva ao destino certo;
  - o Resend registra o remetente certo e status `delivered`;
  - o log da função não traz token;
  - o tempo da chamada fica dentro do limite.

  Nenhum Agendamento é criado nesses testes, para não disparar WhatsApp real. Os usuários de teste são removidos no fim, com confirmação do usuário.
- **Volta atrás, provada no dev.** Com o hook desligado, "Esqueci minha senha" sai pelo SMTP, com o template antigo. O hook é religado em seguida.
- **Suíte do app.** `npm run lint`, `npm test` e `npm run build` passam. O front não muda, então não há teste Vitest novo.

## Out of Scope

- Promoção para prod (deploy da função, secrets, hook no projeto de prod): spec de promoção à parte, só com pedido explícito.
- Templates para magic link, convite, troca de e-mail e reautenticação: nenhum fluxo do app usa.
- Texto diferente para o barbeiro ("A Barbearia X criou seu acesso"): decidido texto único.
- Redirecionar para a agenda quem já está logado ao abrir o Login depois de confirmar: mudança à parte na tela de Login.
- Código de 6 dígitos no e-mail: o app não tem tela para digitar código.
- Rotação de secret do hook com vários valores.
- Apagar os templates do dashboard e a configuração de SMTP: ficam como volta atrás.
- E-mails que não são de Auth.

## Further Notes

- **Limite de 5 s.** O Supabase dá 5 s para a chamada inteira do hook, retries incluídos. O spike mediu ~85 ms de render, bem abaixo disso; o ticket 02 mede o caminho completo com o Resend real.
- **Entrypoint `.tsx`.** Achado do spike: o arquivo de entrada da função precisa ter extensão `.tsx` para o bundler aceitar JSX, mesmo com o `jsx` configurado no mapa de imports.
- **Duplicidade.** Sem o `Idempotency-Key`, um 503 depois de o Resend já ter aceitado o envio faria o retry mandar um segundo e-mail.
- **Chaves.** O usuário cria as chaves no dashboard do Resend e as cadastra como secret no Supabase. A chave nunca passa pela conversa nem pelo repositório; pelo conector do Resend só se confere que ela existe.
- **Tickets** em `.scratch/emails-de-auth/issues/`.
- **Commit de referência** na montagem desta spec: `dev` em `6668ded`.
- **Encerrada em 24/09.** Tickets 01, 02 e 03 concluídos e verificados de ponta a ponta no dev, com e-mails reais, nos quatro fluxos (cadastro de barbearia, "Reenviar link", acesso de barbeiro criado pelo gerente, "Esqueci minha senha") e com a volta atrás provada. Promoção para prod fica para uma spec à parte, só com pedido explícito.
