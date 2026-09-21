# Especificação Técnica: Textos operacionais que não voltam — Motivo de Cancelamento e observação da Lista de Espera

## Problem Statement

A barbearia digita dois textos operacionais que nunca mais alcança. Os dois têm a mesma cara para quem usa o sistema — "eu escrevi e sumiu" — e causas técnicas distintas: um é gravado e nunca exibido, o outro nem chega ao banco.

### Parte 1 — O Motivo de Cancelamento é gravado e nunca exibido para quem opera

Hoje o Motivo de Cancelamento de um Agendamento é escrito por três caminhos e, quando se trata de um cancelamento específico, lido por apenas um — o cliente. A barbearia, que é quem opera a grade, nunca relê a informação que ela própria é obrigada a preencher; só o gerente enxerga um ranking agregado dos motivos, sem ligação com o Agendamento de origem.

1. **O barbeiro é obrigado a justificar e não pode reler.** Ao cancelar pela Minha Agenda, o barbeiro preenche um motivo obrigatório. Esse texto é gravado em `appointments.cancellation_reason` e desaparece da interface no instante seguinte. Mesma coisa para o gerente na Agenda.
2. **O cliente justifica e ninguém na barbearia fica sabendo.** No Canal do Cliente o motivo é opcional; quando o cliente não escreve nada, o banco grava o texto padrão `Cancelado pelo cliente`. Quando ele escreve de verdade — "fiquei doente", "consegui em outro horário" — esse texto não chega a nenhuma tela do gerente nem do barbeiro.
3. **O texto de cada cancelamento só é lido, individualmente, pelo próprio cliente.** O motivo de um Agendamento específico aparece em um único componente da aplicação, a linha do tempo de histórico do Canal do Cliente. É a página do cliente lendo de volta o que a barbearia escreveu. O gerente tem uma visão apenas **agregada**: o relatório de agenda lista os dez motivos mais frequentes do período, com contagem, no cartão "Motivos de cancelamento". Esse relatório normaliza o texto (tira espaços e caixa) para agrupar, não diz qual Agendamento nem qual cliente, não diz quem cancelou, e não é acessível ao barbeiro. Também não distingue o motivo real do texto de preenchimento gravado quando o cliente não escreve nada, de modo que `cancelado pelo cliente` tende a dominar o ranking sem dizer nada.
4. **Agendamento cancelado é invisível nas duas agendas.** As duas rotas de leitura filtram `status = 'canceled'` antes de devolver dados para a tela. Não existe nenhuma superfície no painel do gerente ou do barbeiro que liste, Agendamento a Agendamento, o que foi cancelado no dia.
5. **Não se sabe quem cancelou.** Não há coluna de autoria. O único indício é o texto padrão do cliente, que some assim que ele digita um motivo real. O gerente não consegue responder a pergunta operacional mais básica diante de um horário vago: o cliente desmarcou ou fomos nós que desmarcamos?
6. **A Central 360º do Cliente mostra "Cancelado" e para aí.** A aba de histórico lista o Agendamento cancelado sem o motivo, porque o contrato de leitura do módulo de clientes não carrega o campo.

O efeito prático: um horário que vagou não conta a própria história. A recepção não sabe se deve acionar a Lista de Espera, se o cliente merece ser chamado de volta, ou se o cancelamento foi decisão interna. Cancelamento recorrente do mesmo cliente não é detectável.

### Parte 2 — A observação da Lista de Espera é digitada e descartada em silêncio

A gaveta da Lista de Espera oferece um campo de observação. A recepção usa esse campo para o que importa na hora do encaixe: "só pode depois das 18h", "quer o Marcos, aceita esperar", "vai trazer o filho junto". Nada disso é gravado.

