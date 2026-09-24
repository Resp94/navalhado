# 02: Barbeiro só recebe notificação dos próprios Agendamentos, e só depois de ter login

**What to build:** o Barbeiro recebe no sininho só as notificações dos Agendamentos dele, e só a partir do momento em que tem login. O gatilho `handle_appointment_notification` continua criando a notificação do Gerente em todo Agendamento criado ou cancelado, mas só cria a do profissional quando ele está vinculado a um usuário barbeiro ativo. Profissional sem login não acumula notificação; profissional vinculado ao Gerente e barbeiro com login inativo também não recebem. Uma migration de dados marca como lidas (sem apagar) as notificações de barbeiro que ninguém podia ter lido: as de profissional sem login de barbeiro ativo e as criadas antes do login do barbeiro existir. O Barbeiro recém-criado abre o sininho sem notificações antigas.

Reaproveita o stash `fix gerente-barbeiro e notificacoes (pre-spec)`: migration `notificacao_so_para_barbeiro_com_login` (já aplicada no DEV em 24/09; o arquivo entra com o nome da versão aplicada) e pgTAP 62. O pgTAP ganha os casos que faltam.

**Blocked by:** 01 (a correção do acúmulo precisa rodar depois do vínculo do Gerente, para pegar as notificações do profissional que passou a ser dele)

**Status:** ready-for-agent

- [ ] pgTAP 62, no DEV dentro de `begin; ... rollback;`, com barbearia de teste sem instância WhatsApp e Agendamentos sem cliente, marcados como encaixe:
  - [ ] na criação e no cancelamento, o barbeiro com login ativo recebe uma notificação
  - [ ] o profissional sem login, o vinculado ao Gerente e o de login inativo não recebem
  - [ ] o Gerente recebe em todos os casos
  - [ ] o Agendamento de um barbeiro não gera notificação para outro barbeiro
  - [ ] logado como barbeiro, com a RLS valendo, ele lê só as notificações do próprio cadastro
- [ ] Textos, tipos (`appointment_created`, `appointment_canceled`) e momento de disparo da notificação não mudam; a função continua `SECURITY DEFINER`, `search_path` vazio e sem execução para `PUBLIC`, `anon` e `authenticated`
- [ ] Migration de dados no repositório, na ordem depois da migration do ticket 01
- [ ] Conferência no DEV por consulta: a Barbeira Erica Fernandes com 0 não lidas; as 7 não lidas do Barbeiro Diego, criadas depois do login dele, intactas; nenhuma notificação apagada
- [ ] Nenhum dado de teste do pgTAP fica no DEV depois da execução
- [ ] `npm run lint`, `npm test` e `npm run build` passam
