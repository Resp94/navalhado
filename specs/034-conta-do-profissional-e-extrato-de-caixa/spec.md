# Spec 034 — Conta do Profissional e Extrato de Caixa

## Problem Statement

O Hub Financeiro hoje fecha bem o ciclo do dinheiro que entra, mas deixa três buracos na relação financeira com a equipe e na conferência do turno.

**O gestor não consegue levar o fechamento do turno para fora da tela.** A Sessão de Caixa calcula tudo que é preciso — recebido por forma de pagamento, suprimentos, sangrias, repasses, sobra ou quebra — e não existe nenhuma forma de imprimir ou arquivar essa conferência. Quem opera caixa físico precisa de papel: para assinar, para anexar ao malote, para conferir com o dono no dia seguinte. Hoje a única saída é fotografar o monitor.

**A gorjeta é cobrada do cliente e nunca chega ao profissional.** O valor de gorjeta é somado ao total da Comanda e entra na gaveta junto com o resto. A partir dali, não existe registro de que aquele dinheiro pertence a alguém: nenhum saldo, nenhum extrato, nenhum repasse rastreável. O gestor que quer ser justo precisa anotar por fora e pagar por fora, e o profissional não tem como conferir se recebeu. É dinheiro de terceiro parado no fluxo da casa sem trilha.

**Vale e adiantamento não têm onde morar.** Quando o profissional pede dinheiro adiantado, a saída acontece na gaveta e a dívida vive na memória do gestor. Na hora da Quitação de Comissão, nada no sistema lembra que existe um vale em aberto — então ou o gestor lembra e abate na cabeça, ou paga a comissão cheia e o vale vira prejuízo silencioso. O profissional, do outro lado, não tem extrato do que assinou.

## Solution

Criar a **Conta do Profissional**: um extrato de créditos e débitos por profissional, separado da comissão automática de atendimentos, onde a gorjeta entra como crédito e o vale como débito. Na Quitação de Comissão, o sistema passa a apresentar o líquido sugerido — comissão mais gorjetas menos vales — e o gestor aceita ou ajusta, com cada lançamento abatido de forma rastreável.

Em paralelo, expor o extrato da Sessão de Caixa em tela imprimível, aproveitando o cálculo que o sistema já faz e hoje não mostra.

O profissional passa a ver a própria conta: o que lhe é devido e o que ele deve.

## User Stories

