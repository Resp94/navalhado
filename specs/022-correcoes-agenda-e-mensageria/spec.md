## Problem Statement

Em alguns tenants, a operação apresenta divergências entre a configuração salva e o comportamento observado.

Na Agenda da Barbearia Brooklyn, o intervalo configurado de 40 minutos aparece corretamente antes do intervalo, mas a grade volta a apresentar slots de 20 minutos depois do retorno. O problema aparece no mobile e precisa ser protegido também no desktop. A configuração é por tenant e não pode depender de valores globais, de uma sessão antiga ou de uma interpretação diferente entre componentes.

Na tela de WhatsApp, o gerente informa que modelos personalizados parecem não ser persistidos quando tenta salvar repetidamente. A investigação mostrou que as gravações atuais chegam ao banco, mas a experiência precisa garantir que o valor salvo seja confirmado, reapresentado e utilizado pelo dispatcher do mesmo tenant. Um modelo personalizado que não contém `{link}` também não deve receber um link implícito que o gerente não solicitou.

Na automação de primeiro contato, a remoção de palavras-chave não é efetiva. Quando a lista é apagada, o frontend pode reapresentar a lista padrão e a Edge Function trata `NULL` como autorização para usar palavras-chave padrão, incluindo `link`. Como consequência, uma palavra removida continua habilitando respostas. A regra de primeira mensagem do dia também precisa ficar explícita e coberta para não ser confundida com a regra das palavras-chave.

Esses problemas atingem código frontend, persistência por tenant, Edge Functions, observabilidade e validação entre DEV e PROD. A correção deve começar em DEV, preservar o contrato de envio UAZAPI, ser validada integralmente e só então ser promovida por merge para `main` e aplicada em PROD.

## Snapshot Regression Baseline

Os snapshots operacionais existentes são contratos de regressão desta especificação. Os itens abaixo foram validados anteriormente e não podem ser quebrados silenciosamente:

- `/agenda` desktop e mobile carregam a grade do tenant, respeitam expediente, escala, intervalo, antecedência e data; encaixes mantêm diferenciação visual, seleção de profissional ativo e regras de conflito/capacidade.
- `/comandas` identifica corretamente a origem `Encaixe`, `Agendamento` ou balcão/avulsa a partir da relação com o agendamento e de `is_fitting`, em mobile e desktop.
- `/profissionais` preserva escalas existentes, dias fechados, limites derivados do expediente e dados já salvos.
- `/configuracoes` mantém timezone do tenant, intervalo da grade, antecedência mínima e expediente por dia.
- O Canal do Cliente e os links públicos tokenizados mantêm validação de token e tenant, criação, consulta, cancelamento e reagendamento, disponibilidade e regras de prazo/conflito.
- O reagendamento público persiste o novo horário e cria/processa o evento correspondente no outbox sem chamar fallback inválido.
- Todos os fluxos WhatsApp já implementados permanecem cobertos: boas-vindas, primeiro contato, respostas por palavras-chave, confirmação, cancelamento, reagendamento, lembretes e envio manual.
- A mensageria continua usando dispatcher comum, outbox durável, retry, idempotência por tenant e direção, opt-out e observabilidade sanitizada.
- Triggers privilegiados, RPCs da outbox, RLS, grants, isolamento por tenant e contrato de envio UAZAPI permanecem preservados.
- O frontend continua sem expor `instance_token`, secrets, JWTs, tokens de acesso ou telefone completo.
- Serviços continuam sem overflow horizontal no mobile validado e com layout desktop preservado.

As limitações registradas nos snapshots também permanecem válidas: algumas larguras e orientações ainda não foram cobertas, o build pode emitir o aviso preexistente de bundle grande e os registros históricos de falha não devem ser confundidos com novas falhas. Esses itens não serão “corrigidos” por esta entrega sem evidência específica.

## Solution

Corrigir a origem única da configuração da grade, o ciclo de salvamento dos modelos e a interpretação da lista de palavras-chave, com testes de regressão nos seams mais altos disponíveis.

A Agenda deverá normalizar uma única vez as configurações do tenant e usar o mesmo intervalo para a régua, os slots antes e depois do intervalo, os modais de agendamento, encaixes e bloqueios, no desktop e no mobile. O retorno do intervalo não poderá alterar o passo da grade. Atualizações de configuração deverão refletir no contexto consumido pela Agenda sem deixar estado antigo ativo.

