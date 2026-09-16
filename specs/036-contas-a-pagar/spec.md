# Spec 036 — Contas a Pagar

## Problem Statement

O Hub Financeiro cuida bem do dinheiro que entra pela Comanda e do dinheiro que sai para a equipe. Já o dinheiro que sai para manter a barbearia aberta, como aluguel, energia, produto e contador, não tem registro no sistema.

**Não existe onde registrar uma obrigação antes de pagá-la.** O aluguel vence todo dia 5, o boleto do distribuidor vence em três parcelas e o contador cobra todo mês. Nada disso fica no sistema. O gestor usa planilha, caderno ou a própria memória, e descobre o atraso quando chega a multa. Como não há vencimento registrado, também não há alerta, e não dá para responder "quanto eu tenho para pagar este mês".

**O pagamento de fornecedor pela gaveta vira sangria sem destino.** Quando o gestor paga um entregador com dinheiro do caixa, a única saída disponível é a sangria. O Fechamento de Caixa com Conferência bate, mas o dinheiro não se liga a nenhuma obrigação. Uma semana depois, ninguém sabe se aquela sangria de R$ 180 pagou o gás, o motoboy ou foi retirada do dono. A mesma conta pode ser paga duas vezes sem que nada avise.

**A apuração da gaveta está copiada em três lugares e a tela mostra um número errado.** O valor esperado da gaveta é recalculado em três funções do banco, e cada uma filtra os tipos de movimento pelo nome. A spec 034 já pagou esse preço uma vez: incluir o vale exigiu editar as três funções, sob risco de erro silencioso de saldo. Enquanto isso, a prévia exibida na tela, inclusive no modal de Fechamento de Caixa, só considera suprimento e sangria. Em qualquer turno com Quitação de Comissão ou vale pago em dinheiro, o gestor vê um valor esperado maior que o real antes de contar a gaveta. Colocar um quarto tipo de saída em cima dessa base repetiria o defeito pela terceira vez.

## Solution

Criar o livro de **Contas a Pagar**: obrigações com valor, vencimento, Categoria de Despesa e Fornecedor opcional, pagas por uma ou mais **Baixas**, com juros e desconto separados, e sempre estornáveis de forma auditável. Contas recorrentes e parceladas nascem juntas como **Série**, com todas as ocorrências geradas na criação, e podem ser editadas ou canceladas "apenas esta" ou "esta e as seguintes em aberto".

A Baixa declara de onde saiu o dinheiro. Se veio da gaveta, gera um movimento de caixa vinculado à Baixa, entra no Fechamento de Caixa com Conferência e respeita o saldo disponível no turno. Se veio de fora do caixa, fica registrada sem movimentar saldo de conta nenhuma.

Antes do tipo novo de movimento, a apuração do valor esperado da gaveta passa a existir em **um único lugar** no banco. As funções que dependem dela e a prévia da tela passam a consumir esse ponto único. Nenhum tipo de movimento futuro volta a exigir editar várias fórmulas.

Tudo vive na aba `/financeiro/contas-a-pagar` do Hub Financeiro. A aba mostra um alerta de contas vencidas e das que vencem hoje.

## User Stories

1. Como gestor, quero ver na tela o valor esperado da gaveta já descontando repasses de comissão e vales pagos em dinheiro, para que eu não conte a gaveta contra um número maior que o real.
2. Como gestor, quero que a prévia da gaveta e o valor apurado no Fechamento de Caixa com Conferência sejam sempre o mesmo número, para que a diferença mostrada antes de fechar seja a diferença que fica registrada.
3. Como gestor, quero ser impedido de lançar uma sangria maior que o saldo disponível na gaveta, para que o fechamento do turno não fique impossível de concluir.
4. Como proprietário, quero que toda movimentação de caixa registre como autor quem realmente a fez, sem que o navegador possa informar outro autor, para que a trilha da gaveta seja confiável.
5. Como gestor, quero que o extrato impresso da Sessão de Caixa mostre todas as saídas da gaveta, incluindo vales e pagamentos de contas, para que o papel explique a gaveta inteira.
6. Como gestor, quero cadastrar uma Conta a Pagar com descrição, Categoria de Despesa, valor e vencimento, para que a obrigação exista no sistema antes de eu pagá-la.
7. Como gestor, quero informar opcionalmente o Fornecedor, o número do documento ou da nota e uma observação, para que eu localize a conta quando o fornecedor ligar cobrando.
8. Como gestor, quero que a categoria padrão do Fornecedor preencha a Categoria de Despesa quando eu escolher o Fornecedor, sem sobrescrever uma categoria que eu já tenha escolhido, para que o lançamento repetido seja rápido.
9. Como gestor, quero cadastrar um Fornecedor ou uma Categoria de Despesa sem sair do formulário da conta, para que eu não perca o que já digitei.
10. Como proprietário, quero que a data de competência seja registrada separada do vencimento, com o vencimento como valor inicial, para que o resultado por mês possa ser apurado corretamente no futuro.
11. Como gestor, quero dar Baixa numa Conta a Pagar informando data, forma de pagamento e origem do dinheiro, para que o pagamento fique registrado junto da obrigação que ele pagou.
12. Como gestor, quero pagar uma conta em partes, para que uma Conta a Pagar paga metade hoje e metade na semana que vem continue em aberto pelo saldo.
13. Como gestor, quero registrar juros ou multa e desconto separados do valor principal, para que eu saiba quanto perdi por atraso e quanto ganhei por negociação.
14. Como gestor, quero dar Baixa com dinheiro da gaveta do turno aberto, para que o pagamento ao entregador saia do caixa já ligado à conta, e não como uma sangria sem destino.
15. Como gestor, quero ser impedido de pagar pela gaveta um valor maior que o disponível no turno, para que o fechamento continue possível.
16. Como gestor, quero dar Baixa informando que o dinheiro saiu de fora do caixa, por PIX, boleto, transferência ou débito automático, para que o pagamento seja registrado sem mexer na gaveta.
17. Como gestor, quero estornar uma Baixa lançada por engano informando o motivo, para que a conta volte a ficar em aberto sem apagar o histórico.
18. Como gestor, quero que o estorno de uma Baixa feita pela gaveta devolva o valor à gaveta do turno, para que o Fechamento de Caixa com Conferência continue batendo.
19. Como gestor, quero cancelar uma Conta a Pagar lançada por engano informando o motivo, para que ela saia das listas e dos totais sem desaparecer da auditoria.
20. Como gestor, quero lançar uma compra parcelada informando o valor total e o número de parcelas, para que o sistema gere cada parcela com o próprio vencimento.
21. Como gestor, quero que o centavo que sobra da divisão fique na última parcela, para que a soma das parcelas seja exatamente o valor da compra.
22. Como gestor, quero lançar uma despesa recorrente semanal, quinzenal, mensal ou anual informando quantas ocorrências gerar, para que eu cadastre o aluguel uma vez só.
23. Como gestor, quero que uma recorrência mensal no dia 31 vença no último dia dos meses mais curtos e volte ao dia 31 nos meses seguintes, para que o vencimento não vá encolhendo mês a mês.
24. Como gestor, quero conferir as datas e os valores das ocorrências antes de confirmar uma Série, para que eu não gere sessenta contas erradas.
25. Como gestor, quero editar uma ocorrência de uma Série escolhendo "apenas esta" ou "esta e as seguintes em aberto", para que um reajuste de aluguel valha daqui para frente.
26. Como gestor, quero cancelar "esta e as seguintes em aberto" de uma Série, para que um contrato encerrado pare de gerar obrigação.
27. Como gestor, quero que contas já pagas ou parcialmente pagas nunca sejam alteradas por uma edição ou um cancelamento em série, para que uma correção em lote não reescreva o que já saiu do caixa.
28. Como gestor, quero ser avisado quando uma recorrência estiver perto de acabar e poder estendê-la com mais ocorrências, para que o aluguel do ano que vem não suma da lista sem eu perceber.
29. Como gestor, quero listar as Contas a Pagar por período de vencimento, estado, Categoria de Despesa e Fornecedor, para que eu encontre o que preciso sem rolar a lista inteira.
30. Como gestor, quero ver os totais do filtro, com o saldo em aberto, quanto dele está vencido e quanto foi pago no período, para que eu saiba o tamanho do compromisso sem somar à mão.
31. Como gestor, quero ver destacadas as contas vencidas, as que vencem hoje e as que vencem nos próximos sete dias, para que eu priorize o que pagar primeiro.
32. Como gestor, quero que uma conta atrasada apareça como vencida sem que ninguém precise marcá-la, para que o estado nunca fique desatualizado.
33. Como gestor, quero que "hoje" e "vencida" sejam calculados no fuso horário da barbearia, e não no do meu celular, para que uma conta não mude de estado conforme o aparelho usado.
34. Como gestor, quero ver um alerta na aba de Contas a Pagar quando existirem contas vencidas ou vencendo hoje, para que eu perceba sem precisar abrir a aba.
35. Como gestor, quero abrir uma Conta a Pagar e ver suas Baixas, estornos, Série e quem lançou cada coisa, para que eu responda a qualquer cobrança com dado.
36. Como gestor, quero usar a tela de Contas a Pagar no celular, para que eu dê Baixa no balcão sem ir ao computador.
37. Como gestor, quero que a lista continue rápida mesmo com muitas ocorrências de recorrência geradas, para que o volume não degrade a tela.
38. Como proprietário, quero que toda operação em Contas a Pagar registre quem a fez e quando, para que o financeiro da barbearia seja auditável.
39. Como proprietário, quero que profissionais não vejam Contas a Pagar, Baixas nem Séries, para que o custo da casa continue restrito à gestão.

