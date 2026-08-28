# Especificação: Canal público, identidade do cliente e agendamento transacional

## Problem Statement

O link público da barbearia atualmente trata todo visitante como se já fosse um cliente. Ao abrir o link, o fluxo chama `get_or_create_provisional_customer_by_slug`, que cria um registro em `customers` com nome genérico, telefone nulo e `cadastro_completo = false`. Recarregar a página, consultar serviços, abandonar o fluxo ou apenas visualizar horários pode, portanto, poluir a base com clientes que nunca foram identificados.

Esse acoplamento também faz com que o catálogo, os profissionais e a disponibilidade dependam de um `customer_token`, embora essas consultas sejam dados públicos do tenant. O token salvo no navegador é usado como se fosse prova suficiente de identidade, a confirmação cadastral e a criação do agendamento acontecem em operações separadas e o fluxo de fallback mantém RPCs legadas em uso.

Há ainda inconsistências na disponibilidade pública: profissionais não são filtrados pelo serviço selecionado, a grade de um profissional pode substituir o expediente geral da barbearia, a duração do serviço nem sempre governa o último início possível e as regras de indisponibilidade ficam distribuídas entre funções SQL, adapter e tela React.

O princípio de negócio a ser restaurado é: **visitante não é cliente**. Um registro em `customers` deve existir somente quando uma pessoa estiver identificada no momento da confirmação ou quando já existir um cadastro válido.

## Solution

Separar o canal público em três responsabilidades:

1. **Contexto público do tenant:** resolver a barbearia por `slug` e consultar somente dados públicos, sem criar cliente e sem exigir `customer_id` ou `customer_token`.
2. **Identidade opcional do cliente:** validar um token previamente salvo no backend. Quando válido, o fluxo preenche nome e telefone, mas permite edição para que o cliente possa agendar para outra pessoa.
3. **Comando transacional de confirmação:** validar os dados, normalizar o telefone, localizar ou criar um Cliente Completo e criar o agendamento na mesma operação do Postgres.

O telefone normalizado será a identidade única de cliente dentro de cada tenant. Se o telefone já existir, o cadastro canônico será reutilizado. Se não existir, será criado um Cliente Completo. Se um cliente reconhecido alterar o telefone, seu cadastro original permanecerá intacto e a confirmação resolverá a nova pessoa por telefone.

A grade pública será baseada no expediente geral da barbearia e no intervalo configurado no tenant. O profissional selecionado, ou escolhido automaticamente em “Tanto faz”, apenas restringirá os slots por serviço, jornada, intervalo, folga, agendamentos, bloqueios, duração e antecedência mínima.

A mudança será entregue em quatro planos executáveis e independentemente testáveis: contexto público e confirmação transacional; disponibilidade e grade; reconhecimento por token e experiência do formulário; limpeza de legados, privilégios, dados e regressões.

## User Stories

### Visitante e contexto público

1. Como visitante, quero abrir o link público da barbearia sem criar um cadastro, para poder conhecer os serviços antes de decidir agendar.
2. Como visitante, quero recarregar a página sem gerar novos registros em `customers`, para que a base da barbearia contenha apenas pessoas reais.
3. Como visitante, quero abandonar o fluxo sem deixar um Cliente Provisório criado, para que a operação não precise limpar cadastros fantasmas continuamente.
4. Como visitante, quero consultar serviços, profissionais e horários usando apenas o `slug` da barbearia, para que o catálogo público não dependa de uma identidade de cliente.
5. Como visitante, quero visualizar a logo, o telefone, o timezone, o expediente e as regras públicas corretas da barbearia, para que eu tome decisões com informações atuais.
6. Como visitante, quero ver somente serviços ativos e não excluídos, para que o catálogo não ofereça itens indisponíveis.
7. Como visitante, quero ver somente profissionais ativos que executam o serviço selecionado, para que não escolha uma combinação incompatível.

### Identificação e confirmação

