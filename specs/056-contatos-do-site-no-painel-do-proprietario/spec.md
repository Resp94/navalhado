# Especificação Técnica: Contatos do Site no painel do Proprietário

Triagem: `ready-for-agent`

## Problem Statement

O site do Navalhado (`navalhado.com.br`, outro repositório, Worker `navalhado-site`) tem um formulário de contato. Cada envio vira uma linha na tabela `contatos` do D1 `navalhado-site` (nome, sobrenome, e-mail, barbearia, assunto, mensagem, data, `ip`, `user_agent` e `status`), e um aviso por e-mail vai para `contato@navalhado.com.br` pelo Resend.

O Proprietário não tem onde ver essas mensagens dentro do Navalhado:

- Para ler uma mensagem, ele depende da caixa de e-mail, ou abre o D1 no painel da Cloudflare.
- A coluna `status` (`novo`, `lido`, `respondido`) foi criada para o Proprietário marcar o andamento, mas nada a altera: toda mensagem fica `novo` para sempre.
- Sem marcar o andamento, não há como saber quais mensagens ainda pedem resposta.
- Quando chega um contato novo, o painel do Proprietário não mostra nada. Quem não olhou o e-mail não fica sabendo.

## Solution

O painel do Proprietário ganha a aba **Contatos**, ao lado de Dashboard e Barbearias.

- A aba lista as mensagens do formulário do site, da mais nova para a mais antiga. Os filtros são Novos, Lidos, Respondidos e Todos, e Novos é o padrão, como numa caixa de entrada.
- Abrir uma mensagem mostra tudo o que a pessoa preencheu e a marca como lida.
- A mensagem aberta tem os botões "Marcar como respondido" e "Marcar como não lida". A resposta em si continua sendo feita à mão, fora do Navalhado.
- A aba Contatos mostra no cabeçalho um contador de mensagens novas, visível em todas as telas do painel do Proprietário. Um formulário enviado no site aparece no contador em até 1 minuto, sem recarregar a página.
- O aviso por e-mail para `contato@` continua como está.

O app lê e grava direto no D1 do site, pelo Worker do próprio app, sem cópia no Supabase. O D1 continua sendo a única fonte dos contatos. Dev e prod ficam separados: o app de dev usa o D1 `navalhado-site-dev`, e o de prod usa o `navalhado-site`.

## User Stories

1. Como Proprietário, quero ver as mensagens do formulário de contato do site dentro do painel, para não depender da caixa de e-mail.
2. Como Proprietário, quero ver as mensagens da mais nova para a mais antiga, para tratar primeiro o que acabou de chegar.
3. Como Proprietário, quero abrir a aba Contatos já filtrada em Novos, para ver logo o que ainda não li.
4. Como Proprietário, quero filtrar por Novos, Lidos, Respondidos e Todos, para achar uma mensagem pelo andamento.
5. Como Proprietário, quero ver em cada linha da lista o nome e o sobrenome, a barbearia, o assunto, a data e o status, para decidir qual abrir sem abrir todas.
6. Como Proprietário, quero que a linha sem barbearia informada não mostre um campo vazio estranho, porque a barbearia é opcional no formulário.
7. Como Proprietário, quero abrir uma mensagem e ver o e-mail e a mensagem inteira, com as quebras de linha que a pessoa digitou, para entender o pedido.
8. Como Proprietário, quero que a mensagem aberta vire lida sozinha, para não precisar de um clique a mais em cada leitura.
9. Como Proprietário, quero marcar uma mensagem como respondida depois de responder fora do Navalhado, para saber que ela não pede mais nada.
10. Como Proprietário, quero marcar uma mensagem como não lida, para ela voltar a Novos quando eu quiser tratá-la depois.
11. Como Proprietário, quero que abrir de novo uma mensagem lida ou respondida não mude o status dela, para não desfazer o que já marquei.
12. Como Proprietário, quero que a lista acompanhe o filtro quando eu mudo o status de uma mensagem, para a mensagem marcada sair de Novos na hora.
13. Como Proprietário, quero carregar as mensagens mais antigas aos poucos, para a tela abrir rápido mesmo com muitas mensagens.
14. Como Proprietário, quero ver um contador de contatos novos na aba Contatos, em qualquer tela do meu painel, para saber que chegou mensagem sem abrir a aba.
15. Como Proprietário, quero que o contador suma quando não houver contato novo, para ele só chamar a atenção quando importa.
16. Como Proprietário, quero que um formulário enviado no site apareça no contador em até 1 minuto, sem recarregar a página.
17. Como Proprietário, quero que o contador baixe na hora em que abro uma mensagem nova, sem esperar o próximo minuto.
18. Como Proprietário, quero que o painel não fique consultando contatos com a aba do navegador em segundo plano, para não gastar requisições à toa.
19. Como Proprietário, quero que o contador se atualize quando eu volto para a aba do navegador, para não ver um número velho.
20. Como Proprietário, quero que a aba Contatos e o contador caibam numa tela de 375 px, sem rolagem horizontal, para conferir mensagens pelo celular.
21. Como Proprietário, quero uma mensagem clara e um botão "Tentar de novo" quando a lista não carrega, para não confundir erro com caixa vazia.
22. Como Proprietário, quero ver "Nenhum contato novo" (ou o equivalente do filtro) quando não houver mensagens, para saber que a lista carregou.
23. Como Proprietário, quero que, se marcar uma mensagem falhar, a tela volte ao status anterior e me avise, para a tela nunca mostrar um status que não foi gravado.
24. Como Proprietário, quero que o texto das mensagens apareça como texto, nunca como HTML, para uma mensagem maliciosa não executar nada no meu painel.
25. Como Proprietário, quero que só eu consiga ler e marcar os contatos do site, porque são dados pessoais de quem nos procurou.
26. Como Gerente, inclusive com `tenant_id` nulo, Barbeiro ou visitante sem login, quero receber recusa ao chamar as rotas de contatos, para a guarda valer para todo papel que não é o Proprietário.
27. Como pessoa que preencheu o formulário, quero que o meu IP e o meu navegador não apareçam na tela do painel, porque o Proprietário não precisa deles para me responder.
28. Como Proprietário, quero que o painel de dev mostre só os contatos do site de dev, para um teste nunca tocar as mensagens reais.
29. Como Proprietário, quero continuar recebendo o aviso por e-mail de cada contato novo, para não perder uma mensagem se eu não abrir o painel.
30. Como desenvolvedor, quero que a regra de quem é Proprietário continue no Postgres, para o Worker não manter uma cópia dessa regra.
31. Como desenvolvedor, quero rodar a tela de Contatos localmente lendo o D1 de dev, para desenvolver sem publicar.
32. Como desenvolvedor, quero que o resto do app continue servido como hoje (SPA nos assets), para o script novo do Worker não mexer em nenhuma outra rota.
33. Como desenvolvedor, quero testes do Worker, do módulo e da tela, e um pgTAP da guarda, para a autorização e o fluxo de status não regredirem sem aviso.