## Implementation Decisions

### Dependência da spec 035

Esta spec usa o Plano de Contas da spec 035 como contrato já entregue:

- **Categoria de Despesa** plana, com arquivamento.
- **Fornecedor** com categoria padrão opcional e arquivamento.
- A estrutura de abas com sub-rotas do Hub Financeiro, criada pelo prefactor que divide a página do Hub.

A Conta a Pagar exige Categoria de Despesa ativa no lançamento e aceita Fornecedor ativo opcional, ambos referenciados por chave estrangeira composta sobre o par tenant e identificador, como a 035 exige, para que o schema impeça referência a outro tenant. A categoria padrão do Fornecedor só pré-preenche a Conta a Pagar se estiver ativa. Arquivar uma categoria ou um fornecedor depois não afeta contas já lançadas: elas continuam exibindo o nome. O cadastro rápido dentro do formulário reutiliza os componentes de formulário e o contrato de escrita da 035, sem uma segunda implementação.

A Entrega 1 depende só do prefactor de abas da 035 (a Entrega 1 dela). As Entregas 2 a 4 dependem da 035 inteira.

### Escopo em quatro entregas sequenciais

A ordem vai da menor para a maior superfície de comportamento novo sobre dinheiro:

1. **Apuração única da gaveta.** Prefactor com saída idêntica no servidor, mais a correção da prévia na tela e o fechamento da brecha de inserção direta. Não cria conceito de domínio e é a única entrega que não usa o Plano de Contas da 035.
2. **Livro de Contas a Pagar.** Conta avulsa, Baixa fora do caixa, Estorno de Baixa, cancelamento, lista e alerta. Cria tabelas novas e não toca nenhuma função existente.
3. **Série.** Parcelamento e Recorrência, com edição, cancelamento e extensão em série. É escrita em lote, mas só sobre o livro novo.
4. **Baixa pela gaveta.** A única entrega que acrescenta semântica nova à gaveta, e por isso chega com o resto estável.

**O prefactor vem primeiro, e não por último como na 034.** A 034 deixou a mudança de gaveta para o fim porque ela trazia semântica nova, e aqui essa parte continua no fim, na Entrega 4. O prefactor é outra coisa: seu contrato é devolver exatamente os mesmos números. Esse contrato é verificável pelas suítes que já cobrem a gaveta, sem precisar de nenhum teste novo para existir. Há três motivos para ele abrir a fila:

- **Base parada.** Ele entra enquanto nada mais mexe na gaveta, e uma regressão só pode ter uma origem.
- **Defeito vivo.** Ele corrige o que o gestor vê hoje: a prévia errada no Fechamento de Caixa e o extrato impresso sem vales.
- **Ordem obrigatória.** O tipo novo de movimento da Entrega 4 só pode existir depois dele. Entregá-lo antes das Entregas 2 e 3 separa as duas mudanças arriscadas da gaveta, a de estrutura e a de semântica, com duas entregas inteiras de distância.

A Entrega 1 não depende da 035 no banco. Na tela, altera o componente da aba de Caixa, então deve ser implementada depois do prefactor de abas da 035, para não disputar o mesmo arquivo.

### Entrega 1 — Apuração única do valor esperado da gaveta

**Uma função privada única calcula o valor esperado da gaveta de uma Sessão de Caixa:** fundo de troco inicial, mais dinheiro recebido de Comanda na sessão, mais entradas de movimento, menos saídas de movimento, considerando só movimentos não estornados.

Ela devolve o valor esperado e o detalhamento agrupado por tipo de movimento, tirados da mesma agregação, de modo que o total e as parcelas nunca divergem. Estes são os consumidores:

