# Spec 009 — Migração da Integração WhatsApp para Uazapi

**Status:** ready-for-agent

**Contrato externo de referência:** Uazapi OpenAPI v2.1.1

## Problem Statement

O Navalhado depende hoje de uma integração profundamente acoplada à Evolution API Go para criar e parear uma **Instância WhatsApp**, acompanhar seu estado, receber o primeiro contato de um cliente e enviar mensagens relacionadas a um **Evento de Agendamento**.

Esse acoplamento está presente no modelo de dados, na Edge Function de integração, na página de gerenciamento, nos testes, no Realtime, nas rotinas de confirmação e lembrete e na documentação de domínio. Uma simples troca de endpoints não é suficiente: nomes, credenciais, payloads, eventos de webhook e estados de conexão também refletem o provedor antigo.

O produto precisa substituir integralmente a Evolution API Go pela Uazapi sem alterar a experiência funcional do Gerente ou romper o isolamento entre Barbearias (Tenants). A arquitetura deve continuar preparada para uma Instância WhatsApp por Barbearia, embora o piloto inicial tenha apenas a empresa de um amigo do proprietário do Navalhado.

A migração será validada primeiro no Ambiente Dev Completo e Isolado. A única instância real usada no piloto será promovida de Dev para Prod de forma sequencial e somente após comando explícito do proprietário. Dev e Prod nunca poderão operar simultaneamente a mesma instância.

## Solution

Substituir a integração ativa da Evolution API Go por uma integração com a Uazapi, mantendo a Uazapi como detalhe interno da infraestrutura. Para o Gerente, o produto continuará apresentando apenas a **Integração do WhatsApp** e preservará o fluxo de ativação, QR Code, conexão, configurações, envio de teste, desconexão e automações.

O domínio e o banco passarão a usar nomenclatura independente de provedor. Cada Barbearia continuará limitada a uma Instância WhatsApp, registrada como pertencente ao seu tenant e identificada internamente com `provider = 'uazapi'`.

A ativação será orquestrada integralmente pela Edge Function. O backend validará o Gerente e seu tenant, criará a instância na Uazapi com o `admintoken`, armazenará o token individual sem expô-lo ao navegador, configurará um webhook individual e persistirá a integração. Falhas parciais deverão ser compensadas para impedir instâncias fantasmas.

O webhook individual receberá somente eventos novos de conexão e mensagens. Histórico, grupos, mensagens enviadas pelo próprio número e mensagens originadas pela API serão ignorados. Eventos aceitos serão autenticados, deduplicados e processados de forma idempotente.

As mensagens de confirmação, cancelamento, lembrete, teste e resposta com o link do Canal do Cliente usarão o endpoint de texto da Uazapi. Falhas temporárias terão até três tentativas graduais, sem duplicar o envio.

Os registros antigos de conexão da Evolution serão removidos. Migrações históricas não serão reescritas; uma nova migração fará a transição para o modelo neutro. ADRs antigos serão preservados como histórico e marcados como substituídos por uma nova decisão arquitetural.

## User Stories

1. Como **Gerente da Barbearia**, quero continuar vendo uma área chamada “WhatsApp”, para que a troca do provedor não exija aprender um novo conceito técnico.

2. Como **Gerente da Barbearia**, quero ativar a Integração do WhatsApp com uma única ação, para que a Instância WhatsApp da minha empresa seja criada sem configuração manual externa.

3. Como **Gerente da Barbearia**, quero que a ativação crie uma instância real na Uazapi, para que o registro exibido no painel corresponda a um recurso operacional do provedor.

4. Como **Gerente da Barbearia**, quero receber uma mensagem clara quando a ativação falhar, para que eu não veja uma integração fantasma ou permanentemente carregando.

5. Como **Gerente da Barbearia**, quero que uma ativação parcialmente concluída seja desfeita automaticamente, para que eu possa tentar novamente sem intervenção técnica.

6. Como **Gerente da Barbearia**, quero que minha empresa tenha no máximo uma Instância WhatsApp, para que não existam conexões concorrentes ou cobranças acidentais.

