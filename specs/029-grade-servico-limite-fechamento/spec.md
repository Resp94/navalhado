# Grade de horários por duração e limite de fechamento

## Problem Statement

Hoje a grade de horários considera principalmente o início do slot em relação ao expediente. Com isso, um horário pode ser exibido mesmo quando o serviço escolhido, ou todos os serviços que o profissional realiza, não conseguem terminar antes do encerramento efetivo do atendimento.

Por exemplo, com fechamento às 19:00, intervalo de grade de 40 minutos e serviço de 40 minutos, o horário 18:40 não é viável: o atendimento terminaria às 19:20. Esse horário pode continuar visível na régua da Agenda interna como referência operacional para gerente e barbeiro, mas não deve ser oferecido como disponibilidade normal nem aparecer no link público.

O limite precisa considerar os dois níveis já existentes:

- o horário de funcionamento da barbearia define o limite máximo;
- a escala do profissional define o horário efetivo exibido;
- a duração efetiva do serviço vem da configuração do profissional quando houver sobrescrita habilitada e, caso contrário, do cadastro do serviço.

A mudança deve preservar os encaixes personalizados, que são exceções operacionais explícitas e podem continuar fora do expediente, fora da escala e fora da cadência da grade.

## Solution

A disponibilidade normal será considerada válida somente quando o atendimento completo couber no período efetivo de trabalho. O horário final do serviço deverá ser menor ou igual ao menor fechamento entre a barbearia e a escala do profissional, além de não atravessar o intervalo do profissional.

Quando um serviço estiver selecionado, a disponibilidade será calculada com a duração efetiva daquele serviço. Quando a tela estiver exibindo uma grade sem um serviço único selecionado, o horário poderá permanecer somente se existir pelo menos um serviço ativo, atribuído a pelo menos um profissional ativo do contexto, que consiga terminar dentro do limite.

O gerente continuará podendo criar encaixes personalizados em qualquer horário válido, inclusive depois do expediente. A regra nova será aplicada à grade normal, a agendamentos normais e às consultas públicas de disponibilidade, sem modificar o horário configurado da barbearia ou do profissional.

## User Stories