1. Como gestor, quero imprimir o extrato de uma Sessão de Caixa fechada, para que eu possa assinar e arquivar a conferência física do turno.
2. Como gestor, quero que o extrato impresso mostre o recebido discriminado por forma de pagamento, para que eu confira a gaveta contra a maquininha e o PIX separadamente.
3. Como gestor, quero que o extrato impresso mostre suprimentos, sangrias e repasses de comissão do turno linha a linha, para que eu explique qualquer diferença sem abrir o sistema.
4. Como gestor, quero que o extrato impresso mostre a sobra ou quebra apurada no Fechamento de Caixa com Conferência, para que a divergência fique registrada em papel no dia em que ocorreu.
5. Como gestor, quero imprimir o extrato em largura de bobina térmica, para que eu use a impressora que já está na recepção em vez de depender de folha A4.
6. Como gestor, quero imprimir o extrato de uma Sessão de Caixa que passou por ajuste posterior, para que o papel reflita o valor ajustado e não o original.
7. Como gestor, quero ver no extrato as gorjetas do turno, para que eu saiba quanto da gaveta não é da casa.
8. Como recepcionista, quero informar de quem é a gorjeta ao fechar uma Comanda com mais de um profissional, para que o valor chegue a quem o cliente quis agradar.
9. Como recepcionista, quero que a gorjeta seja atribuída automaticamente quando a Comanda tem um único profissional, para que eu não responda uma pergunta cuja resposta é óbvia.
10. Como gestor, quero que a gorjeta cobrada do cliente vire crédito na Conta do Profissional ao fechar a Comanda, para que o repasse deixe de depender da minha memória.
11. Como gestor, quero que a gorjeta continue sem gerar comissão, para que o percentual do profissional siga incidindo apenas sobre o serviço prestado.
12. Como gestor, quero que reabrir uma Comanda estorne o crédito de gorjeta, para que uma correção de comanda não pague gorjeta duas vezes.
13. Como gestor, quero lançar um vale para um profissional, para que o adiantamento fique registrado como dívida dele em vez de virar prejuízo da casa.
14. Como gestor, quero lançar o vale informando a forma de pagamento, para que um vale pago em PIX não seja confundido com uma saída da gaveta.
15. Como gestor, quero que um vale pago em dinheiro gere a saída correspondente na Sessão de Caixa, para que o Fechamento de Caixa com Conferência bata com a gaveta física.
16. Como gestor, quero ser impedido de lançar vale em dinheiro acima do saldo disponível na gaveta do turno, para que o fechamento não fique impossível de concluir.
17. Como gestor, quero que o vale exija um motivo escrito, para que o extrato do profissional seja legível meses depois.
18. Como gestor, quero estornar um vale lançado por engano informando a razão, para que a correção fique auditável em vez de apagar o histórico.
19. Como gestor, quero ver na tela de Quitação de Comissão o líquido sugerido — comissão mais gorjetas menos vales —, para que eu pague o valor certo sem calcular à mão.
20. Como gestor, quero poder ignorar a sugestão de abate e pagar outro valor, para que eu mantenha a decisão de quando cobrar o vale.
21. Como gestor, quero que o abate parcial consuma os vales mais antigos primeiro, para que a dívida seja quitada na ordem em que foi assumida.
22. Como gestor, quero que os lançamentos abatidos numa quitação fiquem vinculados a ela, para que eu reconstrua depois qual pagamento cobriu qual vale.
23. Como gestor, quero que estornar uma Quitação de Comissão devolva os vales e gorjetas ao estado aberto, para que o estorno não deixe dívida ou crédito perdidos.
24. Como gestor, quero ver o saldo da Conta do Profissional junto do saldo de comissão, para que eu enxergue a posição completa da equipe numa tela.
25. Como gestor, quero ver o extrato completo de um profissional com vales, gorjetas e quitações em ordem cronológica, para que eu responda a qualquer contestação com dado.
26. Como profissional, quero ver os meus vales em aberto, para que eu saiba quanto será descontado do meu próximo repasse.
27. Como profissional, quero ver as gorjetas que me foram atribuídas, para que eu confirme que o que o cliente deixou chegou até mim.
28. Como profissional, quero não ver a conta dos meus colegas, para que a informação financeira de cada um continue privada.
29. Como proprietário, quero que toda operação na Conta do Profissional registre quem a fez e quando, para que o financeiro da equipe seja auditável.
30. Como gestor, quero que gorjetas de Comandas antigas, fechadas antes desta mudança, apareçam identificadas como sem atribuição, para que eu entenda o histórico sem que o sistema invente uma dívida nova com a equipe.

## Implementation Decisions

### Escopo em três entregas sequenciais

A ordem é deliberada, da menor para a maior superfície de risco:

1. **Extrato de Sessão de Caixa** — consumo puro de contrato existente, nenhuma escrita.
2. **Gorjeta como crédito** — atribuição na Comanda e trigger próprio, sem tocar gaveta.
3. **Vale como débito e abate na quitação** — única entrega que altera as fórmulas de saldo da gaveta, e por isso chega com o resto estável.

### Entrega 1 — Extrato de Sessão de Caixa

O contrato de leitura do extrato do turno **já existe** no banco, com privilégios corretos, e não é consumido por nenhuma superfície. A entrega é de interface: uma visão imprimível acionada da aba de Caixa Diário & Turnos do Hub Financeiro, com folha de estilo de impressão em largura de bobina térmica. Nenhuma alteração de schema, nenhuma RPC nova.

A visão lê o estado efetivo da sessão, o que significa que uma sessão com ajuste posterior imprime os valores ajustados — o contrato existente já expõe a contagem de ajustes e o estado financeiro da sessão.

A linha de gorjetas do turno (história 7) **não** faz parte desta entrega: o contrato atual agrega pagamentos por forma, e gorjeta não é forma de pagamento. Ela entra na Entrega 2, junto com a única alteração que o contrato de extrato recebe nesta spec.

### Entrega 2 — Gorjeta como crédito na Conta do Profissional