7. Como **Gerente da Barbearia**, quero administrar somente a Instância WhatsApp do meu tenant, para que nenhuma empresa consiga visualizar ou controlar o WhatsApp de outra.

8. Como **Gerente da Barbearia**, quero gerar um QR Code de conexão, para que eu possa parear o WhatsApp Business da empresa.

9. Como **Gerente da Barbearia**, quero visualizar o QR Code assim que a Uazapi o retornar, para que o pareamento não dependa exclusivamente da chegada de um webhook.

10. Como **Gerente da Barbearia**, quero que o QR Code seja atualizado enquanto estiver pareando, para que um código expirado não deixe a tela inutilizável.

11. Como **Gerente da Barbearia**, quero que o status mude em tempo real após o pareamento, para que eu saiba quando o WhatsApp está pronto para operar.

12. Como **Gerente da Barbearia**, quero diferenciar os estados “Conectado”, “Pareando”, “Desconectado” e “Pausado”, para que eu execute a ação correta em cada situação.

13. Como **Gerente da Barbearia**, quero retomar uma instância pausada sem novo QR Code, para que uma hibernação não seja confundida com perda da sessão.

14. Como **Gerente da Barbearia**, quero desconectar completamente o aparelho quando necessário, para que a sessão seja encerrada e um novo QR Code seja exigido na próxima conexão.

15. Como **Gerente da Barbearia**, quero manter minhas configurações de mensagens após desconectar, para que um novo pareamento não redefina minhas preferências.

16. Como **Gerente da Barbearia**, quero habilitar ou desabilitar confirmações de agendamento, para que a comunicação respeite a operação da minha empresa.

17. Como **Gerente da Barbearia**, quero habilitar ou desabilitar cancelamentos, para que clientes sejam avisados conforme a política da empresa.

18. Como **Gerente da Barbearia**, quero habilitar ou desabilitar lembretes, para que eu controle os disparos automáticos anteriores ao atendimento.

19. Como **Gerente da Barbearia**, quero definir a antecedência dos lembretes dentro dos limites existentes, para que as mensagens sejam enviadas no horário adequado.

20. Como **Gerente da Barbearia**, quero enviar uma mensagem de teste, para que eu valide a conexão antes de depender das automações.

21. Como **Cliente**, quero que meu primeiro contato novo pelo WhatsApp crie ou reutilize meu cadastro provisório, para que eu receba acesso ao agendamento sem criar uma conta com senha.

22. Como **Cliente**, quero receber o link do Canal do Cliente ao iniciar uma conversa direta, para que eu possa concluir meu cadastro e fazer um agendamento.

23. Como **Cliente**, quero receber esse link uma única vez por mensagem processada, para que falhas ou reentregas de webhook não gerem respostas duplicadas.

24. Como **Cliente**, quero que meu telefone seja tratado no formato canônico brasileiro, para que diferentes máscaras não criem cadastros duplicados na mesma Barbearia.

25. Como **Cliente**, quero receber mensagens com datas e horários no fuso da Barbearia, para que a comunicação corresponda ao horário real do atendimento.

26. Como **Cliente**, quero receber uma confirmação quando meu agendamento for criado e a configuração estiver habilitada, para que eu tenha segurança sobre a reserva.

27. Como **Cliente**, quero receber uma mensagem quando meu agendamento for cancelado e a configuração estiver habilitada, para que eu não compareça indevidamente.

28. Como **Cliente**, quero receber o lembrete configurado antes do atendimento, para que eu reduza o risco de esquecer o compromisso.

29. Como **Cliente**, quero receber no máximo uma confirmação, um cancelamento e cada lembrete devido, para que tentativas técnicas não se tornem spam.

30. Como **Sistema**, quero ignorar o histórico existente quando um número for conectado, para que conversas antigas não criem Clientes Provisórios nem disparem links.

31. Como **Sistema**, quero ignorar mensagens de grupos, para que conversas coletivas não sejam interpretadas como pedidos individuais de agendamento.