1. Como gerente, quero que a régua da Agenda interna continue exibindo a grade completa dentro do horário configurado, para manter a referência visual e operacional do dia.
2. Como barbeiro, quero visualizar a grade do meu horário efetivo, mesmo quando o último slot não comporta determinado serviço, para acompanhar a jornada configurada.
3. Como gerente, quero que um slot visualmente exibido seja impedido no agendamento normal quando nenhum serviço conseguir terminar antes do fechamento, para evitar horários operacionalmente inviáveis.
4. Como cliente, quero ver no link público apenas horários que comportam o serviço escolhido, para não selecionar uma opção que terminará depois do fechamento.
5. Como gerente, quero que a duração configurada para o profissional seja usada quando estiver habilitada, para que a disponibilidade corresponda ao tempo real daquele profissional.
6. Como gerente, quero que a duração do cadastro do serviço seja usada como fallback, para manter o comportamento atual quando não houver duração específica.
7. Como cliente, quero que um serviço curto possa usar o último slot quando ele ainda couber no expediente, para não perder disponibilidade válida desnecessariamente.
8. Como gerente, quero que um serviço longo não seja permitido no último slot quando ultrapassar o fechamento, mesmo que o horário continue visível na régua, para evitar agendamentos que a operação não consegue concluir.
9. Como gerente, quero que o fechamento da barbearia continue sendo o limite máximo, mesmo quando a escala do profissional terminar depois, para preservar a regra de funcionamento do estabelecimento.
10. Como gerente, quero que o fechamento antecipado do profissional seja respeitado na disponibilidade normal, mesmo quando a barbearia permanecer aberta, para não oferecer horário fora da jornada individual.
11. Como cliente, quero que a combinação entre barbearia e profissional use o limite mais restritivo, para que o horário selecionado seja realmente executável.
12. Como gerente, quero que a grade continue ancorada no início da escala do profissional, para não alterar a cadência já validada.
13. Como gerente, quero que a grade continue reiniciando no retorno do intervalo, para manter os horários após o almoço alinhados ao comportamento atual.
14. Como cliente, quero que nenhum horário disponível atravesse o intervalo do profissional, para preservar a pausa configurada.
15. Como gerente, quero que horários passados continuem indisponíveis para agendamento normal, para evitar reservas retroativas pelo fluxo comum.
16. Como cliente, quero que horários bloqueados, ocupados ou sem antecedência mínima continuem indisponíveis, para que a nova regra não substitua os controles existentes.
17. Como gerente, quero reagendar um atendimento normal somente para um horário cujo serviço caiba até o fechamento, para evitar mover o problema para o fluxo de reagendamento.
18. Como gerente, quero que a grade do encaixe pela modalidade de grade use a mesma validação de duração, para manter consistência entre sugestão e gravação.
19. Como gerente, quero continuar usando encaixe personalizado fora do expediente quando necessário, para preservar a exceção operacional já existente.
20. Como gerente, quero que a criação de encaixe personalizado não seja bloqueada pela nova regra de fechamento, para não quebrar a operação de balcão.
21. Como gerente, quero que um encaixe já persistido fora do expediente continue visível no horário real, para não perder controle sobre atendimentos excepcionais.
22. Como gerente, quero que a Agenda desktop e mobile apresentem os mesmos slots normais, para não haver divergência por dispositivo.
23. Como cliente, quero que o link público não exiba o último horário inviável nem como opção ativa, para reduzir confusão na escolha.
24. Como cliente, quero que o fluxo público continue usando o serviço escolhido e o profissional escolhido para calcular a duração, para receber uma disponibilidade precisa.
25. Como gerente, quero que a escolha de qualquer profissional mantenha um horário somente quando houver profissional e serviço elegíveis para atendê-lo, para evitar disponibilidade sem responsável real.
26. Como operador, quero que a tentativa de confirmação revalide a duração contra o fechamento no servidor, para impedir que uma chamada antiga ou manipulada contorne a regra.
27. Como operador, quero receber o mesmo tratamento de timezone já usado pelo sistema, para que o fechamento local não varie conforme o navegador.
28. Como desenvolvedor, quero uma regra de domínio compartilhada entre Agenda interna e apresentações, para evitar cálculos diferentes no desktop, mobile e formulários.
29. Como desenvolvedor, quero que a RPC pública e a RPC interna mantenham isolamento por tenant, para impedir mistura de expediente, serviços ou profissionais.
30. Como administrador, quero preservar as tabelas e os dados existentes, para reduzir risco de regressão e evitar uma migration estrutural sem necessidade.
31. Como administrador, quero que qualquer alteração de função do banco seja versionada e aplicada primeiro em DEV, para manter rastreabilidade antes de qualquer promoção.

## Implementation Decisions

### Regra de domínio

- A regra de viabilidade será definida por uma única função de domínio temporal compartilhada.
- Um slot normal é elegível quando o início está dentro do período efetivo, o término calculado pela duração efetiva não ultrapassa o fechamento e o serviço não atravessa o intervalo.
- O fechamento efetivo será o menor entre o fechamento da barbearia e o fechamento da escala do profissional.
- A regra será aplicada a qualquer intervalo configurado da grade; não haverá dependência ou valor fixo de 20, 30, 40 minutos ou de um horário específico. `40 minutos` e `18:40` são apenas exemplos de teste.
- A comparação será inclusiva no término: um serviço que termina exatamente às 19:00 cabe; um serviço que termina às 19:01 não cabe.
- O slot será mantido quando pelo menos uma duração positiva elegível couber no período. Se nenhuma duração couber, o slot será removido da grade normal.
- Durações específicas do profissional habilitadas terão precedência sobre a duração base do serviço. Configurações desabilitadas ou inválidas não poderão criar uma duração artificial.
- A regra não será aplicada ao encaixe personalizado, que continuará sendo uma exceção explicitamente escolhida pelo gerente.

### Agenda interna

- A régua visual da Agenda deverá continuar exibindo os slots gerados pela escala efetiva e pelo intervalo configurado, sem remover o último horário apenas por causa da duração de um serviço.
- A disponibilidade para agendamento normal, o modal de novo agendamento e o reagendamento deverão aplicar a viabilidade pela duração efetiva.
- Com um profissional selecionado, serão consideradas somente as durações dos serviços ativos que ele pode realizar para decidir se o horário pode ser agendado.
- Com vários profissionais ou seleção ampla, o slot poderá ser selecionado somente se houver pelo menos uma combinação profissional-serviço elegível, embora a régua continue mostrando a referência completa.
- Um horário sem serviço elegível poderá permanecer visível na Agenda interna, mas deverá ser sinalizado como não disponível para agendamento normal e não poderá ser confirmado por esse fluxo.
- A grade não deverá ser reduzida para esconder um atendimento já persistido. Cards existentes, inclusive encaixes fora do expediente, continuarão sendo posicionados pelo horário persistido.
- A Agenda mobile consumirá a mesma lista de slots produzida pelo domínio e não terá uma regra paralela.

