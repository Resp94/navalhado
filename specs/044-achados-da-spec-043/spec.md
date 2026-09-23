# Especificação Técnica: Achados da spec 043 — defeitos, débitos e provas pendentes

## Problem Statement

A spec 043 (Motivo de Cancelamento visível) foi entregue em oito tickets, todos fechados e mesclados em `dev`. Cada ticket registrou, com honestidade, o que ficou de fora: defeitos encontrados de passagem, débitos aceitos para não inflar o escopo, verificações que não foram feitas e uma decisão de desenho que mudou o que a spec tinha prometido. A própria spec 043 também deixou pendências nas suas notas finais e uma decisão que nunca foi entregue.

Esse material está espalhado em nove arquivos, escrito como limite de cada ticket, e nenhum deles é trabalho agendado. Do jeito que está, ele se perde: quem abrir a spec 043 vê oito tickets marcados como feitos e conclui que o assunto acabou.

O que está em jogo, do ponto de vista de quem usa o sistema:

1. **O código de `dev` não pode ir para produção.** As três migrations da spec 043 estão só no ambiente de desenvolvimento, e o código que lê as colunas novas já está em `dev`. Conferido em produção em 2026-09-21: nenhuma das três colunas existe. Promover o código quebra a Agenda, o Painel de Cancelados do Dia e a Lista de Espera.
2. **A recepção pode ver como livre um horário bloqueado.** Isso acontece por dois caminhos independentes. A exclusão de um Bloqueio de Horário não chega pelo tempo real a outras sessões abertas. E, quando a leitura de Bloqueios falha, a Agenda abre sem eles e sem aviso.
3. **O banco confia em quem não deveria.** A validação de telefone da criação de Agendamento conta caracteres, não dígitos. A autoria do cancelamento, que existe para responder quem desmarcou, pode ser reescrita por uma atualização direta do gerente.
4. **O Painel de Cancelados do Dia não conta a história inteira.** O cancelamento feito pela tela de Comandas chega sem motivo, e o de um profissional desativado não aparece. Numa troca rápida de dia, o painel pode mostrar os cancelamentos do dia errado. A entrada não mostra o telefone do cliente, que a spec 043 pedia. E o gerente não alcança o painel no celular.
5. **O relatório continua sem distinguir quem cancelou.** A spec 043 criou a autoria, mas o ranking de motivos do relatório de agenda continua misturando cancelamento da barbearia com cancelamento do cliente, e continua deixando o texto de preenchimento `cancelado pelo cliente` dominar o ranking. A decisão do ticket 07 da spec 043 também tirou do relatório de origem a linha "Lista de Espera" que o ticket original prometia, e hoje não há onde medir quantos encaixes a Lista de Espera produz.
6. **O código carrega débitos que já custaram um defeito.** O tipo do cliente do Agendamento diz que ele é obrigatório, e não é. Foi essa divergência que derrubou a Agenda inteira no ticket 05 da spec 043. Os selos do cartão usam dois vocabulários visuais. Há código repetido entre as duas agendas e entre os fakes de teste.
7. **A documentação descreve outro sistema.** A spec 043 afirma que o banco grava o texto padrão do cancelamento, e quem grava é o front. Ela fala em três funções de cancelamento, e são quatro. Diz que os Bloqueios não seriam tocados, e o ticket 08 da spec 043 dividiu o contrato de leitura deles. O glossário não tem os termos que a spec 043 mandou acrescentar.
8. **Parte do que foi declarado verde não foi executado de novo.** Testes de banco tocados pela spec 043 e a suíte completa não rodaram inteiros depois das últimas mudanças. O cancelamento pelo Canal do Cliente nunca foi exercitado pela tela pública.
9. **A causa de fundo do defeito da Lista de Espera pode estar em outros módulos.** A observação da Lista de Espera se perdia com a suíte verde porque o módulo não tinha adaptador em memória próprio. Numa contagem preliminar feita em 2026-09-22, só 5 dos 16 módulos têm um.

