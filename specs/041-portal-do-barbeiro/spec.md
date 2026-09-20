# Spec 041 — Portal do Barbeiro

## Problem Statement

O barbeiro entra no sistema e cai numa tela que ficou para trás. A Minha Agenda ainda oferece "Iniciar" e "Finalizar", fluxo que o gestor não usa mais: hoje o atendimento é cobrado pela Comanda, com Sessão de Caixa. O "Finalizar" do barbeiro grava pagamento direto no banco, fora da Comanda e da Sessão de Caixa, e marca o Agendamento como concluído pela tela. Esse caminho não passa pelas regras de fechamento da spec 040 e, pela política de acesso atual, provavelmente nem funciona.

Ao mesmo tempo, o barbeiro não consegue fazer o que precisa na própria agenda. Não cria Agendamento nem encaixe, não reagenda, não cancela e não marca "não compareceu". Para tudo isso depende do gestor.

A Minhas Comissões recalcula a comissão no navegador com a porcentagem atual do catálogo. Se o gestor muda a porcentagem de um serviço, a tela do barbeiro passa a mostrar um valor diferente do que foi gravado no fechamento da Comanda e do que o gestor vê na Quitação de Comissão.

O layout mobile do barbeiro também diverge do padrão atual do painel do gestor.

Por fim, o banco dá ao barbeiro mais do que ele precisa. Ele pode escrever direto em Comandas e Itens de Comanda de qualquer profissional do tenant, em produtos, na Lista de Espera e no cadastro de clientes.

## Solution

O barbeiro passa a ter controle total sobre os Agendamentos vinculados a ele, e nada além disso.

Na Minha Agenda ele vê a própria agenda no mesmo componente que o gestor usa no mobile, com um profissional só. Pode criar Agendamento e encaixe, reagendar (só data e hora), cancelar, marcar "não compareceu" e criar ou remover Bloqueio de Horário na própria agenda. Toda escrita passa pelas mesmas RPCs do gestor, que passam a aceitar o barbeiro dono do Agendamento. "Iniciar", "Finalizar" e a cobrança saem da tela do barbeiro. A cobrança continua com o gestor, pela Comanda.

A Minhas Comissões passa a ler a comissão gravada no fechamento da Comanda, pela mesma fonte que o gestor usa na Quitação de Comissão.

No banco, o barbeiro perde a escrita direta em Agendamentos, Comandas, Itens de Comanda, produtos, Lista de Espera e clientes. Continua lendo o que precisa para operar a própria agenda.

## User Stories

### Minha Agenda: leitura

1. Como barbeiro, quero ver meus Agendamentos do dia no mesmo formato que o gestor vê no celular, para não aprender duas telas.
2. Como barbeiro, quero navegar entre os dias da minha agenda, para me preparar para amanhã.
3. Como barbeiro, quero ver só os meus Agendamentos, para não confundir com os dos colegas.
4. Como barbeiro, quero ver meus Bloqueios de Horário na agenda, para saber quando estou indisponível.
5. Como barbeiro, quero chamar o cliente no WhatsApp a partir do Agendamento, para confirmar ou avisar atraso.
6. Como barbeiro, quero ver o status de cada Agendamento (pendente, confirmado, concluído, cancelado, não compareceu), para saber o que já aconteceu.
7. Como barbeiro, quero que a agenda use o fuso da barbearia, para que "hoje" seja o mesmo dia para mim e para o gestor.

### Minha Agenda: criação e encaixe

