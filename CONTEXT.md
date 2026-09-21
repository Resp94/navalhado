# Navalhado

Glossario de dominio do Navalhado, usado para manter uma linguagem comum nas decisoes de produto, dados e operacao.

## Language

**Ambiente Dev Completo e Isolado**:
Um ambiente de desenvolvimento separado da producao, com branch, variaveis de ambiente, banco Supabase, Edge Functions, secrets, triggers e rotinas proprias. Nenhum fluxo do ambiente dev deve chamar recursos de producao.
_Avoid_: Banco de testes, replica parcial, ambiente compartilhado

**Configuracao Local Padrao**:
Conjunto de variaveis carregado no desenvolvimento local. No Navalhado, deve apontar para o ambiente dev, nao para producao.
_Avoid_: Env de producao local, configuracao mista

**URL Publica Dev**:
Endereco publico do frontend do ambiente dev usado em links enviados por WhatsApp e testes reais. No Navalhado, esta URL e `https://dev.navalhado.com.br`.
_Avoid_: localhost em mensagens, URL de producao em teste

**Integração WhatsApp Dev**:
Instância Uazapi exclusiva do banco e do frontend Dev, usada para criar, parear e testar o WhatsApp piloto sem tocar Produção. A promoção para Prod é sequencial e só ocorre mediante comando explícito.
_Avoid_: Uazapi compartilhada entre ambientes, instância Dev em Produção, promoção automática

**Cliente Provisório**:
Cliente cadastrado de forma simplificada (apenas nome/telefone) durante um agendamento rápido ou integração WhatsApp, sem senha criada ou cadastro formalizado.
_Avoid_: Cliente temporário, visitante, lead solto

**Cliente Completo**:
Cliente com perfil totalmente preenchido, verificado e promovido no sistema.
_Avoid_: Cliente ativo, conta finalizada

**ClienteRepository**:
Módulo profundo responsável por isolar toda a lógica de acesso a dados, filtros por tenant, geração de token de acesso e promoção de cadastro de clientes.
_Avoid_: Serviço de cliente, helper de cliente, cliente API

**AgendaRepository**:
Módulo profundo, porta única da Agenda Geral e da Minha Agenda para as transições de estado do Agendamento feitas pelo gestor e pelo barbeiro (iniciar atendimento, cancelar, marcar falta). Valida a entrada e delega a RPCs que decidem estado de origem, horário, papel e unidade no banco (ADR 023); não replica essas regras no cliente.
_Avoid_: Serviço de agenda, helper de agendamento, escrita direta em `appointments` pela tela

**CanalClienteRepository**:
Módulo profundo responsável por isolar a validação do Acesso Tokenizado do Cliente, catálogo de serviços e profissionais, consulta de horários disponíveis, criação, reagendamento e cancelamento de Eventos de Agendamento.
_Avoid_: Serviço de agendamento, helper de agendamento, agendamento API


**Canal do Cliente**:
Experiência tokenizada pela qual o Cliente conclui seu cadastro e consulta, cria, reagenda ou cancela seus próprios agendamentos.
_Avoid_: Área pública, portal anônimo, painel do cliente

**Acesso Tokenizado do Cliente**:
Credencial bearer exclusiva que identifica o Cliente no Canal do Cliente enquanto estiver válida, sem exigir senha.
_Avoid_: Login do cliente, link público, sessão anônima

**Evento de Agendamento**:
Fato canônico que registra a criação confirmada, o cancelamento ou o reagendamento de um Agendamento e pode ser comunicado por diferentes canais.
_Avoid_: Notificação de agendamento, status do WhatsApp, trigger de agendamento

**Instância WhatsApp**:
Conexão lógica e física de um tenant com o WhatsApp, representada por `public.whatsapp_instances` e operada pelo adaptador Uazapi no backend. O estado observado pode ser `disconnected` (sem sessão), `connecting` (pareamento em andamento), `connected` (sessão autenticada) ou `hibernated` (sessão pausada, com credenciais preservadas). O gerenciamento é exclusivo do Gerente do tenant.
_Avoid_: nome de provedor no domínio, estado de pareamento legado, token no frontend, instância compartilhada

**Templates de Notificação WhatsApp**:
Padrões de texto parametrizados e persistidos por tenant em `public.whatsapp_instances` (`template_confirmation`, `template_reschedule`, `template_cancellation`, `template_reminder`, `template_first_contact`), que suportam interpolação dinâmica de tags do domínio (`{cliente}`, `{barbearia}`, `{servico}`, `{profissional}`, `{data}`, `{horario}`, `{link}`). Na ausência ou nulidade de um template customizado, o sistema adota automaticamente o texto padrão canônico (*fallback seguro*).
_Avoid_: Mensagem fixa no código, texto solto sem tags, template global estático

**Wizard de Onboarding**:
Assistente obrigatório de configuração pós-cadastro inicial (`/onboarding`), composto por etapas sequenciais (Localização, Segmentação, Catálogo Inicial de Serviços e Equipe de Profissionais), responsável por parametrizar o tenant antes da operação regular.
_Avoid_: Passo a passo legado, formulário de boas-vindas, setup opcional

**Gatekeeper de Onboarding**:
Mecanismo de proteção de rotas no frontend e validação de estado no backend que intercepta o acesso do Gestor às rotas operacionais do tenant (`/agenda`, `/clientes`, `/financeiro`, etc.) enquanto a flag `onboarding_completed` do tenant for falsa, forçando o redirecionamento para o Wizard de Onboarding.
_Avoid_: Bloqueio temporário, redirect solto, verificação manual

**Agenda Geral (Rota /agenda)**:
Superfície operacional canônica do Gerente no painel da barbearia, responsável pela visualização em tempo real de horários, colunas de profissionais, criação de agendamentos manuais, encaixes rápidos, bloqueios e controle de status de atendimento.
_Avoid_: Dashboard do Gerente, Painel Geral, Tela de Relatórios

**Comanda**:
Instrumento transacional que agrupa todos os itens consumidos (serviços prestados e produtos adquiridos), descontos, gorjetas e comissões associados a um atendimento ou venda de balcão, gerenciando o ciclo de vida entre os estados `aberta`, `fechada` e `cancelada`.
_Avoid_: Conta solta, pedido avulso, ticket

**Item de Comanda**:
Registro unitário de serviço executado ou produto faturado dentro de uma Comanda, contendo identificação do item, quantidade, valor cobrado e o profissional executor responsável pelo recebimento de comissão.
_Avoid_: Linha de pedido, serviço extra, produto vendido

