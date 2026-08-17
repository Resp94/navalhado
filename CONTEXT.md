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
Superfície central de gestão financeira operacional do Gerente no Navalhado, organizada em duas abas especializadas: Caixa Diário & Turnos (ciclo de abertura com fundo de troco, conferência e fechamento de sessões físicas de caixa) e Repasses de Comissões (gestão de saldos acumulados da equipe, detalhamento de atendimentos e quitação formal de pagamentos aos barbeiros). Relatórios profundos de BI e DRE estendido são delegados à futura rota de relatórios.
_Avoid_: Tela de relatórios analíticos, gráficos de BI soltos, dashboard contábil genérico

**Abertura de Caixa do Turno**:
Registro formal do início da operação física de frente de caixa (`cash_sessions`), no qual o operador declara o montante em dinheiro mantido na gaveta como Fundo de Troco Inicial para subsidiar trocos aos primeiros atendimentos.
_Avoid_: Caixa aberto no ar, início tácito de turno

**Fechamento de Caixa com Conferência**:
Conclusão formal da sessão de caixa (`cash_sessions`), onde o operador declara a contagem física final das cédulas na gaveta e o sistema confronta com os recebimentos calculados em dinheiro das comandas liquidadas no turno, registrando eventuais sobras ou quebras de caixa.
_Avoid_: Fechamento cego automático, zeramento de gaveta sem conferência

**Quitação de Comissão**:
Transação formal de liquidação e repasse de valores faturados por um profissional (`commission_payouts`), registrando o valor pago, a forma de liquidação (PIX, dinheiro da gaveta, transferência bancária), data do pagamento e observações contábeis.
_Avoid_: Baixa verbal de comissão, anotação em papel, repasse não rastreado