7. **A coluna nunca existiu.** A tabela da Lista de Espera foi criada sem campo de observação e nenhuma migração posterior acrescentou um. O banco não tem onde guardar o texto.
8. **A aplicação finge que tem.** O tipo de domínio da Lista de Espera declara o campo de observação, a gaveta coleta o texto e o entrega ao repositório. O adaptador que fala com o banco monta a carga de inserção sem esse campo e, na leitura, nunca o copia de volta. O descarte é silencioso: ninguém recebe erro, o registro é criado, a recepção acredita que anotou.
9. **Duas consequências visíveis.** O cartão da própria gaveta tenta exibir a observação e sempre encontra vazio. E o encaixe criado a partir da Lista de Espera monta a nota do Agendamento a partir dessa observação, caindo invariavelmente no texto genérico de origem — o contexto que a recepção escreveu não chega ao barbeiro que vai atender.
10. **O teste não pega.** O módulo da Lista de Espera é o único do projeto sem adaptador em memória próprio; o teste do repositório usa um dublê declarado dentro do próprio arquivo, que guarda a observação como se o banco guardasse. A suíte fica verde exatamente sobre o campo que se perde em produção.
11. **Há uma segunda divergência do mesmo tipo.** O tipo de domínio também declara um carimbo de atualização que não existe na tabela. Ninguém lê esse campo hoje, então não há sintoma — mas é a mesma fresta pela qual o defeito da observação passou.

O efeito prático: a Lista de Espera perde justamente a informação que decide a ordem do encaixe. A recepção anota a restrição do cliente, fecha a gaveta, e na hora de encaixar não tem mais a restrição.

### O que liga as duas partes

Não é o mesmo código nem o mesmo domínio. É o mesmo contrato quebrado com o operador: **a barbearia é convidada a escrever, escreve, e o texto não volta.** As duas correções são independentes entre si e podem ser entregues em qualquer ordem.

## Solution

Um **Painel de Cancelados do Dia**, acessível a partir da Agenda, com a mesma forma para o gerente e para o barbeiro.

- A grade de horários continua não exibindo Agendamento cancelado. Um slot cancelado está livre para receber outro cliente, e ocupá-lo visualmente com um card apagado atrapalha a operação.
- O painel abre sob demanda e lista os Agendamentos cancelados do dia selecionado: horário original, cliente, serviço, profissional, quem cancelou e o Motivo de Cancelamento por extenso.
- **O gerente vê os cancelamentos de toda a barbearia; o barbeiro vê apenas os dele.** Esse recorte não é decisão de tela: ele já é garantido pela política de leitura de Agendamento no banco, que libera a barbearia inteira para o papel de gerente e restringe o papel de barbeiro aos Agendamentos do próprio profissional. O painel herda a garantia sem reimplementá-la. Sobre esse piso, o gerente ainda tem o filtro de profissionais da tela, que é conveniência de leitura e não fronteira de acesso.
- Passa a existir autoria de cancelamento gravada no banco, para que o painel distinga cancelamento feito pela barbearia de cancelamento feito pelo cliente.
- O motivo também passa a aparecer na aba de histórico da Central 360º do Cliente, onde o Agendamento cancelado já é listado e só falta o campo.

Como consequência estrutural, a Agenda do gerente deixa de conversar direto com o banco e passa a ler pelo repositório do módulo de agenda, que já é o caminho do barbeiro. As duas telas voltam a compartilhar um único contrato de leitura.

### Para a observação da Lista de Espera

- A tabela da Lista de Espera ganha a coluna de observação que a aplicação já supõe existir.
- O adaptador passa a gravar e a ler o campo, fechando o caminho de ponta a ponta: a recepção digita, o cartão da gaveta exibe, e o encaixe criado a partir da entrada carrega a observação para a nota do Agendamento.
- O tipo de domínio é reconciliado com a tabela, para que a aplicação pare de declarar campo que o banco não tem.
- O módulo passa a ter adaptador em memória próprio, como os demais módulos do projeto, espelhando os campos realmente persistidos — é o que impede a suíte de voltar a ficar verde sobre um campo perdido.

## User Stories

### A. Painel de Cancelados do Dia — Gerente

1. As a Gerente, I want to open a panel listing the Agendamentos canceled on the selected day, so that I understand why chairs went empty.
2. As a Gerente, I want each canceled entry to show the original time slot, so that I can tell which part of the day lost movement.
3. As a Gerente, I want each canceled entry to show the customer name and phone, so that I can reach out without hunting through another screen.
4. As a Gerente, I want each canceled entry to show the service and the professional, so that I can tell whether cancellations concentrate on a specific person or procedure.
5. As a Gerente, I want each canceled entry to show the full Motivo de Cancelamento text, so that I do not have to guess the reason.
6. As a Gerente, I want each canceled entry to state whether the barbershop or the customer canceled it, so that I know if the decision was ours.
7. As a Gerente, I want the panel to respect the professional filter already applied on the Agenda, so that the panel agrees with what the grid is showing.
8. As a Gerente, I want the panel to show how many cancellations happened that day, so that I can gauge the size of the problem at a glance.
9. As a Gerente, I want a clear empty state when nothing was canceled that day, so that I can tell an empty day apart from a loading failure.
10. As a Gerente, I want a canceled entry whose customer left no written reason to display the default text instead of a blank space, so that the entry never looks broken.
11. As a Gerente, I want to reach the customer on WhatsApp straight from a canceled entry, so that I can try to rebook the slot.
12. As a Gerente, I want the panel to open without leaving the Agenda, so that I do not lose the day I was looking at.
13. As a Gerente, I want the canceled list to refresh when I change the selected day, so that the panel always matches the visible date.
14. As a Gerente, I want canceled Agendamentos to stay out of the time grid, so that a freed slot still reads as available for booking.

