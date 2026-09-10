# Snapshots e histórico financeiro confiável

**Status:** in-progress — Ticket 08 implementado e validado; Tickets 09–16 pendentes
**Ordem:** 3 de 3
**Ambiente inicial:** Supabase DEV
**Dependências:** Specs 030 e 031 concluídas e validadas

## Problem Statement

Os indicadores financeiros atuais reconstroem parte do passado usando configurações presentes. Comissão e custo de produto podem mudar depois que uma comanda foi fechada, fazendo uma consulta histórica apresentar valores diferentes daqueles vigentes no momento da venda.

O saldo pendente de comissão também pode variar conforme o período selecionado, pois geração e quitação são filtradas pelo intervalo da consulta em vez de compor um livro de obrigações e pagamentos. Descontos, gorjetas e rateios não possuem uma base histórica explícita por item. No caixa, o valor esperado e a diferença conferida não ficam preservados como fotografia definitiva do fechamento.

O sistema precisa produzir histórico financeiro reproduzível: uma operação fechada deve continuar mostrando os mesmos valores econômicos mesmo que preços, custos, percentuais ou configurações sejam alterados no futuro.

## Solution

Persistir snapshots financeiros no momento em que a operação se torna efetiva:

- preço bruto, desconto alocado, valor líquido, custo e comissão por item de comanda;
- totais consolidados da comanda e referências às regras usadas;
- obrigação de comissão gerada e quitações aplicadas, sem depender do filtro visual;
- valor esperado, valor contado e diferença da sessão de caixa no fechamento;
- regras explícitas para reabertura, estorno e correção auditável;
- métricas financeiras que leiam snapshots fechados em vez de recalcular o passado com configurações atuais.

A mudança será introduzida de forma compatível, com preenchimento histórico conservador e sem inventar precisão que os dados antigos não conseguem provar.

## User Stories

1. Como gerente, quero que uma comanda fechada mantenha os valores originais, para que o passado não mude quando eu editar cadastros.
2. Como gerente, quero ver o preço unitário praticado em cada item, para auditar a venda real.
3. Como gerente, quero ver o desconto aplicado e sua alocação, para entender o valor líquido por item.
4. Como gerente, quero que gorjetas sejam separadas da receita de serviços e produtos, para evitar distorção dos indicadores.
5. Como gerente, quero que o custo do produto vendido seja preservado no fechamento, para calcular o CMV histórico correto.
6. Como gerente, quero que a comissão use o percentual vigente no atendimento, para não mudar quando o cadastro do profissional for atualizado.
7. Como profissional, quero que meu extrato mostre a comissão gerada por atendimento, para conferir os repasses.
8. Como profissional, quero que pagamentos parciais reduzam meu saldo acumulado, para acompanhar o valor realmente pendente.
9. Como gerente, quero consultar o saldo pendente total independentemente do período visual, para não ocultar dívida antiga.
10. Como gerente, quero filtrar geração e pagamentos por período sem redefinir o saldo contábil, para analisar movimento sem perder a posição atual.
11. Como gerente, quero que uma quitação identifique quais obrigações foram liquidadas, para auditar pagamentos parciais.
12. Como gerente, quero impedir quitação acima do saldo aberto, para não criar crédito negativo indevido.
13. Como gerente, quero que reabertura ou estorno reverta os lançamentos relacionados de forma rastreável, para manter o livro financeiro coerente.
14. Como gerente, quero que um fechamento de caixa preserve valor esperado, contado e diferença, para consultar a conferência original.
15. Como gerente, quero que alterações posteriores em pagamentos não reescrevam silenciosamente um caixa fechado.
16. Como proprietário, quero comparar receita, CMV, comissões e resultado líquido por período, para tomar decisões com dados reproduzíveis.
17. Como proprietário, quero distinguir dados históricos calculados com precisão de dados antigos estimados, para não interpretar estimativa como fato.
18. Como auditor, quero identificar a regra e a origem de cada valor consolidado, para explicar divergências.
19. Como auditor, quero que correções preservem o valor anterior e o motivo, para manter trilha de auditoria.
20. Como usuário de um tenant, quero acessar somente snapshots e lançamentos da minha barbearia, para preservar isolamento.
21. Como usuário inativo ou sem papel financeiro, quero ter o acesso sensível bloqueado no servidor.
22. Como responsável técnico, quero que métricas antigas continuem disponíveis durante a transição, para comparar resultados antes da troca.
23. Como responsável técnico, quero preencher dados históricos de forma determinística e idempotente, para poder validar e repetir o processo no DEV.
24. Como responsável técnico, quero não alterar registros históricos quando não houver informação suficiente, para evitar fabricar números.
25. Como responsável técnico, quero migrations novas e versionadas, para manter rastreabilidade.
26. Como responsável técnico, quero medir consultas e criar somente índices necessários, para evitar custo sem benefício.
27. Como responsável técnico, quero validar tudo no DEV pelo MCP antes de qualquer promoção, para proteger produção.
28. Como operador, quero que as telas atuais continuem funcionando enquanto os snapshots passam a ser usados internamente.

