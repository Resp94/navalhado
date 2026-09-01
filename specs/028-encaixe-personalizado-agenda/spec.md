# Spec 028 — Encaixe personalizado na Agenda

**Status:** ready-for-agent  
**Escopo:** Agenda operacional do gerente, desktop e mobile  
**Ambientes:** primeiro desenvolvimento; produção somente após validação

## Problem Statement

O Navalhado já permite registrar encaixes diretamente na Agenda e já diferencia encaixes de agendamentos normais. Porém, o formulário de encaixe atualmente força o horário escolhido a seguir a grade configurada do tenant. Isso impede o gerente de registrar uma exceção operacional em um horário específico que não seja múltiplo do intervalo da grade.

O caso também precisa funcionar quando o horário escolhido ultrapassar o expediente da barbearia e a escala individual do barbeiro. Um encaixe personalizado representa uma decisão operacional explícita do gerente, e não uma disponibilidade pública oferecida ao cliente.

As regras normais devem permanecer intactas: agendamentos públicos e agendamentos comuns continuam limitados pelo funcionamento da barbearia, pela escala do profissional, pelos intervalos e pela antecedência configurada.

## Solution

Adicionar ao fluxo operacional de encaixe duas modalidades claramente separadas:

1. **Encaixe pela grade:** preserva a ação atual da Agenda e os horários sugeridos pela grade configurada.
2. **Encaixe personalizado:** permite que o gerente informe manualmente qualquer horário válido para uma data, serviço e profissional.

O encaixe personalizado será salvo como um agendamento com `is_fitting = true`, usando o mesmo registro de `appointments`, a mesma duração efetiva do serviço e os mesmos controles de comanda, pagamento, falta e visualização já existentes.

Quando o horário personalizado estiver fora do expediente da barbearia, fora da escala do profissional ou depois do fechamento, o registro ainda será permitido por ser um encaixe explícito. Ele deverá aparecer na Agenda no horário exato informado, em ordem cronológica, sem alterar a grade normal.

## User Stories