8. Como barbeiro, quero criar um Agendamento num horário livre da minha agenda, para marcar um cliente que me procurou direto.
9. Como barbeiro, quero criar um encaixe na minha agenda, para atender um cliente fora da grade quando houver espaço.
10. Como barbeiro, quero escolher um cliente já cadastrado, para não duplicar cadastro.
11. Como barbeiro, quero cadastrar um cliente novo com nome e telefone ao criar o Agendamento, para não depender do gestor.
12. Como barbeiro, quero ver só os horários livres da minha agenda, para não marcar em cima de outro Agendamento ou Bloqueio.
13. Como barbeiro, quero que o profissional venha travado em mim, para não criar Agendamento na agenda de um colega.
14. Como barbeiro, quero que o sistema recuse criar Agendamento para outro profissional, mesmo que a tela seja adulterada.
15. Como barbeiro, quero que o sistema recuse "Tanto faz" quando sou eu quem cria, para o Agendamento não cair na agenda de outro.
16. Como barbeiro, quero que o limite de um encaixe por profissional e horário valha para mim também.
17. Como barbeiro, quero que expediente, escala e Bloqueio de Horário valham para mim como valem para o gestor.

### Minha Agenda: transições

18. Como barbeiro, quero reagendar meu Agendamento para outra data e hora, para acomodar um pedido do cliente.
19. Como barbeiro, quero que o sistema recuse trocar o profissional quando sou eu quem reagenda, para não jogar cliente na agenda de um colega.
20. Como barbeiro, quero cancelar meu Agendamento com um motivo, para liberar o horário.
21. Como barbeiro, quero marcar "não compareceu" no meu Agendamento depois do horário de início, para registrar a falta.
22. Como barbeiro, quero que o sistema recuse marcar falta antes do horário de início, com a mesma regra do gestor.
23. Como barbeiro, quero que as regras de estado de origem (o que pode ser cancelado, reagendado ou marcado como falta) sejam as mesmas do gestor.
24. Como barbeiro, quero que o sistema recuse qualquer transição em Agendamento de outro profissional.
25. Como barbeiro, quero ver uma mensagem clara quando o sistema recusar uma ação, sem perder o que preenchi.

### Minha Agenda: Bloqueio de Horário

26. Como barbeiro, quero bloquear um horário na minha agenda (almoço, folga), para o Canal do Cliente não oferecer esse horário.
27. Como barbeiro, quero remover um Bloqueio de Horário meu.
28. Como barbeiro, quero que o profissional do Bloqueio venha travado em mim.

### Minha Agenda: o que sai

29. Como barbeiro, não quero ver "Iniciar" nem "Finalizar", porque o ciclo atual não usa mais essas etapas.
30. Como barbeiro, não quero cobrar pela minha tela, porque a cobrança é feita pelo gestor na Comanda.
31. Como gestor, quero que o barbeiro não grave pagamento fora da Comanda, para o caixa bater.
32. Como barbeiro, não quero ver faturamento e comissão estimados na agenda, porque a comissão real está em Minhas Comissões.
33. Como barbeiro, não quero ver Lista de Espera, Cobrar nem ações de outros profissionais.

### Minhas Comissões

34. Como barbeiro, quero ver minha comissão do período pelo valor gravado no fechamento da Comanda, para bater com o que o gestor me paga.
35. Como barbeiro, quero que a mudança de porcentagem de um serviço no catálogo não altere comissões já fechadas na minha tela.
36. Como barbeiro, quero ver meu saldo a receber (comissões e gorjetas em aberto, menos vales), pela mesma conta da Quitação de Comissão.
37. Como barbeiro, quero ver o extrato dos atendimentos que geraram comissão no período.
38. Como barbeiro, quero continuar vendo meus vales em aberto e o extrato da minha Conta do Profissional.
39. Como barbeiro, quero filtrar por hoje, 7 dias e mês, como já faço hoje.
40. Como barbeiro, não quero ver comissão, saldo ou extrato de outro profissional.

### Layout

41. Como barbeiro, quero que o header e a navegação inferior no celular sigam o padrão atual do painel, para a experiência ser a mesma do resto do sistema.
42. Como barbeiro, quero sair da conta pela navegação, como hoje.

### Segurança e multi-tenant