## Implementation Decisions

### Momento e natureza do snapshot

- O snapshot será criado dentro da transação de finalização definida na Spec 031.
- Valores monetários serão armazenados com precisão decimal adequada e regras de arredondamento explícitas.
- Cada item fechado preservará quantidade, preço unitário, valor bruto, desconto alocado, valor líquido, custo unitário e total, percentual de comissão e valor de comissão.
- Campos não aplicáveis serão representados de forma inequívoca; zero e ausência não serão usados como sinônimos.
- A soma dos snapshots de item deverá reconciliar com os totais consolidados da comanda segundo uma regra determinística de centavos residuais.
- Alterações futuras em serviços, produtos, profissionais ou configurações não atualizarão snapshots já fechados.

### Descontos, gorjetas, custo e comissão

- O desconto da comanda será alocado entre itens por regra proporcional e determinística, com o resíduo atribuído de forma estável.
- Gorjetas serão registradas separadamente de receita, custo e comissão, salvo regra comercial explicitamente configurada no futuro.
- O custo de produto será capturado do cadastro vigente no instante do fechamento; serviço não terá CMV de produto.
- A base de comissão será definida explicitamente entre valor bruto e líquido antes da implementação e aplicada igualmente no snapshot, extrato e métrica.
- Quando um item não tiver profissional elegível, nenhuma comissão será inventada.
- Mudanças de regra terão versão ou identificador suficiente para explicar qual política produziu o snapshot.

### Livro de comissões

- Comissão gerada será tratada como obrigação financeira vinculada à comanda e aos itens que a originaram.
- Quitações serão lançamentos separados e imutáveis, aplicados ao saldo aberto de forma transacional.
- O saldo pendente será a posição acumulada das obrigações válidas menos quitações e estornos válidos, não uma subtração limitada ao mesmo período do filtro.
- O filtro de período distinguirá posição de saldo, geração no período e pagamentos no período.
- Reabertura ou cancelamento produzirá estorno referenciado; não apagará silenciosamente uma obrigação já auditável.
- Pagamentos parciais poderão ser associados a uma ou mais obrigações por regra determinística, preferencialmente das mais antigas para as mais novas dentro do tenant e profissional.

### Snapshot de caixa

- O fechamento transacional persistirá o valor esperado, valor contado, diferença, componentes do cálculo e versão da regra.
- Sessões fechadas não serão recalculadas automaticamente quando comandas ou pagamentos forem corrigidos depois.
- Uma correção posterior produzirá evento ou ajuste auditável e não sobrescreverá a fotografia original.
- O histórico distinguirá caixa aberto, caixa fechado e caixa fechado com ajuste posterior.

### Dados históricos e backfill

- Antes da migration, o MCP do Supabase será usado para inventariar volumes, nulidade, combinações históricas e capacidade real de reconstrução no DEV.
- O backfill será idempotente, limitado por tenant e executado em lotes se o volume justificar.
- Dados que possam ser reconstruídos de forma inequívoca receberão snapshot confirmado.
- Dados sem fonte histórica suficiente serão marcados como estimados ou indisponíveis; valores atuais não serão apresentados como se fossem necessariamente históricos.
- A aplicação continuará conseguindo ler registros antigos durante a transição.
- Restrições obrigatórias serão adicionadas somente depois de preencher e validar os registros elegíveis.

### Métricas e consultas

- Métricas de períodos fechados passarão a usar snapshots e lançamentos, evitando joins com configurações atuais para recalcular fatos históricos.
- Receita, recebimento, CMV, comissão gerada, comissão paga, saldo pendente e resultado líquido terão definições independentes e documentadas.
- Consultas sempre restringirão por tenant e intervalo sargable quando houver filtro temporal.
- Índices serão definidos a partir das consultas finais e de planos de execução no DEV; advisors isolados não serão justificativa suficiente.
- O contrato retornado ao frontend será mantido ou evoluído de forma compatível durante a migração.