- o Fechamento de Caixa, que persiste o valor esperado e o fotografa;
- a Quitação de Comissão em dinheiro e o vale em dinheiro, que usam o valor como saldo disponível;
- a Baixa pela gaveta da Entrega 4;
- um contrato de leitura novo para a prévia da tela.

A função não autoriza nada: pressupõe que quem a chama já validou papel e tenant e, quando vai escrever em seguida, já travou a sessão. Por isso fica no schema privado, com execução revogada dos papéis públicos, anônimo e autenticado. Quem expõe o número ao navegador é só o contrato de leitura, que revalida papel e tenant.

**O sentido do movimento de caixa passa a ser materializado na própria linha.** A tabela de movimentos de caixa ganha uma coluna gerada e armazenada de sentido, entrada ou saída, derivada do tipo. A expressão de derivação não tem ramo padrão e a coluna é obrigatória: um tipo novo acrescentado à restrição de tipo sem sentido declarado falha na primeira inserção, em vez de sair da gaveta sem ser subtraído. É a mesma decisão da 034 na Conta do Profissional (tipo separado da aritmética), aplicada ao lugar onde o defeito foi encontrado. Com isso, a função privada soma por sentido e nunca mais precisa conhecer tipos pelo nome. Um tipo futuro passa a exigir mudança num único ponto, a declaração do tipo na própria tabela, que já precisava ser editada de qualquer forma.

**A regra de estorno passa a valer para todos os tipos igualmente.** Hoje suprimento e sangria entram na soma sem olhar o estorno, e os outros tipos só entram se não estornados. Nenhuma função estorna suprimento ou sangria e não existe permissão de atualização direta na tabela. Por isso, filtrar todos os tipos pelo estorno preserva o resultado atual e elimina uma exceção.

**Saída idêntica.** As três funções existentes são reescritas sem mudar assinatura (substituição simples, sem derrubar e recriar). Elas passam a obter o valor da função privada, com as mesmas mensagens de erro e as mesmas chaves de retorno. A versão de cálculo gravada no fechamento permanece a atual: o número não muda, então não há regime novo a marcar.

**A prévia da tela passa a ler o valor apurado pelo banco.** A função de domínio que replica a fórmula no navegador é removida, e os três pontos que a consomem passam a usar o contrato de leitura novo:

- o modal de Fechamento de Caixa;
- o resumo da sessão ativa na aba de Caixa;
- a visão móvel de caixa.

O contrato devolve o valor esperado e o detalhamento por tipo para uma sessão aberta. Mais código não resolveria o defeito: a causa foi uma fórmula replicada, e a solução é não replicá-la, nem no navegador. A atualização em tempo real que a aba de Caixa já assina sobre movimentos de caixa passa a recarregar esse contrato. Sessões fechadas continuam mostrando o valor persistido no fechamento, que é a fotografia oficial, inclusive para sessões fechadas com versões de cálculo anteriores.

**A brecha de inserção direta é fechada movendo suprimento e sangria para RPC.** A política atual deixa gestores inserirem movimento de caixa de qualquer tipo direto na tabela, com sessão aberta. Restringir a política a suprimento e sangria não bastaria, por três razões:

- **Autor forjável.** O autor do movimento hoje é informado pelo navegador e a política não o confere. Restringir o tipo não impede registrar a sangria em nome de outra pessoa.
- **Vínculos forjáveis.** As colunas de vínculo (quitação, profissional e, a partir da Entrega 4, Baixa) e as de estorno teriam de ser anuladas uma a uma na política, e cada coluna futura reabriria a brecha.
- **Saldo sem trava.** Uma política não consegue validar a sangria contra o saldo da gaveta sem replicar a fórmula e sem travar a sessão. Uma sangria acima do saldo deixa o valor esperado negativo, e a restrição de valor esperado não negativo torna o fechamento do turno impossível, que é exatamente o defeito que a spec 033 corrigiu para a quitação.

O movimento manual passa por RPC nos moldes das escritas financeiras do projeto:

- aceita só suprimento e sangria;
- grava o autor a partir da sessão autenticada;
- trava a sessão;
- recusa sangria acima do saldo disponível apurado pela função privada.

Depois disso, a política de inserção é removida e a permissão de inserção direta é revogada do papel autenticado. A permissão residual do papel anônimo na tabela também é revogada: hoje ela é neutralizada apenas pela ausência de política.

**Expand e contract dentro da Entrega 1.** A revogação da inserção direta quebra qualquer navegador ainda com a versão anterior do adaptador de caixa. Por isso a entrega tem duas migrações:

1. A primeira cria a função privada, a coluna de sentido, a RPC de movimento manual e o contrato de leitura, e reescreve as funções existentes.
2. A segunda revoga a inserção direta e remove a política, e só é aplicada depois que o frontend que usa a RPC estiver publicado.

**O extrato impresso da Sessão de Caixa passa a listar todas as saídas.** Hoje o extrato agrupa movimentos por nomes fixos e omite o vale de profissional: o vale sai da gaveta, entra no valor esperado e não aparece no papel. O contrato de leitura do extrato ganha, em cada movimento, o sentido e os vínculos que já existem na linha. As chaves são aditivas e a assinatura não muda. O extrato passa a agrupar por tipo com rótulo conhecido e cai num rótulo genérico pelo sentido quando encontra um tipo sem rótulo, em vez de omitir a linha.

### Entrega 2 — Livro de Contas a Pagar

**Conta a Pagar em tabela própria, separada dos movimentos de caixa.** Um movimento de caixa pertence obrigatoriamente a uma Sessão de Caixa e representa dinheiro que já saiu. Uma Conta a Pagar existe antes de qualquer pagamento, pode ser paga fora da gaveta e pode ser paga em várias vezes. Acomodá-la em movimentos de caixa exigiria afrouxar o vínculo obrigatório com a sessão, o mesmo tipo de afrouxamento que a 034 recusou para as obrigações de comissão. O Estorno de Baixa e a Baixa pela gaveta ligam os dois livros sem fundi-los.

```
Conta a Pagar
  descrição, categoria de despesa (obrigatória), fornecedor (opcional)
  valor              numeric(12,2)  > 0
  valor baixado      numeric(12,2)  0 ≤ valor baixado ≤ valor     -- soma do principal das Baixas ativas
  estado             'open' | 'partially_paid' | 'paid' | 'cancelled'
  vencimento         date
  competência        date           -- inicia igual ao vencimento
  nº documento, observação
  série, posição na série           -- ambos nulos ou ambos preenchidos
  autor e momento de criação, da última edição e do cancelamento (com motivo)
```

**O estado armazenado fica amarrado ao valor baixado por restrição**, espelhando as obrigações de comissão:

- `open`: nada baixado.
- `partially_paid`: valor baixado entre zero e o valor.
- `paid`: valor baixado igual ao valor.
- `cancelled`: nada baixado e trilha de cancelamento preenchida.

A trilha de cancelamento é preenchida se e somente se o estado é cancelado. Com a restrição, um estado incoerente com o dinheiro não pode ser gravado, nem por uma função com defeito.

**Conta a Pagar Vencida é derivada e nunca armazenada**: está em aberto ou parcialmente paga e o vencimento é anterior ao dia de negócio corrente do tenant. Armazenar o atraso exigiria um processo agendado para virar o estado à meia-noite de cada fuso. O estado ficaria errado entre a virada do dia e a execução, e passaria a existir uma escrita sem autor humano num livro onde toda escrita tem autor.

O dia de negócio corrente é calculado sempre no servidor, a partir do fuso horário do tenant. Nenhum contrato aceita "hoje" vindo do navegador, para não repetir o defeito do filtro de período atual do Hub, que usa a data local do aparelho. A mesma regra deriva as faixas de destaque: vencida, vence hoje e vence nos próximos sete dias.

**A data de competência é gravada já, com o vencimento como valor inicial e edição permitida.** Nenhuma tela desta spec a usa para calcular nada. Ela existe porque o resultado por competência vai precisar dela, e não dá para reconstruí-la depois: o vencimento de uma conta de energia de agosto costuma cair em setembro.

**Baixa em tabela própria**, várias por conta, o que dá a Baixa parcial naturalmente:

```
Baixa
  conta a pagar
  principal          numeric(12,2)  > 0     -- quanto do saldo da conta esta Baixa abate
  juros e multa      numeric(12,2)  ≥ 0
  desconto           numeric(12,2)  ≥ 0, ≤ principal + juros
  valor pago         gerado = principal + juros − desconto   -- dinheiro que efetivamente saiu
  data do pagamento  date                   -- dia de negócio
  forma              'cash' | 'pix' | 'transfer' | 'boleto' | 'credit_card' | 'debit_card' | 'automatic_debit' | 'other'
  origem             'gaveta' | 'fora_do_caixa'
  sessão de caixa, movimento de caixa       -- preenchidos se e somente se a origem é gaveta
  autor e momento; trilha de estorno (momento, autor, motivo — todos ou nenhum)
```

**O principal abate o saldo da conta, e o desconto faz parte do principal abatido.** Pagar R$ 95 numa conta de R$ 100 com R$ 5 de desconto é uma Baixa de principal 100, desconto 5 e valor pago 95, e a conta fica paga. Juros entram só no valor pago e nunca no saldo da conta. Separar as três colunas responde "quanto perdi por atraso" e "quanto ganhei negociando" sem inferência. O valor pago como coluna gerada garante que o número lido pelo fluxo de caixa da spec 037 é sempre a mesma conta, e nunca uma recomposição feita pelo consumidor.

**Valor pago zero é aceito apenas fora do caixa.** Quando o desconto cobre integralmente principal e juros, a Baixa registra um abatimento concedido pelo fornecedor sobre o saldo restante. Sem isso, uma conta parcialmente paga cujo restante foi perdoado ficaria vencida para sempre: o cancelamento exige nenhuma Baixa ativa, e estornar as Baixas reais para cancelar apagaria pagamentos verdadeiros. Pela gaveta o valor pago é sempre positivo, porque movimento de caixa só existe com valor positivo.

**O domínio de formas de pagamento é próprio da Baixa.** O conjunto de formas de pagamento de Comanda está replicado em várias funções e na restrição da tabela de pagamentos. A Baixa precisa de boleto e débito automático, que não fazem sentido na Comanda. Estender o conjunto da Comanda obrigaria a mexer em todas essas cópias por uma necessidade que não é dela.

**A data do pagamento fora do caixa é informada pelo gestor e não pode estar no futuro** em relação ao dia de negócio do tenant. Registrar hoje um boleto pago na semana passada é o uso normal. Registrar um pagamento que ainda não aconteceu não é.

**O contrato de Baixa nasce completo e recusa a origem gaveta até a Entrega 4.** Os parâmetros de origem e de sessão de caixa existem desde a Entrega 2, e a gaveta é recusada com mensagem explícita. É o mesmo arranjo da 034 com o crédito de gorjeta na quitação, e poupa a troca de assinatura depois, com o ciclo de derrubar, recriar e reconceder privilégios que o repositório já pagou uma vez.

A Baixa valida:

- a conta está em aberto ou parcialmente paga;
- o principal não excede o saldo restante;
- os valores estão arredondados a duas casas, com recusa de valor não numérico;
- a forma pertence ao domínio;
- a combinação entre origem e forma é permitida (as regras da gaveta entram na Entrega 4).

Depois disso, atualiza o valor baixado e o estado na mesma transação.

**Estorno de Baixa.** Exige motivo com pelo menos cinco caracteres, recusa Baixa já estornada, grava autor e momento, devolve o principal ao saldo da conta e recalcula o estado para aberto ou parcialmente pago. Nada é apagado.

**Cancelamento de Conta a Pagar.** Só é aceito sem Baixa ativa, o que equivale ao estado aberto. Exige motivo com pelo menos cinco caracteres e é terminal: uma conta cancelada por engano é lançada de novo, não reativada. Reativar exigiria decidir o que acontece com a Série e com o vencimento já passado, e o custo de relançar é um formulário.

**Edição individual, limitada pelo estado:**

- **Aberta:** tudo é editável.
- **Parcialmente paga:** o valor fica travado e os demais campos são editáveis.
- **Paga:** só descrição, categoria, fornecedor, documento, observação e competência. Vencimento e valor viraram histórico de um pagamento concluído.
- **Cancelada:** nada.

Categoria e fornecedor novos precisam estar ativos. Manter os que já estavam na conta é sempre permitido, mesmo arquivados. Toda edição grava autor e momento da última alteração.

**Ordem de lock fixa: Conta a Pagar antes da Sessão de Caixa.** Baixa e Estorno de Baixa são as únicas operações que travam as duas coisas na mesma transação. As duas travam primeiro a Conta a Pagar (e, no estorno, a Baixa) e só depois a sessão. Duas Baixas na mesma conta ficam serializadas pela conta, e a segunda enxerga o saldo já atualizado. Nenhuma função existente trava Conta a Pagar, então essa ordem não forma ciclo com a Quitação de Comissão, o vale ou o fechamento, que travam a sessão primeiro. Toda verificação de estado (sessão aberta, conta em aberto, saldo) é feita depois de obtido o lock, nunca antes.

**Leitura.** São três contratos de leitura por RPC, porque todos devolvem estado derivado ou agregado que não deve ser recalculado no navegador:

