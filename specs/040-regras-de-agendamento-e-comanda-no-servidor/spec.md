# Spec 040 — Regras de Agendamento e Comanda no Servidor

## Problem Statement

A Agenda Geral é a tela mais usada do painel do gestor, e boa parte do que ela decide sobre um Agendamento nunca passa pelo banco. Criar, reagendar, cancelar, iniciar atendimento e marcar falta (no-show) são escritas diretas na tabela de agendamentos, feitas pela própria tela. O Canal do Cliente já faz o mesmo trabalho por RPC, com validação no servidor. O gestor e o barbeiro, não.

**Um Agendamento pode mudar de estado de um jeito que não deveria.** Iniciar atendimento e reagendar não conferem o estado de origem: um Agendamento cancelado pode voltar a "em atendimento" se duas telas estiverem abertas ao mesmo tempo. A regra "falta só depois do horário de início" existe só na tela.

**Dois encaixes podem cair no mesmo horário.** O limite de um encaixe por profissional e horário é conferido só contra o que a tela carregou. Outra recepção, ou o mesmo gestor em outra aba, passa pela checagem. Quando o profissional é "Tanto faz", a checagem olha o campo errado e deixa passar.

**A Comanda é criada em quatro lugares.** O banco já cria a Comanda quando nasce um Agendamento. A Agenda Geral, a Minha Agenda do barbeiro e o repositório de Comandas repetem esse trabalho, cada um com uma versão própria. Duas criações ao mesmo tempo podem gerar corrida.

**A Lista de Espera perde gente.** Ao encaixar um cliente da Lista de Espera, a entrada é marcada como atendida antes de o Agendamento ser salvo. Se o gestor fecha o modal, o cliente some da fila sem ter horário.

**O reagendamento pelo checkout ignora a agenda.** A tela de fechamento de Comanda reagenda direto na tabela, sem checar conflito nem Bloqueio de Horário. Se a busca de horários falha, ela oferece uma grade fixa de 08:00 a 19:30, que pode não existir na barbearia.

**O valor cobrado pode não ser o do catálogo.** O preço de cada Item de Comanda vem da tela. O banco só confere que não é negativo. Quem chama a RPC direto consegue fechar uma Comanda com qualquer preço.

**A gorjeta pode ir para quem não participou.** O banco aceita qualquer profissional como destinatário da gorjeta, inclusive de outra barbearia, e cria o crédito na Conta do Profissional dele. A tela também deixa fechar a Comanda sem destinatário quando há mais de um profissional nos itens.

**O total da tela pode diferir do total gravado em R$ 0,01.** A tela soma os itens sem arredondar cada um e converte o desconto percentual sem limite nem arredondamento. O banco arredonda item a item. O percentual original do desconto também se perde, porque a tela envia só o valor em reais.

## Solution

Levar para o servidor toda decisão sobre o ciclo de vida de um Agendamento feito pelo gestor ou pelo barbeiro, no mesmo padrão que o Canal do Cliente já usa, e fechar as lacunas do fechamento de Comanda.

- Cada mudança de estado de um Agendamento (criar, reagendar, cancelar, iniciar atendimento, marcar falta) vira uma RPC atômica. Ela confere papel, tenant, estado de origem, expediente, escala do profissional, conflito, Bloqueio de Horário e o limite de encaixe, no banco.
- Um novo **AgendaRepository** é a única porta da Agenda Geral e da Minha Agenda para essas operações.
- A Comanda passa a nascer só no banco, junto com o Item de Comanda do serviço agendado.
- O encaixe da Lista de Espera só consome a entrada quando o Agendamento é salvo, na mesma transação.
- O fechamento de Comanda usa o preço do catálogo, respeitando a Modalidade de Preço do Serviço, e recusa destinatário de gorjeta que não esteja nos itens.
- O total da Comanda é calculado por uma função única do módulo de Comandas, com a mesma regra de arredondamento da RPC.

Para o gestor, a Agenda funciona como hoje. A diferença é que erros que antes passavam em silêncio passam a aparecer como mensagem clara.

## User Stories

### Criação de Agendamento pelo gestor