**Divisão de Pagamento de Comanda**:
Fracionamento da liquidação financeira de uma Comanda em múltiplas formas de pagamento simultâneas (ex: R$ 30,00 no PIX e R$ 20,00 em Dinheiro) com validação de troco e registro discriminado no caixa do dia.
_Avoid_: Pagamento parcial solto, split manual, baixa mista

**Sessão de Caixa**:
Período operacional delimitado de movimentação financeira do tenant (`cash_sessions`), iniciado pela declaração de abertura com fundo de troco inicial e finalizado com a conferência e fechamento consolidado dos valores por método de pagamento.
_Avoid_: Caixa aberto, turno solto, gaveta diária

**Bloqueio de Horário**:
Intervalo temporal de indisponibilidade de um profissional na grade (`blocked_slots`), registrado por motivos operacionais (como almoço, folga, compromisso externo ou manutenção), que é renderizado com sinalização visual de bloqueio na Agenda e subtraído automaticamente dos slots livres ofertados no Canal do Cliente.
_Avoid_: Agendamento fake, pausa solta, horário travado manual

**Produto**:
Item físico comercializado pela barbearia (`public.products`), com controle de saldo de estoque, preço de venda, custo unitário e baixa automática na finalização de Comandas.
_Avoid_: Mercadoria avulsa, serviço de balcão, item físico genérico

**Lista de Espera**:
Fila diária de clientes cadastrados que aguardam abertura de vagas ou cancelamentos no mesmo dia (`public.waiting_list`), com disparo de alertas e atalho de encaixe com 1 clique para a recepção. O Agendamento criado pelo encaixe fica marcado no banco (`appointments.from_waiting_list`), gravado na mesma transação que baixa a entrada, e a Agenda o exibe com o selo "Espera". A marca não é texto na nota do Agendamento e não altera a origem (`origin`), que descreve o canal de entrada.
_Avoid_: Fila solta, lista de encaixe manual, anotação de espera, prefixo `[Fila de Espera]` na nota, valor de origem para a fila

**Rodízio de Barbeiros**:
Lógica de ordenação e sugestão de atendimento de balcão (*walk-in*) para balancear a quantidade de clientes atendidos entre os profissionais ativos sem preferência específica indicada.
_Avoid_: Vez da fila, sorteio de barbeiro, ordem manual

**Perfil Progressivo do Cliente**:
Estratégia de captura de dados onde o agendamento público exige fricção zero (apenas nome e WhatsApp), reservando dados enriquecidos (aniversário, tags, canal de aquisição, notas) para o painel do gerente ou preenchimento voluntário posterior.
_Avoid_: Formulário longo no agendamento, cadastro obrigatório burocrático

**Central 360º do Cliente**:
Interface profunda no painel do Gerente que consolida o perfil cadastral, métricas de frequência e ticket médio, histórico unificado de agendamentos e comandas, e ações rápidas (WhatsApp, comanda, tags).
_Avoid_: Modal genérico de cliente, tela de visualização simples

**Associação Profissional-Serviço**:
Contrato granular N:N (`professional_services`) que define se um profissional específico executa determinado serviço, permitindo que o barbeiro personalize sua própria duração de atendimento (com padrão do sistema de 40 minutos) e sobrescreva o percentual de comissão.
_Avoid_: Vínculo solto, comissão única global fixa, tempo único obrigatório

**Duração Padrão de Serviço**:
Tempo base inicial de atendimento atribuído a novos serviços no Navalhado, fixado em 40 minutos, passível de personalização individual por cada profissional.
_Avoid_: Grade fixa de 30 min, tempo engessado

**Tempo de Retorno de Serviço**:
Intervalo estimado em dias (`return_period_days`) para o cliente realizar a manutenção do procedimento (ex: 20 dias para corte, 60 dias para química), servindo de gatilho para a régua de reativação automática via WhatsApp com template personalizado.
_Avoid_: Lembrete genérico, pós-venda manual

**Modalidade de Preço do Serviço**:
Classificação do valor cobrado entre preço fixo (`fixed`) e valor inicial flexível (`starting_at`), permitindo ajuste justo no fechamento da comanda conforme a complexidade do trabalho.
_Avoid_: Preço único obrigatório, valor engessado

**Classificação de Produto (Venda vs Insumo)**:
Distinção operacional entre produtos comercializados ao cliente final no checkout de comandas (`retail`) e insumos consumidos na bancada ou lavatório pelos profissionais (`internal_use`), evitando mistura indevida de estoque e comissões.
_Avoid_: Produto genérico, mercadoria mista

**Ponto de Reposição de Estoque**:
Quantidade mínima estipulada (`min_stock_alert`) que dispara avisos visuais no painel do Gerente para recompra preventiva de mercadorias e insumos antes do desabastecimento.
_Avoid_: Estoque zerado surpresa, contagem cega

**Hub Financeiro (Rota /financeiro)**:
Superfície central de gestão financeira operacional do Gerente no Navalhado, organizada em abas endereçáveis por sub-rota (`/financeiro/caixa`, `/financeiro/comissoes`, `/financeiro/cadastros`, `/financeiro/contas-a-pagar`, `/financeiro/fluxo-de-caixa`), cada uma com link próprio, favoritável e alcançável pelo botão voltar do navegador. `/financeiro` sem sub-rota, ou com sub-rota desconhecida, redireciona para a aba Caixa Diário & Turnos (ciclo de abertura com fundo de troco, conferência e fechamento de sessões físicas de caixa). A segunda aba é Repasses de Comissões (gestão de saldos acumulados da equipe, detalhamento de atendimentos e quitação formal de pagamentos aos barbeiros). Um layout intermediário, sem segmento de URL, guarda o filtro de período e os KPIs consolidados só para essas duas abas operacionais. As abas Plano de Contas, Contas a Pagar e Fluxo de Caixa Projetado não têm esse período: são rota-filha direta do Hub, fora do layout intermediário, cada uma com o próprio filtro (vencimento, no caso de Contas a Pagar) quando precisa de um. Relatórios profundos de BI e DRE estendido são delegados à futura rota de relatórios.
_Avoid_: Tela de relatórios analíticos, gráficos de BI soltos, dashboard contábil genérico, filtro de período como cabeçalho global do Hub

**Abertura de Caixa do Turno**:
Registro formal do início da operação física de frente de caixa (`cash_sessions`), no qual o operador declara o montante em dinheiro mantido na gaveta como Fundo de Troco Inicial para subsidiar trocos aos primeiros atendimentos.
_Avoid_: Caixa aberto no ar, início tácito de turno