## Implementation Decisions

### Worker do app

- O Worker do app (`navalhado` em prod, `navalhado-dev` em dev) passa de "só assets" para "assets + script". Só `/api/*` passa pelo script (`run_worker_first`). O resto continua servido pelos assets, com o fallback de SPA de hoje.
- **Binding D1 `CONTATOS`:** no topo da configuração, aponta para `navalhado-site`. No `env.dev`, aponta para `navalhado-site-dev`, repetido porque bindings e vars não são herdados entre ambientes. O D1 de dev já existe, com a tabela migrada.
- **Vars do Worker, por ambiente:** a URL do projeto Supabase e a chave anon. São valores públicos, então ficam na configuração, sem segredo. Prod usa o projeto `boakqstrdfqmsrwnjore`, e dev usa o `selvxobcjbkligxighlp`.
- **As migrations da tabela `contatos` continuam no repositório do site.** O app não cria nem altera a tabela: só lê e atualiza `status`.
- **Rotas, todas exigindo o Proprietário:**
  - `GET /api/admin/contatos?status=<novo|lido|respondido>&antesDe=<id>`:
    - devolve `{ contatos, haMais }`, 50 por página, ordenada por `id` decrescente (o `id` é autoincremento, e a ordem bate com `criado_em`);
    - `antesDe` pagina pelo id (keyset);
    - sem `status`, devolve todas;
    - `status` fora da lista dá 422.
  - `PATCH /api/admin/contatos/:id` com `{ status }`:
    - aceita só `novo`, `lido` ou `respondido`; fora disso, 422;
    - id inexistente dá 404;
    - devolve o contato atualizado.
  - `GET /api/admin/contatos/novos`: devolve `{ novos }`, a contagem de `status = 'novo'`, que usa o índice `contatos_status` já existente.
- **Campos devolvidos:** `id`, `criado_em`, `nome`, `sobrenome`, `email`, `barbearia` e `assunto`, mais `mensagem` e `status`. **`ip` e `user_agent` nunca saem do Worker** (minimização, LGPD; a spec 055 trata registros de acesso).
- **SQL:** sempre parametrizado (`prepare().bind()`), sem nenhum trecho vindo do cliente.
- **Erros:**
  - Erro do D1 vira 500, com mensagem genérica, e o detalhe vai só para o log do Worker.
  - Rota `/api/*` desconhecida dá 404 em JSON, e método errado dá 405.

### Autorização

- **RPC nova, `public.assert_proprietario()`:**
  - security definer, `search_path` vazio;
  - só chama `private.assert_saas_admin()`, que recusa com `ADMIN_ONLY`/42501;
  - `EXECUTE` só para `authenticated`.