### B. Painel de Cancelados do Dia — Barbeiro

15. As a Barbeiro, I want to open the same canceled panel from Minha Agenda, so that I learn why my own chair went empty.
16. As a Barbeiro, I want the panel to show only my own canceled Agendamentos, so that I am not exposed to the rest of the team movement.
17. As a Barbeiro, I want to read the reason a customer gave when canceling on the Canal do Cliente, so that I know whether it was personal or about the service.
18. As a Barbeiro, I want to read back the reason I myself typed when canceling, so that I can justify the empty slot to the manager later.
19. As a Barbeiro, I want the panel to tell me when the barbershop canceled on my behalf, so that I am not surprised by a slot that vanished from my day.
20. As a Barbeiro, I want the panel to look and behave like the manager panel, so that I do not have to learn a second interface.

### C. Autoria do Cancelamento

21. As a Gerente, I want a cancellation made from the manager Agenda to be recorded as made by the barbershop, so that internal decisions are identifiable.
22. As a Barbeiro, I want a cancellation I make from Minha Agenda to be recorded as made by the barbershop, so that it is not mistaken for a customer giving up.
23. As a Gerente, I want a cancellation made by the customer through the Canal do Cliente to be recorded as made by the customer, so that I can measure customer-driven churn separately.
24. As a Gerente, I want authorship to be stored even when the customer writes a custom reason, so that the distinction does not depend on the default text.
25. As a Gerente, I want Agendamentos canceled before this feature existed to display authorship as unknown rather than guessing, so that the history is not retroactively falsified.

### D. Central 360º do Cliente

26. As a Gerente, I want the Motivo de Cancelamento to appear on the canceled entries of a customer history timeline, so that the 360º view is actually complete.
27. As a Gerente, I want to see repeated cancellations from the same customer with their reasons in one place, so that I can decide how to treat that customer.
28. As a Gerente, I want a canceled entry with no reason recorded to render without visual noise, so that older records do not look broken.

### E. Contrato de Leitura Unificado

29. As a Desenvolvedor, I want the manager Agenda to read Agendamentos through the agenda module repository, so that the read contract lives in one place.
30. As a Desenvolvedor, I want canceled Agendamentos to arrive in a field separate from the active ones, so that no existing screen can accidentally render a canceled entry in the grid.
31. As a Desenvolvedor, I want canceled Agendamentos to be loaded only when a screen asks for them, so that the default Agenda load does not get heavier.
32. As a Desenvolvedor, I want the same repository call to serve one professional or the whole barbershop, so that manager and barbeiro do not drift apart again.
33. As a Desenvolvedor, I want the in-memory adapter to model cancellation the same way the real one does, so that repository tests stay meaningful.

### F. Escopo de Visibilidade

34. As a Gerente, I want the canceled panel to cover every professional in my barbershop, so that I get the whole picture of the day and not a fragment.
35. As a Gerente, I want a cancellation on a professional I have currently filtered out of the grid to still exist in the data, so that clearing the filter reveals it without reloading the page.
36. As a Barbeiro, I want to be unable to read cancellations belonging to other professionals, so that my colleagues' movement stays private from me.
37. As a Barbeiro, I want that restriction to hold even if the screen asks for the whole barbershop, so that a front-end mistake cannot expose data I should not see.
38. As a Gerente, I want the visibility rule to be enforced by the database rather than by the screen, so that it cannot drift as new screens are added.
39. As a Desenvolvedor, I want one repository call to serve both roles without branching on role, so that there is no second place for the access rule to disagree with the database.
40. As a Proprietario, I want the barbershop boundary to hold for canceled Agendamentos exactly as it does for active ones, so that cancellation does not become a leak between tenants.

