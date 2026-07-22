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

**Evolution Dev**:
Stack separada da Evolution API usada pelo ambiente dev para criar, parear e testar instancias de WhatsApp sem tocar instancias de producao.
_Avoid_: Evolution compartilhada, instancia dev em producao

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
Conexão lógica e física de uma barbearia com o WhatsApp na Evolution API, cujo estado observado pode ser desconectado, em pareamento ou conectado, e cujo gerenciamento é de acesso restrito e exclusivo do Gerente do tenant.
_Avoid_: Evolution do tenant, status desejado, comando de conexão, instância temporária