## Solution

Uma spec de acompanhamento que transforma cada achado em trabalho agendado, rastreável até o ticket da spec 043 onde foi registrado.

- **Fechar os furos que fazem a recepção errar.** A exclusão de Bloqueio passa a chegar pelo tempo real. A falha na leitura de Bloqueios passa a ser visível na tela.
- **Devolver ao banco a última palavra.** A validação de telefone passa a contar dígitos. A autoria do cancelamento passa a ser protegida contra escrita fora das funções que cancelam.
- **Completar o Painel de Cancelados do Dia.** O cancelamento pela tela de Comandas passa a gravar o motivo. Os cancelamentos de profissional desativado passam a aparecer. As respostas obsoletas passam a ser descartadas. O gerente passa a alcançar o painel no celular. A entrada passa a mostrar o telefone, e o atalho de WhatsApp passa a abrir com uma mensagem-base.
- **Aproveitar no relatório o que a spec 043 passou a gravar.** O ranking de motivos passa a separar a barbearia do cliente e a não contar o texto de preenchimento como motivo. O relatório passa a medir os encaixes vindos da Lista de Espera.
- **Pagar os débitos que causam defeito.** O tipo do cliente passa a aceitar nulo. Os selos passam a usar a biblioteca de interface. A repetição é extraída onde a próxima mudança a faria divergir.
- **Pôr a documentação de acordo com o que foi entregue.** Corrigir a spec 043 e acrescentar os verbetes de cancelamento ao glossário.
- **Fechar as provas pendentes e investigar a causa de fundo.** Reexecutar o que não foi reexecutado, exercitar o Canal do Cliente de ponta a ponta e levantar quais módulos não têm adaptador em memória.

Nenhum item desta spec muda o desenho da spec 043. Todos completam, corrigem ou provam o que ela entregou.

## User Stories

### A. A recepção não vê como livre um horário bloqueado

1. As a Gerente, I want a Bloqueio de Horário deleted on another device to disappear from my open Agenda, so that I do not refuse a slot that is actually free.
2. As a Gerente, I want a Bloqueio deleted in another barbershop to never reach my session, so that realtime does not leak between tenants.
3. As a Barbeiro, I want Minha Agenda to follow Bloqueio deletions in real time, like the Agenda Geral, so that my day is current.
4. As a Gerente, I want to be told when the Bloqueios failed to load, so that I do not book on top of a blocked slot believing it is free.
5. As a Gerente, I want my Agendamentos to keep showing when only the Bloqueios failed, so that a partial failure does not blank the grid.
6. As a Gerente, I want the failure notice to disappear once the Bloqueios load again, so that a stale warning does not train me to ignore warnings.
7. As a Barbeiro, I want the same failure notice on Minha Agenda, so that I am not misled about my own blocked time.

### B. O banco guarda a regra

8. As a Gerente, I want the database to reject a new-customer phone with fewer than ten digits, whatever mask it carries, so that a malformed contact never reaches the customer base.
9. As a Gerente, I want a text with no digits at all to be rejected as a phone, so that garbage cannot pass validation by being long.
10. As a Gerente, I want the authorship of a cancellation to be unchangeable outside the functions that cancel, so that "who canceled" stays trustworthy.
11. As a Gerente, I want my legitimate edits to Agendamentos to keep working after that protection, so that the fix does not block the daily operation.
12. As a Desenvolvedor, I want that protection enforced by the database and not by a screen, so that a new screen cannot bypass it.

### C. Painel de Cancelados do Dia completo