### G. Observação da Lista de Espera

41. As a Gerente, I want the note I type when adding a customer to the Lista de Espera to be saved, so that my constraint survives closing the drawer.
42. As a Gerente, I want the saved note to appear on the entry card when I reopen the Lista de Espera, so that I can act on it later in the day.
43. As a Gerente, I want the note to describe availability constraints such as "only after 6pm" or "wants Marcos, willing to wait", so that I can pick the right person to slot in.
44. As a Gerente, I want the note to carry over into the Agendamento notes when I use the one-click encaixe, so that the barbeiro who takes the chair knows the context.
45. As a Barbeiro, I want the context the reception wrote on the Lista de Espera to reach my Agendamento, so that I am not surprised at the chair.
46. As a Gerente, I want an entry saved without a note to render cleanly, so that a blank note is not mistaken for a broken record.
47. As a Gerente, I want notes recorded before this fix to stay absent rather than be invented, so that history is not fabricated.
48. As a Gerente, I want a long note to be preserved in full rather than silently truncated, so that I do not lose the end of my own sentence.
49. As a Desenvolvedor, I want the Lista de Espera domain type to match the columns actually persisted, so that the application stops declaring fields the database does not have.
50. As a Desenvolvedor, I want the Lista de Espera module to have its own in-memory adapter mirroring the persisted columns, so that a field dropped on the way to the database cannot keep the suite green.

## Implementation Decisions

### 1. Autoria do cancelamento no banco

Acrescentar a `public.appointments` uma coluna de autoria do cancelamento, com domínio fechado validado por `CHECK`, aceitando os valores que representam barbearia e cliente, e nula para Agendamento não cancelado ou cancelado antes desta spec.

A coluna é escrita exclusivamente pelas RPCs de cancelamento já existentes, nunca pela tela:

- A RPC de cancelamento pelo gestor — usada tanto pela Agenda do gerente quanto pela Minha Agenda do barbeiro — grava autoria de barbearia.
- As duas RPCs do Canal do Cliente, a por token e a por sessão pública, gravam autoria de cliente.

Decisão consciente de **não** distinguir gerente de barbeiro nesta coluna. As duas telas chamam a mesma RPC e o banco hoje não identifica o autor individual nessa função. Distinguir exigiria propagar identidade de usuário por um caminho que não existe, o que é escopo maior do que o problema pede. "Barbearia" contra "cliente" é a distinção que responde à pergunta operacional.

Registros anteriores permanecem nulos. Nenhum backfill por heurística de texto: inferir autoria a partir da frase padrão produziria histórico falso para clientes que escreveram motivo próprio.

### 2. Contrato de leitura do módulo de agenda

O carregamento de agenda do dia do repositório de agenda passa a ser o único caminho de leitura de Agendamento das duas telas internas. Mudanças no contrato:

- **Profissional opcional.** O parâmetro de profissional passa a ser opcional. Omitido, devolve os Agendamentos de toda a barbearia no intervalo; informado, mantém o comportamento atual de um profissional só. É o que permite a Agenda do gerente usar a mesma chamada.
- **Cancelados sob demanda.** Novo sinalizador de entrada, desligado por padrão, pedindo os Agendamentos cancelados do intervalo. Desligado, a consulta segue exatamente como hoje.
- **Cancelados em campo próprio.** O retorno ganha uma coleção separada para os cancelados, ao lado da coleção de ativos e da de Bloqueios de Horário. Decisão deliberada: misturar cancelados na coleção de ativos faria qualquer consumidor atual passar a renderizar cancelado na grade sem mudar uma linha. Campo separado torna esse erro impossível por construção.
- **Campos novos no Agendamento.** O tipo de Agendamento do dia ganha o Motivo de Cancelamento e a autoria, ambos opcionais e nulos fora do contexto de cancelamento.

O adaptador Supabase e o adaptador em memória implementam as duas mudanças. O adaptador em memória já modela o Motivo de Cancelamento ao cancelar, o que reduz o trabalho do lado do fake.

#### Por que tornar o profissional opcional é seguro

A pergunta óbvia diante da optionalidade é se um barbeiro poderia omitir o profissional e enxergar a barbearia inteira. Não poderia, e a razão é estrutural: **o recorte de visibilidade mora na política de leitura da tabela de Agendamento, não no parâmetro da chamada.**