32. Como **Sistema**, quero ignorar mensagens enviadas pelo próprio número e mensagens originadas pela API, para que as automações não entrem em ciclos de resposta.

33. Como **Sistema**, quero autenticar cada webhook contra a Instância WhatsApp correspondente, para que requisições falsificadas não criem clientes nem disparem mensagens.

34. Como **Sistema**, quero registrar que um evento externo já foi processado, para que reentregas sejam respondidas com sucesso sem repetir seus efeitos.

35. Como **Sistema**, quero repetir temporariamente envios que falharam por limite, timeout ou indisponibilidade, para que falhas transitórias não façam o cliente perder mensagens importantes.

36. Como **Sistema**, quero respeitar o tempo de nova tentativa informado pela Uazapi quando disponível, para que a recuperação não agrave limites do provedor.

37. Como **Sistema**, quero interromper tentativas diante de erros permanentes, para que números inválidos ou requisições rejeitadas não consumam processamento desnecessário.

38. Como **Sistema**, quero ocultar tokens administrativos e individuais do navegador, dos logs e das mensagens de erro, para que credenciais de WhatsApp não sejam expostas.

39. Como **Proprietário do SaaS**, quero que a Uazapi seja um detalhe interno, para que a interface e o domínio permaneçam estáveis em futuras trocas de provedor.

40. Como **Proprietário do SaaS**, quero preservar o modelo de uma Instância WhatsApp por tenant, para que novas Barbearias possam usar o mesmo fluxo após o piloto.

41. Como **Proprietário do SaaS**, quero manter as mesmas regras atuais de acesso, para que não seja necessário criar uma permissão especial ou codificar a empresa piloto no sistema.

42. Como **Proprietário do SaaS**, quero validar a integração real no Ambiente Dev Completo e Isolado, para que erros sejam encontrados antes de afetar o ambiente Prod.

43. Como **Proprietário do SaaS**, quero que a instância piloto opere em apenas um ambiente por vez, para que Dev e Prod não disputem webhook, sessão ou disparos.

44. Como **Proprietário do SaaS**, quero autorizar explicitamente a promoção para Prod, para que nenhuma mudança de webhook, segredo, função ou rotina produtiva aconteça automaticamente.

45. Como **Proprietário do SaaS**, quero promover a mesma instância validada de Dev para Prod, para que o piloto respeite o limite operacional de uma única instância real.

46. Como **Proprietário do SaaS**, quero que as credenciais capazes de enviar mensagens sejam removidas ou inutilizadas no Dev após a promoção, para que somente Prod permaneça operacional.

47. Como **Equipe de Manutenção**, quero que os nomes ativos do banco e do código sejam neutros em relação ao provedor, para que a arquitetura expresse o domínio do Navalhado.

48. Como **Equipe de Manutenção**, quero preservar migrações e ADRs históricos, para que a evolução do banco e das decisões continue auditável.

49. Como **Equipe de Manutenção**, quero marcar as decisões da Evolution como substituídas, para que documentos antigos não sejam interpretados como arquitetura vigente.

50. Como **Equipe de Manutenção**, quero fixtures baseadas no contrato oficial da Uazapi v2.1.1, para que alterações de payload sejam detectadas pelos testes.

## Implementation Decisions

- **Domínio independente de provedor**
  - “Instância WhatsApp” permanece como termo canônico.
  - Evolution API Go e Uazapi não aparecem como conceitos de produto apresentados ao Gerente.
  - O registro ativo passa a usar nomenclatura neutra e inclui o provedor atual como dado explícito.
  - A única implementação aceita nesta entrega é `uazapi`; não haverá implementação executável da Evolution, fallback ou operação dupla.

- **Modelo multi-tenant**
  - Cada Instância WhatsApp pertence a exatamente uma Barbearia (Tenant).
  - Permanece a restrição de no máximo uma Instância WhatsApp por tenant.
  - As regras de acesso continuam iguais às atuais: somente o Gerente autenticado do próprio tenant gerencia a integração.
  - Não será criado feature flag, allowlist, plano especial ou ID codificado para a empresa piloto.