**Fechamento de Caixa com Conferência**:
Conclusão formal da sessão de caixa (`cash_sessions`), onde o operador declara a contagem física final das cédulas na gaveta e o sistema confronta com os recebimentos calculados em dinheiro das comandas liquidadas no turno, registrando eventuais sobras ou quebras de caixa.
_Avoid_: Fechamento cego automático, zeramento de gaveta sem conferência

**Quitação de Comissão**:
Transação formal de liquidação e repasse de valores faturados por um profissional (`commission_payouts`), registrando o valor pago, a forma de liquidação (PIX, dinheiro da gaveta, transferência bancária), data do pagamento e observações contábeis.
_Avoid_: Baixa verbal de comissão, anotação em papel, repasse não rastreado

**Conta do Profissional**:
Extrato de créditos e débitos por profissional (`professional_account_entries`), separado da comissão automática de atendimentos. Gorjeta entra como crédito ao fechar a Comanda; vale e adiantamento entram como débito. Discrimina a natureza do lançamento (`entry_type`) da aritmética do saldo (`direction`), para que a soma de créditos e débitos nunca dependa de conhecer todo tipo de lançamento existente.
_Avoid_: Extensão de comissão, saldo avulso, planilha paralela

**Plano de Contas (Rota /financeiro/cadastros)**:
Superfície de cadastros auxiliares do Hub Financeiro, com as seções de Categoria de Despesa e (a partir do ticket 035/06) Fornecedor. Sem período nem KPIs: é rota-filha direta do Hub, fora do layout intermediário de Caixa e Comissões. Escrita exclusiva por RPC `SECURITY DEFINER` (a partir do ticket 035/04); a leitura desta spec é por tabela com RLS. Ambos os cadastros são arquivados, nunca excluídos fisicamente, e servem de contrato para a Conta a Pagar (spec 036): toda Conta a Pagar referencia uma Categoria de Despesa ativa do tenant, obrigatória, e opcionalmente um Fornecedor.
_Avoid_: Plano de contas contábil completo, DRE, hierarquia de categorias, exclusão física de categoria ou fornecedor

**Fluxo de Caixa Projetado (Rota /financeiro/fluxo-de-caixa)**:
Aba do Hub Financeiro, rota-filha direta de `/financeiro` e fora do filtro de período do painel de Caixa e Comissões, que mostra por dia, semana ou mês o que entrou e saiu de fato e o que deve entrar e sair até o fim do período. O contrato de leitura (`get_projected_cash_flow`) lê cada fato financeiro no livro onde ele nasce e nunca `cash_movements` (espelho ou transferência interna, como sangria e suprimento, que não são receita nem despesa), devolve `timezone` e `business_today` do banco -- a tela nunca decide sozinha qual é o dia de hoje -- e classifica cada agrupamento como passado, atual ou futuro. O ticket 01 cobre entradas realizadas: pagamentos de Comanda fechada, líquidos de estorno, no dia de negócio do pagamento no fuso do tenant. O ticket 02 soma saídas realizadas: Quitações de Comissão (`commission_payouts.amount`, já líquido do abate de vale, no dia de negócio de `paid_at`, sem as estornadas) e vales (`professional_account_entries` com `entry_type = 'vale'`, no dia de negócio da criação, sem os estornados) -- cada fato lido no livro onde nasce, nunca via `cash_movements`, para não contar a mesma saída duas vezes nem ignorar o que foi pago fora da gaveta. `pending_flow` soma entradas futuras e subtrai saídas futuras (ex.: Quitação com `paid_at` adiante), o que já obriga as três somas por bucket (entrada, Quitação, vale) a serem agregadas cada uma em sua própria CTE antes de juntar -- juntar direto no mesmo `GROUP BY` produz produto cartesiano e multiplica os totais sempre que mais de uma fonte tiver mais de um dia no mesmo agrupamento. O ticket 03 acrescenta a **Entrada Estimada**: só dias futuros (hoje nunca recebe estimativa), média do recebido nas N ocorrências mais recentes do mesmo dia da semana (N até 8, contado a partir do primeiro pagamento de Comanda do tenant, não da criação do tenant); abaixo de 4 semanas o estado vira `insufficient_history` e o campo por agrupamento fica `null` ("vazio", nunca "zerado") sempre que houver dia futuro ativo -- `0` só é correto quando não há dia futuro ativo a estimar (agrupamento todo passado, ou só dias fechados). Dia fechado é lido de `tenants.business_hours` (chaves em português: segunda..domingo, campo `active`; dia ausente ou sem `active` conta como fechado, mesma leitura da agenda) e vale sempre zero, mesmo com histórico. `pending_flow` soma a estimativa só quando o status é `ok`. O ticket 04 acrescenta a curva, composta no navegador (`computeFluxoCaixaCurva`, `src/modules/fluxo-caixa/curva.ts`) a partir do que o contrato já devolve, sem consulta nova a cada tecla. Sem saldo informado (zero, o padrão), ela é o **Resultado Acumulado**: soma corrida, desde o primeiro agrupamento do período, de entradas realizadas + estimadas − saídas realizadas − previstas − vencidas (campos ainda ausentes contam como zero). Com saldo informado (maior que zero), vira o **Saldo Projetado**: começa no agrupamento atual com `saldoInformado + pending_flow` e soma o `pending_flow` de cada agrupamento seguinte -- agrupamentos passados não têm saldo (`null`), porque reconstruir saldo passado fingiria conhecer dinheiro que o sistema não registra, e o realizado de hoje não entra de novo porque já está dentro do saldo informado. O saldo informado é estado só de tela (`FluxoCaixaTab`, nunca gravado, nunca na URL, nunca em armazenamento do navegador) e some do formulário num período inteiramente passado. Três decisões (leitura pelos livros de origem, estimativa sem persistência, saldo só de tela) estão na ADR 021. O ticket 05 acrescenta os **Compromissos sem Data**: quanto a barbearia deve hoje à equipe entre comissões e gorjetas em aberto, menos vales a abater, com piso zero por profissional (reusa `get_professional_commission_balance` por profissional do tenant -- ativo, inativo ou arquivado -- somando `suggested_net_amount`, a mesma fonte que a Quitação de Comissão já exibe e liquida, para que as duas telas nunca divirjam). Fica numa chave de topo (`undated_commitments`), calculada uma única vez por consulta, independente do período pedido -- nunca entra em nenhum agrupamento, no `pending_flow` nem na curva, porque distribuí-lo exigiria inventar uma data de quitação. **Atenção:** `get_professional_commission_balance` soma vale/gorjeta em aberto só por `status` (`open`/`partially_paid`), sem filtrar `reversed_at` -- um teste que insira um vale com `reversed_at` preenchido mas `status` ainda `'open'` (só para testar a leitura própria do fluxo de caixa, que filtra por `reversed_at`) contaminaria os Compromissos sem Data se reusasse o mesmo tenant de outro teste. O ticket 06 é só tela, sem tocar o contrato: gráfico SVG feito à mão (`FluxoCaixaGrafico.tsx`, mesmo precedente do painel administrativo, nenhuma dependência nova) com barras de entrada (realizada sólida, estimada com hachura -- a distinção nunca depende só de cor) e saída realizada por agrupamento, mais a linha da curva vigente, com o mesmo destaque de primeiro período negativo da tabela e do resumo; rola na horizontal só dentro do próprio contêiner (largura mínima por agrupamento), nunca a página. Tocar um agrupamento na tabela, num cartão de celular ou num grupo do gráfico abre `FluxoCaixaDetalheDrawer` (entradas por forma de pagamento, Quitações de Comissão e vales por profissional, dias estimados e fechados) direto dos dados do bucket já carregado, sem repositório próprio nem nova ida à rede. O ticket 07 acrescenta a **Saída Prevista** e a **Conta a Pagar Vencida**: toda Conta a Pagar (`public.payables`, spec 036) em aberto ou parcialmente paga entra pelo saldo restante (`amount - paid_amount`). Vencimento hoje ou depois é prevista, no agrupamento do próprio vencimento (`outflow_forecast`); vencimento já passado é vencida, sempre no agrupamento atual (`outflow_overdue`) -- nunca as duas ao mesmo tempo para a mesma conta, e conta paga ou cancelada não entra em nenhuma. `pending_flow` desconta as duas por inteiro, mesmo a prevista vencendo hoje, porque nenhuma delas já saiu da gaveta. A junção usa uma "data atribuída" por linha (o próprio vencimento para prevista, sempre `p_today` para vencida) contra o intervalo de cada bucket -- como `p_today` só cai dentro de um bucket quando existe o agrupamento "atual" (`p_end_date >= p_today`), um período inteiramente passado não devolve vencida nenhuma de graça, sem `if` separado. Detalhamento por bucket ganha `payables_forecast` (descrição, saldo restante, vencimento original, `overdue`). O ticket 08 (último da cadeia) soma a Baixa de Conta a Pagar (`public.payable_settlements`, spec 036) em `outflow_realized`, pelo `paid_amount` já gerado (principal + juros − desconto), sem recompor a fórmula. Conta na data do pagamento (sempre passada ou hoje -- `settle_payable` recusa data futura, então nunca precisa de "pending" como as outras fontes de saída realizada). Conta pelo próprio `reversed_at`, nunca pelo status da Conta a Pagar (uma Baixa numa conta já "paga" ainda conta). Baixa de valor pago zero (abatimento do fornecedor) soma zero em `outflow_realized`, mas o saldo restante da conta -- e com ele a Saída Prevista -- já cai pelo principal abatido, porque `settle_payable` incrementa `payables.paid_amount` pelo principal, nunca pelo pago líquido. Baixa pela gaveta também gera `cash_movements`, mas o fluxo nunca lê essa tabela -- conta uma vez só. Nenhum índice novo: usa `idx_payable_settlements_tenant_payment_date_active`, já criado pela spec 036. Detalhamento por bucket ganha `settlements_by_category` (Baixas pagas por Categoria de Despesa).
_Avoid_: Ler cash_movements para receita ou despesa, faturamento (a aba sempre diz "recebido"), data local do navegador como "hoje", somar múltiplas fontes "many-rows-per-bucket" num único GROUP BY, zerar a entrada estimada quando o histórico é insuficiente (deve ficar `null`/vazia), gravar ou persistir o saldo informado em qualquer lugar, mostrar saldo projetado em agrupamento passado, distribuir Compromissos sem Data entre agrupamentos ou somá-los ao pending_flow/curva, nova dependência de gráficos, distinguir entrada estimada só por cor, contar a mesma Conta a Pagar como prevista e vencida ao mesmo tempo, projetar juros/multa futuros de Conta a Pagar (só existem quando a Baixa acontece), recompor o valor pago da Baixa em vez de usar `paid_amount`, filtrar Baixa pelo status da Conta a Pagar