### Link público

- O fluxo público continuará escolhendo serviço, profissional, data e horário na ordem atual.
- O serviço selecionado será enviado ao contrato existente de consulta pública; a duração específica do profissional continuará sendo resolvida no banco.
- O endpoint público deverá impedir que um horário estruturalmente inviável pelo fechamento seja retornado como disponível; a interface pública não deverá renderizar esse horário como opção.
- Horários ocupados ou bloqueados poderão continuar sendo representados internamente como indisponíveis se isso for necessário para manter o contrato atual, mas a interface pública continuará renderizando somente os disponíveis.
- A confirmação pública deverá revalidar a mesma condição no servidor antes de gravar o agendamento.

### Supabase e persistência

- O levantamento atual indica que o schema já possui `business_hours`, `weekly_schedule`, `slot_interval_minutes`, `duration_minutes`, `custom_duration_minutes`, `appointments.start_time` e `appointments.end_time`.
- Não será criada tabela nem coluna nova para esta regra.
- As funções existentes de disponibilidade interna, disponibilidade por sessão/token e grade pública deverão compartilhar a condição de término viável, preservando suas assinaturas e permissões atuais.
- Caso a definição atual das RPCs precise ser atualizada, será criada uma migration numerada conforme a sequência vigente, sem escolher manualmente um número conflitante.
- A migration será aplicada primeiro no banco DEV usando o MCP do Supabase, validada com testes de banco e somente depois considerada para promoção.
- As funções `SECURITY DEFINER` deverão manter `search_path` fixo, qualificadores explícitos de schema, filtragem por tenant e grants já estabelecidos.
- A consulta deverá resolver as durações em conjunto, evitando uma consulta por slot ou por serviço. Índices só serão adicionados se uma medição ou plano de execução demonstrar necessidade.
- Nenhuma alteração será aplicada ao banco PROD nesta spec antes da validação completa no DEV.

### React e arquitetura

- O módulo temporal de Agenda será o seam profundo: uma interface pequena receberá segmentos de escala, intervalo e durações efetivas e devolverá slots viáveis.
- Componentes de apresentação não decidirão fechamento, duração, timezone ou intervalo.
- O estado React deverá permanecer derivado das fontes já carregadas, evitando efeitos extras, listeners duplicados e consultas N+1.
- Carregamentos independentes de serviços, profissionais e configurações continuarão paralelizáveis.
- A implementação deverá manter o adapter Supabase existente e os contratos de domínio atuais sempre que forem suficientes.

### Compatibilidade e segurança

- Agendamento normal continuará respeitando funcionamento da barbearia, escala do profissional, intervalo, bloqueios, conflitos, antecedência mínima e revalidação no servidor.
- Encaixe personalizado continuará podendo ultrapassar expediente, escala e grade quando o gerente escolher esse modo.
- O valor de `tenant_id` continuará vindo do contexto confiável da aplicação/RPC, nunca de uma entrada pública aceita sem validação.
- A mudança não deverá alterar mensagens, comandas, pagamentos, cores dos cards, sessão pública, Turnstile ou regras de confirmação WhatsApp.

## Testing Decisions

Um teste bom deve verificar o comportamento observável: quais horários são retornados, quais podem ser selecionados e se o servidor rejeita uma tentativa inviável. Não deve depender de detalhes de implementação quando o contrato público do módulo puder ser exercitado.

### Módulos e testes

1. **Domínio temporal:** testes unitários para término inclusivo, fechamento mais restritivo, durações múltiplas, intervalo e grade ancorada.
2. **Agenda interna:** testes do modal e da régua para profissional único, vários profissionais, duração específica e encaixe personalizado.
3. **Agenda mobile:** teste de paridade com a lista normal e preservação de cards persistidos fora do expediente.
4. **Canal público:** testes de fluxo garantindo que apenas slots disponíveis sejam renderizados e que o serviço selecionado determine a duração.
5. **RPCs Supabase:** testes pgTAP para disponibilidade interna, sessão/token e `get_public_schedule_by_slug`.
6. **Persistência:** teste de confirmação que aceite término exatamente no fechamento e rejeite término posterior.
7. **Regressão:** execução das suítes atuais de Agenda, fluxo público, reagendamento, intervalos, grade profissional e encaixes.

