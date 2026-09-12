# Operações inversas e higiene financeira

**Status:** draft — nenhuma implementação iniciada
**Ordem:** 4 de 4 (sucede as Specs 030, 031 e 032)
**Ambiente inicial:** Supabase DEV (`selvxobcjbkligxighlp`)
**Dependências:** Specs 030, 031 e 032 aplicadas no DEV
**Origem:** achados A1 a A10 de `docs/reports/auditoria-qualidade-financeiro-dev-2026-09-11.md`

## Problem Statement

O Hub Financeiro chegou ao fim das Specs 030–032 com o caminho de ida completo e o caminho de volta incompleto. Um gerente consegue liquidar uma Comanda, apurar comissão por item, registrar uma Quitação de Comissão e fechar a Sessão de Caixa — mas não consegue desfazer nenhuma dessas três últimas coisas.

Quando o gerente tenta reabrir uma Comanda cuja comissão já foi quitada, o sistema responde que ele deve estornar a quitação antes. Não existe estorno de quitação. Quando ele tenta reabrir uma Comanda de um turno já encerrado, o sistema responde que ele deve estornar o caixa antes. Não existe reabertura de Sessão de Caixa. Nos dois casos a mensagem instrui uma ação que o produto não oferece, e o atendimento fica congelado com o valor errado para sempre.

O mesmo descompasso aparece no dinheiro físico. O glossário do Navalhado descreve a Quitação de Comissão como paga em PIX, transferência **ou dinheiro da gaveta**, mas a quitação em dinheiro não registra movimentação no caixa. O fechamento confere a gaveta contra recebimentos de comandas, suprimentos e sangrias, sem saber que o gerente tirou dali o repasse do barbeiro. Toda vez que um barbeiro é pago em dinheiro, o turno fecha com uma quebra de caixa que não existe, e o operador aprende a ignorar a divergência — que é justamente o número que o Fechamento de Caixa com Conferência existe para produzir.

Há ainda registros que o banco grava e ninguém lê. O ajuste posterior de caixa e o estorno de pagamento de comanda são persistidos com autoria, motivo e fotografia dos valores originais, mas nenhuma função de leitura e nenhuma tela os consulta. O gerente que corrige uma conferência continua vendo a divergência antiga em todos os relatórios, e conclui que o ajuste não funcionou.

Por fim, o histórico de migrations do DEV divergiu dos arquivos do repositório e as suítes pgTAP não falham quando um teste quebra — duas condições que fazem qualquer correção futura ser aplicada e validada às cegas.

## Solution

Fechar o caminho de volta do financeiro e devolver credibilidade ao ciclo de conferência, sem redesenhar nenhum fluxo de ida e sem introduzir as entidades do livro caixa geral, que ficam para a spec seguinte.

- Toda operação financeira que hoje é irreversível ganha a operação inversa correspondente, com autoria, motivo e trilha de auditoria: estorno de Quitação de Comissão e reabertura de Sessão de Caixa.
- A Quitação de Comissão em dinheiro passa a exigir uma Sessão de Caixa aberta e a gerar a saída correspondente na gaveta, com tipo próprio de movimentação, de modo que o Fechamento de Caixa com Conferência volte a apurar a divergência real.
- Os registros de auditoria já existentes — ajuste posterior de caixa e estorno de pagamento de comanda — ganham leitura própria, e o extrato da Sessão de Caixa passa a apresentar a divergência ajustada ao lado da original.
- As regras de comissão hoje implícitas no código (base bruta, gorjeta sem comissão, ausência de taxa de cartão) passam a ser gravadas no snapshot e registradas em ADR como decisão consciente, sem torná-las configuráveis nesta etapa.
- Os achados residuais de classificação, rastreabilidade e consistência são corrigidos junto, porque todos tocam as mesmas funções.
- O histórico de migrations é reconciliado e as suítes pgTAP passam a falhar de verdade, com execução por comando único.

Esta spec não implementa nada por si: ela define o que será construído e como será verificado.

## User Stories

### Estorno de Quitação de Comissão