13. As a Gerente, I want a cancellation made from the Comandas screen to ask for and record the Motivo de Cancelamento, so that the same cancellation does not look different depending on the screen used.
14. As a Barbeiro, I want to read the reason of a cancellation made from the Comandas screen on my panel, so that my empty slot has an explanation.
15. As a Gerente, I want the Comanda and its Agendamento to still be canceled together or not at all, so that recording the reason does not break the atomic cancellation.
16. As a Gerente, I want the cancellations of a deactivated professional to appear on the panel, so that the slots of someone who left can still be rebooked.
17. As a Gerente, I want those entries flagged as belonging to a deactivated professional, so that I do not look for that person in the team filter.
18. As a Gerente, I want the counter to include those cancellations, so that the number matches the list.
19. As a Gerente, I want the Agenda to ignore a late answer from a day I already left, so that the grid and the panel always show the day in the header.
20. As a Gerente, I want the loading indicator to settle even when a stale answer arrives last, so that the screen does not look stuck.
21. As a Gerente, I want to open the canceled panel on my phone, so that I can act on a vacated slot without a computer.
22. As a Gerente, I want the phone panel to follow the same team filter and day as the grid, so that it agrees with what I see.
23. As a Gerente, I want each canceled entry to show the customer phone, so that I can call a customer who does not use WhatsApp.
24. As a Gerente, I want the WhatsApp shortcut to open with a ready draft, so that I only adjust the text before sending.
25. As a Gerente, I want that draft to never be sent by the system, so that every message to the customer passes through my review.

### D. Relatório de agenda

26. As a Gerente, I want the cancellation reasons ranking to separate barbershop cancellations from customer cancellations, so that I can measure customer-driven churn apart from our own decisions.
27. As a Gerente, I want the default filler text of a customer who wrote nothing to stop counting as a reason, so that the ranking shows real reasons.
28. As a Gerente, I want cancellations without authorship, from before spec 043, to be reported as unknown authorship, so that old data is not assigned to anyone.
29. As a Gerente, I want the agenda report to show how many Agendamentos came from the Lista de Espera in the period, so that I can tell whether the waiting list fills chairs.
30. As a Gerente, I want that measure to leave the "Agendamentos por origem" breakdown unchanged, so that past periods remain comparable.
31. As a Gerente, I want both measures to follow the report's existing professional filter, so that the report stays consistent.

### E. Débitos que já custaram defeito

32. As a Desenvolvedor, I want the Agendamento customer type to admit null, so that the type checker points out every place that could crash on a walk-in Agendamento.
33. As a Gerente, I want every screen that shows a walk-in Agendamento to show the same label the grid uses, so that no screen shows an empty or broken name.
34. As a Gerente, I want the badges on an Agendamento card to share one visual language, so that the card reads at a glance in light and dark themes.
35. As a Gerente, I want the badges to fit on the small week-view cards and at 375 pixels, so that no badge is clipped.
36. As a Desenvolvedor, I want the canceled panel state and its header button defined once, so that the next change to the panel is made in one place.
37. As a Desenvolvedor, I want the test helper that reads the columns of a query to live in one place, so that a divergent copy cannot make an adapter test stop covering a missing column.

### F. Documentação

38. As a Desenvolvedor, I want spec 043 to state that the default cancellation text is built by the front-end adapter, so that I look for the rule in the right place.
39. As a Desenvolvedor, I want spec 043 to record every point where what shipped differs from what it decided, so that the spec matches what shipped without erasing the original decision.
40. As a Desenvolvedor, I want the glossary to define Motivo de Cancelamento, Painel de Cancelados do Dia and autoria do cancelamento, so that code and commits use one vocabulary.
41. As a Desenvolvedor, I want the glossary to list the terms to avoid that spec 043 already named, so that synonyms stop spreading.

### G. Provas e causa de fundo

42. As a Desenvolvedor, I want every database test that spec 043 created, changed, or whose functions it changed, re-run in full after its last change, so that "green" means executed, not assumed.
43. As a Desenvolvedor, I want the full application suite run once on the current `dev`, so that the last-mile edits of tickets 02 and 04 are covered.
44. As a Gerente, I want a customer cancellation made through the public Canal do Cliente page verified end to end, so that the reason and authorship I read on the panel are proven, not inferred.
45. As a Desenvolvedor, I want the remaining Agenda browser checks of spec 043 ticket 08 performed, so that removing and creating a Bloqueio are proven to refresh the grid.
46. As a Desenvolvedor, I want every verification to leave the database as it found it and to never trigger a real WhatsApp message, so that testing has no external effect.
47. As a Desenvolvedor, I want to know which modules test their repository against a fake more generous than the table, so that the silent data loss of the Lista de Espera cannot repeat elsewhere.

