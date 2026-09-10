# Atomicidade operacional de comandas e caixa

**Status:** in-progress
**Ordem:** 2 de 3
**Ambiente inicial:** Supabase DEV
**Dependências:** Spec 030 concluída e validada

## Problem Statement

Finalizar ou reabrir uma comanda e fechar uma sessão de caixa são operações financeiras únicas para o usuário, mas hoje parte desses fluxos é executada em várias chamadas independentes pela aplicação.

Na finalização da comanda, pagamentos são registrados, produtos são baixados, a comanda é fechada e o agendamento é atualizado em etapas. Na reabertura, estoque, pagamentos, comanda e agendamento também são revertidos separadamente. Uma falha intermediária, repetição de clique, perda de conexão ou concorrência pode deixar pagamentos sem fechamento, estoque baixado com comanda aberta ou agendamento divergente.

O fechamento do caixa é realizado por atualização direta e não preserva uma fotografia confiável do valor esperado no instante da conferência. Isso reduz a capacidade de distinguir erro operacional de alteração posterior nos dados.

O sistema precisa executar cada intenção do usuário como uma transação indivisível, preservando a experiência e os contratos que já funcionam.

## Solution

Introduzir comandos transacionais no banco para:

- finalizar uma comanda com seus pagamentos, baixas de estoque e vínculo com agendamento;
- reabrir uma comanda com estorno dos efeitos controlados pelo fechamento;
- fechar uma sessão de caixa com cálculo e persistência do resumo esperado no mesmo instante;
- rejeitar repetição, concorrência e estados inválidos de forma previsível;
- manter os repositórios atuais como seam da aplicação, substituindo internamente chamadas encadeadas por um único comando remoto.

As telas continuarão apresentando os mesmos passos e resultados. A mudança será de consistência e segurança operacional, não de redesign.

## User Stories

1. Como gerente, quero finalizar uma comanda em uma única operação, para não deixar dados parciais se a conexão falhar.
2. Como gerente, quero registrar um ou vários pagamentos ao finalizar, para preservar pagamentos divididos.
3. Como gerente, quero que a soma dos pagamentos seja validada contra o total da comanda, para evitar liquidação inconsistente.
4. Como gerente, quero que produtos vendidos sejam baixados junto com o fechamento, para manter estoque e financeiro sincronizados.
5. Como gerente, quero que serviços sem produto não criem movimento de estoque, para preservar o domínio correto.
6. Como gerente, quero que o agendamento relacionado seja atualizado junto com a comanda, para manter Agenda e Comandas coerentes.
7. Como gerente, quero que qualquer falha reverta toda a finalização, para poder tentar novamente com segurança.
8. Como gerente, quero que dois cliques de finalizar não dupliquem pagamentos nem baixas de estoque.
9. Como gerente, quero receber o estado final já confirmado pelo servidor, para atualizar a tela com dados confiáveis.
10. Como gerente, quero reabrir uma comanda fechada em uma única operação, para desfazer corretamente seus efeitos.
11. Como gerente, quero que a reabertura restaure somente o estoque baixado por aquela finalização, para não alterar movimentos independentes.
12. Como gerente, quero que pagamentos ligados à finalização sejam estornados de modo rastreável, para preservar a auditoria.
13. Como gerente, quero que o agendamento retorne ao estado operacional correspondente, para manter a Agenda consistente.
14. Como gerente, quero que uma falha na reabertura não deixe a comanda parcialmente reaberta.
15. Como gerente, quero que uma comanda já reaberta não seja reaberta novamente, para evitar estornos duplicados.
16. Como gerente, quero fechar o caixa informando o valor contado, para registrar a conferência física.
17. Como gerente, quero que o sistema calcule o valor esperado no mesmo instante do fechamento, para evitar divergência por leituras em momentos diferentes.
18. Como gerente, quero ver sobra ou quebra registrada no fechamento, para acompanhar diferenças de caixa.
19. Como gerente, quero que apenas uma sessão aberta possa ser fechada, para impedir alterações em turnos encerrados.
20. Como gerente, quero que dois operadores não consigam fechar a mesma sessão duas vezes.
21. Como usuário de outro tenant, quero ser impedido de operar a comanda ou o caixa, para preservar isolamento.
22. Como usuário inativo ou sem papel autorizado, quero ter o comando rejeitado, para manter a segurança no servidor.
23. Como operador, quero mensagens de erro claras para estado inválido, conflito e validação, para saber se devo corrigir dados ou recarregar.
24. Como responsável técnico, quero manter as interfaces dos repositórios usadas pelas telas, para reduzir a superfície de mudança.
25. Como responsável técnico, quero executar a migração primeiro no DEV pelo MCP, para validar o estado real antes de promoção.
26. Como responsável técnico, quero que os fluxos antigos permaneçam testados durante a transição, para evitar perda silenciosa de comportamento.
27. Como auditor, quero identificar quem executou e quando executou cada fechamento ou reabertura, para rastrear operações financeiras.
28. Como auditor, quero distinguir uma repetição segura de uma operação nova, para investigar eventos sem duplicidade.