8. Como visitante que confirma um agendamento, quero informar nome, sobrenome e telefone obrigatórios, para que a barbearia saiba quem será atendido.
9. Como cliente reconhecido, quero encontrar meus dados preenchidos automaticamente, para não precisar digitá-los novamente.
10. Como cliente reconhecido, quero editar os dados preenchidos, para poder agendar para outra pessoa quando necessário.
11. Como cliente que informa um telefone já cadastrado no tenant, quero que meu cadastro existente seja reutilizado, para evitar duplicidade.
12. Como cliente que informa um telefone novo, quero que um Cliente Completo seja criado somente na confirmação, para que consultas preliminares não criem pessoas fictícias.
13. Como cliente reconhecido que troca o telefone, quero que o cadastro original permaneça preservado, para que um novo agendamento não altere minha identidade anterior.
14. Como cliente, quero que a confirmação falhe com mensagem clara quando nome, sobrenome ou telefone forem inválidos, para corrigir os dados sem ambiguidade.
15. Como cliente, quero que a localização/criação do cliente e o agendamento sejam atômicos, para que uma falha no horário não deixe um cadastro novo sem agendamento.
16. Como cliente, quero que duas confirmações simultâneas para o mesmo telefone não criem cadastros duplicados, para que minha identidade permaneça única no tenant.
17. Como cliente, quero que duas confirmações simultâneas para o mesmo horário sejam resolvidas com segurança, para que não haja dupla reserva do profissional.
18. Como cliente, quero receber o token canônico após a confirmação, para continuar gerenciando meus agendamentos.

### Reconhecimento e área do cliente

19. Como cliente que já usou o link, quero que o token seja salvo localmente com uma versão de armazenamento, para que mudanças futuras no formato não causem conflitos.
20. Como cliente que retorna pelo mesmo navegador, quero que o backend valide o token antes de reconhecer minha identidade, para que um valor adulterado no `localStorage` não conceda acesso.
21. Como cliente que acessa outro tenant com um token existente, quero que o token seja rejeitado para aquele tenant, para que dados de uma barbearia não vazem para outra.
22. Como cliente reconhecido por token válido, quero ser direcionado diretamente à área de gestão quando acessar o link novamente, para não passar pela tela inicial desnecessariamente.
23. Como visitante com token inválido, expirado ou inexistente, quero continuar o fluxo público ou ver acesso negado conforme o contexto, para que token inválido nunca conceda acesso à área privada.
24. Como cliente reconhecido, quero visualizar agendamentos futuros e histórico, para acompanhar minha relação com a barbearia.
25. Como cliente reconhecido, quero cancelar e reagendar dentro das regras permitidas, para gerenciar meus compromissos pelo canal digital.
26. Como cliente reconhecido que inicia um novo agendamento, quero manter meus dados preenchidos e editáveis, para reutilizar minha identidade ou cadastrar corretamente outra pessoa.
27. Como cliente em outro navegador ou dispositivo, quero seguir o fluxo público e ser associado pelo telefone na confirmação, para não gerar duplicidade por falta de token local.

### Grade pública e regras de disponibilidade

28. Como cliente, quero que a grade use o expediente configurado da barbearia, para enxergar o horário operacional completo do tenant.
29. Como cliente, quero que a grade respeite o intervalo configurado, como 15, 30 ou 40 minutos, para escolher horários na cadência definida pela barbearia.
30. Como cliente, quero que mudanças nas configurações de funcionamento e intervalo sejam refletidas no link público sem valores fixos no frontend.
31. Como cliente, quero que o último horário seja permitido somente quando o serviço terminar antes ou exatamente no fechamento, para evitar reservas que ultrapassem o expediente.
32. Como cliente, quero que o serviço selecionado determine sua duração real, incluindo duração customizada do profissional quando existir.
33. Como cliente, quero que horários incompatíveis com a jornada individual apareçam indisponíveis dentro da grade, para entender a grade da barbearia sem que ela seja redesenhada para cada profissional.
34. Como cliente, quero que intervalos, folgas e horários fora da jornada individual bloqueiem somente os slots afetados.
35. Como cliente, quero que agendamentos existentes e bloqueios manuais removam os slots conflitantes, para que a disponibilidade corresponda à agenda real.
36. Como cliente, quero que a antecedência mínima seja aplicada no backend e no frontend para o dia atual, para não escolher horários que já não podem ser confirmados.
37. Como cliente, quero que a confirmação revalide todas as regras, para que uma mudança ocorrida enquanto eu navegava não resulte em reserva inválida.
38. Como gerente ou barbeiro, quero que o fluxo interno continue podendo criar encaixes e agendamentos operacionais sem ser bloqueado pela antecedência do canal público.

### Dados legados e segurança operacional