1. Como gerente, quero continuar criando um encaixe clicando diretamente em um horário da Agenda, para preservar meu fluxo operacional atual.
2. Como gerente, quero registrar encaixes em dias passados, atuais e futuros, para manter o histórico e planejar exceções operacionais.
3. Como gerente, quero escolher entre um horário sugerido pela grade e um horário personalizado, para diferenciar uma exceção manual de um encaixe alinhado à grade.
4. Como gerente, quero informar manualmente o horário de início de um encaixe, para registrar o horário real combinado com o cliente.
5. Como gerente, quero usar horários personalizados que não sejam múltiplos do intervalo da grade, como 18:10 em uma grade de 40 minutos, para não ficar limitado por uma regra destinada à disponibilidade normal.
6. Como gerente, quero registrar um encaixe personalizado às 18:00 quando o barbeiro encerra às 17:00, para controlar atendimentos excepcionais autorizados.
7. Como gerente, quero registrar um encaixe personalizado depois do fechamento da barbearia, para atender situações operacionais excepcionais sem alterar o expediente configurado.
8. Como gerente, quero que a duração do encaixe continue vindo do serviço e da configuração específica do profissional, para preservar o cálculo atual.
9. Como gerente, quero que um serviço de 60 minutos iniciado às 18:00 termine às 19:00 ou depois disso sem ser truncado, para manter o tempo real do atendimento.
10. Como gerente, quero escolher o profissional responsável pelo encaixe, para que o atendimento seja atribuído corretamente.
11. Como gerente, quero escolher um serviço ativo para o encaixe, para que preço e duração sejam consistentes com o cadastro atual.
12. Como gerente, quero associar um cliente existente ou cadastrar um cliente conforme o fluxo atual, para manter o histórico do atendimento.
13. Como gerente, quero criar um encaixe de balcão sem cliente quando o fluxo operacional permitir, para não bloquear um atendimento rápido.
14. Como gerente, quero que o registro continue identificado como encaixe na Agenda e na comanda, para não confundi-lo com um agendamento público.
15. Como gerente, quero que um encaixe personalizado apareça no horário exato informado, para que a visualização represente o combinado real.
16. Como barbeiro, quero ver encaixes personalizados em ordem cronológica junto aos demais atendimentos, para controlar a sequência do dia.
17. Como gerente, quero que a duração visual do card reflita o intervalo entre início e fim persistidos, para entender a ocupação prevista.
18. Como gerente, quero que um encaixe personalizado possa coexistir com a regra operacional de encaixes concorrentes já existente, para não perder a finalidade do encaixe de balcão.
19. Como gerente, quero que o sistema impeça apenas duplicidade indevida do mesmo encaixe para o mesmo profissional e horário inicial, conforme a proteção atual, para evitar registros acidentais.
20. Como gerente, quero que agendamentos normais continuem bloqueados fora do expediente da barbearia, para proteger a disponibilidade pública.
21. Como gerente, quero que agendamentos normais continuem respeitando a escala individual do profissional, para não oferecer horários que ele não atende.
22. Como gerente, quero que agendamentos normais continuem respeitando intervalos e bloqueios, para não quebrar as regras atuais da Agenda.
23. Como gerente, quero que a antecedência mínima continue valendo para agendamentos públicos, para não transformar o encaixe operacional em disponibilidade pública.
24. Como gerente, quero que o modo personalizado não altere `business_hours`, `weekly_schedule` ou `slot_interval_minutes`, para preservar as configurações do tenant.
25. Como gerente, quero que a ação de marcar não compareceu continue disponível para encaixes quando aplicável, para manter o controle dos atendimentos.
26. Como gerente, quero abrir a comanda de um encaixe personalizado pela Agenda, para finalizar o atendimento no fluxo existente.
27. Como gerente, quero que pagamento e finalização de comanda continuem atualizando o estado visual do encaixe, para manter a semântica atual das cores.
28. Como gerente, quero que as regras atuais de confirmações WhatsApp para encaixes passados e futuros permaneçam válidas, para não reintroduzir mensagens indevidas.
29. Como gerente, quero receber mensagens claras quando faltar data, horário, profissional, serviço ou cliente obrigatório, para corrigir o cadastro sem ambiguidades.
30. Como gerente, quero que o horário personalizado aceite somente um horário válido no formato local da barbearia, para evitar registros inválidos.
31. Como gerente, quero que o horário seja convertido para `timestamptz` usando o timezone do tenant, para manter consistência entre navegador, banco e Agenda.
32. Como gerente, quero que a data e o horário sejam preservados ao trocar entre modo de grade e modo personalizado, para não perder o que já informei.
33. Como gerente, quero retornar ao modo de grade sem apagar o formulário, para alternar a estratégia com segurança.
34. Como gerente, quero que o desktop e o mobile ofereçam o mesmo comportamento de encaixe, para não haver regras diferentes por dispositivo.
35. Como responsável pelo tenant, quero isolamento por `tenant_id` em todas as consultas e gravações, para impedir mistura entre barbearias.
36. Como administrador, quero manter o schema atual quando ele já atende ao caso, para reduzir risco de regressão e evitar migration desnecessária.
37. Como administrador, quero que qualquer eventual alteração futura de banco seja versionada e aplicada primeiro em DEV, para preservar rastreabilidade.
38. Como operador, quero consultar na Agenda encaixes fora do expediente sem que eles desapareçam por filtros de horário, para acompanhar a operação real.
39. Como operador, quero que encaixes cancelados continuem seguindo a filtragem e os estados atuais, para não criar cards indevidos.
40. Como desenvolvedor, quero uma única regra de domínio para construir o horário inicial e final do encaixe, para evitar divergência entre desktop, mobile e persistência.

## Implementation Decisions

### 1. Modelo de domínio