**A gorjeta não passa pelo motor de comissão.** A ADR 018 decidiu que gorjeta não gera comissão e determinou que qualquer mudança no repasse fosse decisão registrada, não ajuste incidental na função de liquidação. Esta spec respeita as duas coisas: a gorjeta se torna crédito na Conta do Profissional, as obrigações de comissão e os snapshots de comissão ficam intocados, e uma **ADR 019** registra o repasse de gorjeta como decisão distinta de comissionar gorjeta.

A Comanda passa a guardar a atribuição da gorjeta (qual profissional a recebe). A atribuição é persistida, não resolvida na interface: sem isso, reabrir a Comanda perderia de quem era a gorjeta e o estorno não saberia qual crédito reverter. A interface pede a escolha apenas quando a Comanda tem mais de um profissional; com um só, resolve sozinha.

O crédito nasce de um **trigger próprio** sobre a Comanda ao assumir o estado fechada, separado do trigger que cria obrigações de comissão. A separação é o que mantém a decisão da ADR 018 válida: a função de liquidação de comissão não é alterada.

Um índice único parcial impede crédito de gorjeta duplicado por Comanda, ignorando lançamentos já estornados — assim reabrir e fechar de novo gera o crédito correto sem colidir com o antigo.

Comandas fechadas antes desta entrega não recebem backfill. A atribuição vale para Comandas novas; o histórico é apresentado como gorjeta sem atribuição, dado factual em vez de dívida retroativa inventada com a equipe.

O contrato de extrato da Sessão de Caixa ganha uma linha de gorjetas do turno, discriminando o atribuído do não atribuído. É a única alteração de contrato de leitura do caixa nesta spec, e por isso a única que exige estender a cobertura de teste do extrato.

### Entrega 3 — Vale como débito e abate na Quitação de Comissão

**Tabela própria, não reuso da tabela de obrigações de comissão.** As obrigações exigem vínculo obrigatório com Comanda e valor estritamente positivo — duas guardas endurecidas de propósito. Um vale não nasce de Comanda e é dedução. Acomodá-lo ali exigiria afrouxar as duas.

A Conta do Profissional é uma tabela de lançamentos com **duas colunas discriminadoras**:

```
entry_type  -- 'vale' | 'gorjeta'   (semântica do lançamento)
direction   -- 'debit' | 'credit'   (aritmética do saldo)
```

Guardar a direção separada do tipo é decisão explícita, tirada de um defeito encontrado no schema atual: todas as fórmulas de saldo de gaveta filtram por tipo de movimento nominalmente, o que faz cada tipo novo exigir a edição de várias fórmulas sob pena de erro silencioso de saldo. Com a direção materializada, somar créditos e subtrair débitos permanece correto quando um terceiro tipo de lançamento aparecer.

A tabela espelha a forma das obrigações de comissão no que importa: valor positivo, valor já liquidado limitado ao valor total, estado do lançamento, motivo obrigatório com tamanho mínimo e trilha de estorno com autor e razão. Valor monetário em precisão fixa de duas casas, alinhado ao tipo usado nos movimentos de caixa, porque o vale conversa com a gaveta, onde o centavo tem de fechar na conferência física.

Um vale pago em dinheiro gera o movimento de caixa correspondente, e o vínculo é bidirecional — o movimento aponta o profissional, o lançamento aponta o movimento — com índice único parcial garantindo que dois vales não reivindiquem a mesma saída de gaveta. O lançamento reusa a validação de saldo disponível na gaveta já existente na quitação em dinheiro.

**Correção obrigatória de propagação de tipo.** As fórmulas de saldo e de valor esperado da gaveta filtram movimentos por tipo de forma nominal e explícita. O tipo novo de movimento para vale não está em nenhuma delas, o que faria um vale em dinheiro sair da gaveta sem ser subtraído — superestimando o saldo disponível e o valor esperado no fechamento, reproduzindo exatamente o defeito que a spec 033 corrigiu ao validar saldo de gaveta na quitação. Todas as funções vivas que apuram saldo ou valor esperado da gaveta devem passar a considerar o tipo novo. Este é o item de maior risco da spec.

