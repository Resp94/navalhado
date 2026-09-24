# Especificação Técnica: Gerente que também atende e notificações do Barbeiro

## Problem Statement

Dois problemas aparecem logo depois da compra do Navalhado, quando o Gerente monta a equipe.

**1. O Gerente que também atende aparece como barbeiro sem acesso.** No último passo do onboarding, o wizard pergunta se o Gerente também atende e oferece "Me incluir como Barbeiro". O Gerente passa a ter o papel de gerente e um cadastro de profissional na agenda. Mas esse cadastro nasce sem vínculo com o login dele. Em "Criar acesso", o Gerente aparece na lista de profissionais sem login, como se fosse um barbeiro esperando credenciais. Se o Gerente criar esse acesso, ganha um segundo login só para ver a própria agenda, e o cadastro de profissional fica preso a esse segundo login.

**2. O Barbeiro recém-criado herda uma pilha de notificações.** Quando o Gerente cria o acesso de um Barbeiro, o sininho do Barbeiro já abre cheio de notificações não lidas, mesmo sendo o primeiro login. Para quem vê, parece que o Barbeiro recebeu as notificações da barbearia.

Estado conferido no dev em 24/09:

- **Wizard.** O item marcado "Me incluir como Barbeiro" é gravado em `professionals` sem `user_id`. A marcação de que aquele profissional é o Gerente não é gravada em lugar nenhum. Duas barbearias do dev estão nessa situação: "Barbearia Teste Navalhado" (Jonathas Teste) e "Barbearia Alpha Dev" (Carlos Alpha Gestor).
- **Criar acesso.** A tela lista todo profissional ativo sem `user_id`. A Edge Function `create-barber-access` recusa só o profissional que já tem `user_id`.
- **Notificações: não há vazamento entre usuários.** A RLS de `notifications` deixa o Barbeiro ler só as notificações cujo `professional_id` é o cadastro dele. Entrando como a Barbeira Erica Fernandes, com a RLS valendo, ela viu 15 notificações: 0 do Gerente, 0 de outros barbeiros, 15 do cadastro dela.
- **Notificações: a causa real.** O gatilho `handle_appointment_notification` cria duas notificações a cada Agendamento criado ou cancelado: uma para o Gerente (`professional_id` nulo) e uma para o profissional do Agendamento. A do profissional nasce mesmo quando ele ainda não tem login. O cadastro da Erica é de 03/09 e o login dela é de 23/09. As 15 notificações são de Agendamentos entre 12/09 e 22/09, todas anteriores ao login, e ficaram acumuladas até o login existir.
- **Busca de notificações na tela.** Quando a busca não recebe profissional nem é do Gerente, ela vem sem filtro de destinatário. Hoje só a RLS impede que o Barbeiro sem cadastro vinculado veja notificações de outros.

## Solution

**Gerente que também atende.** Ao concluir o onboarding, o profissional criado por "Me incluir como Barbeiro" fica vinculado ao login do próprio Gerente. Com isso, "Criar acesso" deixa de listar o Gerente, a Edge Function recusa criar acesso para ele e a lista da equipe mostra que ele já tem login. O Gerente continua entrando pelo painel do Gerente, que já mostra a agenda de todos. As barbearias já criadas são corrigidas uma vez, pelo nome.

**Notificações do Barbeiro.** O Barbeiro recebe notificação só dos Agendamentos dele, e só a partir do momento em que tem login.

- O gatilho só cria a notificação do profissional quando ele está vinculado a um usuário barbeiro ativo. Profissional sem login não acumula notificação. Profissional vinculado ao Gerente também não recebe, porque o Gerente já recebe a notificação geral de todo Agendamento.
- As notificações de barbeiro que ninguém podia ter lido são marcadas como lidas, uma vez: as de profissional sem login de barbeiro ativo e as criadas antes do login do barbeiro existir. O histórico fica guardado.
- A busca de notificações na tela não traz nada quando não há profissional vinculado nem é o Gerente. A regra deixa de depender só da RLS.

A notificação do Gerente não muda.

## User Stories