- **Migração do banco**
  - Uma nova migração fará a transição do modelo específico da Evolution para o modelo neutro.
  - Migrações históricas já existentes não serão alteradas, removidas ou renomeadas.
  - Registros antigos de conexão da Evolution serão excluídos porque seus IDs e tokens não são reutilizáveis na Uazapi.
  - A limpeza afeta apenas dados da integração antiga; Barbearias, usuários, Clientes, Profissionais, Serviços, Agendamentos e pagamentos permanecem intactos.
  - As configurações de confirmação, cancelamento e lembrete de uma nova integração começam com os valores padrão vigentes.
  - Índices, RLS, Realtime, privilégios de coluna, consultas administrativas e métricas que referenciam a tabela antiga serão migrados para a nomenclatura neutra.
  - O estado persistido admite `connected`, `connecting`, `disconnected` e `hibernated`.
  - A interface apresenta `connecting` como “Pareando” e `hibernated` como “Pausado”.

- **Seam único do provedor**
  - A Edge Function de WhatsApp permanece como único gateway entre o Navalhado e a Uazapi.
  - O gateway concentra um adaptador com as operações criar instância, conectar, consultar status, desconectar, configurar webhook e enviar texto.
  - Frontend, triggers, cron e fluxo de Cliente Provisório dependem do contrato interno da Edge Function, nunca das rotas ou payloads da Uazapi.
  - O adaptador Uazapi segue o contrato OpenAPI v2.1.1.

- **Configuração e credenciais**
  - A URL base e o `admintoken` são segredos/configurações do backend, separados por ambiente Supabase.
  - O `admintoken` é usado apenas em operações administrativas, especialmente criação da instância.
  - A criação retorna um token individual usado nas operações regulares daquela instância.
  - O token individual é persistido somente para acesso do backend e não pode ser selecionado por papéis do frontend.
  - O frontend nunca gera, recebe, armazena ou envia tokens do provedor.
  - Tokens completos, cabeçalhos de autenticação e corpos contendo credenciais não são escritos em logs.
  - Mensagens de erro ao usuário não incluem conteúdo sensível retornado pelo provedor.

- **Ativação transacional**
  - O frontend solicita a ativação ao backend e não insere previamente a integração no banco.
  - O backend valida JWT, papel de Gerente e pertencimento ao tenant.
  - O backend confirma que o tenant ainda não possui integração antes de chamar o provedor.
  - A instância é criada na Uazapi por meio da operação administrativa de criação.
  - O tenant e o ambiente são associados à instância como metadados administrativos quando o contrato permitir.
  - O token retornado é armazenado antes de qualquer resposta ao frontend.
  - O webhook individual é configurado durante a ativação.
  - A integração somente é considerada criada depois que as etapas externas e internas necessárias forem concluídas.
  - Se a persistência local falhar depois da criação remota, o backend executa compensação administrativa para não deixar uma instância órfã.
  - Requisições concorrentes de ativação produzem no máximo uma integração.

- **Conexão e QR Code**
  - A conexão usa a operação regular da Uazapi autenticada pelo token individual.
  - O QR Code retornado pela conexão é persistido e exibido imediatamente.
  - Enquanto o estado estiver em pareamento, a aplicação consulta temporariamente o status da instância para obter renovação de QR Code e mudanças de estado.
  - Webhook e Realtime continuam atualizando o estado observado da conexão.
  - A consulta temporária é encerrada quando a instância conecta, desconecta, pausa, a tela é desmontada ou o limite operacional de espera é alcançado.
  - O QR Code é limpo quando a conexão é concluída ou a sessão é desconectada.

- **Pausa e desconexão**
  - `hibernated` é um estado válido e não é reduzido a `disconnected`.
  - Uma instância pausada pode ser retomada sem novo pareamento quando a Uazapi preservar a sessão.
  - “Desconectar” usa a operação que encerra a sessão atual, limpa as credenciais de sessão do WhatsApp no provedor e exige novo QR Code.
  - Desconectar não exclui o registro da instância, seu token administrativo local nem suas preferências de mensagens.
  - O Gerente não recebe uma ação para excluir definitivamente a instância da Uazapi.