- O encaixe continuará sendo representado por `appointments` com `is_fitting = true` e `origin = 'manual'`.
- `start_time` e `end_time` continuarão sendo os valores oficiais do atendimento.
- O modo de criação será uma decisão do fluxo da Agenda, não um novo tipo de registro no banco.
- O encaixe personalizado não será publicado como disponibilidade e não será usado pelo fluxo público do cliente.
- O modo de grade continuará usando o intervalo configurado pelo tenant e a estratégia atual de horários sugeridos.
- O modo personalizado aceitará qualquer horário local válido, sem exigir alinhamento ao intervalo da grade.

### 2. Seam e arquitetura

O seam principal será o módulo de domínio temporal da Agenda, responsável por receber a data, o horário, o timezone, a duração efetiva e o modo de encaixe, retornando um intervalo persistível e as validações de formato. A interface deverá ser pequena e compartilhada pelo container da Agenda e pelas apresentações desktop/mobile.

O formulário será um módulo de orquestração. Ele não deverá duplicar regras de conversão de timezone, duração ou validação em handlers diferentes. A implementação visual poderá ter adaptadores desktop e mobile, mas ambos deverão chamar o mesmo seam de domínio.

O adapter Supabase continuará usando a tabela `appointments` existente. Não será criado um adapter paralelo nem uma segunda tabela para encaixes personalizados.

### 3. Regras de horário

- **Agendamento normal:** continua respeitando funcionamento do tenant, escala do profissional, intervalo, bloqueios, duração e antecedência aplicável.
- **Encaixe pela grade:** continua sendo criado como encaixe e preserva a grade sugerida pelo fluxo atual.
- **Encaixe personalizado:** não é submetido aos limites de expediente, escala ou múltiplo do intervalo, porque é uma exceção operacional explícita.
- Todo modo de encaixe deve validar data, horário local válido, profissional ativo, serviço ativo, duração positiva, conversão de timezone e conflito que a regra atual do encaixe já considera impeditivo.
- O sistema não deve alterar a configuração do tenant ou do profissional como efeito colateral de um encaixe.
- A duração será calculada pela mesma precedência já existente: duração específica do profissional quando configurada; caso contrário, duração do serviço.
- O horário final será calculado adicionando a duração efetiva ao início, sem truncar no expediente.

### 4. Persistência e regras atuais do banco

O levantamento em DEV e PROD confirmou que o schema atual já possui os campos necessários em `appointments`, inclusive `start_time`, `end_time`, `is_fitting` e `origin`.

A trigger de validação de limites de agendamento retorna antes das validações de expediente quando `is_fitting` é verdadeiro. Portanto, ela já permite encaixes fora do horário da barbearia e da escala do profissional, enquanto mantém as restrições para agendamentos normais.

A constraint de não sobreposição também exclui registros com `is_fitting = true`, preservando o comportamento operacional atual de encaixes concorrentes. Essa regra não deverá ser alterada incidentalmente.

Não será criada migration nesta spec se a implementação permanecer restrita ao fluxo existente e aos campos já disponíveis. Se surgir necessidade comprovada de mudança de schema, a migration deverá ser numerada conforme a sequência vigente, revisada, aplicada somente em DEV via MCP e validada antes de qualquer promoção.

### 5. Segurança e isolamento

- Toda leitura e gravação deverá filtrar pelo tenant autenticado no contexto da Agenda.
- O frontend nunca deverá aceitar `tenant_id` de outro tenant como parâmetro confiável.
- O modo personalizado não poderá ser exposto no canal público do cliente.
- O valor de `is_fitting` deverá ser definido pelo fluxo operacional e enviado explicitamente na gravação.
- A gravação não poderá permitir que um agendamento normal contorne expediente apenas por receber um horário manual.
- Não serão alteradas policies, funções privilegiadas ou permissões sem evidência de que o fluxo atual não atende ao caso.
- Logs e mensagens de erro não devem expor token, secret, telefone completo ou dados de outro tenant.

### 6. Interface do gerente

