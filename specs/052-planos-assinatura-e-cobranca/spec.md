# Especificação Técnica: Planos, assinatura e cobrança recorrente

## Problem Statement

O Navalhado ainda não cobra de ninguém, e os planos que existem não valem na prática.

**1. Os planos não seguram nada.** O catálogo atual tem Bronze (R$ 99, 3 profissionais), Prata (R$ 199, 6) e Ouro (R$ 349, 15). O limite de profissionais só existe na tela do onboarding. Depois do onboarding, o Gerente cadastra quantos profissionais quiser em Profissionais, e uma chamada direta ao banco também passa, porque nenhum gatilho ou regra do banco lê o limite do plano. A coluna de recursos do plano (`features`, com "financeiro", "suporte prioritário" etc.) não é lida por ninguém. Os preços e os limites também não conversam com o mercado: o autônomo que trabalha sozinho não tem plano para ele.

**2. A assinatura não vence.** O cadastro cria a assinatura do tenant como ativa, com vencimento em um mês, e nada confere esse vencimento. Em prod, as duas barbearias (Barbearia Brooklyn e Barber Tester) estão com o vencimento passado desde agosto e continuam com acesso total.

**3. O Gerente não tem como assinar nem pagar.** Não existe integração com meio de pagamento, tela de assinatura, forma de trocar cartão, mudar de plano ou cancelar.

**4. O Proprietário não tem ferramenta.** Estender o teste do beta tester, dar cortesia a um parceiro ou liberar alguém bloqueado por engano hoje exige SQL direto no banco.

**5. Barbearia que sai continua ocupando o WhatsApp.** A Instância WhatsApp de um tenant que deixou de usar o sistema continua existindo no servidor Uazapi, que tem vagas contadas.

**6. Os termos não cobrem cobrança.** O Navalhado tem só um texto genérico de Termos de Uso e de Política de Privacidade, aberto por link no login e no cadastro. Não há nada sobre assinatura, renovação, cancelamento ou suspensão por falta de pagamento, e o aceite não é registrado.

## Solution

O Navalhado passa a ter três planos mensais que diferem só pela quantidade de profissionais, um teste grátis de 15 dias e cobrança recorrente no cartão pelo Mercado Pago.

**Planos.** Todos os planos têm todos os recursos.

| Plano | Profissionais ativos | Preço mensal | Substitui |
|---|---|---|---|
| Tesoura | 1 | R$ 59,90 | Bronze |
| Máquina | 5 | R$ 89,90 | Prata |
| Bancada | 10 | R$ 159,90 | Ouro |

O limite passa a valer no banco. Conta profissional ativo (não excluído). O Gerente só entra na conta quando ele próprio está cadastrado como profissional.

**Teste grátis.** Toda barbearia nova começa com 15 dias de teste no plano escolhido no cadastro, com WhatsApp liberado e sem pedir cartão. As barbearias que já existem ganham 15 dias de teste a partir do lançamento.

**Assinar.** O Gerente clica em "Assinar" quando quiser, e só então a assinatura é criada no Mercado Pago. Ele paga na página do próprio Mercado Pago, com cartão de crédito, cartão de débito ou saldo da conta Mercado Pago. Se assinar durante o teste, a primeira cobrança só acontece no fim do teste, e o Mercado Pago mostra os dias restantes como "dias grátis". Se assinar depois do bloqueio, a cobrança é imediata e o acesso volta quando o pagamento é aprovado.

**Tela Assinatura.** Em Configurações, o Gerente vê o plano, a situação, a próxima cobrança e o histórico de cobranças. Ali ele troca o cartão, muda de plano e cancela.

- **Trocar cartão:** o cartão é digitado nos campos seguros do Mercado Pago. O número do cartão nunca passa pelo Navalhado.
- **Subir de plano:** o limite sobe na hora e a diferença proporcional aos dias que faltam no ciclo é cobrada na hora, no cartão digitado nos campos seguros. A partir da próxima cobrança vale o preço cheio do plano novo.
- **Descer de plano:** vale na próxima cobrança, sem reembolso, e só se os profissionais ativos couberem no plano menor.
- **Cancelar:** a cobrança recorrente para na hora e o acesso continua até o fim do período já pago.

**Cartão recusado.** O Gerente é avisado por e-mail e por uma faixa no painel no dia da recusa, no terceiro dia e no quarto dia. No quinto dia sem pagamento aprovado, o acesso é bloqueado.

