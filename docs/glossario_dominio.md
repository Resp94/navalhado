# Glossário de Domínio — Navalhado

Este documento define os principais conceitos de negócio, técnicos e termos comuns que compõem o ecossistema do **Navalhado** para alinhar a taxonomia da aplicação.

---

## 1. Conceitos de Negócio (Domínio)

### Barbearia (Tenant)
* **Definição**: O estabelecimento comercial que assina o SaaS Navalhado. Cada barbearia opera em isolamento de dados absoluto (Multitenancy).
* **Entidade no Banco**: `public.tenants`

### Cliente (Customer)
* **Definição**: O usuário final que realiza agendamentos na barbearia. No modelo do Navalhado, os clientes não precisam necessariamente criar contas com login e senha; eles acessam o menu personalizado e fazem agendamentos através de um link seguro contendo um token único.
* **Entidade no Banco**: `public.customers`

### Cliente Provisório
* **Definição**: Registro criado no primeiro contato recebido pelo WhatsApp, antes de o cliente informar seu nome na página de agendamento. Possui telefone e token válidos, mas permanece com `cadastro_completo = false` até concluir o primeiro acesso.
* **Entidade no Banco**: `public.customers`

### Cadastro Completo
* **Definição**: Estado que indica que o cliente já confirmou seu nome. Quando verdadeiro, os próximos acessos pelo link abrem diretamente o fluxo de agendamento.
* **Campo no Banco**: `public.customers.cadastro_completo`

### Telefone Normalizado
* **Definição**: Representação canônica brasileira no formato `55DDDNUMERO`, usada para identificar o mesmo telefone independentemente da máscara original e impedir duplicatas dentro da mesma barbearia.
* **Campo no Banco**: `public.customers.telefone_normalizado`, calculado automaticamente a partir de `phone`.

### Token de Acesso do Cliente
* **Definição**: Credencial bearer única usada no link para identificar o cliente e a barbearia sem login e senha. Quem possuir o link consegue acessar o fluxo associado enquanto o token for válido.
* **Campo no Banco**: `public.customers.token_acesso`

### Profissional (Professional / Staff)
* **Definição**: O barbeiro ou cabeleireiro que realiza os serviços na barbearia. Possui escala de horários de trabalho e comissões associadas a cada atendimento.
* **Entidade no Banco**: `public.professionals`

### Agendamento (Appointment)
* **Definição**: A reserva de um horário para a realização de um serviço por um cliente com um profissional específico. Pode assumir os status de `confirmed` (confirmado), `pending` (pendente/fila de encaixe) ou `canceled` (cancelado).
* **Entidade no Banco**: `public.appointments`

### Origem do Cliente (Customer Source)
* **Definição**: A forma de entrada do cliente no ecossistema do Navalhado. Pode ser `WhatsApp` (quando inserido via webhook de mensagens recebidas de novos números) ou `Manual` (quando cadastrado diretamente pelo gerente/barbeiro no painel administrativo).

### Promoção de Cadastro (Customer Promotion)
* **Definição**: A transição de estado de um cliente de provisório para completo (`cadastro_completo = true`). Ocorre automaticamente quando o cliente informa seu nome no primeiro acesso ao link ou quando o gerente edita e salva o nome real do cliente na aba de gerenciamento no painel administrativo.

---

## 2. Integração e Comunicação Técnica

### Evolution API Go
* **Definição**: O microsserviço reescrito em linguagem Go responsável por simular e orquestrar conexões com instâncias do WhatsApp Baileys. Hospedado na VPS de forma segura.
* **Instância (Instance)**: Um container lógico da Evolution API pareado com um número de celular físico específico por meio de QR Code.
* **Global ApiKey**: A chave mestre que possui privilégios totais de escrita e gerenciamento sobre todas as instâncias do servidor da VPS.
* **Instance ApiKey**: A chave única de autorização gerada individualmente para cada instância de WhatsApp, usada de forma isolada pelas barbearias.
* **Entidade no Banco**: `public.evolution_api_instances`

### Webhook
* **Definição**: O mecanismo HTTP pelo qual a Evolution API Go na VPS notifica assincronamente as Edge Functions do Supabase sobre atualizações de status (ex: celular desconectado, leitura de QR Code, falha de rede).

### pg_net
* **Definição**: Extensão do Supabase Postgres que permite realizar requisições HTTP assíncronas (`net.http_post`) de dentro do banco de dados, ideal para triggers que notificam microsserviços sem bloquear a transação de escrita.

### pg_cron
* **Definição**: Extensão do Supabase Postgres que possibilita criar agendamentos cron (tarefas programadas de tempo) dentro da própria base de dados, usada para disparar a rotina de envio de lembretes.