## Implementation Decisions

### 1. Linha de base de banco

Antes de qualquer alteração nas funções que a spec 043 já testou, os testes de banco que ela tocou são reexecutados no ambiente de desenvolvimento, e a suíte da aplicação roda uma vez. É a linha de base: nenhuma função coberta por esses testes é alterada antes dela, e nenhuma migration desta spec é aplicada em produção antes dela.

**A aplicação em produção fica fora desta spec, por decisão do responsável em 2026-09-22: ele ainda não vai mexer em produção.** As migrations da spec 043 e as que esta spec cria continuam só no ambiente de desenvolvimento, provadas por pgTAP. Quando o responsável decidir promover, a aplicação em produção é trabalho à parte, uma migration de cada vez, com confirmação antes de cada uma, conferindo estrutura e permissões antes e depois; nenhum teste roda contra produção. Até lá, a promoção de `dev` para `main` fica bloqueada.

### 2. Validação de telefone

A função de criação de Agendamento pelo gestor passa a contar dígitos. A mensagem de recusa não muda. O restante do corpo, incluindo a marca de Agendamento vindo da Lista de Espera e a baixa da entrada, fica como está.

A função tem um ramo que trata Bloqueio de Horário sem profissional. A coluna do profissional é obrigatória na tabela de Bloqueios, então esse ramo nunca é alcançado. O ticket que já reescreve a função decide se o remove, e registra a decisão.

### 3. Autoria protegida

A recusa da escrita direta da autoria mora no banco. A escolha do mecanismo é do ticket. O critério que ele precisa cumprir: as quatro funções de cancelamento continuam gravando, as atualizações legítimas que o gerente faz em Agendamento continuam funcionando, e o administrador do SaaS não ganha nem perde acesso. O ticket também avalia se o Motivo de Cancelamento merece a mesma proteção e registra a conclusão.

Vem depois do ticket da tela de Comandas, porque os dois mexem no mesmo conjunto de funções de cancelamento.

### 4. Tempo real dos Bloqueios

Duas saídas plausíveis, e a escolha é do ticket:

- **Ampliar o que a tabela publica na exclusão.** Custo: mais volume de registro no banco.
- **Tirar o filtro por barbearia da inscrição e recortar na tela.** Custo: sessões de outras barbearias acordam para descartar o evento.

Em qualquer das duas, nenhum dado de uma barbearia chega à outra, e o evento de uma tabela não dispara leitura da outra. O ticket confere e registra se a inscrição de Agendamentos tem o mesmo furo.

### 5. Relatório de agenda

As duas medidas novas entram no relatório de agenda que já existe, no módulo de relatórios, e seguem o filtro de profissional que o relatório já aplica. A quebra "Agendamentos por origem" não muda.

- **Motivos por autoria.** O ranking passa a separar barbearia, cliente e autoria desconhecida. O texto de preenchimento usado quando o cliente não escreve motivo deixa de contar como motivo. Hoje esse texto é montado no front, repetido em três pontos do adaptador do Canal do Cliente e em um do adaptador em memória. Para o relatório reconhecê-lo, ele precisa ter uma definição única, e o ticket decide onde ela mora. A comparação com o texto é normalizada da mesma forma que o ranking já normaliza.
- **Encaixes vindos da Lista de Espera.** Decidido em 2026-09-22: o relatório passa a devolver dois números do período, quantos Agendamentos vieram da Lista de Espera, cancelados inclusive, e desses quantos foram concluídos. Altera a mesma função do relatório que o ranking por autoria, então os dois são feitos em sequência.

### 6. Painel de Cancelados do Dia