**Bloqueio.** Quando o teste acaba sem assinatura, o período pago de uma assinatura cancelada termina ou o quinto dia de recusa chega, a barbearia fica bloqueada: o painel do Gerente e do Barbeiro mostra só a tela de bloqueio, o Canal do Cliente não aceita agendamento e nenhum WhatsApp da barbearia é enviado. A tela de bloqueio deixa pagar e exportar os dados da barbearia. Os dados ficam guardados sem prazo: quem volta encontra tudo como deixou.

**WhatsApp.** No bloqueio, a sessão do WhatsApp fica como está e os envios param. Se a barbearia pagar em até 7 dias, o WhatsApp volta sem ler QR code de novo. No sétimo dia de bloqueio, a Instância WhatsApp é excluída do servidor e a vaga é liberada. Quem volta depois disso conecta o WhatsApp de novo, como no primeiro uso.

**Proprietário.** Em Admin > Tenants, o Proprietário vê os detalhes da assinatura de cada barbearia, estende o teste, dá cortesia (sem cobrança e sem bloqueio, com data de fim opcional) e desbloqueia manualmente.

**Termos.** Os Termos de Uso e a Política de Privacidade ganham as cláusulas de assinatura, e o aceite passa a ser registrado com versão e data. Quem se cadastra aceita no cadastro. O Gerente que já existe aceita no primeiro acesso depois do lançamento.

## User Stories