**Categoria de Despesa**:
Classificação plana (sem hierarquia, sem grupo de DRE) de para onde vai uma despesa da barbearia (`financial_categories`, coluna `nature = 'expense'`). Todo tenant nasce, por gatilho `AFTER INSERT` em `tenants`, com catorze categorias padrão comuns do setor (Aluguel e condomínio, Energia, Água, Internet e telefone, Produtos para revenda, Insumos de bancada, Manutenção e reparos, Marketing, Impostos e taxas, Contabilidade, Software e assinaturas, Salários e encargos, Pró-labore, Outras despesas), identificadas por uma chave estável (`seed_key`) que torna a semeadura idempotente independente de o gestor ter renomeado a categoria. O nome é único por tenant e natureza sem diferenciar maiúsculas, inclusive contra categorias arquivadas. Arquivar (carimbo `archived_at`/`archived_by`, nunca exclusão física) tira a categoria das opções de lançamento sem afetar o que já foi classificado nela.
_Avoid_: Categoria de conta financeira genérica, tipo de despesa em texto livre, exclusão física de categoria, hierarquia de categorias

**Fornecedor**:
Cadastro de quem recebe pagamentos da barbearia (`suppliers`), com nome, CPF ou CNPJ opcional (`private.is_valid_br_document`, mesma função do documento de Categoria), telefone, e-mail, observação e uma Categoria de Despesa padrão opcional. Nome e documento são únicos por tenant sem diferenciar maiúsculas, inclusive contra fornecedores arquivados; a categoria padrão é referenciada por chave estrangeira composta (`tenant_id`, `default_category_id`) sobre `financial_categories`, e só pré-preenche a Conta a Pagar (spec 036) se a categoria estiver ativa. Uma categoria padrão já definida que foi arquivada depois continua vinculada ao fornecedor até ele escolher outra. Arquivar (carimbo `archived_at`/`archived_by`, nunca exclusão física) tira o fornecedor das opções de lançamento sem afetar o que já foi pago a ele; arquivar a categoria padrão não desfaz o vínculo, só o efeito de pré-preencher.
_Avoid_: Texto livre no motivo de sangria/entrada de estoque, exclusão física de fornecedor, forma de pagamento do fornecedor (isso é da Conta a Pagar, spec 036)