39. Como gerente, quero que clientes fantasmas antigos sejam identificados por critérios de incompletude e ausência de vínculos, para que a limpeza seja segura.
40. Como gerente, quero que clientes ligados a agendamentos, comandas ou lista de espera nunca sejam removidos pela higienização automática.
41. Como administrador, quero que RPCs internas não sejam executáveis anonimamente, para reduzir a superfície de ataque do banco.
42. Como desenvolvedor, quero que as RPCs públicas tenham contratos sem sobrecarga ambígua, para evitar chamadas inconsistentes no PostgREST.
43. Como desenvolvedor, quero que migrations sejam versionadas e revisadas antes de aplicação, para manter histórico reproduzível e rollback compreensível.
44. Como desenvolvedor, quero verificar schema, migrations, advisors e smoke tests no banco após cada mudança, para detectar regressões de segurança e performance.

## Implementation Decisions

### Arquitetura e seam principal

- O seam principal será o contrato do Canal do Cliente: contexto público por slug e comando transacional de confirmação. O `CanalClienteRepository` continuará sendo o módulo profundo consumido pelas telas, com um adapter Supabase e um adapter em memória para testes.
- O adapter não exporá detalhes de `localStorage`, nomes de RPC ou códigos brutos do Postgres às telas. Erros de token, validação, conflito e regra de cancelamento continuarão sendo convertidos em erros de domínio.
- A implementação pública não usará o token para descobrir o tenant. O `slug` será a referência de contexto; o token será opcional e servirá somente para reconhecer ou gerenciar uma identidade já existente.
- O layout visual existente será preservado. A mudança de comportamento será concentrada no módulo do Canal do Cliente, nas RPCs e nas utilidades puras de data/horário.

### Contratos públicos do banco

- `get_public_tenant_by_slug` permanecerá como resolução do contexto público e deverá retornar somente dados públicos do tenant.
- Serão criadas RPCs públicas equivalentes para listar serviços por slug, listar profissionais por slug e serviço, e consultar slots por slug, sem `customer_id` ou `customer_token`.
- A consulta de profissionais exigirá vínculo ativo em `professional_services`, respeitando `is_enabled`, além de `is_active` e `deleted_at` do profissional e do serviço.
- A consulta pública de slots resolverá o tenant pelo slug e delegará a uma implementação canônica interna de disponibilidade. O contrato público não exporá uma função interna baseada em `tenant_id` para o papel `anon`.
- As RPCs públicas usarão `SECURITY DEFINER` somente quando necessário para atravessar RLS, sempre com `search_path = ''`, referências qualificadas e grants mínimos para `anon` e `authenticated`.
- Funções legadas tokenizadas de catálogo e disponibilidade deixarão de ser chamadas pelo novo fluxo. A remoção ou revogação ocorrerá somente depois da migração do adapter e dos testes de regressão.

### Confirmação transacional

- Será criada uma RPC de comando para confirmação pública, recebendo slug, token opcional, serviço, profissional opcional, data, horário, nome e telefone.
- A RPC resolverá o tenant pelo slug e rejeitará combinações de serviço, profissional e tenant que não sejam válidas.
- Nome e sobrenome serão validados como pelo menos duas palavras não vazias, com limites de tamanho definidos no contrato de domínio.
- O telefone será normalizado exclusivamente pela função canônica `private.normalize_br_phone`. O valor normalizado será persistido em `telefone_normalizado`; o valor de exibição seguirá o padrão atual do sistema.
- Se o token opcional existir, ele será validado contra o tenant e sua validade. Um token inválido não concederá acesso nem poderá selecionar a identidade de outro tenant.
- A identidade final será resolvida por `(tenant_id, telefone_normalizado)`. Um Cliente Completo existente será reutilizado; um telefone inexistente criará um Cliente Completo com origem explícita do canal do cliente.
- Para um cadastro completo existente, o nome persistido será preservado como identidade canônica. Para um cadastro novo ou incompleto legitimamente encontrado, o nome informado poderá completar o registro.
- A mesma transação validará o slot, escolherá um profissional quando “Tanto faz” for usado, inserirá o agendamento e retornará os identificadores do cliente, do agendamento e o token canônico.
- Falhas de validação, conflito de agenda, restrição de telefone ou trigger deverão abortar a transação inteira. O trigger existente de criação automática de comanda deverá continuar funcionando sem deixar comanda órfã.
- A concorrência será protegida pela unicidade existente de `(tenant_id, telefone_normalizado)` e pela restrição de sobreposição de agendamentos. A função deverá tratar conflitos de forma idempotente e retornar erro de domínio amigável.

### Disponibilidade e grade