1. Como gerente, quero estornar uma Quitação de Comissão registrada por engano, para que o saldo do profissional volte ao valor correto.
2. Como gerente, quero informar um motivo ao estornar uma quitação, para que a correção fique justificada para a contabilidade.
3. Como gerente, quero que o estorno devolva exatamente os valores alocados a cada obrigação de comissão, para que nenhuma obrigação volte com saldo diferente do que tinha antes do pagamento.
4. Como gerente, quero que uma obrigação totalmente paga volte a aparecer como pendente após o estorno, para que ela entre no próximo repasse.
5. Como gerente, quero que uma obrigação parcialmente paga volte ao saldo parcial anterior, para que o estorno de um pagamento não apague outro.
6. Como gerente, quero que o estorno de uma quitação paga em dinheiro devolva o valor à gaveta do turno, para que a conferência física continue batendo.
7. Como gerente, quero ser impedido de estornar uma quitação em dinheiro cujo turno já foi encerrado, e ser informado de que preciso reabrir aquele turno antes, para que o caixa fechado não seja alterado pelas costas.
8. Como gerente, quero ser impedido de estornar duas vezes a mesma quitação, para que o saldo do profissional não seja inflado.
9. Como gerente, quero que a quitação estornada continue visível no histórico marcada como estornada, para que o repasse feito e desfeito permaneça auditável.
10. Como gerente, quero que uma quitação estornada deixe de contar como valor pago em todos os saldos e extratos, para que o profissional não apareça como quitado.
11. Como barbeiro, quero que meu extrato reflita o estorno imediatamente, para que eu saiba que aquele repasse foi desfeito.
12. Como proprietário, quero estornar quitações de qualquer unidade que administro, para manter a prerrogativa administrativa já existente.
13. Como usuário sem papel financeiro autorizado, quero ter o estorno recusado, para que a segurança não dependa da tela.
14. Como responsável técnico, quero que duas tentativas concorrentes de estorno da mesma quitação não produzam devolução dobrada, para preservar a consistência do saldo.
15. Como gerente, quero que a Comanda cuja comissão foi estornada volte a poder ser reaberta, para que a correção completa seja possível.

### Reabertura de Sessão de Caixa

16. Como gerente, quero reabrir uma Sessão de Caixa encerrada por engano, para corrigir a conferência do turno.
17. Como gerente, quero informar um motivo ao reabrir um turno, para que a exceção operacional fique registrada.
18. Como gerente, quero que a fotografia financeira do fechamento anterior seja preservada ao reabrir, para que a conferência original continue auditável.
19. Como gerente, quero ser impedido de reabrir um turno enquanto existir outro turno aberto na mesma barbearia, para que a regra de caixa único por unidade seja respeitada.
20. Como gerente, quero receber uma mensagem de domínio compreensível nesse impedimento, e não um erro técnico de violação de índice.
21. Como gerente, quero que a reabertura permita novamente lançar sangria e suprimento naquele turno, para concluir a correção.
22. Como gerente, quero refazer o fechamento após a correção e obter uma nova apuração de divergência, para encerrar o turno corretamente.
23. Como gerente, quero que a Comanda pertencente a um turno reaberto volte a poder ser reaberta, para desfazer uma liquidação errada.
24. Como usuário sem papel financeiro autorizado, quero ter a reabertura recusada.
25. Como responsável técnico, quero que a reabertura seja atômica, para que nunca exista um turno meio reaberto.

### Quitação de Comissão e gaveta física

26. Como gerente, quero que a quitação em dinheiro exija um turno aberto, para que a saída seja registrada onde o dinheiro realmente saiu.
27. Como gerente, quero que a quitação em dinheiro gere uma movimentação de caixa com tipo próprio, para que ela não se confunda com uma sangria comum nos relatórios.
28. Como gerente, quero que o fechamento do turno subtraia as quitações pagas em dinheiro do saldo esperado em gaveta, para que a divergência apurada seja a divergência real.
29. Como gerente, quero que a quitação em PIX, transferência ou cartão não exija turno aberto nem toque a gaveta, para que o repasse bancário não distorça o caixa físico.
30. Como gerente, quero ser impedido de informar um turno de outra barbearia ou um turno encerrado na quitação, para preservar o isolamento entre unidades.
31. Como gerente, quero que a movimentação de caixa gerada aponte para a quitação que a originou, para que a origem do valor seja rastreável na conferência.
32. Como operador, quero que o extrato do turno mostre as quitações pagas em dinheiro junto das demais saídas, para conferir a gaveta item a item.