**Contrato da quitação.** A Quitação de Comissão passa a receber dois valores adicionais: o total de débitos a abater e o total de créditos a pagar, ambos consumidos em ordem cronológica crescente do lançamento. A escolha por valor, em vez de lista de lançamentos, espelha como o motor já liquida obrigações e expressa abate parcial naturalmente; a rastreabilidade fica numa tabela de rateio entre quitação e lançamento, espelhando o rateio que já existe entre quitação e obrigação.

Acrescentar parâmetro cria assinatura nova, não altera a existente. A migração que estende **derruba a assinatura anterior na mesma transação** e refaz a revogação de acesso público e anônimo mais a concessão explícita aos papéis autenticado e de serviço. O repositório já pagou o preço de um overload legado vivo uma vez; não repetir.

**Ordem de lock fixa.** O abate faz a mesma transação travar linhas em duas tabelas. A ordem é regra de projeto documentada — obrigações de comissão sempre antes de lançamentos da Conta do Profissional, ambas em ordem cronológica crescente — para que duas quitações concorrentes não se travem mutuamente.

O estorno de Quitação de Comissão devolve lançamentos abatidos ao estado aberto, do mesmo modo que já devolve obrigações.

### Leitura de saldo e extrato do profissional

Já existe contrato de leitura do saldo de comissão por profissional. Ele é **estendido**, não
substituído, para devolver também o saldo da Conta do Profissional discriminado em crédito e
débito, além do líquido sugerido. Estender evita que a tela de Quitação de Comissão precise
compor duas fontes e divergir da conta que a própria quitação vai fazer — o líquido exibido e o
líquido liquidado passam a vir da mesma origem.

O extrato cronológico do profissional é contrato de leitura novo, devolvendo vales, gorjetas e
quitações numa sequência única, e é o mesmo contrato que serve o gestor e o próprio
profissional — a diferença entre os dois é resolvida pelas políticas de acesso, não por duas
implementações.

### Acesso

Escrita na Conta do Profissional é exclusiva dos papéis de gestão, seguindo o padrão de papéis financeiros já vigente, com as chamadas de contexto de autenticação envolvidas em subconsulta para avaliação única por consulta em vez de por linha.

Leitura ganha uma exceção: o profissional lê os próprios lançamentos e apenas os próprios, por predicado de propriedade combinado ao papel. Um vale que o profissional assina e não pode consultar é problema de confiança, não de permissão. Toda política de atualização declara verificação de escrita além da de leitura, para que um lançamento não possa ser reatribuído a outro profissional.

### Fora de alteração

Nenhuma forma de pagamento nova é introduzida. A tabela de obrigações de comissão, os snapshots de comissão e a base de cálculo da comissão não são alterados.

## Testing Decisions

Um bom teste aqui verifica **comportamento externo observável**: saldo apurado, valor esperado no fechamento, o que uma quitação liquidou, o que um papel consegue ler. Nenhum teste deve afirmar sobre estrutura interna de função, nome de variável ou ordem de execução — só sobre o resultado que o gestor, o profissional ou a próxima transação enxergam.

Nenhuma seam nova é criada. Os testes entram nas seams que já existem.

**Seam primária — testes de banco (pgTAP, executados por `supabase test db`).** É a seam mais alta em que os invariantes de dinheiro efetivamente vivem, e onde está toda a arte prévia relevante: `10_obrigacoes_comissao`, `11_quitacoes_obrigacoes`, `19_quitacao_comissao_gaveta_caixa`, `21_estorno_quitacao_comissao` e `25_validar_saldo_gaveta_quitacao_comissao`.

Dois arquivos novos:

- Conta do Profissional — lançamento de vale e de gorjeta, motivo obrigatório, estorno auditável, crédito de gorjeta não duplicado ao reabrir e fechar Comanda de novo, leitura do profissional restrita à própria conta, vale em dinheiro recusado acima do saldo da gaveta.
- Quitação com Conta do Profissional — líquido sugerido, abate parcial consumindo o lançamento mais antigo primeiro, rateio registrado, estorno devolvendo lançamentos ao estado aberto, ordem de lock sob concorrência, e igualdade entre líquido sugerido e líquido liquidado na fronteira de arredondamento entre os dois tipos monetários.