- A grade será gerada a partir de `tenants.business_hours` e `tenants.slot_interval_minutes`, usando timezone do tenant.
- Para cada slot candidato, o backend calculará o fim com a duração efetiva do serviço e aceitará início até o fechamento exato, inclusive no caso “fechamento às 11:00, duração de 30 minutos, início às 10:30”.
- O expediente individual do profissional será um filtro de disponibilidade, não a origem visual da grade.
- O filtro individual considerará dia ativo, início/fim de jornada, intervalo, folga, serviço habilitado, duração customizada, agendamentos ativos, bloqueios do profissional ou do tenant e antecedência mínima.
- O modo “Tanto faz” retornará um slot quando pelo menos um profissional compatível estiver livre; na confirmação, a escolha final será repetida no backend para evitar confiar no resultado anterior.
- O cálculo usará chaves de dia determinísticas por `extract(dow ...)`, sem depender de idioma/locale do servidor.
- A implementação deverá manter índices úteis para os predicados de tenant, profissional, serviço, telefone, intervalos e vínculos N:N. Índices existentes não serão recriados sem evidência de necessidade.
- A utilidade de data/horário do frontend será centralizada para evitar duplicação entre a agenda interna e o canal público. A filtragem de slots de hoje será defensiva, nunca a única camada de segurança.

### Reconhecimento, armazenamento e roteamento

- O `localStorage` armazenará apenas o token mínimo necessário, com chave versionada e tratamento de exceções para modo privado, quota excedida ou armazenamento indisponível.
- Tokens vindos da rota, query string ou storage serão submetidos ao backend antes de qualquer redirecionamento para a área do cliente.
- O acesso por slug sem token carregará o contexto público e iniciará em serviços. O acesso por token válido poderá ir diretamente para o menu do cliente, salvo quando o usuário tiver iniciado explicitamente um novo agendamento ou reagendamento.
- O formulário de confirmação será preenchido com dados do perfil reconhecido, mas seus campos continuarão editáveis. A submissão enviará sempre os dados efetivamente informados para que o banco resolva a identidade correta.
- O lookup antecipado por telefone não será necessário para confirmar o agendamento. A resolução canônica ocorrerá dentro da RPC transacional, evitando exposição desnecessária da existência de clientes e reduzindo chamadas repetidas.
- O menu do cliente continuará usando token validado para listar, cancelar e reagendar agendamentos. Novo agendamento reaproveitará nome e telefone apenas como valores iniciais, sem transformar o token em identidade imutável.
- Chamadas sequenciais independentes de catálogo serão paralelizadas no adapter quando não houver dependência entre elas. Efeitos relacionados à submissão permanecerão no handler de confirmação, evitando efeitos React duplicados.

### Migrações, legado e higienização

- Toda alteração de schema, função, grant, constraint ou índice será feita em migration nova, com nome e versão gerados pelo fluxo de migrations do projeto.
- A migration deverá verificar que o índice único por tenant e telefone já existente atende ao requisito, corrigindo apenas inconsistências ou dados incompatíveis se forem encontradas.
- `get_or_create_provisional_customer_by_slug` será removida do fluxo público e marcada para remoção formal após confirmação de que nenhum consumidor legítimo permanece.
- Clientes provisórios antigos vinculados a `appointments`, `comandas` ou `waiting_list` serão preservados para não quebrar histórico, comandas ou lista de espera.
- A higienização identificará candidatos por `cadastro_completo = false`, telefone nulo, nome genérico e ausência de vínculos em todas as entidades que referenciam `customers`. A execução deverá ser repetível, auditável e conservadora.
- O estado remoto atual deve ser considerado no rollout: há dois tenants, um Cliente Completo, um agendamento, uma comanda e nenhum candidato fantasma sem vínculo. A primeira execução deverá registrar essa linha de base e não apagar dados sem correspondência explícita.
- Os grants de funções internas serão alinhados aos testes e ao princípio de privilégio mínimo. RPCs públicas terão somente o acesso necessário; RPCs internas permanecerão fora do alcance de `anon`.
- Depois de cada migration, serão executados advisors de segurança e performance via MCP, verificação da lista de migrations, consultas de integridade e testes de comportamento.

## Testing Decisions

- Os testes verificarão comportamento externo observável: registros criados, identidade retornada, agendamentos persistidos, slots retornados, acesso concedido ou negado e mensagens de domínio. Não testarão detalhes privados do corpo das funções ou a estrutura interna dos componentes.
- A interface do `CanalClienteRepository` será o seam de teste do domínio, usando o adapter em memória para regras puras e o adapter Supabase mockado para contratos de RPC e tradução de erros.
- Os testes SQL usarão pgTAP, seguindo o padrão existente do projeto para funções, grants, RLS, constraints, triggers e isolamento entre tenants.
- Os testes React usarão Vitest e Testing Library, seguindo os testes existentes de `FluxoAgendamento`, `MenuCliente` e do módulo do Canal do Cliente.
- A suíte de Edge Function existente será mantida para garantir que alterações de origem do cadastro não reativem mensagens de boas-vindas indevidas.