- **Motivo pela tela de Comandas.** A função que cancela a Comanda e o Agendamento juntos passa a receber o motivo, com a mesma exigência da Agenda, e a tela de Comandas passa a pedi-lo. A atomicidade não muda.
- **Profissional desativado.** O painel passa a mostrar os cancelamentos dos profissionais desativados, sinalizados como tal. A grade continua sem coluna para eles. Decidido em 2026-09-22: eles aparecem quando o filtro de equipe está com todos os profissionais e somem quando o gerente restringe o filtro; o desativado não entra na lista do filtro.
- **Resposta obsoleta.** A Agenda Geral adota o mesmo descarte que a Minha Agenda já usa, para Agendamentos e para Bloqueios.
- **Celular do gerente.** A visão de celular ignora as ações do cabeçalho por desenho, e a decisão é mantida. Decidido em 2026-09-22: o painel abre por uma faixa discreta acima da grade da visão do dia, com o número de cancelamentos, que só aparece quando há cancelamento no dia ou quando a leitura dos cancelados falha.
- **Contato com o cliente.** A entrada passa a mostrar o telefone, como a história 3 da spec 043 pedia e o painel entregue não fez. O atalho de WhatsApp abre um rascunho que a recepção revisa. O sistema nunca envia.

### 7. Débitos de código

- **Tipo do cliente.** Aceita nulo no contrato do módulo de agenda e no tipo que a página espelha. Os pontos que a verificação de tipos apontar passam a tratar o nulo, sem conversão forçada de tipo. É prefactor: vem antes do telefone no painel.
- **Selos.** Passam ao componente de selo da biblioteca de interface, com cor por token. Cada selo continua distinguível dos outros.
- **Repetição entre as agendas.** Os estados do painel e o botão do cabeçalho ganham definição única. O que é particular de uma página continua nela. É prefactor: vem antes do cancelado de profissional desativado e do painel no celular, que mexem no mesmo estado.
- **Leitor de colunas dos testes.** Passa a existir em um lugar só, no apoio de teste do projeto. Nenhum código de produção muda.

### 8. Documentação

A spec 043 é corrigida sem ser reescrita. As correções entram como notas de estado de entrega, com data, ao lado do texto original. O leitor vê o que foi decidido e o que acabou sendo feito. Os tickets da spec 043 não são alterados: eles já registram o comportamento real.

O glossário ganha os três verbetes que a decisão 8 da spec 043 previa e que não foram entregues, com os termos a evitar que ela já listava.

### 9. Provas e auditoria

A verificação segue a regra aprendida no ticket 06 da spec 043: nenhum Agendamento de teste é criado em estado ativo numa barbearia com instância de WhatsApp conectada. Todo dado criado é apagado, com as contagens do banco conferidas antes e depois.

A auditoria dos adaptadores em memória só produz um levantamento e, se for o caso, tickets novos. Ela não cria nenhum adaptador: criar é trabalho por módulo, com o próprio escopo.

## Testing Decisions

### O que constitui um bom teste

O mesmo critério da spec 043: comportamento externo observável. Um teste que quebra numa renomeação interna sem mudança de comportamento é um teste ruim. Um fake mais generoso que a tabela não prova nada sobre persistência. A persistência e o acesso pertencem ao pgTAP.

### Costuras

Confirmadas com o responsável em 2026-09-22. Nenhuma costura nova. Cada ticket usa a costura existente mais alta do seu assunto:

- **Banco:** pgTAP numerado a partir do maior prefixo existente, pelo servidor MCP, dentro de `begin; ... rollback;`. É a costura dos tickets de validação de telefone, motivo pela tela de Comandas, autoria protegida e relatório. Cada função alterada que recebe identificador de barbearia ganha asserção de isolamento, incluindo o gestor com identificador de barbearia nulo.
- **Repositório do módulo contra o adaptador em memória:** para regra de aplicação, onde o fake não precisa afirmar acesso.
- **Adaptador real com banco falso que respeita colunas, filtros e ordem:** para provar que a consulta pede e devolve o que precisa. Arte prévia nos testes de adaptador de agenda e de clientes.
- **Página:** os arquivos de teste de página já existentes da Agenda Geral, da Minha Agenda, da Comanda e do relatório de agenda.
- **Navegador:** prova final dos tickets com efeito visível, e a única prova possível para tempo real entre duas sessões e para alvo de toque.