**Regressão da propagação de tipo: estende arquivos existentes, não cria novos.** A prova de que o vale em dinheiro é subtraído da gaveta pertence ao lado das provas de que o repasse de comissão é — ou seja, dentro de `07_fechar_caixa_atomicamente` e `25_validar_saldo_gaveta_quitacao_comissao`. Incluir ali garante que a suíte falhe se alguém adicionar um tipo de movimento futuro sem tratar a aritmética.

**Seam secundária — repositório (vitest).** Os módulos de Comissões e de Caixa e seus adaptadores Supabase ganham cobertura do contrato novo, seguindo os testes de repositório e de adaptador que já existem para ambos.

**Interface.** A atribuição de gorjeta é coberta através do teste do modal de checkout de Comanda que já existe, e o extrato imprimível através do teste da página do Hub Financeiro. O bloco de atribuição de gorjeta é extraído em componente próprio por legibilidade — o modal de checkout já passa de três mil e setecentas linhas, e é onde entra um seletor condicional —, mas a extração não cria arquivo de teste próprio: a cobertura continua pela seam de cima.

O extrato de Sessão de Caixa não recebe arquivo de teste novo: o contrato de leitura já é coberto por `22_extrato_sessao_caixa`, e o que a Entrega 1 adiciona é consumo. A linha de gorjetas do turno introduzida na Entrega 2 e a extensão do contrato de saldo do profissional entram como casos dentro dos arquivos que já cobrem esses contratos — `22_extrato_sessao_caixa` e a cobertura existente de saldo de comissão.

## Out of Scope

- **Plano de contas, classificação contábil e DRE.** Categorias hierárquicas de despesa e receita, demonstrativo de resultado e margem operacional são trabalho contábil, decidido fora deste ciclo.
- **Contas a pagar e a receber.** Títulos com vencimento, baixa individual ou em lote, lançamento recorrente e parcelado.
- **Subcontas e contas bancárias**, e transferência interna entre elas.
- **Fornecedores.**
- **Conta do Cliente (fiado).** Crédito e débito por cliente e quitação de dívida. Excluído deliberadamente: manter o fiado fora evita introduzir forma de pagamento nova, o que pouparia alterar o conjunto de formas aceitas replicado em várias funções, a restrição da tabela de pagamentos, o tipo de forma de pagamento na interface e a apuração de recebido da sessão — que somaria o fiado como dinheiro recebido sem que ele tenha entrado.
- **Regime de dedução de taxa de adquirente** (bruto, dividido ou integralmente descontado do profissional). Altera a base de cálculo da comissão e pertence à spec própria de meios de pagamento que a ADR 018 já previu.
- **Anexos de comprovante** em lançamentos financeiros.
- **Nota fiscal de serviço sobre repasse.**
- **Comissão sobre pacotes e clubes de assinatura** — o produto não tem pacotes.
- **Recálculo em lote de comissões** — o modelo é por obrigação individual, não recalculável em massa.
- **Backfill de gorjetas históricas.** Comandas já fechadas com gorjeta não geram crédito retroativo.

## Further Notes

**Origem.** Esta spec nasceu do mapeamento do módulo financeiro do AppBarber documentado em `docs/scraping_appbarber_financeiro.md`. Das oito seções mapeadas, a maior parte já tem equivalente construído nas specs 027 a 033; o que se extraiu aqui foi o que falta e o que independe de estrutura contábil.

**Convergência com o sistema de referência.** Duas decisões desta spec coincidem com escolhas do AppBarber, e a coincidência é evidência de que são o caminho natural e não preferência: gorjeta é lançada por contrato separado do de comissão, e vale tem destino declarado entre gaveta e financeiro em vez de ser inferido.

**Regras que o sistema de referência resolveu e ainda não precisamos.** Duas armadilhas contábeis ficam registradas para quando as contas a pagar e a receber entrarem: reentrada de sangria no financeiro não pode contar como receita nova, sob pena de duplicidade; e retirada de sócio sai do saldo da conta mas é expurgada do resultado operacional.

**Dívida aceita.** A precisão do tipo monetário permanece divergente entre a tabela de obrigações de comissão, sem precisão declarada, e os movimentos de caixa, com duas casas fixas. Esta spec não uniformiza — a tabela de comissão está estável e fora do pedido — mas trata a fronteira com arredondamento explícito a duas casas no cálculo do líquido, e cobre essa fronteira com teste. Uniformizar é candidato a spec de higiene futura.
