# ADR 001: Integração Real com a Evolution API Go (VPS) (Atualizado c/ MCP Supabase)

## Status
Proposto

## Data
2026-07-14

## Contexto
O sistema **Navalhado** precisa notificar clientes e profissionais em tempo real sobre eventos de agendamento (confirmações, lembretes de horários e alertas de cancelamento) utilizando o WhatsApp. 

Para a integração física, foi disponibilizada uma instância do **Evolution API Go** hospedada em uma VPS privada pertencente ao cliente. De acordo com a documentação oficial do Evolution Foundation (`https://docs.evolutionfoundation.com.br/`), a Evolution Go redefiniu e simplificou sua estrutura de endpoints. Precisamos atualizar a arquitetura técnica para garantir que os payloads e rotas chamados pelo backend batam com a versão em Go.

## Decisões Técnicas

### 1. Supabase Edge Functions como Gateway de Segurança
Toda a comunicação direta com a Evolution API Go na VPS (criação de instâncias, exclusão, envio de texto, consulta de status) passará por um microsserviço intermediário nas **Edge Functions** do Supabase (`whatsapp-integration`).
* **Motivo**: A chave global (Global ApiKey) e a URL da VPS ficarão restritas às variáveis de ambiente seguras do backend (`EVOLUTION_API_URL` e `EVOLUTION_GLOBAL_APIKEY`), evitando exposição no frontend.

### 2. Rotas e Payloads da Evolution Go
O gateway das Edge Functions usará as seguintes definições reais da API:
* **Criar Instância**: `POST /instance/create` com header `apikey: [GLOBAL_APIKEY]`. Envia `{ "name": "...", "token": "..." }`.
* **Obter QR Code**: `GET /instance/qr` com header `apikey: [INSTANCE_APIKEY]`. Retorna `{ "data": { "Qrcode": "base64...", "Code": "texto..." } }`.
* **Desconectar**: `POST /instance/disconnect` com header `apikey: [INSTANCE_APIKEY]`.
* **Enviar Mensagem de Texto**: `POST /send/text` com header `apikey: [INSTANCE_APIKEY]`. Envia `{ "number": "...", "text": "..." }`.

### 3. Sincronização via Webhook Automatizado
O status da conexão do WhatsApp (conectado/desconectado) será atualizado de forma reativa:
* A Evolution API Go na VPS enviará payloads do tipo `connection.update` para a nossa Edge Function (`/webhook`).
* A Edge Function atualiza o status de pareamento na tabela `evolution_api_instances` e o Supabase Realtime propaga a alteração para o navegador do gerente automaticamente, eliminando a necessidade de polling ineficiente.

### 4. Orquestração de Lembretes Periódicos via pg_cron e Índice Parcial
Para os lembretes automáticos agendados (enviados `N` horas antes do atendimento):
* Configuramos a extensão **`pg_cron`** para executar uma rotina a cada 15 minutos chamando o endpoint `/process-reminders` na nossa Edge Function.
* **Otimização de Performance (Indexação Parcial)**: Criamos um índice parcial específico na tabela `public.appointments` filtrando por `reminder_sent = false` e `status = 'confirmed'`. Isso reduz drasticamente o tamanho do índice e acelera a query de varredura periódica a cada 15 minutos.
  ```sql
  create index if not exists idx_appointments_reminder_pending 
  on public.appointments (start_time, tenant_id) 
  where reminder_sent = false and status = 'confirmed';
  ```

### 5. Padronização de Nomenclatura (`reminder_hours`)
* O tempo de antecedência do lembrete será unificado e padronizado em **horas** (`reminder_hours` de 1 a 24) em todas as camadas (Banco de Dados, Edge Functions, Testes Unitários e Componentes Frontend). Isso resolve a inconsistência em que o frontend gerenciava em minutos, mas o banco armazenava e impunha constraints em horas.

### 6. Ferramental do Banco de Dados (Supabase MCP)
* Toda a criação, alteração e testes da estrutura de banco de dados (tabelas, índices, triggers e funções Postgres) serão geridos e aplicados de forma direta por meio das ferramentas do servidor **Supabase MCP** (`execute_sql`), eliminando a necessidade de executar comandos na CLI do Supabase localmente.

## Consequências
* **Segurança**: Risco zero de vazamento de credenciais globais da VPS do WhatsApp.
* **Resiliência**: Disparos assíncronos que não travam as transações SQL principais e não dependem do frontend para o envio.
* **Compatibilidade**: Mapeamento 100% fiel às rotas reestruturadas da Evolution Go na VPS, evitando payloads quebrados e erros 404 em produção.
* **Agilidade no Desenvolvimento**: Aplicação e teste das queries e tabelas em tempo real direto pela IDE por meio das chamadas MCP seguras do Supabase.