A política em vigor concede leitura ao papel de gerente sobre todos os Agendamentos da própria barbearia, e ao papel de barbeiro apenas sobre os Agendamentos cujo profissional é ele mesmo. O carregamento de agenda do dia lê a tabela como o usuário autenticado, então a política se aplica inteira, inclusive aos cancelados — a política não condiciona nada a status.

Daí decorre a propriedade que esta spec depende: **omitir o profissional devolve "tudo o que este usuário pode ver", que é a barbearia toda para o gerente e a própria agenda para o barbeiro.** A mesma chamada serve os dois papéis sem ramificação e sem risco de ampliação de acesso.

Consequências de projeto:

- O painel **não** implementa verificação de papel. Reimplementar a regra na aplicação criaria um segundo lugar para ela divergir do banco.
- O profissional continua sendo informado na tela do barbeiro, porque exprime a intenção da consulta e evita tráfego inútil. É otimização, **não** é a fronteira de acesso. Se um dia a tela deixar de informá-lo, o resultado visto pelo barbeiro não muda.
- O filtro de profissionais da Agenda do gerente é recorte de leitura sobre dados que ele já tem direito de ver. Não é controle de acesso e não deve ser tratado como tal.

### 3. Migração da Agenda do gerente para o repositório

A Agenda do gerente hoje monta uma consulta própria na tabela de Agendamento dentro da página, duplicando colunas e filtros do adaptador. Essa leitura é substituída pela chamada ao repositório de agenda, alinhando a tela ao padrão de módulo do projeto.

Escopo restrito à leitura de Agendamento. As demais consultas da página — profissionais, serviços, clientes, Bloqueios de Horário — não são tocadas nesta spec. O objetivo é eliminar a duplicação do contrato de Agendamento, não refatorar a tela inteira.

A filtragem por profissional selecionado continua acontecendo na tela, como hoje, já que é estado de interface e não regra de negócio.

### 4. Painel de Cancelados do Dia

Componente único, consumido pela Agenda do gerente e pela Minha Agenda do barbeiro, recebendo por propriedade a lista de cancelados já carregada. O componente não busca dados; quem busca é a tela, pelo repositório. Isso segue o padrão já adotado na refatoração da sidebar compartilhada, em que o componente recebe itens por propriedade em vez de conhecer a origem.

A diferença entre os dois papéis é só o conjunto de dados passado: o barbeiro recebe os cancelados do próprio profissional, o gerente os da barbearia filtrados pela seleção da tela. Nenhuma ramificação por papel dentro do componente, e nenhuma verificação de permissão dentro dele — o recorte já chegou aplicado pelo banco, conforme a decisão 2.

Superfície de abertura: gaveta lateral acionada por um controle no cabeçalho da Agenda, com contador de cancelamentos do dia, espelhando o padrão de acesso já usado pela Lista de Espera.

### 5. Central 360º do Cliente

O contrato de histórico de Agendamento do módulo de clientes ganha o Motivo de Cancelamento. A aba de histórico passa a exibi-lo nas entradas canceladas, condicionado à presença do texto, para que registros antigos sem motivo não rendam rótulo vazio.

Autoria fica fora desta tela nesta spec: a Central 360º é a visão do cliente, onde o eixo é o que aconteceu com aquele cliente, e o painel da Agenda já é o lugar de decidir operação.

### 6. Observação da Lista de Espera

Correção independente das decisões 1 a 5. Não compartilha tabela, módulo nem tela com a parte do cancelamento, e pode ser entregue antes ou depois dela.

**Banco.** Acrescentar à tabela da Lista de Espera a coluna de observação, texto livre e anulável. Sem valor padrão e sem retroatividade: entrada criada antes desta spec permanece sem observação, porque o texto que a recepção digitou naquela época não existe em lugar nenhum para ser recuperado.

**Adaptador.** A carga de inserção passa a incluir a observação, e o mapeamento de linha para entidade passa a copiá-la de volta. São os dois pontos exatos por onde o campo se perde hoje. Nada mais do adaptador muda: o mapeamento de status entre o vocabulário do domínio e o do banco fica como está.

**Tipo de domínio.** Reconciliar com a tabela. A observação passa a existir dos dois lados. O carimbo de atualização declarado no tipo e ausente da tabela é **removido do tipo**, e não criado no banco: nenhuma tela lê esse campo, e acrescentar coluna para sustentar uma declaração morta seria resolver o problema pelo lado errado. A regra que fica é que o tipo de domínio descreve o que a tabela guarda.