- **Lista paginada no servidor.**
  - Filtros: período de vencimento, estado, Categorias de Despesa e Fornecedores.
  - Estados filtráveis: todas exceto canceladas (padrão); em aberto (inclui parcialmente pagas e vencidas); vencidas; pagas; canceladas.
  - Ordenação por vencimento e identificador, com tamanho de página limitado no servidor.
  - Cada linha já traz a situação derivada e a faixa de destaque, o saldo restante, os nomes de categoria e fornecedor e a posição na Série.
  - A resposta traz o total de linhas e os totais do filtro.
  - Recorrência infla o volume, e a regra atual das listas do Hub (limite fixo com filtro no navegador) esconderia contas sem avisar.
- **Totais do filtro.** Obedecem ao período, à categoria e ao fornecedor, e ignoram o filtro de estado, que de outro modo zeraria o pago ao filtrar vencidas.
  - Em aberto: saldo restante das contas não canceladas com vencimento no período, destacando quanto desse saldo está vencido.
  - Pago no período: soma do valor pago das Baixas ativas cuja data de pagamento cai no período, independentemente do vencimento da conta.
- **Alerta.** Quantidade e saldo das contas vencidas e das que vencem hoje, sem filtro de período. Alimenta o selo na aba e a faixa de alerta no topo da lista, porque uma conta vencida no mês passado não pode sumir só porque o filtro está no mês corrente.
- **Detalhe.** A conta, suas Baixas com autor e trilha de estorno, a trilha de cancelamento e o resumo da Série.

**Acesso.** As três tabelas novas seguem a política moderna: leitura para administrador do SaaS ou para gerente e proprietário do tenant, com o contexto de autenticação avaliado em subconsulta. Não há política nem permissão de inserção, atualização ou exclusão direta. Toda escrita passa por RPC `security definer` com `search_path` vazio, revalidando papel e tenant internamente, com revogação explícita de público e anônimo e concessão a autenticado e serviço. Nas tabelas, tudo é revogado de público, anônimo e autenticado, e só a leitura é concedida ao autenticado (o mesmo padrão dos ajustes de sessão de caixa). Assim não sobra permissão de truncar, que outras tabelas financeiras ainda carregam. O profissional não lê nada deste livro.

**Índices.** Todo FK é indexado na criação: categoria, fornecedor, Série, autores, conta da Baixa, sessão de caixa e movimento de caixa. Além deles:

- **Contas (por tenant e vencimento).** Índice composto, que serve a lista. Índice parcial pelo mesmo par restrito a contas em aberto e parcialmente pagas, que serve o alerta, as vencidas e a previsão de saída da 037.
- **Baixas (por tenant e data de pagamento).** Índice parcial restrito às não estornadas, que serve o pago no período e o realizado da 037.
- **Vínculo entre Baixa e movimento de caixa.** Índice único parcial em cada ponta, garantindo que duas Baixas não reivindiquem a mesma saída de gaveta (Entrega 4).

### Entrega 3 — Série: Parcelamento e Recorrência

**As ocorrências são materializadas na criação, sem motor de regra e sem processo agendado.** Uma regra de recorrência avaliada em tempo de leitura faria cada consumidor reinterpretar a regra: a lista, o alerta e o fluxo de caixa da 037. Uma ocorrência gerada é uma Conta a Pagar comum, com Baixa, estorno, edição e cancelamento próprios, e o livro inteiro continua valendo para ela sem caso especial. O custo é o limite de ocorrências por operação, mitigado pela extensão da Série.

A Série é uma tabela própria com tipo (Parcelamento ou Recorrência), periodicidade, data âncora (o vencimento da primeira ocorrência), valor informado na criação, autor e momento. Cada ocorrência aponta a Série e a própria posição, única dentro da Série.

**O calendário da Série é calculado num único lugar no servidor**, e a prévia usa esse mesmo cálculo. A ocorrência de posição *i* vence na data âncora deslocada *i* períodos:

- **Semanal:** sete dias.
- **Quinzenal:** catorze dias, porque mantém o dia da semana e o vencimento não escorrega de sábado para domingo.
- **Mensal e anual:** mesmo dia da âncora no mês-alvo, limitado ao último dia desse mês.

O deslocamento é sempre calculado a partir da âncora, nunca da ocorrência anterior. Assim, uma âncora em 31 de janeiro vence em 28 ou 29 de fevereiro e volta a 31 de março, e uma âncora em 29 de fevereiro vence em 28 de fevereiro nos anos não bissextos.

O formulário mostra a lista de ocorrências antes da confirmação, obtida de um contrato de leitura que usa o mesmo cálculo da criação. Replicar a aritmética de datas no navegador reabriria, em outro domínio, o defeito da prévia da gaveta que a Entrega 1 fecha.

**Parcelamento.**

- **Quantidade:** de 2 a 60 parcelas, a partir de um valor total.
- **Valor das parcelas:** todas recebem o total dividido pela quantidade, truncado em centavos, e a última recebe o resíduo, de modo que a soma é exatamente o total.
- **Numeração:** as parcelas são exibidas como "i/N", derivado da posição e da quantidade.
- **Descrição:** gravada sem sufixo, para que editar a descrição da Série não exija reescrever numeração.
- **Competência:** uma única, informada na criação e replicada em todas as parcelas, porque uma compra parcelada é uma despesa só. Por padrão, é o vencimento da primeira parcela.
- **Extensão:** não pode ser estendido, porque o total é o contrato.

**Recorrência.**

- **Quantidade:** de 1 a 60 ocorrências, todas com o mesmo valor.
- **Competência:** cada ocorrência recebe o próprio vencimento como competência, porque cada ocorrência é uma despesa do seu período.

**Edição e cancelamento em série.** A partir de uma ocorrência, o gestor escolhe entre "apenas esta" e "esta e as seguintes em aberto".

- **"Apenas esta"** segue as regras de edição individual.
- **"Esta e as seguintes em aberto"** atinge a ocorrência escolhida e as de posição maior que estejam em estado aberto. Parcialmente pagas, pagas e canceladas nunca são alteradas em lote, e a resposta informa quantas foram ignoradas e por quê.

Campos editáveis em lote:

- descrição;
- Categoria de Despesa;
- Fornecedor;
- observação;
- valor, só na Recorrência, porque num Parcelamento mudar o valor em lote desfaz o total da compra.

Vencimento, documento e competência só se editam individualmente. Mudar o dia de vencimento de uma recorrência equivale a cancelar esta e as seguintes e criar uma Série nova. Um recálculo de datas em lote precisaria decidir o que fazer com as ocorrências já pagas no meio, e essa regra não se paga aqui.