## Implementation Decisions

### Limites transacionais

- Cada intenção de negócio terá um único comando remoto e uma única transação de banco.
- O comando de finalizar será responsável por validar estado, pagamentos, itens, estoque, tenant e autorização antes de produzir qualquer efeito persistente.
- O comando de reabrir será responsável por localizar e reverter somente os efeitos pertencentes ao fechamento daquela comanda.
- O comando de fechar caixa calculará recebimentos e movimentos elegíveis e persistirá os valores de conferência antes de marcar a sessão como fechada.
- Uma falha em qualquer etapa causará rollback integral.

### Compatibilidade com a aplicação

- Os repositórios de Comandas e Caixa continuarão sendo o seam principal para componentes e páginas.
- As assinaturas externas serão preservadas sempre que representarem corretamente o comando. Novos campos obrigatórios só serão introduzidos quando necessários para evitar ambiguidade ou concorrência.
- A interface não executará novamente efeitos que passarem a pertencer à transação do banco.
- Recarregamentos e notificações continuarão acontecendo após a confirmação do comando, não entre suas etapas internas.
- Mensagens de erro serão mapeadas para categorias estáveis: validação, autorização, conflito de estado e falha inesperada.

### Concorrência e idempotência

- As linhas centrais da comanda, produtos afetados e sessão de caixa serão bloqueadas na ordem determinística necessária durante a transação.
- O estado esperado será verificado dentro da transação, e não somente antes da chamada.
- Repetições do mesmo comando não poderão duplicar pagamentos, movimentos ou encerramentos.
- Se for necessário um identificador de operação, ele será persistido com unicidade no tenant e retornará o resultado já produzido para uma repetição legítima.
- Restrições de unicidade e integridade serão preferidas a verificações exclusivamente na aplicação.

### Finalização da comanda

- A comanda deverá estar aberta e pertencer ao tenant autorizado.
- Itens e pagamentos deverão ter valores válidos; a regra vigente de total, desconto e troco será caracterizada antes da implementação.
- Cada item de produto produzirá exatamente um efeito de estoque identificável e reversível.
- O fechamento gravará responsável e instante fornecidos pelo servidor.
- O agendamento associado será atualizado somente quando existir e quando a transição atual permitir.

### Reabertura da comanda

- A comanda deverá estar fechada e elegível para reabertura pelas regras atuais.
- O estorno de estoque deverá referenciar os movimentos originados no fechamento, evitando inferência apenas pela quantidade atual dos itens.
- Pagamentos serão estornados ou removidos conforme a decisão de auditoria já vigente; a implementação não poderá apagar evidência financeira sem justificativa explícita.
- A reabertura será bloqueada quando efeitos posteriores tornarem o estorno inseguro, com erro claro ao operador.
- O vínculo com o agendamento será revertido sem afetar agendamentos de outro tenant ou outra comanda.

### Fechamento de caixa

- A sessão deverá estar aberta, pertencer ao tenant e ser fechada por usuário ativo autorizado.
- O valor esperado incluirá o fundo inicial, recebimentos em dinheiro e movimentos de caixa reconhecidos pelo contrato vigente.
- PIX, cartões e outros meios não serão somados à gaveta física, embora permaneçam no resumo financeiro.
- O fechamento persistirá ao menos valor esperado, valor contado e diferença, além de responsável e instante.
- Uma sessão fechada será imutável pelo fluxo normal; correções posteriores exigirão operação auditável específica fora desta spec.