**Conta a Pagar (Rota /financeiro/contas-a-pagar)**:
Despesa da barbearia com vencimento (`payables`), livro próprio e separado dos movimentos de caixa (`cash_movements`): a maior parte das Contas a Pagar nunca passa pela gaveta. Referencia uma Categoria de Despesa ativa do tenant, obrigatória, e opcionalmente um Fornecedor ativo. Nasce avulsa (ticket 06/036); Recorrência, Parcelamento e Baixa chegam nos tickets 07 a 15, sobre a mesma tabela. Escrita exclusiva por RPC `SECURITY DEFINER`; a leitura paginada (`list_payables`) também é RPC, não SELECT direto com RLS, porque a situação derivada e a data de competência dependem do dia de negócio do tenant, calculado no servidor a partir de `tenants.timezone` -- nenhuma tela decide "hoje" a partir do navegador. Data de competência nasce igual ao vencimento quando não informada; não é consumida por nenhuma tela desta entrega.
_Avoid_: Extensão de cash_movements, saldo de caixa dentro da própria Conta a Pagar, "hoje" vindo do navegador, exclusão física de conta a pagar

**Conta a Pagar Vencida**:
Situação derivada (não uma coluna gravada) de uma Conta a Pagar em aberto ou parcialmente paga cujo vencimento é anterior ao dia de negócio do tenant no momento da leitura (`list_payables`). Contas pagas ou canceladas nunca são vencidas, mesmo com vencimento passado. Vencimento a até sete dias do dia de negócio, sem estar vencido, ganha faixa de destaque de alerta (`due_today` no próprio dia, `due_soon` até sete dias) -- outra situação derivada, não gravada.
_Avoid_: Status gravado em coluna própria, vencimento calculado no navegador, alerta por e-mail ou notificação (fora de escopo desta spec)

**Data de Competência**:
Data (`competence_date`) a que uma Conta a Pagar pertence para fins de resultado por mês, gravada já na criação com o vencimento como valor inicial -- reconstruí-la depois, sem tê-la gravado desde o início, não seria possível. Nenhuma tela desta entrega a exibe ou consome; existe para as entregas futuras de totais e relatório por período.
_Avoid_: Confundir com vencimento (a data em que a conta deve ser paga), calcular a partir de outras colunas depois do fato

**Baixa (ticket 07/036)**:
Pagamento (total ou parcial) de uma Conta a Pagar (`payable_settlements`), em tabela própria e separada -- uma conta pode ter várias Baixas. O principal abate o saldo da conta; juros e multa entram só no valor pago, nunca no saldo; desconto faz parte do principal abatido (pagar R$ 95 numa conta de R$ 100 com R$ 5 de desconto é principal 100, desconto 5, valor pago 95, conta paga). Valor pago (`paid_amount`) é coluna gerada (`principal + juros - desconto`), nunca recomposta pelo consumidor -- fonte única também para o fluxo de caixa da spec 037. Valor pago zero só é aceito fora do caixa (abatimento concedido pelo fornecedor). O contrato nasceu completo no ticket 07/036 (parâmetros de origem e Sessão de Caixa já existem), mas a origem gaveta é recusada com mensagem explícita até o ticket 15/036.
_Avoid_: Somar juros ao saldo da conta, recompor o valor pago a partir de outras colunas, aceitar Baixa pela gaveta antes do ticket 15/036

**Estorno de Baixa (ticket 07/036)**:
Reversão de uma Baixa lançada por engano (`reversed_at`/`reversed_by`/`reversal_reason` na própria linha da Baixa, todos ou nenhum preenchidos) -- nada é apagado. Exige motivo com pelo menos cinco caracteres, recusa Baixa já estornada, devolve o principal ao saldo da conta e recalcula o estado da conta (aberto ou parcialmente pago conforme o que sobrar de Baixas ativas). Baixa e Estorno de Baixa travam primeiro a Conta a Pagar (e, no estorno, a Baixa também) antes de qualquer verificação de estado ou saldo -- ordem fixa que evita ciclo de lock com a Sessão de Caixa quando o ticket 15/036 acrescentar a gaveta.
_Avoid_: Apagar a Baixa estornada, recalcular o estado da conta sem considerar as outras Baixas ativas

**Origem do Dinheiro (ticket 07/036)**:
Campo da Baixa (`source`: `gaveta` ou `fora_do_caixa`) que declara de onde saiu o pagamento. Fora do caixa (Pix, boleto, transferência, débito automático, cartão, dinheiro fora da gaveta) não movimenta nenhum saldo. Pela gaveta gera um movimento de caixa vinculado à Baixa nos dois sentidos -- só disponível a partir do ticket 15/036. A forma de pagamento da Baixa (`payment_method`: inclui boleto e débito automático) é um domínio próprio, não o mesmo conjunto usado pelos pagamentos de Comanda.
_Avoid_: Reusar o domínio de forma de pagamento da Comanda, tratar "fora do caixa" como sinônimo de "não registrado"

**Série (ticket 11/036)**:
Tabela própria (`payable_series`) que agrupa as ocorrências de uma Recorrência ou de um Parcelamento (ticket 12/036): tipo, periodicidade, data âncora (o vencimento da primeira ocorrência), valor informado na criação, autor e momento -- só isso. Descrição, Categoria de Despesa, Fornecedor, documento e observação vivem em cada ocorrência (`payables`), nunca duplicados na Série. As ocorrências são materializadas na criação (sem motor de regra, sem processo agendado): cada uma é uma Conta a Pagar comum, com Baixa, estorno, edição e cancelamento próprios. O calendário é calculado num único lugar no servidor (`private.compute_series_due_date`) a partir da âncora, nunca da ocorrência anterior -- a ocorrência de posição *i* vence na âncora deslocada *(i-1)* períodos, e mensal/anual limitam ao último dia do mês-alvo (âncora 31/jan vence em 28 ou 29/fev e volta a 31/mar). A prévia (`preview_payable_series`) usa o mesmo cálculo da criação, para nunca ser replicado no navegador.
_Avoid_: Guardar descrição/categoria/fornecedor na Série, calcular datas no navegador, gerar ocorrências sob demanda em vez de materializar na criação