- **Webhook individual**
  - Cada instância usa seu próprio webhook; o webhook global administrativo não será configurado.
  - O webhook assina apenas `connection` e `messages`.
  - O evento `history` não é assinado nem processado.
  - A configuração exclui mensagens `wasSentByApi`, `fromMeYes` e `isGroupYes`.
  - A aplicação também valida os mesmos filtros no processamento, como defesa contra payloads incompletos ou configuração externa incorreta.
  - O token de instância presente no evento é comparado com a credencial registrada antes de qualquer efeito de negócio.
  - Eventos sem integração correspondente, token válido, tipo permitido ou tenant resolvido são rejeitados ou ignorados sem efeitos.
  - O endpoint não registra o corpo bruto quando ele puder conter token ou dados pessoais desnecessários.

- **Primeiro contato e Cliente Provisório**
  - Somente mensagens novas, recebidas de conversas individuais e não originadas pela API podem iniciar o fluxo.
  - O telefone é convertido para Telefone Normalizado no padrão brasileiro `55DDDNUMERO`.
  - O fluxo existente de localizar ou criar Cliente Provisório permanece a autoridade para impedir duplicidade por tenant e telefone.
  - O nome disponível no evento pode ser usado como dado provisório sem promover o cadastro para completo.
  - A resposta contém o link do Canal do Cliente construído com a URL pública do ambiente e o Token de Acesso do Cliente.
  - O ambiente Dev usa exclusivamente a URL Pública Dev nos links enviados durante a validação.

- **Envio de texto**
  - Confirmação, cancelamento, lembrete, resposta ao primeiro contato e teste usam a operação `/send/text`.
  - O destinatário é enviado em formato E.164 brasileiro, sem máscara.
  - As mensagens e regras de habilitação atuais são preservadas.
  - Datas e horários continuam formatados segundo o Fuso Horário da Barbearia.
  - Funcionalidades adicionais de mídia, campanhas, chatbot, Chatwoot e placeholders da Uazapi não são usadas.

- **Idempotência**
  - Um registro neutro de processamento armazena os identificadores externos necessários para reconhecer reentregas.
  - O identificador de mensagem da Uazapi é a chave de idempotência do primeiro contato.
  - A combinação de tenant, Agendamento e tipo de Evento de Agendamento identifica confirmações e cancelamentos.
  - A combinação de Agendamento e janela de lembrete identifica cada lembrete devido.
  - A reserva da chave de idempotência ocorre antes do efeito externo sempre que possível.
  - Reentregas de eventos concluídos retornam sucesso sem repetir o efeito.
  - Tentativas com resultado desconhecido não são tratadas automaticamente como novo envio.

- **Tentativas e falhas**
  - Erros de rede, timeout, HTTP 429 e respostas 5xx são transitórios.
  - Mensagens automáticas podem ter no máximo três tentativas com atraso crescente.
  - O cabeçalho `Retry-After` é respeitado quando presente.
  - Erros 4xx permanentes, como destinatário ou payload inválido, não são repetidos.
  - Ativação, conexão, retomada, desconexão e envio de teste retornam erro imediatamente ao Gerente; não ficam executando indefinidamente em segundo plano.
  - Uma nova tentativa reutiliza a mesma chave de idempotência.
  - O resultado final e a quantidade de tentativas ficam disponíveis para diagnóstico técnico, sem exigir uma nova interface nesta entrega.