### Mutação

Todo teste novo que protege contra um defeito já observado é conferido por mutação: desfazer a correção deixa o teste vermelho. Os tickets que corrigem defeito registram a mutação feita.

### Critério de pronto

`npm run lint`, `npm test` e `npm run build` passam. O pgTAP novo passa pelo servidor MCP contra o ambiente de desenvolvimento.

## Out of Scope

Continuam fora, como a spec 043 decidiu, e ficam como backlog de produto:

- **Distinguir gerente de barbeiro na autoria.** Exige identidade de usuário num caminho que hoje não existe.
- **Motivo para falta.** Outro fluxo e outra função.
- **Backfill de autoria ou da marca da Lista de Espera.** Inferir produziria histórico falso.
- **Motivo obrigatório para o cliente.** Contraria o Perfil Progressivo do Cliente.
- **Notificação no momento do cancelamento.** Feature própria, com decisão de ruído.
- **Restrição de cliente por cancelamento recorrente.** Spec própria.
- **Cancelado na grade de horários.** Descartado por decisão de produto.
- **Data desejada na Lista de Espera.** Muda a natureza da funcionalidade.
- **Acionar a Lista de Espera a partir de um cancelamento.** Ligação para depois. O painel não deve impedi-la.
- **Reescrever o mapeamento de status da Lista de Espera.** Funciona e não é defeito.
- **Alterar a política de leitura de Agendamento.** Ela entrega o recorte de que as duas agendas precisam, inclusive para cancelado. Vale também para os tickets desta spec: o 13 e o 15 reusam a política como está, e o 08 mexe na escrita da autoria, não na leitura.
- **Dar ao barbeiro qualquer visão da barbearia inteira.** Nem no painel, nem em contador, nem em relatório. O recorte do banco é o teto.

Novos, desta spec:

- **Lista de Espera para o barbeiro.** Registrado no ticket 07 da spec 043 como nota de escopo, não defeito. É decisão de produto e, se for o caso, vira spec própria.
- **Acesso do proprietário a qualquer barbearia.** O proprietário é o administrador do SaaS e alcança qualquer barbearia por desenho, como o pgTAP 52 da spec 043 documenta. Nenhum ticket desta spec muda isso.
- **Criar adaptadores em memória nos módulos que não têm.** A auditoria só levanta. Criar é trabalho por módulo.
- **O botão "Remover" do Bloqueio na Minha Agenda.** Levantado como dúvida no ticket 08 da spec 043 e conferido no banco em 2026-09-21. A política de exclusão permite ao barbeiro excluir os Bloqueios do próprio profissional, e a tela só lhe mostra esses. Funciona por desenho.
- **Decisões do responsável, que não são trabalho de engenharia.** Estas quatro ficam fora:
  - Aplicar em produção as migrations da spec 043 e as desta spec. Decidido em 2026-09-22: adiado até o responsável decidir promover. Nenhum ticket desta spec cobre a aplicação; a linha de base (decisão 1) continua provando tudo no ambiente de desenvolvimento.
  - As 4 mensagens de WhatsApp enviadas durante a verificação do ticket 06 da spec 043. As linhas da fila de saída foram mantidas como registro, e apagá-las ou não é decisão do responsável.
  - O push de `dev`.
  - A remoção das branches locais já mescladas.

## Further Notes