**Recorrência (ticket 11/036)**:
Tipo de Série (`series_type = 'recurring'`) para uma despesa que se repete: de 1 a 60 ocorrências, todas com o mesmo valor. Cada ocorrência recebe o próprio vencimento como competência, porque cada uma é uma despesa do seu período -- ao contrário do Parcelamento (ticket 12/036), que tem uma única competência para todas as parcelas. Periodicidade semanal (sete dias), quinzenal (catorze dias, para manter o dia da semana), mensal ou anual.
_Avoid_: Competência única para as ocorrências (isso é do Parcelamento), valor variando entre ocorrências

**Parcelamento (ticket 12/036)**:
Tipo de Série (`series_type = 'installment'`) para uma compra dividida: de 2 a 60 parcelas (mínimo 2, não 1 -- uma parcela só não é parcelamento) a partir de um valor total. O total é dividido truncado em centavos (`trunc(valor / quantidade, 2)`) e a última parcela absorve o resíduo, para a soma bater exatamente com o total sem sobrar nem faltar centavo. Uma única competência (a informada na criação, ou o vencimento da primeira parcela quando omitida) é replicada em todas as parcelas -- ao contrário da Recorrência, uma compra parcelada é uma despesa só. A descrição é gravada sem sufixo "i/N": a numeração de cada parcela é derivada da posição (`series_position`) e da quantidade de ocorrências na leitura, nunca persistida -- editar a descrição da Série não exige reescrever a numeração em cada parcela. Reusa o mesmo calendário e a mesma prévia da Recorrência (`private.compute_series_due_date`, `preview_payable_series`), sem exigir troca de assinatura.
_Avoid_: Arredondar em vez de truncar a divisão (perderia ou sobraria centavo na soma), persistir a numeração "i/N" na descrição, competência por parcela (isso é da Recorrência), aceitar quantidade 1

**Edição e cancelamento em Série (ticket 13/036)**:
"Esta e as seguintes em aberto" (`update_payable_series`/`cancel_payable_series`) atinge a ocorrência escolhida e as de posição maior *dentro da mesma Série*, sempre travando a Série primeiro e depois as ocorrências em ordem de posição -- toda verificação de estado vem só depois do lock. Pagas, parcialmente pagas e já canceladas nunca são alteradas, mesmo dentro do alcance: a RPC devolve uma linha por ocorrência atingida com `ignored`/`ignore_reason`, nunca silencia o que não mudou. Em lote só se edita descrição, Categoria de Despesa, Fornecedor, observação e valor -- vencimento, documento e competência continuam exclusivos da edição individual (ticket 08/036), porque recalcular datas em lote exigiria decidir o que fazer com ocorrências já pagas no meio. Valor em lote só existe na Recorrência: a RPC recusa quando a Série é um Parcelamento, já que as parcelas têm resíduo calculado na criação. "Apenas esta" nunca ganhou uma RPC própria -- é literalmente `update_payable`/`cancel_payable` do ticket 08/036, chamados com o alcance padrão.
_Avoid_: Recalcular vencimento/documento/competência em lote, aceitar valor em lote num Parcelamento, alterar ocorrências pagas/parcialmente pagas/canceladas mesmo dentro do alcance, travar ocorrências antes da Série

**Aviso de fim próximo e extensão da Recorrência (ticket 14/036)**:
Mitiga o limite de 60 ocorrências por operação do ticket 11/036 -- não existe recorrência sem fim. O aviso é por dias (até 60 a partir do dia de negócio do tenant), não por quantidade de ocorrências, para valer igual em qualquer periodicidade; só a ocorrência de maior `series_position` da Série importa (a "última", mesmo que pagas/parciais no meio não contem) -- se ela está cancelada, não há aviso, porque o gestor já encerrou deliberadamente. Parcelamento nunca tem aviso nem extensão: o total é o contrato. A extensão (`extend_recurring_payable_series`) gera de 1 a 60 ocorrências novas com posições a partir da MAIOR posição já existente (contando canceladas, pra nunca colidir), pelo mesmo calendário ancorado na data original da Série -- nunca na data da última ocorrência. Valor, categoria, fornecedor e descrição vêm da última ocorrência NÃO cancelada, para que um reajuste feito em "esta e as seguintes" (ticket 13/036) sobreviva à extensão; documento e observação não são herdados. A prévia (`preview_extend_recurring_payable_series`) usa o mesmo cálculo, nunca replicado no navegador. `get_payable` ganhou `series_ending_soon`/`series_last_due_date` (mesma exceção de drop+create do ticket 11/036, coluna nova no retorno).
_Avoid_: Contar ocorrências para o aviso em vez de dias, ancorar a extensão na última ocorrência em vez da âncora original da Série, herdar valor/categoria/fornecedor/descrição de uma ocorrência cancelada, permitir aviso ou extensão em Parcelamento

**Baixa pela gaveta (ticket 15/036)**:
Um novo tipo de movimento de caixa (`baixa_conta_pagar`, sentido `saida`) é tudo que a apuração única do ticket 01/036 precisou para passar a descontar pagamentos de conta do valor esperado da gaveta -- `private.compute_cash_session_expected_amount` nunca foi editada, só o CASE de sentido (coluna gerada `cash_movements.direction`, sem ramo padrão) ganhou um `when`. `close_cash_session`, `register_commission_payout` e `register_professional_advance` (que já consumiam a apuração única) enxergam o disponível reduzido automaticamente, sem nenhuma mudança nelas -- só `close_cash_session` foi tocada, e só para gravar `calculation_version = 'cash_expected_v4'` (nenhuma coluna de fotografia nova na Sessão de Caixa). Vínculo bidirecional `cash_movements.payable_settlement_id` <-> `payable_settlements.cash_movement_id`, com índice único nas DUAS pontas (diferente do vale, que só é único do lado do lançamento): uma Baixa não pode reivindicar a mesma saída de gaveta que outra, e vice-versa. `payable_settlements_drawer_link_check` (ticket 07/036) já exigia `cash_movement_id` preenchido no INSERT quando `source = 'gaveta'` -- como CHECK não é deferrable no Postgres, a ordem de escrita em `settle_payable` é invertida em relação ao vale: o movimento nasce primeiro (sem o vínculo de volta ainda), a Baixa nasce em seguida já apontando pra ele, e só então o movimento é atualizado com `payable_settlement_id` -- as três escritas na mesma transação da RPC. Pela gaveta: só forma dinheiro, sessão trava depois da Conta a Pagar (ordem de lock fixa já estabelecida no ticket 07/036), data do pagamento é sempre o dia de negócio corrente definida pelo servidor (parâmetro `p_payment_date` é ignorado nesse caso). Estorno pela gaveta só é aceito com a sessão do movimento ainda aberta (mesma mensagem "reabra o turno antes de estornar" do vale) e devolve o valor à gaveta marcando o movimento com o mesmo motivo e autor do estorno da Baixa. `get_cash_session_statement` ganhou as chaves aditivas `payable_settlement_id`/`payable_description` (join até `payables` via `payable_settlements`), e o extrato impresso (`ExtratoSessaoCaixaModal`) ganhou seção própria "Pagamentos de conta" com rótulo `"Pagamento de conta: {descrição}"`.
_Avoid_: Editar `private.compute_cash_session_expected_amount` para um tipo novo, inserir a Baixa antes do movimento na gaveta (viola o CHECK), aceitar Baixa pela gaveta com forma diferente de dinheiro, aceitar data de pagamento informada pelo cliente na gaveta, estornar Baixa pela gaveta com a sessão do movimento fechada