### Leitura dos registros de auditoria

33. Como gerente, quero consultar o extrato de uma Sessão de Caixa encerrada com a divergência original, os ajustes posteriores e a divergência ajustada, para entender o que foi corrigido e por quem.
34. Como gerente, quero ver o motivo e o autor de cada ajuste posterior, para responder a uma auditoria sem consultar o banco.
35. Como gerente, quero que o extrato apresente a divergência ajustada como número corrente do turno, mantendo a original visível ao lado, para não perder a conferência inicial.
36. Como gerente, quero consultar os estornos de pagamento de uma Comanda reaberta, para saber quais formas de pagamento foram desfeitas.
37. Como barbeiro, quero não ter acesso aos extratos de conferência de caixa, para que a visibilidade financeira continue restrita aos papéis autorizados.
38. Como gerente, quero registrar um ajuste posterior de caixa pela aplicação, e não apenas pelo banco, para que a funcionalidade já construída deixe de ser inacessível.

### Regra de comissão explícita

39. Como responsável técnico, quero que cada item liquidado grave qual base foi usada para calcular a comissão, para que a apuração histórica continue interpretável quando a regra mudar.
40. Como proprietário, quero que a decisão atual — comissão sobre valor bruto, desconto absorvido pela casa, gorjeta sem comissão e ausência de taxa de cartão — esteja registrada como decisão de arquitetura, para que ninguém a trate como esquecimento.
41. Como proprietário, quero que a mudança dessa regra seja uma decisão futura explícita, e não um efeito colateral de outra correção.

### Correções residuais

42. Como gerente, quero que a devolução de estoque na reabertura de Comanda apareça no histórico com tipo próprio de estorno, para que ela não seja contada como entrada manual de mercadoria.
43. Como gerente, quero que o estorno de estoque continue vinculado ao movimento original que o gerou, para que a contagem seja reconstruível.
44. Como responsável técnico, quero que a obrigação de comissão preserve a identificação do item que a originou mesmo após a Comanda ser reaberta e refaturada, para que a auditoria não perca o rastro.
45. Como gerente, quero registrar uma Comanda de cortesia com desconto integral, para que um atendimento gratuito seja liquidado sem valor inventado.
46. Como operador, quero ser impedido de informar um valor recebido em dinheiro menor que o valor do pagamento, para que o troco nunca seja calculado sobre um recebimento inexistente.
47. Como responsável técnico, quero que todas as funções financeiras usem `search_path` vazio com schemas qualificados, para que a superfície de segurança seja uniforme.
48. Como responsável técnico, quero índices nas colunas de vínculo dos estornos de pagamento, para que a consulta por Comanda e por unidade não varra a tabela.

### Higiene de migrations e testes

49. Como responsável técnico, quero que a versão registrada de cada migration no DEV corresponda ao arquivo do repositório, para que o histórico volte a ser fonte de verdade.
50. Como responsável técnico, quero que as versões de sondagem criadas durante a exploração sejam removidas do histórico do DEV, para que nenhuma entrada sem arquivo permaneça.
51. Como responsável técnico, quero executar toda a suíte de banco por um comando único, para que a validação não dependa de colar SQL manualmente.
52. Como responsável técnico, quero que uma suíte pgTAP com teste vermelho falhe o comando, para que uma regressão não passe despercebida.
53. Como responsável técnico, quero que os testes comportamentais criem o próprio contexto em vez de depender de linhas preexistentes do DEV, para que a suíte continue válida em um banco recém-semeado.
54. Como responsável técnico, quero comparar advisors de segurança e performance antes e depois, para provar que a mudança não introduziu alerta novo.
55. Como responsável técnico, quero que nada desta spec seja aplicado em produção, para validar primeiro no DEV com dados controlados.

## Implementation Decisions

### Princípios que valem para toda a spec