1. As a Gerente autônomo, I want um plano para um único profissional, so that eu pague só pelo que uso.
2. As a Gerente, I want que todos os planos tenham todos os recursos, so that eu escolha só pelo tamanho da minha equipe.
3. As a Gerente, I want ver o preço e o limite de cada plano no cadastro, so that eu escolha antes de começar.
4. As a Gerente, I want que o catálogo de planos da tela de cadastro seja o mesmo do banco, so that o que eu vejo é o que eu contrato.
5. As a Gerente, I want começar com 15 dias grátis sem informar cartão, so that eu teste sem compromisso.
6. As a Gerente em teste, I want usar o WhatsApp durante o teste, so that eu veja o recurso que mais faz diferença.
7. As a Gerente em teste, I want ver quantos dias faltam no teste, so that eu não seja pego de surpresa.
8. As a Gerente em teste, I want um aviso 3 dias antes do fim do teste, pela faixa no painel e por e-mail, so that eu assine a tempo.
9. As a Gerente em teste, I want assinar antes do fim do teste sem perder os dias que faltam, so that eu resolva isso já sem pagar antes da hora.
10. As a Gerente, I want pagar na página do próprio Mercado Pago, so that eu confie no pagamento.
11. As a Gerente sem conta no Mercado Pago, I want pagar só com o cartão, so that eu não precise criar outra conta.
12. As a Gerente com conta no Mercado Pago, I want pagar com saldo ou com um cartão já salvo lá, so that eu pague mais rápido.
13. As a Gerente, I want usar cartão de débito, so that eu assine mesmo sem cartão de crédito.
14. As a Gerente, I want que a mensalidade seja cobrada sozinha todo mês, so that eu não precise lembrar de pagar.
15. As a Gerente, I want ver na tela Assinatura o plano, a situação e a data da próxima cobrança, so that eu saiba em que pé está.
16. As a Gerente, I want ver o histórico das cobranças, com valor, data e situação, so that eu confira o que paguei.
17. As a Gerente, I want ver o final do cartão cadastrado, so that eu saiba qual cartão está sendo cobrado.
18. As a Gerente, I want trocar o cartão sem cancelar a assinatura, so that a cobrança continue no cartão novo.
19. As a Gerente, I want digitar o cartão em campos seguros do Mercado Pago, so that o número do meu cartão não fique com o Navalhado.
20. As a Gerente que contratou um barbeiro, I want subir de plano e cadastrar o barbeiro na hora, so that eu não espere a próxima fatura.
21. As a Gerente que sobe de plano, I want pagar só a diferença proporcional aos dias que faltam no ciclo, so that eu não pague duas vezes pelo mesmo período.
22. As a Gerente que sobe de plano, I want ver o valor da diferença e o novo valor mensal antes de confirmar, so that eu decida sabendo quanto vou pagar.
23. As a Gerente cuja cobrança da diferença foi recusada, I want continuar no plano atual, so that eu não fique com um plano que não paguei.
24. As a Gerente em teste, I want mudar de plano sem cobrança, so that eu teste o plano certo.
25. As a Gerente, I want descer de plano, so that eu pague menos quando a equipe diminuir.
26. As a Gerente que desce de plano, I want que a mudança valha na próxima cobrança, so that eu use o que já paguei.
27. As a Gerente com mais profissionais ativos do que o plano menor permite, I want ser avisado de que preciso desativar profissionais antes de descer, so that eu não perca ninguém sem querer.
28. As a Gerente com uma descida de plano agendada, I want que o limite do plano menor já valha para novos cadastros, so that eu não chegue à próxima cobrança acima do limite.
29. As a Gerente, I want ver quantas vagas de profissional ainda tenho, na tela de Profissionais e no onboarding, so that eu saiba quando preciso subir de plano.
30. As a Gerente no limite do plano, I want uma mensagem clara ao tentar cadastrar ou reativar um profissional, so that eu entenda que preciso subir de plano.
31. As a Gerente que também atende, I want contar como profissional só se eu estiver cadastrado como profissional, so that o plano Tesoura sirva para mim quando eu trabalho sozinho.
32. As a Gerente, I want cancelar a assinatura pela tela, so that eu não precise falar com ninguém.
33. As a Gerente que cancelou, I want usar o sistema até o fim do período já pago, so that eu não perca o que paguei.
34. As a Gerente que cancelou, I want não ser cobrado de novo, so that o cancelamento tenha efeito de verdade.
35. As a Gerente que cancelou, I want assinar de novo quando quiser, so that eu volte sem refazer o cadastro.
36. As a Gerente com cartão recusado, I want ser avisado por e-mail e pela faixa no painel no dia da recusa, so that eu troque o cartão logo.
37. As a Gerente com cartão recusado, I want lembretes no terceiro e no quarto dia, so that eu tenha tempo de resolver antes do bloqueio.
38. As a Gerente com cartão recusado, I want saber a data exata do bloqueio, so that eu me organize.
39. As a Gerente que trocou o cartão depois de uma recusa, I want que a cobrança pendente seja tentada no cartão novo, so that o problema se resolva sem esperar um mês.
40. As a Gerente bloqueado, I want uma tela que explique o motivo do bloqueio e como voltar, so that eu não fique perdido.
41. As a Gerente bloqueado, I want pagar pela própria tela de bloqueio, so that o acesso volte na hora.
42. As a Gerente bloqueado, I want exportar os dados da minha barbearia, so that os meus dados nunca fiquem presos ao Navalhado.
43. As a Gerente que volta depois de um bloqueio, I want encontrar clientes, agenda e financeiro como deixei, so that eu continue de onde parei.
44. As a Gerente que paga em até 7 dias de bloqueio, I want o WhatsApp funcionando sem ler QR code de novo, so that a volta seja imediata.
45. As a Gerente que volta depois de 7 dias de bloqueio, I want conectar o WhatsApp de novo pelo fluxo normal, so that o recurso volte a funcionar.
46. As a Barbeiro de uma barbearia bloqueada, I want ver uma tela dizendo que o acesso da barbearia está suspenso, so that eu saiba que não é problema no meu login.
47. As a Cliente de uma barbearia bloqueada, I want ver que o agendamento online está indisponível, so that eu procure a barbearia por outro meio.
48. As a Cliente de uma barbearia bloqueada, I want não receber lembretes de WhatsApp de uma barbearia que não está operando pelo sistema, so that eu não receba informação desatualizada.
49. As a Gerente, I want aceitar os Termos de Uso e a Política de Privacidade no cadastro, so that eu saiba as regras de cobrança, cancelamento e suspensão.
50. As a Gerente que já usa o Navalhado, I want aceitar os termos novos no primeiro acesso depois do lançamento, so that eu siga usando sabendo das regras.
51. As a Gerente de uma barbearia que já existia antes do lançamento, I want ganhar 15 dias de teste a partir do lançamento, so that eu não seja bloqueado de surpresa.
52. As a Proprietário, I want ver de cada barbearia o plano, a situação, o fim do teste, a próxima cobrança, os profissionais ativos e os identificadores no Mercado Pago, so that eu atenda o suporte sem abrir o banco.
53. As a Proprietário, I want estender o teste de uma barbearia até uma data, so that eu dê mais tempo a um beta tester ou a uma negociação.
54. As a Proprietário, I want marcar uma barbearia como cortesia, com data de fim opcional, so that parceiros usem sem cobrança e sem bloqueio.
55. As a Proprietário, I want desbloquear manualmente uma barbearia até uma data, informando o motivo, so that eu corrija um bloqueio indevido enquanto o pagamento é esclarecido.
56. As a Proprietário, I want que só eu consiga usar essas ferramentas, so that nenhum Gerente altere a própria assinatura por fora.
57. As a Proprietário, I want que a vaga do WhatsApp de quem saiu seja liberada sozinha, so that o servidor Uazapi não lote com barbearias inativas.
58. As a Proprietário, I want que a cobrança fique registrada a partir dos avisos do Mercado Pago, so that a situação de cada barbearia não dependa de alguém abrir a tela.
59. As a Desenvolvedor, I want o limite de profissionais no banco, so that nenhuma tela ou chamada direta passe do limite.
60. As a Desenvolvedor, I want uma única regra no banco que diga se a barbearia está liberada, em aviso ou bloqueada, so that painel, Canal do Cliente e WhatsApp decidam igual.
61. As a Desenvolvedor, I want o Mercado Pago atrás de uma interface trocável, so that os testes não dependam da rede e o Asaas possa entrar no lugar se preciso.
62. As a Desenvolvedor, I want que o webhook confira a assinatura secreta e ignore evento repetido, so that ninguém forje pagamento e nenhum evento conte duas vezes.
63. As a Desenvolvedor, I want que o webhook busque o pagamento ou a assinatura no Mercado Pago em vez de confiar no corpo do aviso, so that só dado confirmado mude a situação.
64. As a Desenvolvedor, I want que o token do Mercado Pago fique só em secret do Supabase, so that ele nunca chegue ao navegador.
65. As a Desenvolvedor, I want que a rotina diária do dev nunca exclua instância de prod, so that o servidor Uazapi compartilhado não sofra com erro no dev.