**Módulo de Relatórios (Rota /relatorios)**:
Área própria de análise do painel do Gerente, separada do Hub Financeiro (o Hub continua operacional: Caixa, Comissões, Plano de Contas, Contas a Pagar, Fluxo de Caixa Projetado). Dez relatórios organizados em cinco páginas endereçáveis (Faturamento, Equipe e Serviços, Agenda, Clientes, Clientes sem Retorno), cada uma lida por um único contrato RPC (`get_revenue_report` e os quatro que vêm nos tickets seguintes). Um layout do módulo, sem segmento de URL, guarda o título, a navegação entre páginas e o filtro de período (atalho, datas, granularidade) compartilhado pelas páginas com período, sincronizado com os parâmetros de busca da URL para favoritar e navegar sem perder o filtro. **Exclusivo do desktop**: o item "Relatórios" só aparece na barra lateral do computador (`GlassSidebar`), nunca na barra inferior nem na gaveta "Mais" do celular; em largura de celular (mesmo limite de 768px do resto do painel) o layout do módulo mostra só o aviso "Os relatórios estão disponíveis apenas no computador", com atalho para a Agenda, sem chamar nenhum contrato -- a decisão é tomada uma única vez no layout, e as páginas nunca a repetem. O ticket 01 entrega só o catálogo (`RelatoriosCatalogo`, sem números, só perguntas) e a página de Faturamento por período; as demais aparecem no catálogo e na navegação do layout marcadas "em breve".
_Avoid_: Relatório dentro do Hub Financeiro, versão para celular do módulo (lista de cartões, acesso pela navegação móvel), cards de resumo com números no catálogo, contrato genérico de dimensão/métrica livre

**Receita Reconhecida de Item**:
Valor de um item de Comanda `fechada` contado no Faturamento por período (spec 038), pela mesma regra de reconhecimento de `get_tenant_financial_metrics` (função privada compartilhada `private.report_recognized_items`, para as duas leituras nunca divergirem -- garantido por teste cruzado): item com snapshot `confirmed` ou `estimated` conta pelo snapshot (bruto, líquido, quantidade e comissão); item `unavailable` (sem snapshot, dado histórico) conta pelo `total_price` corrente, sem comissão; item `reverted` ou sem snapshot vale zero. Bruto é a soma do bruto reconhecido; líquido, a soma do líquido; descontos, a diferença entre os dois. Gorjeta (`comandas.tip_amount`) fica sempre fora, mostrada à parte. Comanda aberta ou cancelada nunca entra; um item estornado numa Comanda reaberta some, sem deixar resíduo.
_Avoid_: Somar itens de Comanda aberta ou cancelada, incluir gorjeta no líquido, contar item revertido pelo preço cheio, duplicar a regra de reconhecimento em vez de reusar a função privada compartilhada

**Agendamento sem Desfecho**:
Classificação do relatório de Agenda (`get_schedule_report`, spec 038, ticket 07): Agendamento `pending`, `confirmed` ou `in_progress` cujo `start_time` já passou do instante da consulta. Fica fora das duas taxas (comparecimento e cancelamento) e aparece em destaque na tela, avisando que a recepção precisa atualizar o status -- diferente do Agendamento `future` (mesmos status, mas com início ainda não chegado), que também fica fora das taxas mas não gera aviso nenhum. Um Agendamento `canceled` nunca vira sem desfecho nem futuro, seja qual for o `start_time`.
_Avoid_: Contar Agendamento sem desfecho nas taxas de comparecimento/cancelamento, confundir sem desfecho com futuro, misturar o aviso de sem desfecho nos cartões de taxa (a tela separa visualmente os dois)

**Taxa de Comparecimento**:
Concluídos dividido por (concluídos + faltas) do relatório de Agenda (spec 038, ticket 07), calculada para o período, o período anterior, cada origem e cada profissional. Denominador zero devolve `null` ("--" na tela), nunca `0%` -- mesma decisão de `share`/`average_ticket` do Faturamento por período. A taxa de cancelamento é cancelados dividido por (total - futuros), com a mesma regra de `null` no denominador zero.

**Mapa de Calor da Agenda**:
Grade dia da semana × hora do relatório de Agenda (`get_schedule_report`, spec 038, ticket 08): `heatmap.cells[]` traz só as combinações `{weekday, hour, count}` com pelo menos 1 Agendamento não cancelado no fuso do tenant (falta conta, porque é demanda real; cancelado nunca conta); célula ausente é 0, e cabe à tela cruzar `heatmap.hours[]` com os 7 dias para desenhar a grade completa. `weekday` usa a convenção nativa do Postgres (`extract(dow)`): `0` = domingo até `6` = sábado -- não confundir com a convenção ISO (segunda = 1). `heatmap.hours[]` vai da menor hora de abertura à maior hora de fechamento entre os dias com `tenants.business_hours.<dia>.active = true`, ampliada (nunca reduzida) por qualquer Agendamento fora desse expediente; dia inativo ou ausente na configuração nunca amplia sozinho. `p_professional_id` filtra o mapa (e os totais por profissional dele), ao contrário de `by_professional`, que nunca é filtrado.
_Avoid_: Misturar a convenção de `weekday` com ISO (segunda = 1), deixar o expediente de um dia inativo ampliar `hours` sem Agendamento de fato, devolver grade completa com zeros do backend (isso é responsabilidade do frontend), contar Agendamento cancelado no mapa
_Avoid_: Mostrar `0%` quando a taxa é `null`, incluir Agendamento sem desfecho ou futuro no numerador ou denominador da taxa de comparecimento