- **Ambientes e promoção**
  - A validação real começa no Supabase Dev.
  - Dev e Prod usam a mesma conta definitiva da Uazapi; servidores gratuitos ou demo não fazem parte do aceite.
  - A instância piloto é usada em somente um ambiente por vez.
  - A promoção para Prod exige comando explícito do proprietário do Navalhado.
  - O procedimento de promoção pausa triggers, cron e envios de Dev antes de mudar o webhook.
  - O webhook individual é reconfigurado para a Edge Function de Prod.
  - ID e token da instância validada são provisionados de forma segura no registro correspondente de Prod sem criar uma segunda instância.
  - Após o aceite de Prod, as credenciais capazes de operar a instância são removidas ou inutilizadas no Dev.
  - Nenhum passo de promoção, alteração de segredo Prod, implantação Prod ou ativação de rotina Prod é automático.

- **Documentação**
  - O glossário e o contexto passam a definir Instância WhatsApp sem associá-la à Evolution.
  - A documentação vigente usa a Uazapi somente quando descreve o adaptador ou a infraestrutura.
  - ADRs da Evolution são preservados e marcados como substituídos.
  - Uma nova ADR registra a Uazapi, a nomenclatura neutra, o webhook individual e a promoção sequencial Dev → Prod.
  - Diagramas, modelo de banco, rotas e personas deixam de apresentar Evolution como arquitetura ativa.

## Testing Decisions

- **Princípio de teste**
  - Testes validam comportamento observável e contratos, não nomes de helpers, sequência interna de chamadas privadas ou detalhes incidentais de implementação.
  - O principal seam é o handler HTTP da Edge Function de WhatsApp com Supabase e Uazapi simulados.
  - Fixtures de requisição e resposta refletem o OpenAPI v2.1.1 e ficam centralizadas para reduzir divergência.
  - Testes menores do adaptador somente são usados quando um comportamento do contrato não puder ser observado de forma clara pelo handler.

- **Testes da Edge Function**
  - Gerente do tenant correto consegue ativar, conectar, consultar, retomar e desconectar.
  - Usuários sem papel de Gerente ou de outro tenant recebem HTTP 403.
  - Ativação cria a instância, persiste token sem retorná-lo e configura webhook.
  - Falha na persistência após criação remota executa compensação.
  - Ativações concorrentes resultam em uma única instância.
  - Conexão persiste o QR Code e traduz os estados da Uazapi.
  - `hibernated` é retornado como estado pausado e pode ser retomado.
  - Desconexão mantém configurações e exige novo pareamento.
  - Webhook válido de mensagem cria ou reutiliza Cliente Provisório e envia o link.
  - Webhooks sem token, com token inválido, evento não permitido, grupo, mensagem própria, mensagem da API ou histórico não geram efeitos.
  - Reentrega do mesmo identificador de mensagem não envia nova resposta.
  - Confirmação, cancelamento, lembrete e teste usam número e texto esperados.
  - Falhas temporárias repetem no máximo três vezes e respeitam `Retry-After`.
  - Erros permanentes não são repetidos.
  - Respostas e logs não expõem `admintoken` nem token individual.
  - Os testes Deno já existentes da função são a prior art e devem ser migrados, não substituídos por uma segunda estratégia.

- **Testes da página do Gerente**
  - A interface exibe somente termos neutros de WhatsApp.
  - Ativação chama a Edge Function e não insere credencial ou instância diretamente pelo cliente.
  - QR Code retornado é exibido imediatamente.
  - Consulta temporária atualiza QR Code e status durante o pareamento.
  - Realtime continua refletindo mudanças recebidas pelo backend.
  - “Pausado” apresenta a ação de retomada sem pedir QR Code antecipadamente.
  - “Desconectado” apresenta a geração de novo QR Code.
  - Configurações de confirmação, cancelamento e lembrete permanecem editáveis.
  - Envio de teste preserva validação e feedback ao Gerente.
  - Erros de ativação, pareamento e desconexão encerram o carregamento e exibem mensagem segura.
  - Os testes existentes da página de WhatsApp são a prior art e devem ser adaptados para o contrato neutro.