O editor de mensagens deverá salvar sempre na Instância WhatsApp do tenant autenticado, aguardar uma única operação de persistência por ação, consumir a linha retornada pelo banco e exibir o valor confirmado. A personalização salva será a fonte de verdade do renderer: se o gerente remover `{link}` de um modelo personalizado, esse modelo não receberá um link anexado automaticamente. Os templates padrão continuarão contendo o comportamento padrão, inclusive o link quando definido no template padrão.

A lista de palavras-chave será tratada como configuração explícita do tenant. Lista vazia ou `NULL` não significa restaurar padrões: significa que nenhuma mensagem adicional baseada em palavra-chave deve ser habilitada. A palavra removida deixará de casar imediatamente após o salvamento. A política existente para a primeira mensagem do dia será preservada nesta entrega para evitar regressão; ela será testada separadamente da política de palavras-chave e ficará documentada na interface.

Todas as mudanças serão implementadas e validadas em DEV antes da promoção. Migrations, se forem necessárias, serão novas e versionadas; nenhuma migration existente será editada. Depois dos gates de DEV, o código será incorporado em `main`, o banco PROD receberá apenas migrations ausentes e a Edge Function será publicada em PROD com a mesma versão validada.

## User Stories

1. Como gerente, quero que a Agenda respeite o intervalo configurado pela minha barbearia, para que a régua represente a operação real do tenant.
2. Como gerente, quero que um intervalo de 40 minutos produza slots de 40 minutos antes e depois do almoço, para que o retorno do intervalo não altere a grade.
3. Como gerente, quero que um intervalo de 30 minutos continue produzindo slots de 30 minutos, para que tenants com configurações diferentes permaneçam isolados.
4. Como gerente, quero ver a mesma grade no desktop e no mobile, para que a operação não mude conforme o dispositivo.
5. Como gerente, quero que a Agenda atualize sua grade depois de uma alteração de configuração, para que eu não precise confiar em uma sessão antiga ou recarregar várias vezes.
6. Como gerente, quero que os slots de um profissional selecionado usem o mesmo intervalo do tenant, para que a filtragem de profissionais não introduza uma segunda régua.
7. Como gerente, quero que o intervalo de almoço apenas remova o período de pausa, para que ele não altere a duração do passo da grade.
8. Como gerente, quero que encaixes, bloqueios e modais de horário respeitem a mesma configuração da Agenda, para que não existam horários válidos em uma tela e inválidos em outra.
9. Como gerente, quero que uma configuração de um tenant não afete outra barbearia, para que o produto continue multi-tenant.
10. Como gerente, quero salvar um modelo personalizado e receber confirmação visual de que ele foi persistido, para que eu saiba que a alteração foi aceita.
11. Como gerente, quero que o modelo reapareça exatamente como salvo depois de trocar de aba ou recarregar a tela, para que a interface não restaure um rascunho antigo.
12. Como gerente, quero que uma ação de salvar não seja sobrescrita por uma resposta antiga de outra tentativa, para que cliques repetidos não percam a última alteração.
13. Como gerente, quero que o salvamento seja desabilitado enquanto a operação estiver em andamento, para que não sejam criadas gravações concorrentes desnecessárias.
14. Como gerente, quero que o modelo salvo para uma Instância WhatsApp seja lido somente dentro do meu tenant, para que uma barbearia nunca veja ou altere a configuração de outra.
15. Como gerente, quero remover `{link}` de uma mensagem personalizada e não receber um link anexado, para que o texto enviado corresponda ao que configurei.
16. Como gerente, quero incluir `{link}` explicitamente quando desejar o link de autoatendimento, para que a presença do link seja uma decisão do modelo.
17. Como gerente, quero que a prévia da tela mostre o mesmo resultado que será enviado pela Edge Function, para que não haja diferença entre prévia e WhatsApp.
18. Como gerente, quero restaurar o modelo padrão quando desejar, para que o comportamento oficial possa ser recuperado sem edição manual.
19. Como gerente, quero que o modelo salvo continue funcionando para confirmação, reagendamento, cancelamento, lembrete e primeiro contato, para que a correção não quebre outros eventos.
20. Como gerente, quero remover uma palavra-chave e impedir que ela continue habilitando respostas, para que a configuração tenha efeito imediato.
21. Como gerente, quero apagar todas as palavras-chave e deixar o recurso sem gatilhos configurados, para que `NULL` ou texto vazio não restaure palavras padrão silenciosamente.
22. Como gerente, quero que a lista de palavras-chave seja carregada vazia quando estiver vazia no banco, para que a tela não mostre valores fictícios.
23. Como gerente, quero que acentos, maiúsculas e espaços sejam normalizados sem reintroduzir palavras removidas, para que a comparação continue previsível.
24. Como cliente, quero que uma mensagem sem palavra-chave não gere resposta quando a política diária já tiver sido atendida, para que eu não receba mensagens inesperadas.
25. Como cliente, quero que a primeira mensagem do dia siga uma regra documentada e estável, para que a automação não dependa de interpretações diferentes entre telas e versões.
26. Como operador, quero distinguir no ledger uma mensagem enviada de uma mensagem ignorada por regra, para que a investigação não confunda bloqueio intencional com falha UAZAPI.
27. Como operador, quero que falhas de persistência dos modelos apresentem erro observável sem expor credenciais, para que o diagnóstico seja possível sem vazamento de dados.
28. Como operador, quero que o primeiro contato permaneça tenant-scoped e idempotente, para que a correção de palavras-chave não gere mensagens duplicadas.
29. Como operador, quero que mensagens de confirmação e primeiro contato continuem passando pela mesma fronteira UAZAPI, para que a integração existente permaneça protegida.
30. Como desenvolvedor, quero validar a correção em DEV antes de qualquer mudança em PROD, para que falhas sejam descobertas em ambiente controlado.
31. Como desenvolvedor, quero aplicar migrations novas e imutáveis, para que o histórico do banco continue reproduzível.
32. Como responsável pela operação, quero que PROD só seja atualizado após os testes, a validação funcional e o merge em `main`, para que o ambiente publicado corresponda ao código aprovado.
33. Como responsável pela operação, quero comparar DEV e PROD depois da promoção, para que diferenças relevantes de schema, funções, policies e Edge Functions sejam identificadas antes do encerramento.