- **Como o Worker usa a RPC:**
  - repassa o `Authorization: Bearer <jwt>` do usuário para a RPC no PostgREST do ambiente, e o PostgREST valida o JWT;
  - sem cabeçalho ou com JWT inválido, a resposta é 401;
  - `ADMIN_ONLY` vira 403;
  - qualquer outra falha do Supabase vira 503;
  - uma chamada por requisição, sem cache.
- Assim a regra de quem é Proprietário (`users.role = 'proprietario'` e `is_active`) continua num lugar só, o Postgres.

### Módulo do front: Contatos do Site

Segue o padrão de módulo do projeto (repositório, adaptador, hooks).

- **Tipos:**
  - `ContatoDoSite`: id, recebidoEm (Date), nome, sobrenome, email, barbearia (ou nulo), assunto, mensagem, status.
  - `StatusDoContato`: `'novo' | 'lido' | 'respondido'`.
- **Interface do adaptador:**
  - `listar(filtro: StatusDoContato | null, antesDe: number | null)` devolve `{ contatos, haMais }`;
  - `marcar(id, status)` devolve o `ContatoDoSite`;
  - `contarNovos()` devolve um `number`.
- **Adaptador real:** fala com o Worker na mesma origem, levando o token da sessão do Supabase. 401 e 403 viram erros de domínio, e as outras falhas viram um erro genérico de leitura ou gravação.
- **Adaptador em memória:** usado nos testes.
- **Repositório:**
  - valida o status;
  - converte as datas;
  - expõe `abrir(contato)`, que marca como `lido` só quando o contato está `novo` e não faz nada nos outros casos;
  - avisa os assinantes depois de cada mudança de status, para o contador se atualizar na hora.
- **Hook da lista:** cuida do filtro (padrão Novos), da paginação ("Carregar mais"), de abrir e de marcar. A mudança aparece na hora e é desfeita, com toast de erro, quando a gravação falha.
- **Hook do contador:**
  - lê ao montar;
  - lê a cada 60 segundos enquanto `document.visibilityState` é `visible`, e lê de novo ao voltar a ficar visível;
  - lê quando o repositório avisa uma mudança;
  - com a aba oculta, não consulta.

### Tela

- **Rota:** `/admin/contatos`, protegida por `AuthGuard allowedRole="proprietario"`.
- **Cabeçalho:** o cabeçalho compartilhado do painel do Proprietário ganha a terceira aba, Contatos, com o contador. Com zero, o contador some. As três abas, o contador e o Sair cabem em 375 px.
- **Lista:**
  - Cada linha mostra nome e sobrenome, barbearia (quando houver), assunto, data e um selo de status.
  - Clicar abre a mensagem: e-mail, mensagem com as quebras de linha preservadas (texto, nunca HTML), e os botões "Marcar como respondido" e "Marcar como não lida", conforme o status atual.
- **Estados:**
  - carregando;
  - vazio, com uma mensagem por filtro (ex.: "Nenhum contato novo");
  - erro: "Não foi possível carregar os contatos", com "Tentar de novo".
- **Sem resposta pela tela:** não há link nem envio de resposta. O Proprietário responde à mão, fora do Navalhado.

### Desenvolvimento local

- Um script novo roda o Worker localmente com o ambiente dev.
- O binding D1 de `env.dev` usa `remote = true`, para o desenvolvimento local ler e marcar o `navalhado-site-dev` real (só há mensagens de teste nele).
- O Vite manda `/api` para esse Worker por proxy. O `npm run dev` continua sendo o comando do front, e a tela de Contatos pede os dois rodando.
- O plugin da Cloudflare para o Vite fica de fora, porque mudaria a saída do `vite build` e o deploy.

### Implantação

- O deploy do app parece ser automático a cada push, pelo Workers Builds: `dev` vai para `navalhado-dev` e `main` para `navalhado`. É uma dedução pelos horários, e precisa ser confirmada no painel da Cloudflare.
- **Antes do primeiro push**, confirmar que o build da `dev` publica com `--env dev`. Sem isso, o push publicaria no Worker de prod, com os bindings de prod.
- **A migration da RPC vai para o Supabase de dev antes do push na `dev`.** Senão, a tela no ar recebe erro em vez de 403 ou 200.
- **DEV:**
  - aplicar a migration pelo MCP (`selvxobcjbkligxighlp`);
  - fazer o push na `dev`;
  - conferir no site de dev, logado como Proprietário: enviar um formulário pelo site de dev, ver o contador subir em até 1 minuto, abrir a mensagem (fica lida e o contador baixa) e marcar como respondida;
  - conferir que um Gerente recebe 403.