**Visita**:
Segunda regra de domínio compartilhada da spec 038 (função privada `private.report_customer_visits`, `language sql`, sem grant): um cliente identificado esteve na barbearia num dia de negócio, por Agendamento `completed` (dia de `start_time`) ou por Comanda `fechada` com `customer_id` preenchido (dia de `closed_at`) -- os dois fatos no mesmo dia contam como uma Visita só, nunca duas. Visita de balcão (Comanda fechada sem Agendamento) conta normalmente; Comanda sem `customer_id` não é Visita. Os serviços realizados vêm dos itens de serviço da Comanda quando há Comanda fechada no dia (o registro definitivo do que foi cobrado); sem Comanda no dia, vêm do serviço do Agendamento. O profissional é o inverso: vem do Agendamento quando há Agendamento concluído no dia (valor único e confiável); sem Agendamento no dia, vem do item de serviço de maior valor da Comanda (que pode ter vários profissionais quando dividida).
_Avoid_: Contar Agendamento concluído e Comanda fechada do mesmo dia como duas Visitas, considerar Comanda sem `customer_id` como Visita, usar o serviço do Agendamento quando já existe Comanda fechada no dia (ou vice-versa para o profissional), duplicar a regra de Visita em vez de reusar a função privada compartilhada

**Cliente sem Retorno**:
Relatório 8 da spec 038 (`get_customers_without_return`), página própria `/relatorios/clientes-sem-retorno`, sem período -- é uma fotografia de hoje. Para cada cliente com ao menos uma Visita, o prazo de retorno é o menor `services.return_period_days` entre os serviços da ÚLTIMA Visita (20 dias sem serviço identificável, mesmo padrão de `get_pending_return_reminders`). Cliente sem Retorno é quem tem `dias desde a última Visita > prazo` e nenhum Agendamento `pending`/`confirmed` com `start_time` depois de agora (um `canceled` futuro não impede a listagem). Faixas de atraso (`up_to_15`, `d16_30`, `d31_60`, `over_60`) e `total_count` respeitam paginação e o filtro `p_overdue_band`; os totais do topo (`without_return`/`within_return`/`no_visit_ever`) e as faixas ignoram paginação e `p_overdue_band`, mas respeitam `p_professional_id` (filtrado pelo profissional da última Visita). **Divergência aceita**: `get_pending_return_reminders` olha só o último Agendamento `completed` e pode marcar como sumido um cliente atendido no balcão que este relatório corretamente não lista -- as duas listas convivem até o lembrete adotar Visita.
_Avoid_: Usar o último Agendamento `completed` em vez da última Visita, deixar `p_overdue_band` filtrar os totais/faixas do topo, deixar a paginação alterar totais/faixas/`total_count`, contar Agendamento `canceled` futuro como impedimento de "sem retorno"

**Cliente Novo**:
No relatório Novos x recorrentes (spec 038, ticket 10, `get_customer_report`), cliente cuja PRIMEIRA Visita da vida (olhando todo o histórico via `private.report_customer_visits`, não só o período) cai dentro do período pedido. Conta no agrupamento (`buckets[]`) da própria primeira Visita da vida. Mutuamente exclusivo com Cliente Recorrente -- juntos formam `unique_customers` do período.
_Avoid_: Classificar como Novo quem já teve Visita antes do início do período, olhar só as Visitas dentro do período para achar a primeira

**Cliente Recorrente**:
No relatório Novos x recorrentes (spec 038, ticket 10), cliente que teve Visita no período e já tinha Visita ANTES do início dele. Conta no agrupamento (`buckets[]`) da primeira Visita DELE DENTRO DO PERÍODO (não a mais recente). Mutuamente exclusivo com Cliente Novo.
_Avoid_: Contar o Recorrente no bucket da última Visita dele no período em vez da primeira, contar o mesmo cliente como Novo e Recorrente no mesmo período

**Cliente de Uma Visita**:
No relatório Novos x recorrentes (spec 038, ticket 10), Cliente Novo do período cuja ÚNICA Visita, até HOJE (`p_today`, não até o fim do período), é a Visita do próprio período -- perde o status se tiver Visita posterior ao período, mesmo que antes de hoje. Lista (`single_visit_customers[]`) limitada a 200, mais recentes primeiro. Não existe equivalente em `previous_visitors` (o campo `new_single_visit` só existe no período atual): depende de "até hoje", um corte móvel incompatível com um período anterior fixo no passado.
_Avoid_: Manter na lista um cliente com Visita depois do período (antes de hoje), calcular `new_single_visit` para `previous_visitors`

**Origem do Cadastro**:
No relatório Origem dos clientes (spec 038, ticket 11, bloco `registrations` de `get_customer_report`), classificação AUTOMÁTICA e sempre preenchida de como o cadastro do cliente entrou no sistema (`customers.registration_origin`, `not null`: `balcao`, `agenda`, `online`, `canal_cliente`, `whatsapp_bot`, `importacao`). Base de cadastros = clientes com `created_at` no período (fuso do tenant, intervalo meio-aberto). `by_registration_origin[]` traz uma linha por origem presente no período, com `total` e `with_visit` (clientes do grupo com ao menos uma Visita até hoje, por `exists`, nunca por join que duplique). Aparece separada do Canal de Aquisição porque responde a uma pergunta diferente: por qual porta o cadastro entrou.
_Avoid_: Confundir com Canal de Aquisição (a origem é automática e sempre preenchida; o canal é declarado e opcional), listar origem que não apareceu no período, calcular `with_visit` por join que multiplica quando o cliente tem várias Visitas

**Canal de Aquisição**:
No relatório Origem dos clientes (spec 038, ticket 11, bloco `registrations`), resposta DECLARADA e opcional de como o cliente conheceu a barbearia (`customers.acquisition_channel`, texto livre). Agrupado por texto normalizado (trim + minúsculas, mesmo padrão de `cancellation_reason` do ticket 07) para juntar grafias diferentes da mesma resposta, mas EXIBIDO com a grafia MAIS FREQUENTE do grupo (não a normalizada) -- ao contrário de `cancellation_reason`, que exibe o próprio texto normalizado. Nulo ou vazio vira "Não informado", SEMPRE presente em `by_acquisition_channel[]` quando há ao menos um cadastro no período (mesmo que 100% dos canais estejam preenchidos, para destacar a qualidade do dado -- no banco dev todos os clientes têm canal vazio). Período sem cadastro devolve a lista vazia (nada a destacar) e `acquisition_channel_filled_share` (fração com canal preenchido) como `null`, nunca zero.
_Avoid_: Exibir a grafia normalizada em vez da mais frequente, omitir "Não informado" quando ele tem `total = 0` mas há cadastro no período, devolver `acquisition_channel_filled_share = 0` num período sem cadastro em vez de `null`