- Toda escrita financeira continua entrando exclusivamente por função remota `SECURITY DEFINER` com `search_path` vazio, schemas qualificados, validação explícita do chamador e grants restritos. Nenhuma tabela nova recebe `INSERT`, `UPDATE` ou `DELETE` para `authenticated`; apenas policies de leitura por papel.
- Toda alteração de banco é migration nova e idempotente, criada pela ferramenta de migrations e aplicada primeiro no DEV pelo MCP do Supabase. Constraint é sempre `drop constraint if exists` seguido de `add constraint`, porque Postgres não aceita `add constraint if not exists`.
- Locks são adquiridos em ordem estável em todas as funções novas — profissional, depois quitação, depois obrigações por `created_at, id`; sessão de caixa antes de movimentações — mantendo a ordem já praticada pelas funções existentes para não introduzir deadlock entre operação de ida e de volta.
- Nenhuma migration histórica é editada. Correção é sempre migration compensatória.
- Toda coluna de chave estrangeira criada nesta spec nasce com índice.

### Estorno de Quitação de Comissão

- Nova função remota de estorno recebendo a quitação, a unidade e o motivo obrigatório, com mesmo mínimo de caracteres já exigido no ajuste de caixa.
- A quitação passa a carregar marcação de estorno na própria linha — quando, por quem e por quê — seguindo o padrão já adotado em movimentações de estoque, em vez de criar tabela paralela. A linha nunca é apagada.
- As alocações da quitação são preservadas como registro histórico. Toda soma de valor pago passa a desconsiderar quitações estornadas, tanto no livro novo de obrigações quanto no cálculo legado de compatibilidade.
- O estorno devolve a cada obrigação exatamente o valor alocado àquela obrigação por aquela quitação, e recalcula o status pela mesma regra da constraint de consistência já existente: saldo zerado volta a `open`, saldo parcial volta a `partially_paid`.
- Quitação já estornada é recusada com erro de domínio, não com efeito silencioso.
- Quitação paga em dinheiro só pode ser estornada com o turno de origem ainda aberto. Com o turno encerrado, o erro aponta a reabertura de Sessão de Caixa como pré-requisito — mensagem que, a partir desta spec, descreve uma ação existente.
- O estorno de quitação em dinheiro remove o efeito na gaveta pelo mesmo mecanismo de marcação de estorno usado no restante do módulo, sem apagar a movimentação original.
- Autorização idêntica à do registro de quitação: usuário ativo com papel gerente ou proprietário, validado no banco, com proprietário mantendo a prerrogativa multiunidade.
- A serialização contra estornos concorrentes usa o mesmo ponto já usado pelo registro de quitação — o travamento da linha do profissional —, garantindo que registro e estorno do mesmo profissional nunca corram em paralelo.

### Reabertura de Sessão de Caixa

- Nova função remota de reabertura recebendo a sessão, a unidade e o motivo obrigatório.
- A unidade já possui índice único parcial garantindo uma única sessão aberta por barbearia. A função verifica essa condição antes de tentar a mudança de status e devolve erro de domínio próprio, para que o usuário nunca veja violação de índice único.
- A fotografia do fechamento — valor declarado, valor esperado, divergência, composição por método de pagamento, contagem de pagamentos, suprimentos, sangrias e versão de cálculo — é copiada para uma tabela nova de reaberturas de caixa antes de a sessão voltar a `open`, junto com autor, momento e motivo. A tabela é somente leitura para papéis financeiros, como as demais tabelas de auditoria do módulo.
- Após a cópia, a sessão volta a `open` e os campos de fechamento são limpos, de modo que um novo fechamento produza uma apuração íntegra em vez de somar sobre a anterior.
- Ajustes posteriores já registrados para aquela sessão permanecem, e o extrato passa a exibi-los associados ao fechamento a que pertenciam.
- A policy de atualização de `cash_sessions` continua restrita a sessões abertas; a reabertura acontece pela função definidora, mantendo o princípio de que a transição de estado não é escrita direta do cliente.

### Quitação de Comissão e gaveta física