43. Como gestor, quero que o barbeiro não escreva direto em Agendamentos, para toda mudança passar pelas regras do banco.
44. Como gestor, quero que o barbeiro não escreva em Comandas nem em Itens de Comanda, para a cobrança ficar só comigo.
45. Como gestor, quero que o barbeiro não altere produtos, para o estoque e o preço ficarem sob meu controle.
46. Como gestor, quero que o barbeiro não escreva na Lista de Espera, porque o Rodízio de Barbeiros é decisão do balcão.
47. Como gestor, quero que o barbeiro não edite o cadastro de clientes direto, e que o cliente novo que ele cria nasça pela RPC de criação.
48. Como gestor, quero que as permissões novas do barbeiro não mudem nada do que eu já faço.

### Isolamento entre barbearias

49. Como dono de barbearia, quero que o barbeiro de outra barbearia não leia nada da minha: Agendamentos, clientes, serviços, profissionais, Comandas, Bloqueios de Horário e comissões.
50. Como dono de barbearia, quero que o barbeiro de outra barbearia não consiga criar, reagendar, cancelar nem marcar falta em Agendamento meu, mesmo passando o identificador da minha barbearia na chamada.
51. Como dono de barbearia, quero que o barbeiro não consiga usar cliente, serviço ou entrada de Lista de Espera de outra barbearia ao criar um Agendamento na minha.
52. Como dono de barbearia, quero que o barbeiro não consiga criar Bloqueio de Horário na minha barbearia.
53. Como barbeiro sem barbearia vinculada (`tenant_id` nulo), quero ser recusado em toda escrita e não enxergar dado nenhum, porque um usuário barbeiro nasce sem vínculo.
54. Como gestor, quero que um barbeiro desativado (`is_active` falso) perca leitura e escrita na hora.
55. Como gestor, quero que um usuário barbeiro cuja barbearia não bate com a do cadastro de profissional seja recusado, para um vínculo cruzado não virar porta de entrada.
56. Como barbeiro, quero que minha tela descubra a barbearia pelo meu vínculo de profissional, nunca por um valor vindo da URL ou do navegador.
57. Como gestor com `tenant_id` nulo, quero continuar recusado nas RPCs que recebem tenant, como já acontece.
58. Como proprietário, quero continuar operando qualquer tenant.

### Qualidade e manutenção

59. Como desenvolvedor, quero que os modais de criação, encaixe, reagendamento, cancelamento e falta sejam os mesmos para gestor e barbeiro, para mudar uma regra de tela num lugar só.
60. Como desenvolvedor, quero que a Minha Agenda use o AgendaRepository e não chame o Supabase direto.
61. Como desenvolvedor, quero que a Minhas Comissões use o ComissaoRepository e não recalcule comissão no navegador.

## Implementation Decisions

### Papel do barbeiro

- O barbeiro opera só Agendamentos em que é o profissional. Cobrança, Comanda, Sessão de Caixa, Lista de Espera e cadastros ficam com o gestor.
- "Iniciar atendimento" sai da tela do barbeiro. A RPC de iniciar continua existindo para o gestor; removê-la não é desta spec.

### RPCs de Agendamento

- As RPCs de cancelar, marcar falta e reagendar passam a aceitar o barbeiro dono do Agendamento, pela mesma checagem de acesso que a RPC de iniciar já usa: papel e tenant do usuário, e Agendamento do profissional vinculado ao usuário. Barbeiro em Agendamento alheio recebe erro de acesso (`42501`).
- Regras de estado de origem, expediente, escala, conflito, Bloqueio de Horário e falta só depois do início não mudam. São as da spec 040.
- Reagendar: quando quem chama é barbeiro, trocar de profissional é recusado com erro de acesso. O gestor continua podendo trocar.
- Criar Agendamento e encaixe: a RPC de criação passa a aceitar o barbeiro. Quando quem chama é barbeiro:
  - o profissional é obrigatório e precisa ser o dele;
  - "Tanto faz" é recusado;
  - entrada da Lista de Espera precisa ser nula.
  - Cliente existente e cliente novo (nome e telefone) continuam aceitos. O cliente novo nasce dentro da RPC.