**Nenhuma mudança de escrita por RPC.** A Lista de Espera é escrita direto na tabela sob a política de acesso vigente, diferente do fluxo financeiro. Esta spec não altera esse desenho.

**Encaixe.** A regra da nota do encaixe já existia na Agenda — montar a nota do Agendamento a partir da observação da entrada e tratar o caso de observação ausente — e a intenção original do produto era essa; apenas a persistência faltava, e com o campo passando a chegar preenchido esse caminho passa a funcionar como sempre foi escrito. A única mudança na Agenda é de lugar, não de comportamento: a regra sai do corpo da página para o repositório da Lista de Espera, porque a página não oferece costura de teste e o critério de aceite do ticket exige prová-la. O resultado observável é idêntico.

### 7. Design System

O painel usa exclusivamente componentes já catalogados em `src/components/ui`, sem componente novo: gaveta, estado vazio, selo e diálogo já existem e cobrem a tela.

Regras que valem aqui:

- Cor, raio, sombra e fonte sempre por token. Nenhum hexadecimal novo.
- A autoria do cancelamento é sinalizada por selo com variante sutil, nunca por fundo sólido. Fundo sólido segue reservado ao botão primário da tela.
- O contador de cancelamentos no cabeçalho sinaliza por texto e borda, não por preenchimento sólido.
- O painel é um contexto próprio: no máximo um botão primário dentro dele.
- Em telas pequenas, os alvos de toque mantêm a altura mínima de 44 pixels.
- Se algum selo usar preenchimento sólido com texto branco, ele usa o par de tokens sólidos, para não repetir o débito de contraste já catalogado no design system.

### 8. Glossário

Acrescentar **Motivo de Cancelamento** ao glossário de domínio: texto obrigatório quando a barbearia cancela e opcional quando o cliente cancela pelo Canal do Cliente, acompanhado da autoria do cancelamento e exibido no Painel de Cancelados do Dia e no histórico da Central 360º do Cliente.

Termos a evitar: justificativa, observação de cancelamento, nota de cancelamento.

## Testing Decisions

### O que constitui um bom teste

Teste de comportamento externo observável: o que entra na chamada e o que sai dela, o que o usuário lê na tela e o que ele consegue acionar. Nada de asserção sobre forma de consulta, ordem de chamadas internas ou estrutura de estado do componente. Um teste que quebra numa renomeação interna sem mudança de comportamento é um teste ruim.

### Costura principal

A costura de teste é o **repositório do módulo de agenda, exercitado contra o adaptador em memória**. É costura existente, é a mais alta disponível, e é por onde as duas telas passam depois da unificação. Prioridade sobre criar costura nova.

Casos a cobrir nessa costura:

- Sem pedir cancelados, o retorno não traz coleção de cancelados preenchida e a coleção de ativos permanece idêntica ao comportamento atual.
- Pedindo cancelados, os cancelados chegam na coleção própria e continuam ausentes da coleção de ativos.
- Com profissional informado, só os Agendamentos daquele profissional voltam, ativos e cancelados.
- Com profissional omitido, voltam os da barbearia inteira.

Limite desta costura, que precisa ficar explícito para ninguém se enganar: o adaptador em memória **não** reproduz a política de leitura do banco. Os dois casos acima provam que o parâmetro de profissional filtra como prometido, e nada além disso. **A garantia de que o barbeiro não alcança o Agendamento de outro profissional não é demonstrável aqui e pertence ao pgTAP.** Um teste em memória que afirme escopo de acesso estaria afirmando algo que o fake não tem autoridade para dizer.
- O Motivo de Cancelamento sobrevive da escrita até a leitura: cancelar pelo repositório e em seguida carregar o dia com cancelados devolve o mesmo texto.
- Autoria de barbearia no cancelamento feito pela via do gestor.
- Autoria de cliente no cancelamento feito pela via do Canal do Cliente.
- Agendamento cancelado sem autoria registrada volta com autoria nula, sem erro.
- O intervalo do dia continua exclusivo no limite superior, para cancelado como já é para ativo.

Arte prévia: o arquivo de teste do repositório de agenda já existente, que é a referência de estilo e de montagem do fake.

### Costura de tela