### Supabase, migrations e rollout

- O estado de tabelas, funções, grants, policies e dados do DEV será consultado novamente pelo MCP antes de definir a migration.
- Toda alteração será criada em migration nova e versionada; nenhuma migration existente será editada.
- Funções com privilégio elevado terão `search_path` fixo, schemas qualificados, autorização explícita e grants mínimos.
- A implantação ocorrerá primeiro no DEV por MCP, seguida de testes de banco, testes da aplicação e simulação de falhas.
- A transição poderá manter o caminho anterior apenas durante testes controlados; não haverá dois caminhos de escrita ativos indefinidamente.
- Produção ficará fora de escopo até aprovação das evidências do DEV.

## Testing Decisions

Os testes verificarão estados antes e depois dos comandos e provarão ausência de efeitos parciais. O seam mais alto será o repositório usado pelas telas; o seam de persistência serão as funções remotas exercitadas com pgTAP e papéis reais.

### Cenários obrigatórios

1. Finalização simples fecha a comanda, registra o pagamento e atualiza o agendamento.
2. Pagamento dividido registra cada parcela uma vez e mantém o total correto.
3. Produto vendido reduz o saldo uma vez e cria movimento vinculado à operação.
4. Falha no segundo produto reverte pagamentos, primeiro produto, comanda e agendamento.
5. Soma de pagamentos inválida falha sem qualquer persistência.
6. Estoque insuficiente falha sem fechar a comanda.
7. Duas finalizações concorrentes produzem um único fechamento.
8. Repetição após timeout não duplica efeitos.
9. Reabertura válida restaura estoque, trata pagamentos e reverte o estado relacionado.
10. Falha durante reabertura mantém integralmente o estado fechado original.
11. Segunda reabertura não duplica estornos.
12. Movimento manual posterior não é confundido com movimento originado pela comanda.
13. Fechamento de caixa calcula fundo inicial, dinheiro recebido, suprimentos e sangrias corretamente.
14. PIX e cartão aparecem no resumo, mas não aumentam a gaveta esperada.
15. Valor contado igual ao esperado grava diferença zero.
16. Valor contado maior grava sobra; valor menor grava quebra.
17. Dois fechamentos concorrentes encerram a sessão uma única vez.
18. Sessão já fechada rejeita nova alteração.
19. Usuário inativo, papel não autorizado e tenant divergente são rejeitados sem efeitos.
20. Datas e agrupamentos respeitam o timezone do tenant.
21. Os adapters fazem uma chamada de comando por intenção e preservam o retorno esperado pelas telas.
22. Os componentes atuais continuam exibindo sucesso, erro e atualização de estado corretamente.
23. As suítes atuais de Comandas, Produtos, Caixa, Agenda e Financeiro permanecem verdes.
24. Testes de injeção de falha comprovam rollback em cada fronteira relevante.
25. O banco DEV é consultado após os testes para confirmar ausência de pagamentos, movimentos ou estados órfãos.

## Out of Scope

- Criar snapshots históricos completos de comissão e custo dos itens, tratados na Spec 032.
- Redesenhar checkout, caixa ou Financeiro.
- Alterar regras comerciais de desconto, troco, comissão ou preço sem uma especificação própria.
- Criar conciliação bancária ou integração com adquirentes.
- Automatizar promoção para produção.
- Limpar registros históricos do DEV ou da produção.
- Corrigir módulos não envolvidos na transação de comanda e caixa.

## Further Notes

- O fluxo atual é funcional em condições normais, portanto os testes de caracterização são pré-requisito e não uma etapa opcional.
- A função corretiva de estoque da Spec 030 deve estar ativa antes de mover as baixas para o comando transacional.
- A política de reabertura deverá favorecer auditoria; apagar evidência histórica somente será aceito se esse for comprovadamente o contrato atual e houver substituição equivalente.
- Esta publicação cria somente a especificação local. Nenhum código, banco, migration, dado, commit, push ou deploy é alterado.