- O registro de quitação passa a aceitar a Sessão de Caixa como parâmetro opcional, com regra condicional: obrigatória quando o método é dinheiro, recusada quando não é.
- Informar sessão de outra unidade, sessão encerrada ou sessão inexistente é erro de domínio.
- O conjunto de tipos de movimentação de caixa ganha um tipo próprio para repasse de comissão, em vez de reaproveitar sangria. O motivo é o mesmo que justifica o tipo de estorno de estoque: um relatório de sangria deve continuar significando retirada de numerário, não pagamento de pessoal.
- O fechamento de caixa passa a subtrair as quitações em dinheiro do turno no cálculo do valor esperado, ao lado das sangrias, e a versão de cálculo gravada na sessão é incrementada para que fechamentos antigos continuem interpretáveis pela fórmula que os produziu.
- A movimentação gerada guarda o vínculo com a quitação de origem, viabilizando o estorno descrito acima e a leitura item a item no extrato do turno.
- A quitação guarda o vínculo com a sessão em que foi paga, para que o extrato do profissional indique de onde saiu o dinheiro.

### Leitura dos registros de auditoria

- Nova função remota de extrato de Sessão de Caixa devolvendo, em uma única chamada: a fotografia do fechamento corrente, a lista de ajustes posteriores com autor e motivo, a divergência ajustada acumulada, as movimentações do turno incluindo as quitações em dinheiro, e o histórico de reaberturas anteriores da mesma sessão.
- A divergência ajustada é apresentada como número corrente e a original permanece ao lado. A linha de `cash_sessions` continua imutável após o fechamento, preservando a decisão de imutabilidade tomada na Spec 032; a consolidação acontece na leitura.
- A leitura exige papel financeiro autorizado, como as policies das tabelas de auditoria envolvidas.
- Os estornos de pagamento de Comanda ganham leitura equivalente no extrato da Comanda, para que a reabertura deixe de ser invisível.

### Contratos dos repositórios

- O `CaixaRepository` ganha três operações no contrato público: registrar ajuste posterior, reabrir sessão e obter extrato da sessão. As três hoje não existem no contrato, apesar de duas já existirem no banco.
- A validação de entrada do repositório segue o padrão vigente: campos obrigatórios e faixas evidentes falham como erro de validação de domínio antes de chegar ao adaptador; regra de negócio permanece no banco.
- As operações de comissão passam a ter um módulo profundo próprio, com contrato equivalente ao de Caixa e Comanda, cobrindo registro de quitação, estorno de quitação e consulta de saldo. Hoje a quitação é chamada diretamente de um componente de tela, o que impede testar o contrato no mesmo seam das demais operações financeiras.
- Os contratos existentes de `ComandaRepository` e `CaixaRepository` não têm assinatura alterada; as adições são aditivas, para não regredir as telas atuais.
- Nenhuma tela é construída ou redesenhada nesta spec. O contrato é definido e testado; a fiação visual é trabalho posterior.

### Regra de comissão explícita

- O snapshot do item passa a gravar qual base foi usada no cálculo da comissão, com o valor correspondente à regra vigente — valor bruto do item, antes do rateio de desconto.
- A regra vigente é registrada em ADR: comissão sobre valor bruto, desconto concedido absorvido integralmente pela casa, gorjeta sem comissão e sem taxa de adquirente no modelo. O ADR declara a regra como decisão consciente e aponta a spec futura de meios de pagamento e recebíveis como o lugar onde ela poderá mudar.
- Tornar a regra configurável por barbearia, por profissional ou por serviço está fora desta spec. O objetivo aqui é que a regra deixe de ser implícita, não que ela mude.

### Correções residuais

- O conjunto de tipos de movimentação de estoque ganha um tipo próprio de estorno, usado pela reabertura de Comanda no lugar de entrada manual. A função de ajuste de estoque exposta à aplicação recusa esse tipo, que passa a ser exclusivo das funções internas de estorno.
- A obrigação de comissão passa a guardar, além da chave estrangeira para o item, a identificação de origem do item em coluna sem vínculo referencial. Assim, quando a Comanda é reaberta e refaturada e os itens antigos são substituídos, a obrigação revertida preserva o rastro em vez de ficar apenas com o vínculo da Comanda.
- A liquidação passa a aceitar total zero quando o desconto iguala o subtotal, caracterizando cortesia, e nesse caso dispensa formas de pagamento. Total negativo continua recusado. A comissão da cortesia segue a regra declarada no ADR.
- A liquidação passa a recusar valor recebido em dinheiro menor que o valor do respectivo pagamento, em vez de calcular troco sobre recebimento insuficiente.
- A função de resumo financeiro diário passa a usar `search_path` vazio com schemas qualificados, alinhando-se às demais funções financeiras.
- Os estornos de pagamento de Comanda recebem índice pelas colunas de unidade e Comanda.