Sem costura nova. O painel é coberto no arquivo de teste de página do barbeiro que já existe, cobrindo apenas o que é comportamento de interface e não se prova na costura do repositório: abertura do painel, renderização do motivo por extenso, estado vazio, e ausência de Agendamento cancelado na grade.

Arte prévia: os testes de página já existentes do barbeiro e da tela de configurações.

### Banco

Teste pgTAP novo, numerado sequencialmente a partir do maior prefixo existente, executado pelo servidor MCP do Supabase dentro de `begin; ... rollback;`.

Casos:

- Cada uma das três RPCs de cancelamento grava a autoria correta.
- O `CHECK` da coluna de autoria recusa valor fora do domínio.
- Agendamento não cancelado mantém autoria nula.
- Como as RPCs alteradas recebem identificador de barbearia, cada uma ganha asserção de isolamento provando o bloqueio, incluindo o caso do gestor com identificador de barbearia nulo, conforme a regra de guarda de acesso do projeto.

Escopo de visibilidade do cancelado, que é onde a garantia de fato se prova:

- Gerente lendo Agendamento cancelado alcança os de todos os profissionais da própria barbearia.
- Barbeiro lendo Agendamento cancelado alcança apenas os do próprio profissional.
- Barbeiro lendo **sem** restringir por profissional continua alcançando apenas os dele. É a asserção que sustenta a optionalidade do parâmetro; sem ela, a decisão de projeto fica sem prova.
- Barbeiro não alcança Agendamento cancelado de colega da mesma barbearia.
- Nenhum papel alcança Agendamento cancelado de outra barbearia.
- As asserções de escopo cobrem cancelado explicitamente, e não só ativo: a política não condiciona por status, e o teste precisa travar esse comportamento contra regressão futura.

### Costura da Lista de Espera

Costura existente: o **repositório da Lista de Espera**. Muda o dublê, não o ponto de teste.

O dublê declarado dentro do arquivo de teste é substituído por um adaptador em memória próprio do módulo, como os demais módulos do projeto já têm. A exigência que o torna útil: **ele espelha os campos realmente persistidos**. Um fake mais generoso que a tabela foi precisamente o que manteve a suíte verde enquanto a observação se perdia; repetir esse fake com outro nome não corrigiria nada.

Casos nessa costura:

- Entrada adicionada com observação devolve a observação ao ser listada.
- Entrada adicionada sem observação devolve ausência de observação, sem erro e sem texto inventado.
- A observação sobrevive à mudança de status da entrada.
- A obrigatoriedade do nome do cliente continua valendo, como hoje.

Limite desta costura, pelo mesmo motivo já registrado na costura de agenda: o adaptador em memória não prova que o banco guarda a coluna. **A prova de persistência é do pgTAP.**

Arte prévia: os adaptadores em memória dos demais módulos, e o arquivo de teste do repositório da Lista de Espera já existente, que é o ponto a ser convertido.

### Banco — Lista de Espera

No mesmo teste pgTAP ou em outro, conforme ficar mais legível:

- A coluna de observação existe na tabela da Lista de Espera e aceita texto.
- Inserção com observação e leitura de volta devolvem o mesmo texto, sem truncamento.
- Inserção sem observação resulta em observação nula, não em texto vazio.
- A entrada permanece isolada por barbearia, como já é hoje — asserção de regressão, já que a coluna nova não pode abrir caminho lateral.

### Teste de regressão do encaixe

Um caso que amarra as duas pontas e que hoje falharia: uma entrada da Lista de Espera com observação, convertida em encaixe, produz um Agendamento cuja nota contém o texto escrito pela recepção, e não apenas o marcador genérico de origem. É o caso que traduz o defeito em comportamento observável pelo usuário.

### Critério de pronto

`npm run lint`, `npm test` e `npm run build` passam. O pgTAP novo passa pelo servidor MCP contra o ambiente de desenvolvimento.

## Out of Scope