1. Como gestor, quero criar um Agendamento manual na Agenda Geral, para registrar um cliente que ligou ou chegou no balcão.
2. Como gestor, quero que o sistema recuse um Agendamento fora do expediente da barbearia, para não marcar horário em que a casa está fechada.
3. Como gestor, quero que o sistema recuse um Agendamento num horário em que o profissional não atende, para respeitar a escala dele.
4. Como gestor, quero que o sistema recuse um Agendamento que conflita com outro Agendamento ativo do mesmo profissional, mesmo que a minha tela não tenha carregado esse outro Agendamento.
5. Como gestor, quero que o sistema recuse um Agendamento que cai num Bloqueio de Horário, para não marcar cliente na pausa ou folga do profissional.
6. Como gestor, quero escolher "Tanto faz" como profissional e deixar o sistema resolver quem atende, para agilizar o balcão.
7. Como gestor, quero que a duração do Agendamento siga a Associação Profissional-Serviço do profissional escolhido, para a grade refletir o tempo real de atendimento.
8. Como gestor, quero cadastrar um Cliente Provisório (nome e telefone) no mesmo passo do Agendamento, para não sair da Agenda.
9. Como gestor, quero uma mensagem clara quando o horário acabou de ser ocupado por outra pessoa, para escolher outro sem perder o que já preenchi.

### Encaixe

10. Como gestor, quero encaixar um cliente fora da grade normal, para atender quem chegou sem horário.
11. Como gestor, quero registrar um encaixe num horário já passado do dia, para lançar um atendimento que já aconteceu.
12. Como gestor, quero que o sistema recuse um Agendamento normal (não encaixe) num horário que já passou, para não criar marcação retroativa por engano.
13. Como gestor, quero que o sistema aceite no máximo um encaixe por profissional e horário, mesmo com duas recepções usando a Agenda ao mesmo tempo.
14. Como gestor, quero que o limite de encaixe valha também quando escolho "Tanto faz", conferindo o profissional que o sistema resolveu.

### Lista de Espera

15. Como gestor, quero encaixar um cliente da Lista de Espera com um clique, para aproveitar uma vaga que abriu.
16. Como gestor, quero que o cliente só saia da Lista de Espera quando o Agendamento dele for salvo, para não perder ninguém se eu fechar o modal.
17. Como gestor, quero que, se o Agendamento falhar, o cliente continue aguardando na Lista de Espera, para tentar outro horário.
18. Como gestor, quero que o Rodízio de Barbeiros continue sugerindo o profissional com menos atendimentos no dia, para balancear o balcão.

### Transições de estado

19. Como gestor, quero iniciar o atendimento de um Agendamento pendente ou confirmado, para indicar que o cliente está na cadeira.
20. Como gestor, quero que o sistema recuse iniciar o atendimento de um Agendamento cancelado, concluído ou com falta, mesmo que outra tela ainda o mostre como confirmado.
21. Como gestor, quero marcar falta (no-show) só depois do horário de início, para não punir um cliente que ainda pode chegar.
22. Como gestor, quero que a falta só possa ser marcada em Agendamento pendente ou confirmado, para não sobrescrever um atendimento que já começou.
23. Como gestor, quero que a Comanda aberta de um Agendamento com falta seja cancelada, como a tela de confirmação já promete.
24. Como gestor, quero cancelar um Agendamento informando o motivo, para a análise de cancelamentos dos Relatórios.
25. Como gestor, quero que o sistema recuse cancelar um Agendamento já concluído, para não apagar um atendimento cobrado.
26. Como gestor, quero que cancelar um Agendamento cancele a Comanda aberta dele, como já acontece hoje.
27. Como gestor, quero que cada mudança de estado gere o Evento de Agendamento correspondente, para as notificações por WhatsApp continuarem saindo.

### Reagendamento

28. Como gestor, quero reagendar um Agendamento para outro horário ou profissional pela Agenda Geral.
29. Como gestor, quero que o reagendamento passe pelas mesmas checagens da criação (expediente, escala, conflito, Bloqueio de Horário), para não criar sobreposição.
30. Como gestor, quero que o sistema recuse reagendar um Agendamento cancelado, concluído, em atendimento ou com falta.
31. Como gestor, quero reagendar pela tela de fechamento de Comanda com as mesmas regras da Agenda, para as duas telas nunca divergirem.
32. Como gestor, quero ver um erro quando a busca de horários livres falhar, em vez de uma grade inventada que pode não existir.

### Comanda gerada pelo Agendamento