1. As a Gerente fazendo o onboarding, I want me incluir como barbeiro com um clique, so that eu apareça na agenda com os meus horários.
2. As a Gerente que também atende, I want que o meu cadastro de profissional fique ligado ao meu login, so that o sistema saiba que esse profissional sou eu.
3. As a Gerente que também atende, I want não aparecer na lista de "Criar acesso", so that eu não crie por engano um segundo login para mim.
4. As a Gerente, I want que a Edge Function recuse criar acesso para o profissional que sou eu, so that ninguém contorne a tela e crie esse segundo login.
5. As a Gerente, I want ver na lista da equipe que o meu cadastro de profissional já tem login, so that eu entenda por que ele não aparece em "Criar acesso".
6. As a Gerente que concluiu o onboarding antes desta correção, I want que o meu cadastro de profissional seja vinculado ao meu login, so that o problema suma sem eu refazer nada.
7. As a Gerente com dois profissionais de mesmo nome, I want que a correção automática não escolha um deles no chute, so that nenhum cadastro fique ligado à pessoa errada.
8. As a Gerente que cadastra barbeiros no onboarding, I want que os outros barbeiros continuem sem login, so that eu crie o acesso de cada um depois em "Criar acesso".
9. As a Barbeiro, I want receber notificação só dos meus Agendamentos, so that eu não veja o movimento de outros barbeiros.
10. As a Barbeiro, I want nunca ler notificação de outro barbeiro, nem pelo sininho nem pelo tempo real, so that a agenda dos colegas fique privada.
11. As a Barbeiro cujo acesso acabou de ser criado, I want abrir o sininho sem notificações antigas, so that eu comece do zero.
12. As a Barbeiro com login, I want receber notificação quando um Agendamento meu é criado, so that eu saiba do novo horário na hora.
13. As a Barbeiro com login, I want receber notificação quando um Agendamento meu é cancelado, so that eu saiba que o horário ficou livre.
14. As a Barbeiro com login desativado, I want não acumular notificações, so that uma reativação não traga uma pilha antiga.
15. As a Barbeiro sem cadastro de profissional vinculado, I want ver o sininho vazio, so that eu não veja notificações que não são minhas.
16. As a Gerente, I want continuar recebendo notificação de todo Agendamento criado ou cancelado, so that eu acompanhe a barbearia inteira.
17. As a Gerente que também atende, I want receber uma notificação por Agendamento, e não duas, so that o sininho não repita a mesma informação.
18. As a Gerente, I want que as notificações antigas continuem guardadas, só marcadas como lidas, so that o histórico não se perca.
19. As a Desenvolvedor, I want a regra "só notifica barbeiro com login ativo" no gatilho do banco, so that todo caminho que cria ou cancela Agendamento siga a mesma regra.
20. As a Desenvolvedor, I want um teste pgTAP que prove quem recebe e quem não recebe notificação, so that uma mudança futura no gatilho não traga o problema de volta.

## Implementation Decisions

- **Vínculo do Gerente no onboarding.** Ao concluir o wizard, o profissional marcado como "Me incluir como Barbeiro" é gravado com o `user_id` do usuário logado, que é o Gerente. Os demais profissionais continuam com `user_id` nulo. O insert continua direto em `professionals` pelo cliente. A RLS de insert já permite isso, e o índice único parcial em `professionals.user_id` garante um profissional por login.
- **Sem coluna nova.** "Este profissional é o Gerente" é representado pelo `user_id` apontando para um usuário com papel `gerente`. Não se cria marcação separada.
- **Impacto do vínculo, conferido.** As 13 funções e as políticas que leem `professionals.user_id` decidem pelo papel do usuário antes. O caminho do Gerente não depende do vínculo. As políticas que usam `is_own_professional` e `is_own_appointment` já liberam tudo ao Gerente pelo papel. O `BarbeiroLayout` exige papel `barbeiro`, então o Gerente não entra por ele.
- **Correção dos onboardings antigos (migration de dados).** A migration vincula gerente ativo e profissional da mesma barbearia, com o mesmo nome (sem diferenciar maiúsculas nem espaços nas pontas), profissional sem login e não excluído. Só vincula quando o par é único dos dois lados e o Gerente ainda não tem profissional vinculado. Caso ambíguo fica como está.
- **Gatilho `handle_appointment_notification`.** A notificação do Gerente continua em todo Agendamento criado e em todo cancelamento. A do profissional só é criada quando o profissional do Agendamento está vinculado a um usuário com papel `barbeiro` e ativo. Textos, tipos (`appointment_created`, `appointment_canceled`) e o momento de disparo não mudam. A função continua `SECURITY DEFINER` com `search_path` vazio e sem execução para `PUBLIC`, `anon` e `authenticated`.
- **Correção do acúmulo (migration de dados).** Notificações não lidas com `professional_id` preenchido passam a lidas quando não existe usuário barbeiro ativo vinculado ao profissional, criado até o momento da notificação. Isso cobre profissional sem login, vinculado ao Gerente, com login inativo e notificação anterior ao login. Nada é apagado.
- **Ordem das migrations.** Primeiro o vínculo do Gerente, depois o gatilho e o acúmulo. Assim as notificações do profissional recém-vinculado ao Gerente já entram na correção do acúmulo.
- **RLS de `notifications` não muda.** Ela já limita o Barbeiro às notificações do próprio cadastro. O teste passa a provar isso.
- **Busca de notificações na tela.** Quando não recebe profissional nem é do Gerente, a busca não consulta o banco, não assina o tempo real e devolve lista vazia. Com profissional, continua filtrando por ele. Com Gerente, continua filtrando por `professional_id` nulo.
- **Ambientes.** Tudo vai primeiro para o dev (`selvxobcjbkligxighlp`). Prod só numa promoção pedida à parte.

