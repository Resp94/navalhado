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