## Implementation Decisions

### Catálogo de planos

- Os três planos atuais são renomeados mantendo os UUIDs: Bronze vira Tesoura (1 profissional, R$ 59,90), Prata vira Máquina (5, R$ 89,90) e Ouro vira Bancada (10, R$ 159,90). As assinaturas existentes continuam apontando para o mesmo plano.
- A coluna de recursos do plano (`features`) sai, depois de conferir que nenhuma função, view ou tela a lê.
- A tela de cadastro deixa de ter os planos fixos no código e lê o catálogo do banco. O plano pré-selecionado é o do meio da lista ordenada por preço (hoje o Máquina), que ocupa o lugar do antigo padrão Prata. A escolha é pela posição, e não pelo nome, para que renomear um plano não mude o padrão.
- O cadastro passa a ligar o plano escolhido pelo identificador do plano, e não mais pelo nome em minúsculas. Renomear planos deixa de quebrar o cadastro.
- Em prod, os dois tenants atuais são Ouro, viram Bancada e têm 1 profissional ativo cada. Nenhum passa do limite novo.

### Limite de profissionais

- Um gatilho em `professionals` recusa a inclusão de profissional ativo e a reativação de profissional excluído quando o número de profissionais ativos do tenant já é igual ao limite. Profissional ativo é o que não tem `deleted_at`.
- O Gerente conta no limite só quando existe um profissional ativo vinculado a ele. Isso sai naturalmente da contagem de profissionais, sem regra especial.
- O limite vem do plano da assinatura do tenant. Com uma descida de plano agendada, vale o limite do plano menor para novos cadastros.
- A recusa usa uma mensagem de erro própria. O onboarding e a tela de Profissionais mostram a cota ("3 de 5") e traduzem esse erro para uma mensagem amigável com o convite para subir de plano.

### Assinatura do tenant

- Continua uma linha de `tenant_subscriptions` por tenant, agora com unicidade por tenant.
- A situação (`status`) passa a ter os valores: em teste, ativa, pagamento recusado, bloqueada, cancelada e cortesia. Os valores antigos são convertidos na migração.
- Campos novos:
  - fim do teste
  - início e fim do período pago atual
  - data da primeira recusa
  - data do bloqueio
  - data do cancelamento
  - fim da cortesia (opcional)
  - plano agendado para a próxima cobrança
  - identificador da assinatura no Mercado Pago
  - bandeira e final do cartão, só para exibição
- Os campos antigos de início, fim e ciclo são absorvidos por esses. O ciclo é sempre mensal.
- Só o Gerente lê a assinatura do próprio tenant, porque a linha guarda bandeira e final do cartão e o id da assinatura no Mercado Pago. O Barbeiro não lê a tabela e recebe só o Estado de Acesso pela RPC do porteiro. Nenhum dos dois escreve nela. Toda mudança vem da Edge Function de cobrança, do webhook, da rotina diária ou das funções do Proprietário.

### Estado de Acesso

- Uma função do banco calcula o Estado de Acesso do tenant a partir da assinatura e da data de hoje. O resultado é um de três:
  - **liberado**
  - **liberado com aviso**: teste nos últimos 3 dias ou pagamento recusado
  - **bloqueado**

  Junto vem o motivo e a data relevante (fim do teste, data do bloqueio ou fim do período pago).
- Regras:
  - teste: liberado até o fim do teste, com aviso nos últimos 3 dias
  - ativa: liberada
  - pagamento recusado: liberado com aviso até o quinto dia desde a primeira recusa; bloqueado a partir daí
  - cancelada: liberada até o fim do período pago; bloqueada depois
  - cortesia: liberada até o fim da cortesia, ou sempre se não houver fim; depois do fim, segue a regra do teste vencido
  - bloqueada: bloqueada