## Testing Decisions

- **Bom teste aqui** olha o comportamento de fora: o que o wizard manda gravar, quem recebe notificação, o que cada usuário consegue ler. Não olha como o gatilho ou o componente fazem por dentro.
- **Wizard de onboarding (teste de componente, Vitest).** O teste percorre os 4 passos com o banco simulado. O Gerente se inclui como barbeiro e cadastra mais um barbeiro. O teste confere que o insert em `professionals` leva o `user_id` do Gerente no cadastro dele e `user_id` nulo no outro. Precedente: o teste atual do wizard, que já percorre os 4 passos.
- **Gatilho de notificação (pgTAP no dev, dentro de `begin; ... rollback;`).** Barbearia de teste sem instância WhatsApp e Agendamentos sem cliente, para nada sair pelo WhatsApp. Agendamento marcado como encaixe para dispensar a validação de expediente. O teste confere:
  - na criação e no cancelamento, o barbeiro com login ativo recebe uma notificação;
  - o profissional sem login, o vinculado ao Gerente e o de login inativo não recebem;
  - o Gerente recebe em todos os casos;
  - o Agendamento de um barbeiro não gera notificação para outro barbeiro;
  - logado como barbeiro, com a RLS valendo, ele lê só as notificações do próprio cadastro.

  Precedentes: pgTAP 51 (barbeiro lê cancelados do próprio profissional) e 55 (setup com encaixe).
- **Busca de notificações (teste do hook, Vitest).** Sem profissional e sem ser Gerente, o hook não consulta nem assina o tempo real, e a lista fica vazia. Precedente: o teste atual do hook, que já cobre filtro por profissional e o descarte de notificação de outro profissional no tempo real.
- **Migrations de dados.** Rodam uma vez só e não têm teste automatizado. Cada uma é conferida no dev por consulta antes e depois: quantos gerentes vinculados e quantas notificações marcadas como lidas.

## Out of Scope

- O Gerente se incluir como barbeiro depois do onboarding, pela tela de Profissionais. Hoje não existe essa opção, e ela não é criada aqui.
- Mostrar "Gerente" em vez de "já possui login" na lista da equipe.
- Dar ao Gerente uma visão de "Minha Agenda" ou "Minhas Comissões" como barbeiro.
- A política de update de `professionals` não restringe o `user_id` que o Gerente grava. Fica anotado para outra spec.
- Mensagens de WhatsApp. O Evento de Agendamento pelo WhatsApp não muda.
- Promoção para prod.

## Further Notes

- **Esta spec nasceu depois do código.** Uma primeira implementação foi feita antes da spec e está no stash `fix gerente-barbeiro e notificacoes (pre-spec)`. As duas migrations dela já foram aplicadas no dev em 24/09:
  - `vincula_gerente_incluido_como_barbeiro` vinculou Jonathas Teste e Carlos Alpha Gestor;
  - `notificacao_so_para_barbeiro_com_login` trocou o gatilho e marcou 20 notificações como lidas, 15 delas da Erica. As 7 não lidas do Barbeiro Diego, criadas depois do login dele, ficaram como estavam.

  Os tickets reaproveitam esse código. Falta nele o teste de um barbeiro não receber notificação de outro, a leitura com RLS e a mudança no hook.
- **Termos.** "Notificação" aqui é a do sininho (`public.notifications`). Não confundir com Evento de Agendamento nem com mensagem de WhatsApp.

## Resultado (2026-09-24)

Todos os 3 tickets concluídos, na `dev` local (`422e051`), sem push.

- **Ticket 01.** Migration `vincula_gerente_incluido_como_barbeiro` aplicada no dev. Jonathas Teste e Carlos Alpha Gestor vinculados ao próprio login; nenhum outro gerente afetado, nenhum caso ambíguo. Os dois tenants ficaram com 0 profissionais ativos sem login.
- **Ticket 02.** Migration `notificacao_so_para_barbeiro_com_login` aplicada no dev. pgTAP 62 com 12 asserções, 12/12, cobrindo os casos da spec e os dois que faltavam no código pré-spec (isolamento entre barbeiros e leitura por RLS). Nenhum dado de teste ficou no dev. Erica com 0 não lidas, Diego com as 7 dele intactas, 156 notificações no total, nenhuma apagada.
- **Ticket 03.** `useRealtimeNotifications` devolve lista vazia sem consultar o banco nem assinar o tempo real quando não há profissional vinculado nem é o Gerente. 13/13 testes do hook.
- **`npm run lint`, `npm test` (1318 testes) e `npm run build`** passam depois de cada ticket.
- **Fora do combinado:** nenhum. Tudo saiu como a spec previu.
- **Pendente:** merge em `main` e push da `dev`, a pedido do usuário; nada foi enviado ao remoto nesta sessão.