- Pasta dos tickets: `.scratch/044-achados-da-spec-043/issues/`. A pasta `.scratch/achados-da-spec-043/`, criada antes desta spec, fica como histórico e aponta para cá.
- Os tickets 02 ("Migrations da spec 043 aplicadas em produção") e 22 ("Migrations da spec 044 aplicadas em produção") foram removidos em 2026-09-22, a pedido do responsável: aplicar em produção não é trabalho agendado enquanto ele não decidir promover (ver Out of Scope). A numeração dos tickets restantes não muda; 02 e 22 ficam vagos.
- Ordem dos tickets: o número é ordem de dependência. Primeiro a linha de base de banco da spec 043 (01), depois os prefactors (03, 04 e 05), depois o resto. Arestas: 06 e 07 esperam o 01; 08 espera o 07; 11 espera o 10; 13 e 15 esperam o 04; 14 espera o 03; 17 espera o 16.
- Validação: spec e tickets foram conferidos em 2026-09-22 contra as skills de spec e de tickets do projeto. A conferência reordenou os prefactors, corrigiu uma aresta falsa entre a extração do painel e os selos, acrescentou as arestas que evitam duas migrations sobrescreverem a mesma função, dividiu as provas pendentes em banco e navegador e trocou "Agenda do gerente" e "fila" pelos termos do glossário, Agenda Geral e Lista de Espera. As três decisões de produto que os tickets deixavam para o agente foram tomadas pelo responsável.
- Os tickets de defeito levam o escopo do domínio onde o código muda (`agenda`, `comandas`, `relatorios`, `db`), um por commit. O número desta spec vai no corpo do commit: `Spec: 044`.
- A contagem de módulos sem adaptador em memória (11 de 16) é preliminar. Ela contou só arquivos com o prefixo usual na pasta de adaptadores. A auditoria confirma ou corrige esse número.
- Duas prioridades de risco, depois da linha de base (decisão 1): a exclusão de Bloqueio pelo tempo real e a falha silenciosa na leitura de Bloqueios. As duas levam ao mesmo erro visível, a recepção agendar em cima de um bloqueio.

## Rastreabilidade

Cada achado registrado na spec 043 e nos seus tickets, com o ticket desta spec que o cobre. Os achados que não viram ticket aparecem com a razão. A tabela foi conferida por uma auditoria independente em 2026-09-22, que reconstruiu a lista de achados a partir das fontes sem olhar esta tabela. A auditoria encontrou um item faltando (o telefone no painel), outros cobertos de forma fraca e atribuições erradas, e tudo foi incorporado aqui.