33. Como gestor, quero que todo Agendamento tenha exatamente uma Comanda aberta, para nunca achar duas Comandas do mesmo atendimento.
34. Como gestor, quero que a Comanda já nasça com o Item de Comanda do serviço agendado, pelo preço do catálogo e com o profissional do Agendamento, para não precisar lançar à mão.
35. Como gestor, quero que iniciar o atendimento não crie uma segunda Comanda quando ela já existe.

### Minha Agenda (barbeiro)

36. Como barbeiro, quero iniciar o atendimento dos meus Agendamentos pela Minha Agenda, com as mesmas regras de estado da Agenda Geral.
37. Como barbeiro, quero que o sistema recuse iniciar atendimento de um Agendamento de outro profissional.
38. Como barbeiro, quero que a Comanda do meu atendimento seja a mesma que o gestor vê, sem duplicata criada pela minha tela.

### Fechamento de Comanda: preço

39. Como gestor, quero que o preço de um produto na Comanda seja sempre o do catálogo, para ninguém cobrar diferente do cadastrado.
40. Como gestor, quero que um serviço de preço fixo seja cobrado pelo valor do catálogo.
41. Como gestor, quero ajustar para cima o valor de um serviço com preço "a partir de", conforme a complexidade do trabalho, como a Modalidade de Preço do Serviço já prevê.
42. Como gestor, quero que o sistema recuse um serviço "a partir de" com valor abaixo do mínimo cadastrado.
43. Como gestor, quero dar abatimento só pelo desconto da Comanda, para que todo abatimento apareça como desconto nos Relatórios.

### Fechamento de Comanda: desconto e total

44. Como gestor, quero aplicar desconto em reais ou em percentual.
45. Como gestor, quero que o desconto percentual fique entre 0% e 100%.
46. Como gestor, quero que o total mostrado na tela seja exatamente o total gravado, centavo por centavo.
47. Como gestor, quero que o percentual do desconto fique registrado na Comanda, para saber depois o que foi combinado com o cliente.
48. Como gestor, quero que a divisão de pagamento some exatamente o total da Comanda, para o Caixa bater.

### Fechamento de Comanda: gorjeta

49. Como gestor, quero que a gorjeta vá automaticamente para o profissional quando só um profissional atendeu na Comanda.
50. Como gestor, quero ser obrigado a escolher o destinatário da gorjeta quando mais de um profissional atendeu, para o crédito não se perder.
51. Como gestor, quero que o sistema recuse um destinatário de gorjeta que não aparece nos itens da Comanda.
52. Como profissional, quero que só gorjeta de Comanda em que atendi entre na minha Conta do Profissional.
53. Como dono da barbearia, quero que nenhuma Comanda consiga creditar gorjeta a profissional de outra barbearia.

### Segurança e multi-tenant

54. Como dono da barbearia, quero que toda operação de Agendamento confira que o usuário pertence ao meu tenant, e não só a tela.
55. Como dono da barbearia, quero que um gerente sem tenant associado não consiga operar Agendamento nenhum.
56. Como proprietário do SaaS, quero continuar operando qualquer tenant, como já é hoje no financeiro.

### Qualidade e manutenção

57. Como desenvolvedor, quero uma única porta (AgendaRepository) para as operações de Agendamento do gestor e do barbeiro, para mudar uma regra num lugar só.
58. Como desenvolvedor, quero testar as regras de Agendamento com pgTAP no banco, para provar as guardas sem depender da tela.
59. Como desenvolvedor, quero testar o AgendaRepository contra um adaptador em memória, como já fazemos no Canal do Cliente.
60. Como desenvolvedor, quero uma função única de totais da Comanda, para a tela nunca recalcular o total por conta própria.

## Implementation Decisions

### Onde mora a regra

- Toda regra de Agendamento do gestor e do barbeiro mora em RPC no Postgres, `security definer`, com `search_path` vazio, no mesmo padrão das RPCs do Canal do Cliente e das migrations recentes.
- A tela não escreve mais na tabela de agendamentos. Leituras continuam como estão nesta spec (ver Out of Scope).
- O AgendaRepository é fino: valida entrada, traduz erro do banco em mensagem de domínio e repassa para a RPC. Não duplica expediente, escala nem conflito.

### RPCs de Agendamento

Cinco operações, uma RPC cada, todas atômicas:

- **criar Agendamento**: recebe tenant, cliente (ou dados de Cliente Provisório), serviço, profissional ou "Tanto faz", início e se é encaixe. Resolve o profissional, calcula a duração pela Associação Profissional-Serviço, valida e grava com estado `confirmed`, pagamento `pending` e origem `manual`. Opcionalmente recebe a entrada da Lista de Espera a consumir.
- **reagendar**: recebe Agendamento, novo início e novo profissional. Só a partir de `pending` ou `confirmed`. Recalcula o fim pela duração do novo profissional.
- **cancelar**: recebe Agendamento e motivo. Só a partir de `pending`, `confirmed` ou `in_progress`.
- **iniciar atendimento**: só a partir de `pending` ou `confirmed`. O barbeiro só inicia Agendamento dele.
- **marcar falta**: só a partir de `pending` ou `confirmed`, e só quando o início já passou pelo relógio do banco no fuso do tenant.

Transições permitidas (quem pode chamar em parênteses):

| De \ Para | in_progress | canceled | no_show | reagendado (mesmo estado) |
|---|---|---|---|---|
| pending | gerente, barbeiro dono | gerente | gerente | gerente |
| confirmed | gerente, barbeiro dono | gerente | gerente | gerente |
| in_progress | — | gerente | — | — |
| completed, canceled, no_show | — | — | — | — |

Checagens comuns a criar e reagendar, todas no banco:

- Papel e tenant do usuário, incluindo recusa do gerente com `tenant_id` nulo quando a RPC recebe `p_tenant_id`. O proprietário opera qualquer tenant.
- Dia aberto e dentro do expediente, escala do profissional e Bloqueio de Horário, reaproveitando a validação de expediente e escala que o banco já tem.
- Conflito com outro Agendamento ativo (`pending`, `confirmed`, `in_progress`) do mesmo profissional, dispensado só para encaixe.
- Horário passado só é aceito para encaixe.
- No máximo um encaixe por profissional e horário entre Agendamentos ativos, conferido sobre o profissional já resolvido e protegido contra corrida (restrição no banco ou trava por profissional dentro da transação).

Toda recusa usa código de erro próprio e mensagem em português, para o Repository traduzir sem interpretar texto.

### Comanda

- A Comanda do Agendamento nasce só no gatilho que já existe no banco. Ele passa a criar também o Item de Comanda do serviço, com preço do catálogo e o profissional do Agendamento.
- Os blocos que criam Comanda na Agenda Geral e na Minha Agenda são removidos. A criação avulsa do repositório de Comandas continua para venda de balcão.
- Unicidade de Comanda aberta por Agendamento garantida no banco.

### Lista de Espera

- Consumir a entrada da Lista de Espera (marcar como atendida) acontece dentro da RPC de criar Agendamento, na mesma transação. A tela deixa de marcar a entrada antes de salvar.
- A contagem de atendimentos do dia para o Rodízio de Barbeiros sai da tela e passa para o repositório da Lista de Espera.

### Fechamento de Comanda

- A RPC de liquidação passa a ler o preço do catálogo:
  - produto: preço do catálogo, sempre;
  - serviço `fixed`: preço do catálogo;
  - serviço `starting_at`: valor informado, recusado se abaixo do preço do catálogo.
- O destinatário da gorjeta precisa ser profissional do tenant e aparecer em pelo menos um Item de Comanda. Gorjeta maior que zero com dois ou mais profissionais nos itens exige destinatário. O gatilho de crédito na Conta do Profissional confere o tenant do profissional.
- A Comanda guarda o tipo e o percentual original do desconto, além do valor em reais.
- O cálculo de totais da Comanda vira uma função única do módulo de Comandas: subtotal com arredondamento por item, desconto em reais ou percentual (0 a 100, arredondado a centavo, com teto no subtotal), gorjeta e total. A tela de fechamento usa essa função e o cálculo de troco que o repositório já tem.
- O reagendamento pelo fechamento de Comanda usa o AgendaRepository. A grade fixa de fallback sai e a falha da busca de horários vira erro visível.
- O cancelamento de Comanda com Agendamento passa pelo repositório de Comandas, em vez de a tela chamar a RPC direto.
- A checagem de Sessão de Caixa aberta usa o repositório de Caixa que já existe.

### Módulos tocados

- **Novo AgendaRepository** (módulo de agenda): `criarAgendamento`, `reagendar`, `cancelar`, `iniciarAtendimento`, `marcarFalta`, com adaptador Supabase e adaptador em memória.
- **Repositório de Comandas**: função de totais estendida para desconto percentual; `cancelarComandaComAgendamento`.
- **Repositório da Lista de Espera**: sugestão do Rodízio recebe os atendimentos do dia em vez de uma contagem pronta.
- **Banco**: cinco RPCs novas, gatilho de Comanda estendido, liquidação e gatilho de gorjeta endurecidos, colunas de tipo e percentual de desconto.