- A rotina diária grava as transições que dependem só do tempo (teste vencido, quinto dia de recusa, fim do período de cancelada, fim da cortesia), para que a data do bloqueio fique registrada e a contagem dos 7 dias do WhatsApp tenha início. A função de estado também vale entre duas execuções da rotina, então o bloqueio não espera a rotina rodar.

### Onde o bloqueio vale

- **Painel do Gerente e do Barbeiro:**
  - Um porteiro nos layouts do Gerente e do Barbeiro, ao lado do que hoje manda o Gerente para o onboarding, lê o Estado de Acesso.
  - Bloqueado: mostra só a tela de bloqueio. Para o Gerente, a tela tem "Pagar" e "Exportar dados". Para o Barbeiro, só a explicação.
  - Com aviso: mostra a faixa no topo.
  - O painel não ganha regra de acesso nova no banco por causa da assinatura. O bloqueio do painel é no front, e o Gerente bloqueado continua conseguindo ler os próprios dados para exportar.
- **Canal do Cliente:** a sessão do cliente e as funções de agendamento do cliente consultam o Estado de Acesso no servidor. Com a barbearia bloqueada, o cliente vê "agendamento online indisponível" e não consegue criar nem reagendar. Cancelar continua permitido, para o cliente liberar o horário.
- **WhatsApp:** todo envio do tenant consulta o Estado de Acesso e não envia se estiver bloqueado. Isso vale para Evento de Agendamento, lembrete, lembrete de retorno e boas-vindas. O envio que não saiu é descartado, com o motivo registrado, e não fica numa fila para depois.

### Mercado Pago

- A conta recebedora é a conta Mercado Pago de pessoa física do Proprietário. O app de prod é o "Navalhado". O recebimento de cartão fica em 30 dias, que é configuração da conta e não código.
- Formas aceitas na assinatura: cartão de crédito, cartão de débito e saldo Mercado Pago. Pix e boleto não existem em assinatura no Mercado Pago (a API responde que só aceita `account_money`, `credit_card` e `debit_card`).
- **Assinar:**
  - A Edge Function de cobrança cria a assinatura (`preapproval`) pendente, com o e-mail do Gerente, o valor do plano, ciclo mensal e referência externa igual ao id do tenant.
  - Durante o teste, o início da cobrança é o fim do teste. Bloqueado, o início é imediato.
  - A função devolve o link de pagamento do Mercado Pago, e o Gerente conclui lá.
- **Primeira cobrança aprovada:** a assinatura vira ativa e o período pago é preenchido.
- **Trocar cartão:**
  - O front carrega os campos seguros do Mercado Pago com a Public Key, gera o token do cartão no navegador e manda só o token para a Edge Function.
  - A função atualiza o cartão da assinatura, e a troca não cobra nada na hora.
  - Se a assinatura estava com pagamento recusado, a cobrança pendente passa a ser tentada no cartão novo.
- **Subir de plano:**
  - Só em assinatura ativa. Durante o teste, a troca de plano é livre, sem cobrança, e atualiza o valor da assinatura no Mercado Pago se ela já existir.
  - A Edge Function calcula no servidor a diferença proporcional: (preço novo − preço atual) × dias que faltam no período pago ÷ dias do período, arredondada em centavos.
  - O Gerente digita o cartão nos campos seguros. O cartão salvo na assinatura não pode ser reaproveitado pelo vendedor para outra cobrança; isso foi conferido no teste.
  - A função cobra a diferença num pagamento avulso, com chave de idempotência e referência ao tenant e ao upgrade.
  - Só com o pagamento aprovado a função troca o plano (e o limite sobe na hora) e atualiza o valor da assinatura para a próxima cobrança. Recusado, nada muda.
  - Se a diferença ficar abaixo do mínimo aceito pelo Mercado Pago, o plano troca sem cobrança avulsa.
- **Descer de plano:**
  - Só se os profissionais ativos couberem no plano menor.
  - A função grava o plano agendado e atualiza o valor da assinatura para a próxima cobrança.
  - O plano troca quando a próxima cobrança é aprovada. Não há reembolso.