| Origem | Achado | Ticket 044 |
|---|---|---|
| Tickets 01, 06 e 07 | Migrations aplicadas só no ambiente de desenvolvimento | Decisão do responsável (fora do escopo): aplicação em produção adiada |
| Ticket 07 | Validação de telefone com `'\\D'` conta caracteres, não dígitos | 06 |
| Conferência de 2026-09-21 | Ramo de Bloqueio sem profissional inalcançável na mesma função | 06 |
| Ticket 06 | Cancelamento pela tela de Comandas sem motivo | 07 |
| Ticket 06 | Autoria alcançável por `UPDATE` direto do gerente | 08 |
| Ticket 08 | Exclusão de Bloqueio não chega pelo tempo real | 09 |
| Ticket 05 | Agenda Geral não descarta resposta obsoleta | 10 |
| Ticket 05 | Cancelado de profissional desativado some do painel | 13 |
| Ticket 08 | Falha de leitura de Bloqueios só no console, e não provada no navegador | 11 |
| Ticket 07 | Selos do cartão fora da biblioteca, com hexadecimal | 12 |
| Verificação no navegador do ticket 07, fora do arquivo do ticket | Selo "Espera" apertado nos cartões pequenos da visão semanal | 12 |
| Ticket 07 original | Rótulo "Lista de Espera" no selo, entregue como "Espera" | 12 |
| Ticket 05 | Tipo do cliente declarado não-nulo | 03 |
| Ticket 05 | Atalho de WhatsApp sem mensagem pré-preenchida | 14 |
| Spec 043, história 3 | Entrada do painel sem o telefone do cliente | 14 |
| Ticket 05 | Botão do cabeçalho e estados do painel repetidos entre as agendas | 04 |
| Ticket 04 | Leitor de colunas do `select` copiado em dois arquivos de teste | 05 |
| Ticket 05 | Painel de Cancelados ausente no celular do gerente | 15 |
| Spec 043, notas finais | Relatório de motivos não separa autoria nem descarta o preenchimento | 16 |
| Ticket 07 (decisão) | Linha "Lista de Espera" prometida no relatório de origem e não entregue | 17 |
| Spec 043, notas finais | Conferir outros módulos sem adaptador em memória | 18 |
| Ticket 04 | Spec afirma que o banco grava o texto padrão | 19 |
| Ticket 06 | Spec fala em três funções de cancelamento; são quatro | 19 |
| Ticket 08 | Spec diz que os Bloqueios não seriam tocados | 19 |
| Spec 043 e ticket 07 original | Marcador na nota e valor novo de origem, substituídos pela coluna própria | 19 |
| Spec 043, decisão 1, e ticket 06 | Spec diz que a autoria é escrita só pelas funções; o banco não impede | 19 (e 08) |
| Spec 043, testes, e ticket 06 | Testes de autoria no repositório substituídos por pgTAP | 19 |
| Spec 043, decisão 7, e ticket 04 | "Nenhum componente novo" lido como nenhum na biblioteca | 19 |
| Spec 043, decisão 8 | Verbete de Motivo de Cancelamento nunca acrescentado | 20 |
| Conferência do glossário em 2026-09-22 | Painel de Cancelados e autoria sem verbete no glossário | 20 |
| Ticket 07 | pgTAP 46 não reexecutado depois do ajuste | 01 |
| Ticket 06 | pgTAP 32 não reexecutado depois da migration de autoria | 01 |
| Ticket 06 | pgTAP 17 conferido só nas asserções da função da Comanda | 01 (e 07, 08) |
| Ticket 02 | Motivo escrito por cliente real nunca observado na Central 360º | 21 |
| Tickets 02 e 04 | Suíte completa não repetida depois da última mudança | 01 |
| Tickets 04 e 06 | Cancelamento pelo Canal do Cliente não exercitado pela tela pública | 21 |
| Ticket 08 | Remoção e criação de Bloqueio não conferidas no navegador | 21 |
| Ticket 08 | Evento de Agendamento sem leitura de Bloqueios não medido na rede | 21 |
| Ticket 06 | Lição: Agendamento ativo de teste envia WhatsApp real | 21 (critério) |
| Ticket 01 | Nota do encaixe não confirmada até o Agendamento salvo | Resolvido pelo ticket 07 da spec 043, que exercitou o fluxo real |
| Ticket 03 | Leitura de Bloqueios duplicada e falha acoplada | Resolvido pelo ticket 08 da spec 043 |
| Ticket 03 | Suposta falta de teste de página da Agenda | Improcedente: o teste existe |
| Ticket 04 | Botão de fechar do `Drawer` com 32 pixels | Resolvido no ticket 04 da spec 043 |
| Ticket 05 | Crash com cancelado sem cliente | Resolvido no ticket 05 da spec 043; a causa de fundo vai no 03 |
| Ticket 06 | pgTAP 42 quebrado antes do ticket | Resolvido no ticket 06 da spec 043 |
| Ticket 08 | Botão "Remover" do Bloqueio para o barbeiro | Funciona por desenho (fora do escopo) |
| Ticket 07 | Lista de Espera só no gerente | Decisão de produto (fora do escopo) |
| Ticket 06 | Autoria não distingue gerente de barbeiro | Decisão da spec 043 (fora do escopo) |
| Ticket 05 | Proprietário alcança cancelado de qualquer barbearia | Por desenho (fora do escopo) |
| Ticket 06 | 4 mensagens de WhatsApp enviadas; linhas mantidas na fila de saída | Decisão do responsável (fora do escopo) |
| Sessão da spec 043 | `dev` sem push; branches mescladas locais | Decisão do responsável (fora do escopo) |