Os cenários mínimos são:

1. Abrir o link por slug não cria cliente.
2. Recarregar, consultar catálogo, trocar serviço, consultar profissional, consultar horário e abandonar o fluxo não criam cliente.
3. A resolução pública por slug retorna somente dados do tenant correto.
4. Profissionais são filtrados pelo serviço ativo e pelo relacionamento habilitado.
5. Nome sem sobrenome, telefone inválido e telefone ausente são rejeitados antes da persistência.
6. Uma confirmação válida cria exatamente um Cliente Completo e um agendamento.
7. Telefone existente no mesmo tenant reutiliza o cliente e seu token.
8. O mesmo telefone em tenants diferentes produz identidades distintas.
9. Duas confirmações concorrentes para o mesmo telefone não criam duplicidade.
10. Falha na criação do agendamento não deixa Cliente Completo novo sem agendamento.
11. Token válido do tenant redireciona para a área de gestão.
12. Token inválido, expirado ou pertencente a outro tenant não concede acesso.
13. Cliente reconhecido recebe dados preenchidos, pode editá-los e, ao informar outro telefone, cria ou reutiliza a outra identidade sem alterar a original.
14. Cliente sem token pode agendar em outro dispositivo e ser associado pelo telefone.
15. A grade respeita expediente, intervalo, timezone, fechamento e duração do serviço.
16. O último início válido é permitido quando o fim coincide exatamente com o fechamento.
17. Jornada, intervalo, folga, bloqueio, agendamento existente, serviço incompatível e antecedência tornam somente os slots afetados indisponíveis.
18. O modo “Tanto faz” retorna slots com pelo menos um profissional compatível e escolhe novamente no backend.
19. A confirmação revalida um slot que ficou inválido durante a navegação.
20. A limpeza não remove clientes ligados a agendamentos, comandas ou lista de espera.
21. A limpeza remove somente candidatos explicitamente órfãos e incompletos.
22. RPCs internas não podem ser chamadas pelos papéis públicos indevidos.
23. Build, lint e todos os testes atuais continuam passando.

## Out of Scope

- Redesign visual, troca de componentes, alteração de identidade visual ou mudança de layout das telas existentes.
- Mudança do provedor de WhatsApp, dos templates ou das regras de mensageria, exceto os efeitos inevitáveis da origem correta do cadastro.
- Alteração do fluxo interno de agenda, encaixes, comandas, caixa ou permissões de gerente/barbeiro, salvo para preservar compatibilidade com o novo contrato público.
- Cadastro de conta Supabase Auth para clientes finais; o canal continuará usando o token de acesso existente.
- Exclusão de clientes com qualquer vínculo histórico, mesmo que o nome seja genérico.
- Criação de uma nova tabela de identidade quando `customers` e a unicidade por telefone já atenderem ao modelo.
- Alteração de regras de pagamento, preços, comissões ou duração além do necessário para calcular disponibilidade e confirmação.
- Aplicação de migrations, exclusões de dados ou mudanças remotas durante a elaboração desta especificação.

## Further Notes

- O banco remoto consultado já possui `customers_tenant_telefone_normalizado_uidx`, `professional_services` com unicidade por tenant e serviço/profissional, RLS habilitado nas tabelas relevantes e a infraestrutura de conflito de horários. O trabalho deve aprofundar e alinhar esses contratos, não duplicá-los.
- O RPC atual de contexto por slug já existe, mas o RPC de inicialização ainda cria provisórios. O rollout deverá migrar consumidores antes de remover a função legada.
- O remoto possui configurações reais de timezone e intervalo diferentes entre tenants; os testes devem incluir valores distintos para provar que a grade não depende de defaults hard-coded.
- O adapter atual contém fallbacks para funções antigas e o frontend possui efeitos que carregam catálogo, perfil e slots em momentos diferentes. A remoção desses fallbacks deve ocorrer somente quando o contrato novo estiver coberto por testes.
- A verificação final será feita no banco por MCP, incluindo migrations aplicadas, advisors, grants, contagens de candidatos fantasmas, isolamento por tenant e smoke tests não destrutivos.