- **Cancelar:** a função cancela a assinatura no Mercado Pago na hora e grava a data do cancelamento. O acesso vai até o fim do período pago.
- **Assinar de novo** depois de cancelar ou de ser bloqueado cria uma assinatura nova no Mercado Pago. A antiga fica cancelada.
- **Ações da Edge Function de cobrança:** assinar, trocar cartão, subir de plano, descer de plano e cancelar. Todas exigem o Gerente do próprio tenant e recusam o Gerente sem tenant.
- **Provedor trocável:** o acesso ao Mercado Pago fica atrás de uma interface, no mesmo padrão do provedor de WhatsApp. Ela cobre criar assinatura, trocar cartão, mudar valor, cancelar, cobrar avulso, buscar pagamento e buscar assinatura. Os testes usam uma versão falsa. Um provedor Asaas pode entrar no lugar sem mexer no resto.

### Webhook

- A Edge Function do webhook é pública.
- Ela confere a assinatura secreta do aviso com o segredo gerado no painel do Mercado Pago, guardado em secret do Supabase. Aviso sem assinatura válida é recusado.
- Tópicos tratados: pagamento, assinatura e pagamento de assinatura.
- Para cada aviso, a função busca o recurso no Mercado Pago e decide pelo que o Mercado Pago responde, nunca pelo corpo do aviso.
- Cada aviso é gravado numa tabela de eventos com chave única pelo id do aviso. Aviso repetido é ignorado.
- A função responde rápido e deixa o processamento pesado fora do tempo de resposta.
- Tradução de eventos:
  - **pagamento aprovado da assinatura:** ativa, período pago avançado, data da primeira recusa limpa, plano agendado aplicado
  - **pagamento recusado:** pagamento recusado, com a data da primeira recusa se ainda não houver
  - **assinatura cancelada fora do Navalhado** (pelo próprio Gerente no Mercado Pago): cancelada
  - **estorno ou contestação:** bloqueada na hora
- Cada cobrança (mensal ou avulsa de upgrade) vira uma linha no histórico de cobranças do tenant, com valor, data, situação, tipo e final do cartão. É esse histórico que a tela Assinatura mostra, sem consultar o Mercado Pago a cada abertura.

### Avisos ao Gerente

- **Faixa no painel:**
  - teste nos últimos 3 dias
  - pagamento recusado, com a data do bloqueio
  - cancelada, com a data do fim do acesso
- **E-mail pelo Resend,** no mesmo padrão dos e-mails de autenticação com React Email:
  - 3 dias antes do fim do teste
  - dia da recusa, terceiro dia e quarto dia ("amanhã o acesso será bloqueado")
  - bloqueio efetivado
- A rotina diária dispara os e-mails de prazo. O webhook dispara o e-mail da recusa.
- Cada e-mail enviado é registrado por tenant e tipo, para não repetir no mesmo dia.

### WhatsApp no bloqueio

- O bloqueio não mexe na sessão da Instância WhatsApp: os envios param pelo Estado de Acesso (ver acima). O estado `hibernated` do glossário continua sendo só o estado informado pelo provedor, sem uso novo.
- A Edge Function do WhatsApp ganha a ação de excluir a instância, chamada pela rotina diária com o segredo interno que as rotinas já usam. A ação exclui no provedor e remove a instância local. A exclusão na Uazapi hoje só acontece para desfazer uma criação que falhou.
- A rotina diária chama a exclusão para o tenant que completou 7 dias bloqueado.
- **Proteção do dev:** o dev usa uma instância no mesmo servidor Uazapi de prod. A exclusão só age sobre instâncias cujo nome identifica o ambiente da rotina que está rodando. Se o nome das instâncias ainda não identifica o ambiente, esta spec passa a exigir isso nas instâncias novas e marca as existentes.

### Exportação de dados

- A tela de bloqueio e a tela Assinatura oferecem "Exportar dados".
- O arquivo reúne, em CSV, os clientes, os agendamentos e as comandas do tenant, lidos com as permissões do próprio Gerente.

### Proprietário

- Funções do banco para o Proprietário:
  - estender o teste até uma data
  - marcar e desmarcar cortesia, com data de fim opcional
  - desbloquear até uma data, com o motivo registrado
  - ler os detalhes da assinatura: plano, situação, datas, profissionais ativos, ids do Mercado Pago e histórico de cobranças
- As funções exigem o papel de Proprietário. Recusam Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo.
- A tela Admin > Tenants ganha a coluna de situação e uma visão de detalhe com essas ações.
- Desbloquear e dar cortesia não criam nem alteram nada no Mercado Pago.

### Tenants existentes no lançamento

- A migração coloca as assinaturas ativas e com pagamento recusado na situação "em teste", com fim do teste em 15 dias a partir da data em que a migração roda em cada ambiente. As suspensas continuam bloqueadas e as canceladas continuam canceladas, para não reabrir quem o Proprietário tirou do ar.
- O plano de cada um é mantido pelo UUID.

### Termos e privacidade