O cancelamento em lote exige motivo e grava o mesmo motivo e autor em cada ocorrência cancelada. A operação em série trava a Série e, em seguida, as ocorrências em ordem de posição. Uma Baixa concorrente numa ocorrência não trava a Série, portanto não há ciclo.

**Aviso e extensão da Recorrência.** A Série exibe aviso de fim próximo quando sua última ocorrência não está cancelada e vence em até 60 dias a partir do dia de negócio corrente. O horizonte em dias, e não em quantidade de ocorrências, vale igual para qualquer periodicidade e cobre a janela em que a previsão de saída da 037 começaria a ficar incompleta. Estender gera de 1 a 60 ocorrências novas, com posições a partir da maior posição existente, pelo mesmo calendário ancorado na data original. Valor, categoria, fornecedor e descrição vêm da última ocorrência não cancelada, porque um reajuste feito em "esta e as seguintes" precisa sobreviver à extensão.

### Entrega 4 — Baixa pela gaveta

**Tipo novo de movimento de caixa, pagamento de conta, com sentido de saída**, declarado na restrição de tipo e na expressão de sentido da Entrega 1. Nenhuma função de apuração é editada. É a demonstração de que o prefactor cumpriu o que prometia, e a suíte de regressão prova isso.

**O vínculo é bidirecional**: o movimento aponta a Baixa e a Baixa aponta o movimento, com índice único parcial em cada ponta, no mesmo padrão do vale da 034. Os dois registros são criados na mesma transação. A regra "Baixa de origem gaveta tem sessão e movimento, e as outras não têm nenhum dos dois" fica numa restrição da tabela de Baixas, com o vínculo ao movimento verificado ao final da transação. Assim, a invariante é garantida pelo schema, e não só pela função que hoje a respeita.

**Validações, na ordem de lock definida.** A origem gaveta só é aceita com forma dinheiro. A Baixa:

1. trava a Conta a Pagar;
2. trava a sessão de caixa informada e exige que esteja aberta e pertença ao tenant;
3. recusa valor pago acima do disponível apurado pela função privada.

A mensagem de recusa segue o mesmo padrão da Quitação de Comissão e do vale.

**Na Baixa pela gaveta, a data do pagamento é o dia de negócio corrente do tenant, definida pelo servidor.** O dinheiro sai da gaveta no momento da operação, mesmo quando a sessão foi aberta num dia anterior ou reaberta. Aceitar uma data informada permitiria registrar como pago na semana passada um dinheiro que saiu hoje da gaveta, e a Baixa e o movimento de caixa contariam histórias diferentes.

**Estorno de Baixa pela gaveta** só é aceito enquanto a sessão do movimento estiver aberta, com a orientação de reabrir o turno, no padrão do estorno de vale e de quitação. O estorno marca o movimento de caixa como estornado, com o mesmo autor e motivo, e o valor volta a contar na gaveta.

**Versão de cálculo.** O Fechamento de Caixa passa a gravar uma versão de cálculo nova. A partir dela, o valor esperado considera pagamentos de conta. É uma marca auditável do regime, como a 034 fez ao incluir o vale, e ela só muda nesta entrega, e não na Entrega 1, porque só aqui o número passa a poder ser diferente. As colunas de fotografia da sessão não ganham coluna nova: repasses e vales também não têm coluna própria, e o detalhamento do turno vive nos movimentos que o extrato já lista.

**Extrato impresso.** O pagamento de conta ganha rótulo próprio e mostra a descrição da Conta a Pagar, que o contrato de leitura do extrato passa a devolver para movimentos desse tipo.

### Interface

**Módulo `src/modules/contas-pagar/`** no padrão existente:

- interface de adaptador com métodos em português;
- repositório que valida entrada e devolve erro de validação próprio com mensagem em português;
- adaptador Supabase;
- hook próprio do módulo, que recebe o repositório por injeção e só instancia o padrão quando nada é injetado, ao contrário do hook de clientes, que o cria internamente.

**Não há adaptador em memória.** As regras que dariam profundidade a um adaptador falso estão no banco: estado amarrado ao valor, calendário da Série, saldo da gaveta. Um adaptador em memória teria de reimplementá-las e passaria a ser uma segunda fonte de verdade. Com um único adaptador real, a seam é hipotética, e os testes de repositório usam o adaptador simulado, como nos demais módulos financeiros.

O módulo de Caixa ganha dois métodos, a leitura do saldo apurado da gaveta e o movimento manual por RPC, e perde a função de domínio de valor esperado.

**Aba `/financeiro/contas-a-pagar`**, montada na estrutura de abas da 035:

- faixa de alerta;
- cartões de totais;
- barra de filtros;
- lista paginada.

A lista usa tabela em telas largas e cartões em largura de celular, no mesmo componente e escolhidos por ponto de quebra, sem uma visão móvel separada. No celular, a aba é alcançada pela navegação entre abas do Hub, que a 035 passa a exibir em largura de celular com rolagem horizontal. O filtro de período de vencimento é próprio da aba, e não o filtro de período do painel de Caixa e Comissões, e usa o calendário do fuso do tenant.

**O formulário de Conta a Pagar compõe variantes explícitas** para conta avulsa, Parcelamento e Recorrência. As variantes ficam sobre uma mesma casca com os campos comuns, e o controle segmentado escolhe qual variante é renderizada, em vez de um formulário único governado por flags booleanas. Cada variante só conhece os próprios campos, e a prévia de ocorrências pertence apenas às duas variantes de Série.

Baixa, Estorno de Baixa, cancelamento e edição com escolha de alcance são diálogos próprios. O de Baixa mostra a origem gaveta só quando existe sessão aberta, trava a forma em dinheiro nessa origem e exibe o disponível lido do contrato da Entrega 1.

**O selo de alerta** é alimentado pelo contrato de alerta e recarregado ao entrar no Hub e após qualquer escrita em Contas a Pagar. Ele fica na navegação de abas da 035 como conteúdo composto no rótulo da aba, e não como propriedade booleana nova no componente de abas.

### Fora de alteração

Nenhuma forma de pagamento de Comanda é alterada. Obrigações de comissão, Quitação de Comissão, Conta do Profissional e seus contratos não mudam de semântica. As três funções que apuram a gaveta mudam só por dentro. Comissões, vales e gorjetas não viram Conta a Pagar: têm livro próprio desde a 034, e duplicá-los aqui faria o fluxo de caixa contar a mesma saída duas vezes.

### ADR e vocabulário

A implementação cria a **ADR 020**, que registra:

- Contas a Pagar como livro separado dos movimentos de caixa;
- Baixa pela gaveta como movimento de caixa vinculado à Baixa;
- apuração única do valor esperado da gaveta com sentido materializado no movimento;
- movimento de caixa escrito exclusivamente por RPC.