- As RPCs seguem o padrão do repo: `security definer`, `search_path` vazio, checagem de `auth.uid()` no corpo.

### Isolamento entre barbearias

- A barbearia do usuário nunca vem da tela. Toda RPC decide pelo papel e pela barbearia gravados no usuário autenticado, e recusa quando a barbearia pedida não é a dele. Proprietário segue como exceção proposital.
- Para o barbeiro há uma segunda trava: o Agendamento (ou o profissional informado na criação) precisa ser de um cadastro de profissional vinculado ao usuário **e** da mesma barbearia dele. Vínculo cruzado (usuário de uma barbearia apontando para profissional de outra) é recusado.
- Barbeiro com barbearia nula ou usuário desativado é recusado em toda escrita, e a leitura não devolve linha nenhuma.
- Na criação, cliente, serviço, profissional e entrada de Lista de Espera precisam ser da mesma barbearia da chamada.
- Leitura continua restrita pelas políticas de acesso por barbearia, que já existem. Esta spec não afrouxa nenhuma delas.
- A consulta de comissão do barbeiro já deriva a barbearia do cadastro de profissional dele e recusa barbearia divergente. A tela passa a depender desse contrato em vez de montar a consulta sozinha.

### Políticas de acesso (RLS)

- O barbeiro perde a escrita direta em: Agendamentos (inserir e atualizar), Comandas e Itens de Comanda (inserir e atualizar), produtos (atualizar), Lista de Espera (inserir e atualizar) e clientes (inserir e atualizar).
- A leitura do barbeiro não muda: próprios Agendamentos, profissionais, serviços, clientes e Bloqueios do tenant.
- Bloqueio de Horário continua como está: o barbeiro escreve só os próprios.
- Os gatilhos que criam e cancelam a Comanda do Agendamento são `security definer` e continuam funcionando quando a escrita vem da RPC.
- Antes de fechar cada tabela, o ticket confere que nenhum código do barbeiro ainda escreve nela direto.

### Minha Agenda

- Prefactor: os modais de criação e encaixe, reagendamento, cancelamento e falta saem da Agenda Geral e viram componentes compartilhados. Eles recebem o profissional fixo como opção. A Agenda Geral passa a usá-los sem mudar de comportamento.
- A Minha Agenda reusa o componente da agenda mobile do gestor, com um profissional só, no celular e no desktop. As ações de Cobrar e Lista de Espera ficam ocultas para o barbeiro.
- Todas as escritas vão pelo AgendaRepository. Leituras de profissional, serviços, clientes, Agendamentos e Bloqueios do dia seguem o padrão já usado pela Agenda Geral.
- Removidos da tela: "Iniciar", "Finalizar", o modal de pagamento, os cards de faturamento e comissão estimados.
- O modal de Bloqueio de Horário do gestor é reusado com o profissional travado no barbeiro.

### Minhas Comissões

- O total do período, o saldo a receber e o extrato vêm do ComissaoRepository (saldo e extrato do profissional). A RPC de saldo já aceita o barbeiro só para os próprios dados.
- A comissão exibida é a gravada no fechamento da Comanda (snapshot), nunca recalculada pela porcentagem atual do catálogo.
- Vales em aberto e extrato da Conta do Profissional continuam como estão.
- Filtros de período: hoje, 7 dias e mês, no fuso da barbearia.

### Layout

- O layout do barbeiro segue o padrão mobile atual do painel do gestor (header e navegação inferior). Navegação: Minha Agenda, Comissões, Sair.

### Módulos tocados

- RPCs de Agendamento e políticas de acesso no Postgres (migration nova).
- AgendaRepository: nenhum método novo. Os existentes passam a ser usados pelo barbeiro.
- ComissaoRepository: nenhum método novo previsto.
- Modais da Agenda Geral extraídos para componentes compartilhados.
- Minha Agenda, Minhas Comissões e o layout do barbeiro.

## Testing Decisions