### Ordem de entrega sugerida

1. Preço do catálogo e destinatário da gorjeta no fechamento (lacunas de segurança, pequenas, independentes).
2. Função única de totais e desconto percentual registrado.
3. RPCs de transição de estado (iniciar, cancelar, falta) e AgendaRepository, usados pela Agenda Geral e pela Minha Agenda.
4. Comanda só pelo gatilho, com Item de Comanda do serviço; remoção dos blocos duplicados.
5. RPC de criar Agendamento com encaixe e Lista de Espera.
6. RPC de reagendar, usada pela Agenda Geral e pelo fechamento de Comanda.

## Testing Decisions

- Um bom teste verifica comportamento visível pela porta pública (RPC ou Repository), não detalhe interno: dado um estado de banco, a chamada é aceita ou recusada com o código certo, e o estado final é o esperado.
- **Seam principal: RPCs no Postgres, com pgTAP.** Cada regra de negócio desta spec tem pelo menos um teste pgTAP, rodado pelo MCP do Supabase dentro de `begin; ... rollback;`, em arquivos novos numerados a partir do maior prefixo existente. Cobrir:
  - cada transição permitida e cada transição proibida da tabela de estados;
  - falta antes do horário de início;
  - conflito, Bloqueio de Horário, expediente e escala na criação e no reagendamento;
  - segundo encaixe no mesmo profissional e horário, inclusive com "Tanto faz";
  - Lista de Espera intacta quando a criação falha, consumida quando dá certo;
  - exatamente uma Comanda aberta por Agendamento, com o Item de Comanda do serviço;
  - preço de produto e serviço `fixed` vindo do catálogo; serviço `starting_at` abaixo do mínimo recusado;
  - gorjeta para profissional fora dos itens e de outro tenant recusada;
  - acesso: gerente de outro tenant, gerente com `tenant_id` nulo, barbeiro em Agendamento alheio, todos recusados; proprietário aceito.
- **Seam secundária: AgendaRepository, com Vitest contra o adaptador em memória.** Testa validação de entrada e tradução de erro de domínio. Não replica as regras do banco.
- **Função de totais da Comanda, com Vitest.** Casos de arredondamento por item, desconto percentual quebrado, teto no subtotal, total zero (cortesia).
- Prior art: os testes pgTAP da spec 037 e 038 em `supabase/tests/database/`; o repositório do Canal do Cliente com seu adaptador em memória; os testes existentes do repositório de Comandas.

## Out of Scope

- Leituras da Agenda (profissionais, serviços, clientes, agendamentos do período) e o realtime. Continuam como estão; podem virar outra spec.
- Quebrar a Agenda Geral em componentes menores ou mexer em layout.
- O cálculo de horários livres, que já mora na biblioteca de grade e continua lá.
- Bloqueio de Horário (criar, remover) e a checagem de conflito do modal de bloqueio.
- Mudanças no Canal do Cliente, que já opera por RPC.
- Regra de comissão, que já mora no banco.
- Painel administrativo, Serviços e painel financeiro, que também chamam o Supabase direto.
- A correção do bypass de `tenant_id` nulo nas 18 RPCs do financeiro, já escrita e pendente de aplicação.

## Further Notes

- A decisão de preço do Item de Comanda vir do catálogo foi tomada nesta spec. O ajuste permitido é só o da Modalidade de Preço do Serviço `starting_at`, para cima. Todo abatimento passa a ser desconto.
- O texto de confirmação de falta na Agenda promete cancelar a Comanda. Hoje não foi encontrado código que faça isso; o ticket de falta precisa confirmar lendo o gatilho de proteção de falta antes de implementar.
- AgendaRepository é termo novo: entra no glossário ao lado de ClienteRepository e CanalClienteRepository.
- Levar o ciclo de vida do Agendamento do gestor para RPC é decisão arquitetural. Registrar em ADR, no padrão das ADRs 018 a 022.
- Dados legados: Comandas abertas duplicadas para o mesmo Agendamento, se existirem, precisam ser levantadas antes de criar a restrição de unicidade. Verificar no dev e no prod antes da migration.