A implementação também atualiza o `CONTEXT.md` com Conta a Pagar, Baixa, Estorno de Baixa, Série, Recorrência, Parcelamento, Conta a Pagar Vencida, data de competência e origem do dinheiro.

## Testing Decisions

Um bom teste aqui verifica **comportamento externo observável**: o valor esperado persistido no fechamento, o disponível que recusa ou aceita uma saída, o estado e o saldo de uma conta depois de uma Baixa ou de um estorno, as datas e os centavos de uma Série, o que cada papel consegue ler e escrever. Nenhum teste afirma sobre o corpo de função, nome de variável ou ordem interna de instruções. A exceção são as asserções de privilégio e de política que o projeto já faz, porque a ausência de permissão é, ela própria, o comportamento.

Nenhuma seam nova é criada.

**Seam primária — testes de banco (pgTAP, `supabase test db`).** É onde vivem os invariantes de dinheiro e toda a arte prévia: `07_fechar_caixa_atomicamente`, `19_quitacao_comissao_gaveta_caixa`, `21_estorno_quitacao_comissao`, `25_validar_saldo_gaveta_quitacao_comissao`, `26_conta_do_profissional_gorjeta` e `27_abate_vale_na_quitacao_comissao`, todos com contexto sintético próprio.

**Entrega 1 — regressão estende arquivos existentes e não cria arquivo novo.**

- **Em `07_fechar_caixa_atomicamente`.**
  - Sessão com todos os tipos de movimento, incluindo repasse e vale estornados, fecha com o valor esperado calculado à mão.
  - O contrato de leitura da prévia devolve exatamente o valor que o fechamento persiste em seguida.
  - Todo tipo aceito pela restrição de tipo recebe sentido, provado enumerando os tipos aceitos. É esta asserção que faz a suíte falhar quando alguém acrescentar um tipo futuro sem declarar sua aritmética.
- **Em `25_validar_saldo_gaveta_quitacao_comissao`.**
  - Sangria acima do disponível é recusada.
  - Sangria igual ao disponível é aceita e o turno fecha com valor esperado zero.
  - O disponível visto pela quitação e pelo vale continua descontando repasses e vales.
- **Nos arquivos que hoje afirmam a inserção direta.**
  - `03_restringir_operacoes_financeiras_estoque` passa a afirmar que o papel autenticado não tem permissão de inserção em movimentos de caixa.
  - `17_code_review_regressions` troca a asserção sobre o texto da política pela recusa, na RPC, de movimento em sessão fechada.
  - `18_code_review_behavioral_regressions` mantém a recusa de inserção direta em caixa fechado, agora por falta de permissão.
  - `20_reabertura_sessao_caixa` passa a lançar a sangria pós-reabertura pela RPC.

  Os arquivos que inserem movimentos como superusuário, antes de assumir o papel autenticado, só para montar contexto, não mudam.
- **As suítes 19, 21, 26 e 27 rodam sem alteração.** Elas são a prova de que as funções reescritas devolvem o mesmo resultado.

**Entregas 2 e 3 — `29_contas_a_pagar`.**

- **Conta a Pagar.**
  - Categoria arquivada é recusada no lançamento e aceita quando já estava na conta.
  - Cancelamento com Baixa ativa é recusado.
  - A restrição de estado e valor baixado recusa gravação incoerente, mesmo feita como superusuário.
- **Baixa e Estorno de Baixa.**
  - Baixa parcial e total, com juros e desconto; valor pago zero aceito fora do caixa; data futura recusada; origem gaveta recusada até a Entrega 4.
  - Estorno devolvendo o estado correto.
  - Duas Baixas concorrentes na mesma conta não ultrapassam o valor.
- **Situação derivada e totais.**
  - Situação vencida e faixas de destaque na fronteira do dia de negócio de um tenant com fuso diferente de UTC.
  - Totais do filtro com pago no período pela data de pagamento.
  - Paginação estável.
- **Séries.**
  - Parcelamento de 100 em 3 dando 33,33, 33,33 e 33,34.
  - Âncora em 31 de janeiro passando por fevereiro e voltando a 31; âncora em 29 de fevereiro em ano não bissexto; quinzenal mantendo o dia da semana.
  - Edição e cancelamento "esta e as seguintes" ignorando ocorrências pagas e parcialmente pagas.
  - Extensão continuando posições e calendário ancorados.
  - A prévia da Série igual às ocorrências efetivamente criadas.
- **Acesso.** O profissional não lê nenhuma das três tabelas nem executa nenhuma escrita; gerente de outro tenant não lê nem escreve.

**Entrega 4 — `30_baixa_conta_pela_gaveta`**, mais a regressão de propagação de tipo nos arquivos existentes, como a 034 fez com o vale.

- **Em `30_baixa_conta_pela_gaveta`.**
  - Baixa pela gaveta recusada acima do disponível e aceita no limite.
  - Recusada com forma diferente de dinheiro e com sessão fechada ou de outro tenant.
  - Vínculo bidirecional e índice único.
  - Data do pagamento definida pelo servidor.
  - Estorno recusado com sessão fechada e aceito após reabertura, marcando o movimento como estornado e devolvendo o valor à gaveta.
- **Em `07_fechar_caixa_atomicamente`.** O pagamento de conta é subtraído do valor esperado e o fechamento grava a versão de cálculo nova.
- **Em `25_validar_saldo_gaveta_quitacao_comissao`.** O pagamento de conta reduz o disponível para quitação, vale e sangria.

A numeração 29 e 30 segue a reserva do brief entre as specs 035 e 037.

**Seam secundária — repositório e adaptador (vitest).**

- O módulo `contas-pagar` recebe testes de repositório com adaptador simulado (validação de entrada e mensagens) e de adaptador simulando o cliente Supabase (mapeamento de parâmetros e de resposta), seguindo os testes dos módulos de Caixa e Comissões.
- Os testes do módulo de Caixa trocam os casos da função de valor esperado removida pelos casos do contrato de saldo apurado e do movimento manual por RPC.

**Interface.**

- A prévia corrigida é coberta pelos testes que já existem do modal de Fechamento de Caixa e da página do Hub Financeiro. Um caso novo mostra o valor esperado vindo do contrato, e não recomposto no navegador.
- O extrato impresso ganha caso com vale e pagamento de conta no teste de página existente.
- A aba de Contas a Pagar recebe um teste próprio no nível da aba, com repositório injetado. Ele cobre o alerta, a alternância de variantes do formulário, a escolha de alcance na edição em série, a oferta da origem gaveta só com sessão aberta e o cadastro rápido de Fornecedor e de Categoria de Despesa com o adaptador em memória do Plano de Contas, que é a cobertura que a 035 atribui a esta spec.
- Os componentes internos da aba não ganham arquivo de teste próprio: a cobertura continua pela seam de cima.