### Cenários obrigatórios

- Barbearia fecha às 19:00, grade de 40 minutos, serviço de 40 minutos: a Agenda interna exibe `18:40` na régua, mas o modal normal e o banco não o aceitam como disponibilidade; o link público não o apresenta.
- Mesmo cenário com serviço de 20 minutos habilitado: `18:40` permanece elegível para o serviço curto no modal e no link público.
- Serviço de 60 minutos com fechamento às 19:00: `18:00` é aceito somente quando termina exatamente às 19:00; `18:40` continua visível na régua interna, mas é rejeitado no fluxo normal e não é público.
- Profissional termina às 17:00 e barbearia às 19:00: horários que terminam depois de 17:00 não são oferecidos para agendamento normal.
- Profissional termina às 19:00 e barbearia às 17:00: horários que terminam depois de 17:00 não são oferecidos.
- Intervalo das 12:00 às 14:00: nenhum serviço cruza o intervalo e a grade da tarde continua reiniciando às 14:00.
- Grade de 40 minutos ancorada às 09:00: manter `09:00`, `09:40`, `10:20` e a cadência já validada.
- Serviço específico do profissional menor que o serviço base: usar a duração específica no limite.
- Serviço específico desabilitado: usar a duração base do serviço.
- Nenhum serviço elegível para o último slot: manter o slot na régua interna para referência, impedir sua seleção normal e removê-lo da disponibilidade do link público.
- Pelo menos um serviço elegível entre profissionais selecionados: manter o slot na grade interna.
- Horário passado, bloqueado, ocupado ou fora da antecedência: continuar indisponível.
- Encaixe pela grade: aplicar a regra de viabilidade normal.
- Encaixe personalizado: permitir horário fora do expediente e manter o término sem truncamento.
- Atendimento existente fora do expediente: manter o card visível no horário persistido.
- Confirmação pública concorrente: revalidar no servidor e impedir término inviável.
- Tenant sem expediente ativo no dia: não expor disponibilidade pública.
- Timezone do tenant diferente do navegador: calcular o limite no horário local do tenant.
- Isolamento: uma consulta pública não pode usar serviço, profissional ou expediente de outro tenant.

### Validação no DEV

- Aplicar qualquer migration somente no banco DEV via MCP.
- Executar os testes de banco e consultar as definições das RPCs antes e depois da alteração.
- Validar no navegador integrado, sem navegador externo, em desktop e viewport mobile de 390 x 844.
- Registrar evidências da régua interna, do bloqueio no agendamento normal e do link público para o cenário `19:00 / 40 min / 18:40`, além do caso positivo do serviço curto.
- Comparar com os snapshots existentes das Specs 023, 024, 025 e 028 para garantir que grade, intervalos, sessão pública e encaixes não regrediram.
- Não inserir dados de teste em PROD e não promover a alteração antes da confirmação do DEV.

## Out of Scope

- Permitir encaixe personalizado no link público.
- Alterar `business_hours`, `weekly_schedule`, `slot_interval_minutes` ou antecedência mínima.
- Criar uma nova tabela, coluna ou sessão para armazenar a viabilidade do slot.
- Mudar a cadência da grade, a ancoragem no profissional ou o reinício após intervalo.
- Fazer o próximo slot se adaptar automaticamente ao término do atendimento anterior.
- Alterar preço, duração cadastrada ou duração específica do profissional.
- Alterar comanda, pagamentos, cores dos cards, faltas ou mensagens WhatsApp.
- Alterar Turnstile, autenticação anônima, sessão pública ou gerenciamento de agendamentos.
- Corrigir os advisors não relacionados a esta regra.
- Alterar PROD, fazer deploy ou criar commit como parte da elaboração desta spec.

## Further Notes

- A causa foi localizada no desacoplamento entre geração da grade e duração efetiva: o início anterior ao fechamento não garante que o atendimento termine antes dele.
- O banco DEV já expõe as funções de disponibilidade necessárias e possui os campos de duração e expediente; a necessidade provável é atualizar as condições das RPCs, não o modelo de dados.
- A migration existente que tratou o fechamento como limite de início deverá ser preservada historicamente; esta mudança deverá ser uma nova migration corretiva, sem editar migrations antigas.
- A alteração deve ser implementada primeiro em DEV, com persistência e evidência visual, antes de qualquer sincronização com PROD ou `main`.
- Esta spec foi criada localmente para revisão. Nenhum código, banco, migration, dado, commit, push ou deploy foi alterado nesta etapa.