- Um bom teste verifica comportamento pela porta pública (RPC, Repository ou tela), não detalhe interno.
- **pgTAP, rodado pelo MCP do Supabase em `begin; ... rollback;`**, em arquivo novo numerado a partir do maior prefixo existente. Cobrir:
  - barbeiro dono consegue cancelar, marcar falta, reagendar (mesmo profissional), criar Agendamento e encaixe (cliente existente e novo);
  - barbeiro recusado: em Agendamento alheio, ao trocar de profissional no reagendamento, com "Tanto faz", com entrada da Lista de Espera, para outro profissional e em outro tenant;
  - escrita direta do barbeiro recusada em Agendamentos, Comandas, Itens de Comanda, produtos, Lista de Espera e clientes;
  - Bloqueio de Horário próprio aceito, alheio recusado;
  - Comanda do Agendamento criado pelo barbeiro nasce pelo gatilho, e é cancelada quando ele cancela;
  - gestor sem regressão, incluindo gestor com `tenant_id` nulo recusado e proprietário aceito;
  - isolamento entre barbearias, com duas barbearias no mesmo teste: barbeiro da barbearia A recusado ao criar, reagendar, cancelar e marcar falta na barbearia B, inclusive passando o identificador da barbearia B na chamada;
  - barbeiro da barbearia A recusado ao usar cliente, serviço ou entrada de Lista de Espera da barbearia B numa criação na barbearia A;
  - barbeiro da barbearia A recusado ao criar Bloqueio de Horário na barbearia B;
  - barbeiro com `tenant_id` nulo e barbeiro desativado recusados em toda escrita;
  - usuário barbeiro cuja barbearia não bate com a do cadastro de profissional recusado;
  - leitura: barbeiro da barbearia A não enxerga nenhuma linha da barbearia B em Agendamentos, clientes, serviços, profissionais, Comandas e Bloqueios de Horário.
- **Vitest nos repositórios** contra o adaptador em memória, só se algum método mudar de contrato.
- **Testes de tela** da Minha Agenda e da Minhas Comissões: ações proibidas não aparecem, profissional travado nos modais, comissão exibida pelo valor gravado, e a barbearia usada nas chamadas vem do vínculo de profissional do usuário, nunca da URL. Os testes atuais da Agenda Geral continuam verdes depois da extração dos modais.
- Prior art: pgTAP da spec 040 em `supabase/tests/database/`, testes da agenda mobile do gestor e os testes atuais das telas do barbeiro.

## Out of Scope

- Cobrança pelo barbeiro, Comanda, Sessão de Caixa e Lista de Espera na tela do barbeiro.
- Remover a RPC de iniciar atendimento ou o status "em atendimento".
- Fluxo de convite ou vínculo de usuário barbeiro a profissional pelo gestor.
- A RPC de horários livres do painel, que é `security definer` e não confere papel nem tenant. Tem ticket próprio, fora desta spec, na pasta de trabalho `seguranca-horarios-livres`.
- Quitação de Comissão e vale, que continuam só com o gestor.
- Mudanças na Agenda Geral além da extração dos modais.

## Further Notes

- O "Finalizar" legado grava em pagamentos, tabela sem política de escrita para barbeiro. O botão provavelmente já falha hoje. Ele sai nesta spec sem migração de dados.
- As decisões de papel foram tomadas com o usuário: o barbeiro não cobra, reagenda sem trocar de profissional, cria Agendamento e encaixe com cliente novo ou existente, e gerencia o próprio Bloqueio de Horário.
- Dar ao barbeiro as RPCs de transição e criação é decisão de acesso. Registrar em ADR, no padrão das ADRs recentes.
- A consulta de comissão recusa barbeiro cujo cadastro de profissional esteja inativo ou arquivado. A tela precisa tratar essa recusa como mensagem, não como erro genérico.
- Contas de teste do DEV: barbeiro Diego, da Barbearia Alpha Dev, no documento de credenciais de teste.