- Os Termos de Uso ganham cláusulas de:
  - preço e renovação mensal automática
  - teste de 15 dias
  - cancelamento com acesso até o fim do período pago
  - subida de plano com cobrança proporcional
  - descida sem reembolso
  - suspensão no quinto dia de pagamento recusado, com os avisos prévios
  - guarda dos dados sem prazo, com exportação
  - exclusão da Instância WhatsApp no sétimo dia de bloqueio
- A Política de Privacidade passa a dizer que os dados ficam guardados sem prazo depois do cancelamento, com exportação pela tela e exclusão a pedido pelo suporte.
- O aceite é registrado por usuário, com a versão dos termos e a data.
- O cadastro exige marcar o aceite. O Gerente que ainda não aceitou a versão atual vê o aceite antes de entrar no painel.
- O texto é escrito como rascunho técnico nesta spec e revisado por advogado antes do lançamento em prod.

### Ambientes e credenciais

- Tudo vai primeiro para o dev (`selvxobcjbkligxighlp`). Prod (`boakqstrdfqmsrwnjore`) só numa promoção pedida à parte.
- **Dev:**
  - A assinatura usa o Access Token de produção da conta de teste vendedora. O token de teste da conta real responde 400 na criação de assinatura.
  - A cobrança avulsa do upgrade usa o Access Token de teste do app Navalhado. O token da conta de teste vendedora responde 401 na API de pagamentos.
  - O e-mail do pagador na cobrança avulsa não pode ser de conta de teste.
  - A Edge Function aceita um token separado para a cobrança avulsa e, se ele não estiver configurado, usa o mesmo da assinatura.
  - O front recebe a Public Key correspondente a cada uso.
- **Prod:** um único Access Token e uma única Public Key do app Navalhado, depois de ativar as credenciais de produção no painel.
- **Webhook:** configurado no app da conta de teste vendedora apontando para o dev, e no app Navalhado apontando para prod.
- Todos os tokens e o segredo do webhook ficam em secret do Supabase.

## Testing Decisions

- **Bom teste aqui** olha o comportamento de fora: quem consegue cadastrar profissional, em que estado a barbearia fica, o que a Edge Function manda ao provedor e o que grava, o que a tela mostra. Não olha como o gatilho, a função ou o componente fazem por dentro.
- **Banco (pgTAP no dev, dentro de `begin; ... rollback;`).** Barbearia de teste sem Instância WhatsApp e sem cliente, para nada sair pelo WhatsApp. Numeração seguindo a maior existente (hoje 62). Os testes cobrem:
  - **Limite:**
    - cadastra até o limite e recusa o seguinte
    - reativar profissional excluído conta e é recusado no limite
    - o Gerente vinculado como profissional conta; sem vínculo, não conta
    - com descida agendada, vale o limite menor
  - **Estado de Acesso** em cada situação e em cada borda de data: último dia do teste, os 3 dias de aviso, dia 4 e dia 5 da recusa, fim do período da cancelada, cortesia com e sem fim.
  - **Rotina diária:**
    - grava as transições de tempo
    - escolhe para exclusão só o tenant com 7 dias de bloqueio
    - não escolhe instância de outro ambiente
  - **Funções do Proprietário:**
    - funcionam para o Proprietário
    - recusam Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo
  - **Canal do Cliente:** com a barbearia bloqueada, criar e reagendar são recusados e cancelar continua permitido.
  - **Leitura da assinatura:** o Gerente lê só a do próprio tenant, o Barbeiro não lê a tabela (recebe só o Estado de Acesso pela RPC) e nenhum dos dois consegue alterá-la.

  Precedentes: pgTAP 62 (notificação só para barbeiro com login) e os testes de guarda de acesso com Gerente sem tenant.
- **Edge Function de cobrança e webhook (testes Deno, com o provedor do Mercado Pago falso).** Os testes conferem:
  - assinar durante o teste manda início no fim do teste; bloqueado manda início imediato
  - trocar cartão manda só o token
  - subir de plano calcula a diferença proporcional, cobra avulso com chave de idempotência e só troca plano e valor se a cobrança for aprovada
  - descer de plano recusa acima do limite e agenda o plano
  - cancelar cancela no provedor e mantém o acesso até o fim do período
  - toda ação recusa quem não é Gerente do tenant
  - o webhook recusa assinatura secreta inválida, ignora aviso repetido, busca o recurso no provedor e aplica a tradução de eventos
  - estorno ou contestação bloqueia

  Precedente: os testes atuais da Edge Function do WhatsApp, que já usam provedor falso.