- **Distinguir gerente de barbeiro na autoria.** As duas telas chamam a mesma RPC; separar exigiria identidade de usuário num caminho que hoje não existe.
- **Motivo para falta.** Marcar falta não registra motivo nenhum hoje. É lacuna real e vizinha, mas é outro fluxo e outra RPC.
- **Backfill de autoria em registros antigos.** Inferir por texto produziria histórico falso.
- **Tornar o motivo obrigatório para o cliente.** Fricção no Canal do Cliente contraria a estratégia de Perfil Progressivo do Cliente.
- **Alterar o relatório de agenda.** O relatório já traz taxa de cancelamento e o ranking agregado de motivos, e pertence ao módulo de relatórios. Esta spec não o modifica: o painel serve a operação do dia, o relatório serve a análise do período. Os dois não competem, e o painel não substitui o relatório.
- **Notificação no momento do cancelamento.** Avisar o barbeiro pelo sino quando o cliente desmarca é feature própria, com decisão de ruído a tomar.
- **Restrição de cliente por cancelamento recorrente.** Bloqueio de cliente é spec separada.
- **Exibir cancelado na grade de horários.** Descartado por decisão de produto: o slot está livre.
- **Refatorar as demais consultas da Agenda do gerente.** Só a leitura de Agendamento migra para o repositório.
- **Alterar a política de leitura de Agendamento.** A política existente já entrega o recorte de que esta spec precisa, inclusive para cancelado. Ela é reusada como está; esta spec não a modifica, apenas passa a cobri-la por teste no que diz respeito a Agendamento cancelado.
- **Dar ao barbeiro qualquer visão da barbearia inteira.** Nem no painel, nem em contador, nem em total agregado. O recorte do banco é o teto, e a tela não tenta contorná-lo.
- **Data desejada na Lista de Espera.** A Lista de Espera é hoje fila do dia, filtrada pela data de criação da entrada. Registrar "quero o dia 15, me avise se vagar" é mudança de natureza da funcionalidade, não correção de defeito.
- **Acionar a Lista de Espera a partir de um cancelamento.** A ligação entre as duas partes desta spec é tentadora e fica para depois; aqui cada uma resolve o próprio defeito.
- **Reescrever o mapeamento de status da Lista de Espera.** O vocabulário do domínio e o do banco divergem e são reconciliados por tradução no adaptador. Funciona, não é o defeito em questão, e unificar os dois é mudança de contrato sem ganho para o operador.

## Further Notes

- A migração segue o padrão versionado e numerado do projeto, com o número da spec no nome.
- O texto padrão gravado quando o cliente cancela sem escrever motivo permanece como está. Com a autoria em coluna própria, ele deixa de ser o único indício de quem cancelou e passa a ser apenas o texto de preenchimento.
- Depois da unificação, a Agenda do gerente e a Minha Agenda do barbeiro passam a compartilhar o contrato de leitura de Agendamento. Qualquer coluna nova de Agendamento necessária a uma das telas passa a ser adicionada em um lugar só.
- A Lista de Espera é a ponte operacional natural a partir do painel: cancelamento libera horário, e a Lista de Espera já tem encaixe com um clique. Conectar os dois fluxos não entra nesta spec, mas o painel deve ser desenhado sem impedir essa ligação depois.
- Relação com a análise comparativa do concorrente: nenhum dos módulos de configuração mapeados cobre este problema. É lacuna própria do Navalhado, não paridade competitiva.
- A autoria do cancelamento, uma vez gravada (ticket 06), abre a possibilidade de o relatório de motivos separar cancelamento da barbearia de cancelamento do cliente e deixar de misturar o texto de preenchimento com motivo real. Não entra nesta spec, que não altera o relatório, mas é o desdobramento natural e vale um ticket próprio.
- Uma versão anterior deste documento afirmava que o motivo aparecia em exatamente um componente e que nenhuma superfície da barbearia o expunha. Isso desconsiderava o relatório de agenda. A conclusão do problema se mantém, agora afirmada com precisão: nenhum papel da barbearia consegue ler o motivo de um cancelamento específico, e só o gerente tem a visão agregada.
- As duas partes tocam domínios diferentes e portanto **não** cabem no mesmo commit, pela regra de escopo único do projeto. A entrega se divide em pelo menos dois: um de correção na Lista de Espera e um de funcionalidade na agenda, cada um com o próprio escopo, ambos citando esta spec no corpo.
- A parte da Lista de Espera é a menor das duas e não depende de nenhuma decisão de produto em aberto. Serve bem como primeira entrega, inclusive para validar o fluxo de migração desta spec antes da parte maior.
- A ausência de adaptador em memória no módulo da Lista de Espera é a causa de fundo do defeito ter sobrevivido à suíte. Vale conferir se algum outro módulo do projeto está na mesma situação; se estiver, é assunto próprio e não desta spec.