- O formulário de encaixe deverá apresentar uma escolha explícita entre “Usar horário da grade” e “Horário personalizado”.
- No modo de grade, manter o seletor de horários sugeridos e o comportamento existente.
- No modo personalizado, exibir controle de data e horário com precisão de minutos.
- Exibir uma indicação curta de que o horário personalizado é uma exceção operacional e pode ultrapassar o expediente.
- Mostrar prévia da data, horário, profissional, serviço e duração antes da confirmação.
- Não bloquear o botão de confirmação somente porque o horário está fora do expediente ou não coincide com a grade quando o modo personalizado estiver ativo.
- Manter o fluxo atual de cliente existente, novo cliente e encaixe sem cadastro quando permitido.
- Depois de salvar, fechar o formulário, atualizar a Agenda e exibir o card no horário persistido.

### 7. Exibição na Agenda

- A Agenda deverá ordenar o encaixe personalizado pelo `start_time` local do tenant.
- O card deverá aparecer mesmo quando não houver slot padrão correspondente.
- O posicionamento visual deverá usar o instante real do atendimento e a duração persistida, sem arredondar para o intervalo da grade.
- O card continuará exibindo o selo de encaixe, estado de pagamento, estado do atendimento e ações existentes.
- A visualização mobile deverá manter o mesmo horário e a mesma classificação do desktop.
- A presença de um encaixe personalizado não deverá criar slots públicos nem deslocar a grade normal.

### 8. Mensageria e comanda

- A criação continuará usando o fluxo atual de comanda automática e atualização da Agenda.
- Encaixes passados continuarão sem confirmações WhatsApp para cliente e barbeiro, conforme a Spec 025.
- Encaixes futuros continuarão seguindo as regras atuais de confirmação.
- A finalização do atendimento e da comanda continuará determinando o estado totalmente verde do card conforme a regra existente.
- O preço continuará vindo do serviço e será apresentado na comanda/confirmação pelo fluxo existente, sem duplicar valor em `appointments`.

### 9. React e performance

- O estado do modo de horário deverá ser pequeno e derivado apenas quando necessário.
- A validação de formato e cálculo local não deverá depender de efeitos assíncronos.
- Consultas independentes de profissionais, serviços e clientes poderão ser carregadas em paralelo.
- Desktop e mobile deverão compartilhar o contrato de domínio e o mesmo adapter de persistência.
- Não serão criados listeners, consultas ou estados duplicados para suportar o modo personalizado.
- Componentes de apresentação não deverão conter regras próprias de expediente, grade ou timezone.

## Testing Decisions

Um bom teste deverá verificar o comportamento observável pelo gerente e o contrato do seam de domínio. Não deverá testar detalhes internos de implementação quando o mesmo comportamento puder ser coberto pela interface do módulo.

### Módulos e testes

1. **Domínio temporal da Agenda:** validar horário local, duração efetiva, timezone, intervalo final e separação entre modo de grade e personalizado.
2. **Formulário de encaixe:** validar alternância de modos, preservação de campos, mensagens de validação e submissão com `is_fitting = true`.
3. **Adapter Supabase:** validar tenant, profissional, serviço, `start_time`, `end_time`, `is_fitting` e `origin` persistidos corretamente.
4. **Agenda desktop:** validar encaixe em slot de grade, encaixe personalizado fora da grade, encaixe fora do expediente e ordenação cronológica.
5. **Agenda mobile:** repetir os cenários relevantes no layout mobile, mantendo horário, selo, duração visual e ações.
6. **Comanda:** confirmar criação/abertura da comanda e preservação do fluxo de finalização.
7. **Mensageria:** confirmar que as regras de encaixe passado e futuro da Spec 025 permanecem intactas.
8. **Banco DEV:** consultar a persistência antes e depois dos testes, sem criar ou alterar dados em PROD.
9. **Segurança:** confirmar isolamento por tenant e que um agendamento normal não contorna limites por usar o formulário comum.

### Cenários obrigatórios