### Higiene de migrations e testes

- O histórico de migrations do DEV é reconciliado com os arquivos do repositório pelo comando de reparo da CLI do Supabase, versão por versão, e as três entradas de sondagem sem arquivo correspondente são removidas do histórico. Nenhum arquivo de migration é renomeado ou reescrito para isso.
- O critério de conclusão é a listagem de migrations não apresentar divergência entre local e remoto.
- Todas as suítes pgTAP passam a encerrar com falha propagada, para que um teste vermelho derrube o comando. As suítes que hoje encerram sem propagação são ajustadas.
- A suíte de banco passa a ter um comando único de execução declarado junto dos demais scripts do projeto, executável contra o DEV.
- Os testes comportamentais deixam de depender de linhas preexistentes do DEV e passam a criar o próprio contexto dentro da transação de teste, mantendo o padrão de reverter tudo ao final.

## Testing Decisions

Um bom teste aqui verifica o comportamento observável do contrato — saldo final, estado persistido, autorização, isolamento entre unidades e erro retornado — e não a organização interna da função. Nenhum teste afirma sobre nome de variável, ordem de instrução ou estrutura de consulta quando a mesma garantia pode ser exercitada pela porta pública.

### Seams

São dois, ambos já existentes no projeto:

1. **Contrato das funções remotas financeiras, exercitado por pgTAP com os papéis reais.** É o seam principal e onde fica a maior parte da verificação, porque toda a regra desta spec vive no banco. Prior art: as suítes de 02 a 18 em `supabase/tests/database`, com o padrão de transação revertida, papel `authenticated` assumido com `set local role` e identidade injetada por configuração de sessão.
2. **Contrato dos repositórios de módulo, exercitado por vitest com adaptador dublê.** Cobre apenas a superfície nova de `CaixaRepository` e do novo módulo de comissões: validação de entrada, tradução de erro e formato devolvido. Prior art: os testes de `CaixaRepository`, `ComandaRepository` e dos adaptadores Supabase correspondentes.

Nenhum seam novo é criado. O módulo profundo de comissões não é um seam novo: é o mesmo seam de repositório já usado por Caixa e Comanda, aplicado a uma área que hoje chama a função remota direto da tela.

### Cenários obrigatórios no seam de banco

1. Estorno devolve o saldo exato de cada obrigação alocada e restaura o status correspondente.
2. Estorno de quitação que cobria obrigação integral e parcial restaura ambas corretamente na mesma operação.
3. Quitação estornada deixa de contar como paga no saldo do profissional e no saldo consolidado da unidade.
4. Segundo estorno da mesma quitação é recusado.
5. Estorno de quitação em dinheiro com turno aberto devolve o valor à gaveta; com turno encerrado é recusado com erro de domínio.
6. Estornos concorrentes da mesma quitação não produzem devolução dobrada.
7. Comanda cuja comissão foi estornada volta a poder ser reaberta.
8. Reabertura de caixa preserva a fotografia do fechamento e devolve a sessão para aberta.
9. Reabertura é recusada com erro de domínio quando já existe turno aberto na unidade, sem expor violação de índice único.
10. Turno reaberto aceita novamente sangria e suprimento, e o novo fechamento apura divergência a partir do estado corrigido.
11. Quitação em dinheiro sem turno aberto é recusada; com turno aberto gera movimentação do tipo próprio vinculada à quitação.
12. Quitação em PIX, transferência ou cartão não aceita turno e não gera movimentação.
13. Turno de outra unidade ou turno encerrado informado na quitação é recusado.
14. Fechamento subtrai as quitações em dinheiro do valor esperado e a divergência apurada reflete a gaveta real.
15. Extrato da sessão devolve fotografia, ajustes, divergência ajustada, movimentações e reaberturas em uma única chamada.
16. Extrato é recusado para papel não autorizado e para usuário de outra unidade.
17. Reabertura de Comanda devolve estoque com o tipo de estorno, e a função de ajuste exposta à aplicação recusa esse tipo.
18. Obrigação revertida preserva a identificação de origem do item após reabertura e refaturamento.
19. Comanda de cortesia com desconto integral é liquidada sem forma de pagamento; total negativo continua recusado.
20. Pagamento em dinheiro com valor recebido menor que o valor do pagamento é recusado.
21. Item liquidado grava a base de cálculo da comissão usada.
22. Usuário inativo, anônimo e sem papel financeiro é recusado em todas as operações novas.
23. Todas as funções novas expõem `search_path` vazio e nenhuma tabela nova concede escrita direta a `authenticated`.