- **Módulo de assinatura no front (Vitest, com adaptador em memória).** Os testes conferem:
  - a tela Assinatura mostra plano, situação, próxima cobrança, histórico e final do cartão
  - o fluxo de subir de plano mostra a diferença e o novo valor antes de confirmar
  - descer de plano acima do limite mostra o aviso
  - o porteiro dos layouts mostra a tela de bloqueio (com "Pagar" e "Exportar dados" só para o Gerente) e a faixa de aviso
  - o cadastro exige o aceite dos termos e lê o catálogo de planos
  - a tela de Profissionais e o onboarding mostram a cota e traduzem o erro de limite

  Precedentes: os testes do layout do Gerente (que já cobrem o redirecionamento para o onboarding), do wizard de onboarding e os testes de módulo com adaptador em memória.
- **Migrações de dados** (renomear planos, converter situações, dar teste aos tenants existentes, marcar instâncias por ambiente): rodam uma vez e são conferidas no dev por consulta antes e depois.
- **Roteiro manual no ambiente de teste do Mercado Pago**, repetindo o que já foi validado: assinar pelo link com cartão de teste aprovado; assinar com início futuro sem cobrança imediata; trocar cartão por token; cobrar a diferença avulsa; cancelar; e receber os avisos no webhook do dev.

## Out of Scope

- Pix e boleto. Não existem em assinatura no Mercado Pago. Pix mensal avulso, com recorrência controlada pelo Navalhado, ou Pix Automático (que exige CNPJ ativo há 6 meses) ficam para outra spec.
- Plano anual ou semestral e cupons de desconto.
- Subir de plano pedindo só o CVV. Exige guardar o cartão como cliente do vendedor e assinar por tela própria em vez do link do Mercado Pago.
- Reembolso proporcional na descida de plano ou no cancelamento.
- Exclusão dos dados pelo próprio Gerente. Fica a pedido, pelo suporte.
- Nota fiscal, CNPJ e questões tributárias da conta de pessoa física.
- Clube de assinaturas das barbearias para os clientes delas (split de pagamento).
- Avisos de cobrança por WhatsApp.
- Adaptador Asaas. Só a interface fica pronta para recebê-lo.
- Multiunidade e plano acima de 10 profissionais.
- Promoção para prod.

## Further Notes

- **Testes já feitos no ambiente de teste do Mercado Pago** (26/09):
  - assinatura pelo link, com a primeira cobrança aprovada
  - troca de cartão por token sem cobrança imediata
  - mudança de valor da assinatura
  - assinatura com início daqui a 3 dias, mostrada como "3 dias grátis", sem cobrar na hora
  - cobrança avulsa de R$ 10,00 aprovada com token novo
  - a API recusou Pix e boleto em assinatura
  - o cartão salvo na assinatura não pode ser reaproveitado pelo vendedor

  Conferido em 29/09: a assinatura diária cobrou sozinha em 27/09 e em 28/09, R$ 89,90 cada, no Visa final 5682. Isso confirma três coisas: a cobrança recorrente automática, a troca de cartão (a cobrança saiu no cartão novo) e a mudança de valor valendo na cobrança seguinte. A assinatura de teste foi cancelada em seguida.
- **Asaas** foi avaliado e testado no sandbox antes da troca para o Mercado Pago. O motivo da troca foi a ausência de troca de cartão documentada sem que o número do cartão passe pelo servidor. Fica como plano B.
- **Exceção ao glossário.** O `CONTEXT.md` define a Integração WhatsApp Dev como instância exclusiva do dev, sem Uazapi compartilhada. Por decisão do usuário, o dev usa por enquanto uma instância do mesmo servidor Uazapi de prod. Por isso a exclusão automática de instância precisa da proteção por ambiente descrita acima.
- **Custos considerados:**
  - Uazapi: servidor de 100 instâncias a R$ 138/mês, cerca de R$ 1,38 por instância com o servidor cheio
  - cartão no Mercado Pago: 3,98% com recebimento em 30 dias
  - no pior cenário, a margem por plano fica acima de 75%, sem contar os custos fixos
- **Base legal considerada para o bloqueio:**
  - a suspensão por falta de pagamento é possível (Código Civil, art. 476) quando está prevista nos termos, com aviso prévio e prazo razoável
  - o Código de Defesa do Consumidor pode valer para barbearia pequena (teoria finalista mitigada)
  - reter os dados do cliente pode ser abusivo, daí a exportação

  Revisão por advogado antes do lançamento.
- **Glossário.** Depois da implementação, entram no `CONTEXT.md`: Assinatura do Tenant, Estado de Acesso, Período de Teste, Cortesia, Pagamento Recusado, Bloqueio por Assinatura (diferente de Bloqueio de Horário) e Limite de Profissionais do Plano.