- Grade de 40 minutos com encaixe pela grade em horário alinhado.
- Grade de 40 minutos com encaixe personalizado às 18:10.
- Barbeiro e barbearia encerrando às 17:00 com encaixe personalizado às 18:00.
- Serviço de 60 minutos iniciado às 18:00, com término posterior ao fechamento.
- Encaixe personalizado antes do início da escala.
- Encaixe personalizado em dia em que a barbearia está fechada.
- Encaixe personalizado em dia passado.
- Encaixe personalizado no dia atual.
- Encaixe personalizado em dia futuro.
- Tentativa de criar agendamento normal fora do expediente, confirmando que continua bloqueada.
- Tentativa de criar agendamento normal fora da escala do profissional, confirmando que continua bloqueada.
- Intervalo do profissional, confirmando que o bloqueio permanece para agendamento normal.
- Serviço com duração específica do profissional.
- Serviço sem duração específica do profissional, usando a duração do cadastro do serviço.
- Cliente existente, novo cliente e encaixe sem cliente quando permitido.
- Dois encaixes no mesmo profissional e horário inicial, confirmando a proteção atual contra duplicidade acidental.
- Encaixe sobreposto a agendamento normal, confirmando a semântica operacional já existente de encaixe.
- Card exibido no horário exato e ordenado junto aos demais cards.
- Abertura, finalização, pagamento e estado visual da comanda.
- Encaixe passado sem confirmação WhatsApp.
- Encaixe futuro com confirmação conforme as regras atuais.
- Falha de rede durante a gravação, sem duplicar o registro ao repetir a ação.
- Revalidação no banco DEV após cada cenário persistível.

### Validação visual

- Validar no navegador integrado, sem abrir navegador externo.
- Repetir em desktop e mobile, incluindo viewport de 390 x 844.
- Registrar prints dos estados: seleção do modo, horário personalizado, confirmação, card na Agenda e comanda.
- Não expor credenciais, tokens, secrets ou telefones completos nas evidências.
- Comparar o resultado com o snapshot atual da Agenda antes de considerar a implementação concluída.

## Out of Scope

- Alterar `business_hours`, `weekly_schedule`, `slot_interval_minutes` ou antecedência do tenant.
- Alterar a grade de disponibilidade pública.
- Permitir horário personalizado no fluxo público do cliente.
- Alterar o cálculo de duração padrão ou específica do profissional.
- Reescrever o módulo de Agenda ou criar uma segunda Agenda para encaixes.
- Alterar a constraint existente de sobreposição de encaixes.
- Alterar policies, RPCs, triggers ou permissões sem necessidade comprovada.
- Criar tabela, coluna ou migration apenas para diferenciar o modo de horário.
- Alterar o fluxo de sessão pública, gerenciamento de agendamentos ou Turnstile.
- Alterar a arquitetura de mensageria, provider, outbox, retry ou idempotência.
- Criar dados de teste em PROD.
- Promover qualquer alteração para PROD antes da validação em DEV.

## Further Notes

- O levantamento atual encontrou DEV e PROD com a mesma estrutura relevante para esse caso: configuração do tenant em JSONB, escala do profissional em JSONB e campos de intervalo em `appointments`.
- DEV possui a barbearia de teste com grade de 40 minutos e antecedência de 60 minutos. PROD possui a Brooklyn com grade de 40 minutos e antecedência de 30 minutos. Esses valores são configurações observadas, não valores hardcoded da feature.
- PROD já contém encaixes persistidos além do fechamento configurado, o que confirma que a camada de banco já suporta a exceção operacional.
- O principal bloqueio atual está na validação e na lista de horários do formulário da Agenda, que usam a grade mesmo quando o gerente precisa de um horário personalizado.
- A implementação deve preservar o comportamento existente de encaixes pela Agenda e introduzir a exceção de horário personalizado de forma explícita.
- Qualquer alteração de banco deverá seguir o fluxo MCP, ser versionada com numeração sequencial e ser validada primeiro em DEV.
- Esta spec foi gerada localmente para avaliação. Nenhum código, dado, migration, deploy ou ticket externo foi alterado nesta etapa.