## Implementation Decisions

- O domínio continuará sendo multi-tenant. Toda leitura e gravação de configuração de Agenda ou WhatsApp deverá estar vinculada ao tenant autenticado e, no caso da mensageria, à Instância WhatsApp pertencente a esse tenant.
- A política de grade temporal será centralizada no seam de geração de slots já utilizado pela Agenda. Desktop, mobile, encaixes, bloqueios e seletores consumirão a configuração normalizada do tenant, sem duplicar um intervalo local.
- `slot_interval_minutes` será convertido e validado uma única vez no contexto operacional. Valores positivos serão preservados por tenant; ausência ou valor inválido usará apenas o fallback técnico já definido, sem substituir silenciosamente uma configuração válida.
- A geração antes e depois de um intervalo profissional usará o mesmo passo. O `break_start` e o `break_end` definem somente a área excluída e o ponto de retomada.
- A atualização de configuração deverá invalidar ou atualizar o estado consumido pela Agenda. A solução não poderá depender de recarregar a página para remover um valor antigo.
- O editor de templates usará a resposta da persistência como estado confirmado. Uma ação de salvar terá uma única mutação ativa por vez e respostas obsoletas não poderão substituir a alteração mais recente.
- O carregamento de `auto_reply_keywords` será baseado na presença do campo, e não em sua avaliação booleana. `NULL` e texto vazio serão exibidos como lista vazia, nunca como a lista padrão.
- A Edge Function não usará fallback de palavras-chave padrão quando `auto_reply_keywords` estiver `NULL` ou vazio. O matching será feito somente contra a lista efetivamente configurada pelo tenant.
- A política de primeira mensagem do dia será preservada nesta correção: a condição de primeira mensagem e a condição de matching por palavra-chave serão avaliadas e registradas separadamente. Não será introduzida uma mudança silenciosa que transforme a primeira mensagem em uma mensagem condicionada a palavra-chave.
- A semântica de uma mensagem personalizada será literal em relação ao link. Se o template personalizado não contiver `{link}`, o renderer não anexará o link por fora. Se contiver `{link}`, o token será interpolado com o link do cliente. Templates ausentes continuarão usando o template padrão correspondente.
- A prévia do frontend e o dispatcher deverão compartilhar a mesma regra de renderização ou reproduzir exatamente o mesmo contrato observável, incluindo ausência ou presença do link.
- A alteração não removerá nem substituirá o ledger `whatsapp_message_idempotency`. Estados `succeeded`, `failed` e ignorado por regra continuarão observáveis, com tenant, evento e motivo sanitizado.
- O fluxo de envio continuará atravessando exclusivamente a Edge Function e o adapter UAZAPI existente. Não haverá envio direto pelo frontend, alteração de secrets, troca de provider ou mudança no contrato de autenticação.
- Qualquer alteração de banco será feita por migration própria, aplicada primeiro em DEV, testada e somente depois aplicada em PROD. Se a correção puder ser feita apenas em frontend e Edge Function, nenhuma migration será criada artificialmente.
- O deploy da Edge Function será feito primeiro no projeto DEV, com verificação de logs e testes de contrato. PROD receberá exatamente a versão validada após o merge em `main`.
- A promoção será interrompida se houver migration ausente, divergência estrutural relevante, falha de teste, erro de Edge Function, regressão de UAZAPI ou diferença de comportamento entre desktop e mobile.
- Nenhum dado operacional de DEV será copiado para PROD. A comparação entre ambientes considerará estrutura, regras, funções, triggers, policies e configuração necessária, não clientes ou mensagens operacionais.
- Nenhuma migration existente será editada, renomeada ou reaplicada. Correções de schema, grants, constraints, RPCs ou triggers exigirão uma nova migration versionada.
- A solução deverá preservar as regras atuais de agenda, timezone do tenant, agendamento público, reagendamento, bloqueios, comandas, notificações e idempotência fora do escopo específico dos achados.
- Antes de qualquer alteração, a suíte focada de Serviços, Agenda, Comandas, Equipe, Configurações, Canal do Cliente, templates e mensageria será executada como baseline. Um teste que regredir qualquer item funcional dos snapshots bloqueia a promoção.