- **Testes de banco**
  - A nova migração parte do histórico atual sem modificar migrações anteriores.
  - Registros de integração Evolution são removidos e demais dados de domínio são preservados.
  - Existe no máximo uma Instância WhatsApp por tenant.
  - Estados e valores padrão respeitam as novas constraints.
  - RLS permite acesso somente ao tenant autenticado e mantém operações administrativas restritas.
  - Papéis do frontend não conseguem selecionar tokens.
  - Realtime e consultas administrativas continuam usando o modelo neutro.
  - Chaves de idempotência têm unicidade que bloqueia efeitos duplicados.
  - Os testes SQL existentes de ciclo de vida e hardening são a prior art e devem ser migrados.

- **Verificação automatizada**
  - Toda a suíte frontend passa.
  - Toda a suíte Deno da Edge Function passa.
  - Toda a suíte SQL relevante passa no Supabase Dev.
  - O build de produção do frontend conclui sem erros.
  - Uma busca por referências da Evolution confirma que ela não permanece em código executável, configuração vigente ou documentação apresentada como atual.
  - Referências preservadas em migrações e ADRs históricos são explicitamente permitidas.

- **Aceite real no Ambiente Dev Completo e Isolado**
  - Ativar cria uma única instância Uazapi para o tenant.
  - QR Code conecta um WhatsApp Business e atualiza o estado.
  - Mensagem nova cria ou reutiliza Cliente Provisório e envia o link uma única vez.
  - Confirmação, cancelamento, lembrete e envio de teste chegam ao destinatário esperado.
  - Desconectar exige novo QR Code.
  - Uma instância pausada pode ser retomada.
  - Webhook forjado é rejeitado.
  - Reentrega simulada não duplica efeitos.
  - Falha transitória simulada executa a política de tentativas.
  - Tokens não aparecem no navegador, nos logs inspecionados ou nos erros.
  - A promoção para Prod não faz parte deste aceite e depende de comando posterior.

## Out of Scope

- Manter Evolution API Go como fallback ou segundo provedor ativo.
- Executar migração gradual, dual-write ou sincronização entre provedores.
- Alterar migrações históricas já aplicadas.
- Criar uma permissão especial, allowlist ou plano exclusivo para a empresa piloto.
- Restringir o WhatsApp a um usuário pessoal em vez do tenant.
- Permitir mais de uma Instância WhatsApp por tenant.
- Permitir que o Gerente exclua definitivamente uma instância administrativa.
- Processar histórico de conversas.
- Processar mensagens de grupos, canais, newsletters, chamadas ou presença.
- Usar campanhas em massa, mídia, botões, listas, chatbot, IA, CRM ou Chatwoot da Uazapi.
- Criar uma nova tela de histórico técnico de entregas.
- Alterar textos e regras de negócio das mensagens atuais além do necessário para o novo contrato.
- Alterar o fluxo do Canal do Cliente, o Acesso Tokenizado do Cliente ou a Promoção de Cadastro.
- Alterar regras de planos ou cobrança.
- Usar servidor gratuito ou demo da Uazapi como ambiente de aceite.
- Trabalhar com uma instância local da Uazapi ou Supabase.
- Implantar, configurar segredos, apontar webhooks ou ativar rotinas em Prod sem comando explícito.

## Further Notes

- A documentação oficial consultada expõe autenticação por `admintoken` para operações administrativas e `token` por instância para operações regulares.
- A criação administrativa ocorre em `/instance/create` e retorna a instância com token próprio.
- A conexão e consulta de status disponibilizam estado e QR Code.
- A desconexão encerra a sessão e exige novo QR Code, enquanto `hibernated` preserva a possibilidade de retomada.
- O webhook individual permite selecionar `connection` e `messages` e excluir `wasSentByApi`, `fromMeYes` e `isGroupYes`.
- O envio de texto ocorre em `/send/text` com destinatário no campo `number`.
- A documentação recomenda WhatsApp Business e alerta que servidores gratuitos ou demo podem ter limites adicionais.
- Existem alterações não commitadas na Edge Function atual e em seus testes. A implementação desta spec deve preservá-las e adaptá-las conscientemente, sem sobrescrever trabalho existente.
- A promoção da instância piloto de Dev para Prod deverá ter runbook explícito e checklist de reversão antes de qualquer execução.