### Cenários obrigatórios no seam de repositório

24. Entradas obrigatórias ausentes ou fora de faixa falham como erro de validação antes de chegar ao adaptador.
25. As novas operações de Caixa e de comissão repassam ao adaptador exatamente o contrato acordado e devolvem o formato esperado pela camada de tela.
26. As suítes atuais de Produtos, Comandas, Caixa, Financeiro e Quitação de Comissão permanecem verdes.

### Verificações de ambiente

27. Advisors de segurança e de performance do DEV comparados antes e depois, sem alerta novo dentro do escopo.
28. Listagem de migrations sem divergência entre repositório e DEV.
29. Suíte de banco executada por comando único, com falha propagada comprovada por um teste deliberadamente quebrado durante a validação.

## Out of Scope

- Livro caixa geral, contas a pagar e a receber, lançamentos com vencimento e baixa, recorrência e parcelamento.
- Plano de contas, categorias de despesa e receita, fornecedores, subcontas bancárias e transferência entre contas.
- Bandeira de cartão, parcelamento, taxa de adquirente e data de compensação de recebíveis.
- Conta do cliente (fiado) e conta do profissional para vales e adiantamentos.
- Retirada de sócio fora da DRE e gorjeta como crédito do profissional.
- Pacotes, assinaturas e comissão sobre venda ou execução de sessão.
- Tornar configurável a base de cálculo da comissão, o tratamento do desconto ou a dedução de taxa de cartão.
- Construção ou redesenho de telas, componentes e navegação do Hub Financeiro.
- Remoção de índices apenas por baixa utilização atual.
- Correção de advisors sem relação com caixa, comissões, comandas ou estoque.
- Produção: nenhuma migration promovida, nenhum deploy, nenhum dado real alterado.

## Further Notes

- O impedimento hoje é circular: reabrir Comanda exige estornar quitação e reabrir caixa, e nenhuma das duas existe. Por isso as três primeiras seções desta spec são uma unidade e não devem ser fatiadas em entregas separadas — entregar só o estorno de quitação mantém o beco quando o turno já fechou.
- O vínculo entre Quitação de Comissão e gaveta não é uma funcionalidade nova: o glossário do Navalhado já descreve a quitação como pagável em dinheiro da gaveta. O que existe hoje é a ausência do efeito correspondente.
- A escolha de tipos próprios de movimentação — repasse de comissão no caixa, estorno de venda no estoque — repete um mesmo julgamento: um registro compensatório não deve ser indistinguível de um registro original, porque relatório que soma os dois passa a mentir.
- A divergência de histórico de migrations surgiu de aplicar pelo MCP, que carimba a própria versão, e escrever o arquivo com outra. Vale decidir, antes da próxima spec, se a aplicação no DEV continua sendo pelo MCP com reparo posterior, ou se passa a ser pela CLI com o arquivo como origem única.
- Os testes comportamentais atuais encontram contexto no DEV por acaso, porque o banco tem dados. Num DEV recém-semeado eles não encontrariam, e — sem falha propagada — passariam em silêncio. As duas correções de teste desta spec são complementares e perdem sentido separadas.
- Esta publicação cria somente a especificação local. Nenhum código, banco, migration, dado, commit, push ou deploy é alterado.