- **PROD:** só com o OK do usuário. Migration no `boakqstrdfqmsrwnjore`, merge para a `main` e a mesma conferência em produção, sem enviar formulário falso para o D1 real.

## Testing Decisions

- **Um bom teste aqui** exercita o comportamento visto de fora: a resposta HTTP do Worker, o que o repositório devolve e o que a tela mostra. Não testa como o código chega lá, nem SQL exato ou chamadas internas.
- **Costuras:**
  1. o handler HTTP do Worker;
  2. o repositório, sobre o adaptador em memória;
  3. a tela, sobre o repositório com adaptador em memória;
  4. o pgTAP da RPC.

  Nada abaixo disso.
- **Worker** (Vitest, D1 e `fetch` do Supabase simulados):
  - 401 sem token e com JWT recusado;
  - 403 com `ADMIN_ONLY`;
  - 200 para o Proprietário;
  - 503 com o Supabase fora;
  - listagem por filtro e paginação por `antesDe`, com `haMais`;
  - 422 para status inválido, na listagem e no `PATCH`;
  - 404 para id inexistente;
  - contagem de novos;
  - `ip` e `user_agent` ausentes de toda resposta;
  - 500 genérico quando o D1 falha;
  - rotas fora de `/api/admin/contatos` dão 404.
- **Módulo:**
  - repositório contra o adaptador em memória: `abrir` marca como `lido` só o que está `novo`, o status inválido é recusado, e os assinantes são avisados depois de marcar;
  - adaptador real com `fetch` simulado: cabeçalho de autorização, tradução de 401, 403 e falhas, e conversão de datas;
  - hook do contador com timers falsos e `visibilityState` simulado: consulta a cada 60 segundos com a aba visível, não consulta oculta, consulta ao voltar e consulta depois de marcar.
- **Tela** (Testing Library):
  - abre em Novos;
  - abrir uma mensagem a marca como lida e a tira da lista de Novos;
  - os botões de marcar funcionam;
  - falha ao marcar desfaz a mudança e mostra o toast;
  - o estado vazio e o de erro (com "Tentar de novo") aparecem;
  - o texto com `<script>` aparece como texto.
  - No cabeçalho: o contador aparece com novos, some com zero, e a aba atual fica marcada.
- **Banco:** o pgTAP `81_contatos_do_site_no_painel.test.sql`, rodado pelo MCP dentro de `begin; ... rollback;`, prova o seguinte:
  - o Proprietário ativo passa;
  - o Proprietário inativo é recusado;
  - o Gerente, inclusive com `tenant_id` nulo, o Barbeiro e o anônimo são recusados com 42501.
- **Prior art:**
  - `80_painel_do_proprietario.test.sql` e `78_ferramentas_do_proprietario.test.sql`: guardas do Proprietário em pgTAP;
  - os testes do módulo `proprietario`: repositório, adaptador e hooks;
  - os testes de `CabecalhoDoAdmin`;
  - no repositório do site, `worker/rotas.test.ts` e `worker/novidades.test.ts`: handler de Worker com bindings simulados.
- **Teste manual:** em 375 px e no desktop, no site de dev, como descrito em Implantação.

## Out of Scope

- **A tela de Novidades (changelog)**, que grava no D1 `navalhado-changelog` e envia imagens ao R2. O mesmo Worker do app vai servir para ela, mas fica para uma spec própria.
- **Responder pelo painel**, tanto enviando e-mail pelo Resend quanto por link `mailto:`.
- **Som, notificação do navegador e toast de contato novo.** O contador é o aviso.
- **Mudanças no site:** formulário, tabela `contatos`, aviso por e-mail ou migrations do D1.
- **Copiar os contatos para o Supabase.**
- **Excluir ou arquivar mensagens, e busca por texto.**
- **Exibir `ip` e `user_agent`**, e qualquer regra de retenção ou eliminação dos contatos (assunto da spec 055).
- **O plugin da Cloudflare para o Vite**, que rodaria o Worker e o front num comando só.

## Further Notes

- **"Contato do Site" é um termo novo** (mensagem do formulário de contato do site, guardada no D1 do site, com o andamento `novo`, `lido` e `respondido`). Vale entrar em `CONTEXT.md` junto da implementação.
- **"Admin" é só o nome técnico das rotas** (`/admin/*`) e do cabeçalho. No texto, use "painel do Proprietário".
- **O CLAUDE.md diz que o app é publicado no "Cloudflare Pages"**, mas hoje ele é um Worker com assets. A seção de arquitetura deve ser atualizada quando o Worker ganhar o script.
- **No repositório do site,** a spec do changelog (`docs/superpowers/specs/2026-10-09-changelog-d1-design.md`) e `docs/app-changelog.md` já pressupõem que o app acessa o D1 por binding nos Workers `navalhado` e `navalhado-dev`. Esta spec monta essa ponte.