## Out of Scope

- **Contas a Receber**: fiado, recebíveis de cartão, assinaturas e títulos a receber. Decisão do usuário: comanda e caixa já cobrem a entrada.
- **Baixa em lote** de várias Contas a Pagar numa operação.
- **Subcontas, contas bancárias e transferência entre elas.** A origem fora do caixa não movimenta saldo de conta nenhuma.
- **Anexo de comprovante**, pela mesma decisão da 034.
- **Notificação por WhatsApp ao gestor** sobre contas vencidas ou vencendo.
- **Conversão de sangrias históricas** usadas para pagar fornecedor em Contas a Pagar.
- **Comissões, vales e gorjetas como Conta a Pagar.**
- **DRE, resultado por competência, margem, retirada de sócio e flag "fora do resultado".** A competência é gravada, mas não é consumida por nenhuma tela.
- **Recorrência sem fim, motor de regra e processo agendado** que gere ocorrências sozinho.
- **Edição de vencimento, documento ou competência em lote**, e recálculo de datas de uma Série existente.
- **Reativação de Conta a Pagar cancelada.**
- **Histórico campo a campo de edições.** A conta guarda autor e momento da criação, da última edição e do cancelamento.
- **Cálculo automático de juros e multa por atraso.** Juros são informados na Baixa.
- **Vínculo de Fornecedor com a entrada de estoque de produtos**, decidido na 035.
- **Coluna de fotografia de pagamentos de conta na Sessão de Caixa.**

## Further Notes

**Origem.** Esta spec cobre a lacuna 1 da auditoria `docs/reports/auditoria-qualidade-financeiro-dev-2026-09-11.md` (livro de títulos com vencimento e baixa, recorrência e parcelamento), com a lacuna 2 entregue pela 035. A referência funcional é o módulo de Entrada e Saída do AppBarber, em `docs/scraping_appbarber_financeiro.md` §4.3.

**Divergência deliberada do sistema de referência.** No AppBarber, dar baixa com destino Caixa *remove* o lançamento do financeiro, insere uma linha no caixa do dia e desvincula fornecedor e anexo (§6, item 4). Aqui a Baixa pela gaveta mantém a Conta a Pagar, a Baixa e o movimento de caixa ligados nas duas direções, e nada é removido. Remover o lançamento é exatamente o que torna uma sangria de fornecedor impossível de rastrear depois, que é o problema que esta spec resolve.

**Convergência com o sistema de referência.** Baixa com origem declarada entre gaveta e financeiro, juros lançados à parte e periodicidades de recorrência são escolhas que o AppBarber também fez. O limite de 60 ocorrências fica acima dos 24 de lá, porque aluguel e parcelamentos longos passam de dois anos. O quinzenal de 14 dias diverge dos 15 de lá, pelo motivo do dia da semana registrado acima.

**Armadilha registrada para a 037.** A Baixa pela gaveta gera um movimento de caixa. O fluxo de caixa deve ler a saída de Contas a Pagar a partir das Baixas e nunca dos movimentos de caixa, sob pena de contar a mesma saída duas vezes. Sangria e suprimento continuam sendo movimentação interna, e não despesa ou receita. O sentido materializado da Entrega 1 serve à gaveta, não à classificação contábil.

**Sangrias históricas.** Pagamentos a fornecedor feitos até hoje como sangria permanecem sangria. Nenhum dado registrado permite saber qual sangria pagou o quê, e converter por inferência inventaria obrigações.

**Divergências encontradas entre o brief e o código.** O brief está certo sobre as três cópias da fórmula. O estorno de vale e o estorno de quitação não recalculam a gaveta, só marcam o movimento como estornado, e nenhuma outra função viva filtra movimentos por tipo. O que o brief não registrava:

- **A prévia errada tem três consumidores, e não um.** A função de domínio de valor esperado é usada pelo modal de Fechamento de Caixa, pelo resumo da sessão na aba de Caixa e pela visão móvel. O modal de fechamento é o mais grave, porque mostra a diferença antes de o gestor confirmar a contagem.
- **O extrato impresso omite o vale de profissional.** Ele agrupa movimentos por nomes fixos e não conhece o vale. É uma lacuna da própria 034, corrigida na Entrega 1.
- **A inserção direta tem mais de uma brecha.** Além de aceitar qualquer tipo, a inserção direta confia no autor informado pelo navegador. Uma sangria acima do saldo, que a política aceita, deixa o valor esperado negativo e a restrição de valor não negativo bloqueia o fechamento.
- **As permissões de tabela destoam da regra.** O papel anônimo tem todas as permissões na tabela de movimentos de caixa, contidas só pela ausência de política. O papel autenticado mantém permissão de truncar em movimentos de caixa e em quatro tabelas financeiras da 034. A Entrega 1 revoga o que é da tabela de movimentos de caixa, e as tabelas novas nascem sem esse resíduo. As demais ficam como candidatas a uma spec de higiene.
- **O administrador do SaaS é o proprietário.** O helper de administrador do SaaS é o próprio papel proprietário. Por isso as RPCs existentes deixam o proprietário agir sobre qualquer tenant informado e restringem só o gerente ao próprio. As RPCs desta spec seguem o mesmo padrão, para não criar uma terceira interpretação de papel no Hub. Nas histórias, "proprietário" é o dono da barbearia, que no sistema opera com o papel `gerente`, como a 035 registra.

**Papel `proprietario` nas superfícies novas (regra comum às specs 035, 036 e 037).** No banco, `private.is_saas_admin()` é verdadeiro para o papel `proprietario`, que é o administrador do SaaS e não pertence a um tenant. As superfícies novas são do `gerente` do próprio tenant, e o `proprietario` recebe exatamente o tratamento que as RPCs financeiras existentes já dão a ele: a leitura por tabela o admite pelo ramo de administrador do SaaS da política moderna, e as RPCs aceitam dele um tenant informado diferente do próprio, que recusam para o `gerente`. O usuário confirmou em 2026-09-12 que o acesso é intencional: o administrador do SaaS precisa operar qualquer tenant para suporte. Mudá-lo depois é uma decisão única para todo o financeiro, não por spec.

**Dívida aceita.** O valor do movimento de caixa e as colunas da Sessão de Caixa têm precisão de dez dígitos, e as tabelas novas usam doze, conforme a decisão transversal. Na Baixa pela gaveta, o valor pago vira valor de movimento de caixa. Na prática, o limite nunca é atingido, porque a Baixa é limitada pelo saldo da gaveta, que já cabe na precisão menor. Uniformizar a precisão monetária continua candidato à mesma spec de higiene que a 034 registrou.