## Testing Decisions

- Os testes validarão comportamento observável e contratos de domínio, não nomes de hooks, loops internos ou detalhes de implementação que não sejam parte do contrato.
- O principal seam de Agenda será a política compartilhada de configuração e geração de slots. Serão testados intervalos de 30 e 40 minutos, com e sem intervalo, antes e depois do retorno, para tenant e profissional.
- Os testes de Agenda deverão verificar que a sequência de 40 minutos permanece 09:00, 09:40, 10:20, 11:00, 11:40, 14:00, 14:40, 15:20 e assim por diante, quando o retorno do intervalo for 14:00. A sequência não poderá conter 14:20, 14:40, 15:00 ou outros passos de 20 minutos nesse cenário.
- A Agenda será validada nos seams desktop e mobile com a mesma entrada de horários. A validação deverá garantir ausência de divergência entre os dois modos.
- Serão testadas alterações de `slot_interval_minutes` enquanto a tela está montada, verificando atualização sem reload e sem reaproveitamento de estado antigo.
- Serão preservados testes de encaixe, bloqueio, seleção de profissional, horário de almoço, fechamento do expediente, timezone e agendamento público.
- A regressão dos snapshots deverá ser verificada por área: serviços mobile/desktop; Agenda mobile/desktop; Comandas e origem; escala de profissionais; configurações e timezone; Canal do Cliente tokenizado; reagendamento/cancelamento; outbox, triggers, RLS, idempotência e todos os tipos de envio WhatsApp.
- O seam de persistência de templates deverá testar gravação, resposta retornada, reentrada na tela, troca de aba, atualização concorrente bloqueada e isolamento por tenant.
- Testes de template deverão confirmar que um modelo personalizado sem `{link}` permanece sem link no resultado enviado e que um modelo com `{link}` o interpola corretamente. Também deverão cobrir fallback para template padrão quando o valor personalizado estiver ausente.
- O preview deverá ser comparado ao renderer usado pelo backend para os mesmos dados, incluindo modelos com e sem `{link}`.
- Testes de palavras-chave deverão cobrir `NULL`, texto vazio, palavra única, múltiplas palavras, remoção de `link`, espaços, acentos, maiúsculas e mensagens sem correspondência.
- Um teste de regressão deverá salvar a lista sem `link`, recarregar a configuração, processar uma mensagem contendo `link` depois de o primeiro contato do dia já estar marcado e verificar que a palavra removida não habilita o envio.
- Outro teste deverá cobrir a primeira mensagem do dia separadamente, documentando o comportamento preservado e impedindo que a correção das palavras-chave altere essa regra por acidente.
- Os testes da Edge Function deverão preservar criação/reutilização de cliente, idempotência, ledger, renderização, opt-out, confirmação, reagendamento, cancelamento, lembrete, welcome e envio UAZAPI.
- Os testes de banco deverão confirmar que não há alteração de schema não versionada, que a Instância WhatsApp consultada pertence ao tenant e que eventuais migrations novas são aplicáveis uma única vez.
- A ordem de validação será: testes focados de regressão em DEV, testes de módulos, testes da Edge Function, testes SQL/migrations, lint, typecheck, build, smoke funcional em DEV, comparação DEV/PROD, merge, repetição das verificações em `main` e smoke em PROD.
- O baseline conhecido dos snapshots inclui, quando aplicável, a suíte frontend completa, a suíte da Edge Function WhatsApp, build, lint, `git diff --check`, testes SQL e validação visual em aproximadamente 390×844 e 1280×900. O conjunto equivalente deverá passar novamente após a correção.
- Nenhuma mensagem real será enviada durante a especificação. O smoke de WhatsApp só ocorrerá na implementação, com autorização operacional e sem expor número completo, tokens ou secrets nos registros.

