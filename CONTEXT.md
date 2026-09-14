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
Fila diária de clientes cadastrados que aguardam abertura de vagas ou cancelamentos no mesmo dia (`public.waiting_list`), com disparo de alertas e atalho de encaixe com 1 clique para a recepção.
_Avoid_: Fila solta, lista de encaixe manual, anotação de espera

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
Aba do Hub Financeiro, rota-filha direta de `/financeiro` e fora do filtro de período do painel de Caixa e Comissões, que mostra por dia, semana ou mês o que entrou e saiu de fato e o que deve entrar e sair até o fim do período. O contrato de leitura (`get_projected_cash_flow`) lê cada fato financeiro no livro onde ele nasce e nunca `cash_movements` (espelho ou transferência interna, como sangria e suprimento, que não são receita nem despesa), devolve `timezone` e `business_today` do banco -- a tela nunca decide sozinha qual é o dia de hoje -- e classifica cada agrupamento como passado, atual ou futuro. Esta fatia (ticket 01) cobre só entradas realizadas: pagamentos de Comanda fechada, líquidos de estorno, no dia de negócio do pagamento no fuso do tenant.
_Avoid_: Ler cash_movements para receita ou despesa, faturamento (a aba sempre diz "recebido"), data local do navegador como "hoje"

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