### Segurança, migrations e rollout

- Snapshots e lançamentos herdarão isolamento por tenant e políticas por usuário ativo e papel autorizado.
- Escritas ocorrerão somente pelas funções transacionais apropriadas; acesso direto será mínimo.
- Toda mudança será uma migration nova criada na sequência vigente, sem editar migrations históricas.
- DDL, backfill e validações serão executados primeiro no DEV pelo MCP do Supabase.
- A migração será dividida em etapas expandir, preencher, validar e somente depois contrair, evitando indisponibilidade e quebra de versões antigas da aplicação.
- Produção não será alterada por esta spec sem revisão separada das evidências do DEV.

## Testing Decisions

Um bom teste provará que o mesmo fato fechado mantém o mesmo resultado após mudanças cadastrais. O seam principal será a consulta financeira usada pelo módulo Financeiro; os comandos de finalização, reabertura e quitação serão exercitados como responsáveis pela escrita dos snapshots e lançamentos.

### Cenários obrigatórios

1. Fechamento cria snapshots reconciliados com o total da comanda.
2. Alterar preço do serviço depois do fechamento não muda a receita histórica.
3. Alterar custo do produto depois do fechamento não muda o CMV histórico.
4. Alterar percentual do profissional depois do fechamento não muda a comissão gerada.
5. Desconto é alocado deterministicamente e a soma dos itens fecha em centavos com o total.
6. Gorjeta permanece separada da receita operacional e da comissão conforme a regra definida.
7. Item sem profissional não gera comissão indevida.
8. Pagamento parcial reduz o saldo e mantém o restante aberto.
9. Pagamento total zera exatamente o saldo aplicável.
10. Duas quitações concorrentes não ultrapassam o saldo.
11. Saldo pendente inclui obrigações anteriores ao período filtrado.
12. Métrica distingue saldo atual, geração no período e pagamentos no período.
13. Reabertura cria estorno vinculado e restaura a posição sem apagar a trilha.
14. Repetição de reabertura ou estorno não duplica lançamentos.
15. Caixa fechado mantém valor esperado e diferença após alteração posterior de cadastro.
16. Correção posterior aparece como ajuste separado sem sobrescrever o fechamento original.
17. Usuário de outro tenant não lê nem escreve snapshots ou lançamentos.
18. Usuário inativo ou sem papel autorizado é rejeitado.
19. Backfill pode ser executado novamente sem duplicar ou alterar resultados confirmados.
20. Registro histórico ambíguo é marcado como estimado ou indisponível, nunca silenciosamente confirmado.
21. Registros antigos e novos coexistem durante a etapa de expansão.
22. A consulta nova reconcilia com uma amostra validada manualmente no DEV.
23. Planos de execução das consultas principais permanecem adequados ao volume esperado.
24. As suítes atuais de Financeiro, Caixa, Comandas, Produtos e Comissões permanecem verdes.
25. Comparação antes e depois documenta diferenças esperadas e identifica qualquer regressão não planejada.

## Out of Scope

- Contabilidade fiscal, plano de contas completo ou DRE contábil oficial.
- Emissão de notas fiscais.
- Conciliação automática com bancos, PIX ou adquirentes.
- Folha de pagamento e encargos trabalhistas.
- Definir novas regras comerciais de comissão sem decisão específica do produto.
- Reescrever silenciosamente o histórico quando a origem não puder ser comprovada.
- Redesenhar o módulo Financeiro.
- Alterar produção, executar deploy ou promover migrations nesta etapa de especificação.

## Further Notes

- O DEV auditado possui poucas comandas fechadas, nenhum produto e nenhum pagamento de comissão, o que facilita validar o modelo, mas não substitui testes com cenários sintéticos completos.
- A implementação deve criar dados de teste controlados no DEV e removê-los apenas por procedimento seguro e explicitamente validado.
- A Spec 031 fornece a fronteira transacional correta para capturar snapshots. Implementar esta spec antes dela criaria múltiplas fontes de verdade.
- A definição final da base de comissão é uma decisão de produto que deverá ser confirmada a partir do comportamento atual antes de codificar; até lá, o requisito é preservar e tornar explícita a regra vigente.
- Esta publicação cria somente a especificação local. Nenhum código, banco, migration, dado, commit, push ou deploy é alterado.