## Out of Scope

- Alterar a regra comercial de horários de funcionamento, duração de serviços ou escalas dos profissionais.
- Criar uma segunda tabela de configuração de slots ou uma grade diferente para mobile.
- Copiar dados de clientes, agendamentos, mensagens ou instâncias de DEV para PROD.
- Substituir UAZAPI, alterar secrets, trocar endpoints do provider ou criar envio direto pelo frontend.
- Reprocessar automaticamente mensagens históricas já registradas como `failed` ou ignoradas.
- Redesenhar toda a tela de WhatsApp ou toda a Agenda; a alteração visual ficará limitada a feedback e consistência necessários para os contratos corrigidos.
- Mudar a política diária de primeiro contato nesta entrega. Qualquer decisão para exigir palavra-chave também na primeira mensagem do dia deverá ser uma especificação separada ou uma alteração explícita desta regra.
- Resolver todos os alertas gerais dos advisors do Supabase que não estejam diretamente relacionados a esses achados.
- Editar, renomear, apagar ou alterar o conteúdo de migrations já versionadas.
- Aplicar migrations, publicar Edge Functions, fazer merge, enviar mensagens ou alterar dados de produção durante a fase de especificação.

## Further Notes

- Referências de ambiente: DEV é o projeto `Navalhado-dev` e PROD é o projeto `Navalhado`. Os tenants devem ser identificados por seus IDs e nunca por nome hardcoded.
- A configuração atual observada para a Barbearia Brooklyn em PROD é de 40 minutos. O fato de o banco estar correto não encerra a investigação: a validação deve provar que a configuração percorre o contexto e todos os consumidores sem produzir grade mista.
- Os salvamentos recentes de templates em PROD retornaram sucesso no PostgREST e os valores personalizados estão presentes. A implementação deve transformar essa evidência em comportamento determinístico de read-after-write e corrigir a diferença entre estado salvo, preview e mensagem enviada.
- A coluna `auto_reply_keywords` já suporta ausência de valor. O ponto crítico é a semântica no frontend e na Edge Function: ausência deve significar nenhuma palavra configurada, e não restauração implícita.
- A observabilidade deve registrar o motivo de uma mensagem não ser enviada sem registrar texto completo, token de cliente, token da instância ou credenciais.
- O plano de promoção obrigatório é: implementar em DEV; validar código, banco e Edge Functions em DEV; registrar o resultado; fazer merge de DEV em `main`; aplicar apenas migrations ausentes em PROD; publicar a mesma versão validada da Edge Function; comparar DEV e PROD; validar os fluxos; só então considerar a entrega concluída.
- Se qualquer gate falhar, a promoção para PROD será interrompida. Nenhum erro será contornado editando migration antiga, forçando deploy, ignorando teste ou fazendo alteração manual não versionada.
