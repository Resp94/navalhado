# Especificação Técnica: Regras de Agendamento Online, Mensageria Inteligente, Lembretes Pontuais e Reagendamento Direto

## Problem Statement

A operação diária das barbearias e o autoatendimento dos clientes no **Navalhado** apresentavam inconsistências e fricções em 5 áreas essenciais de agendamento e comunicação:

1. **Mensagem Incorreta na Primeira Comunicação do Dia (Achado 1):**
   Ao disparar a primeira mensagem do dia para um cliente (seja uma confirmação de agendamento, um lembrete ou um reagendamento), o sistema estava enviando a mensagem de **boas-vindas/cadastro concluído de balcão** (*"Olá, {cliente}! Seu cadastro na barbearia... foi concluído com sucesso..."*) em vez de enviar o texto do **evento legítimo ocorrido** com o link de autoatendimento garantido.
   - **Causa Raiz:** O trigger `trg_customer_welcome_balcao` (Migration 051) foi configurado para disparar `AFTER INSERT` quando `registration_origin = 'balcao'`. Como `'balcao'` era o valor padrão (*default*) da coluna na tabela `public.customers`, qualquer cliente criado ao agendar um horário na agenda (`Agenda.tsx`) ou criado provisoriamente via webhook do WhatsApp (`find_or_create_whatsapp_customer` e `get_or_create_provisional_customer_by_slug`) herdava `'balcao'`, disparando indevidamente a mensagem de boas-vindas. Além disso, as rotas de notificações automáticas não verificavam se era a primeira comunicação do dia para injetar o link de primeiro contato.

2. **Lembretes de Agendamento Não Enviados no Horário Configurado pelo Gerente (Achado 2):**
   A barbearia configura o tempo de antecedência dos lembretes prévios (ex: 1 hora antes, 2 horas antes), porém as notificações de lembrete não estavam sendo entregues aos clientes no horário estabelecido.
   - **Causa Raiz:** A rota `/process-reminders` na Edge Function `whatsapp-integration` realizava uma verificação estrita de terminação de string (`path.endsWith("/process-reminders")`). Requisições recebidas com barras finais (*trailing slashes*) ou pequenas variações do gateway da API retornavam HTTP 404 (*Not Found / Endpoint not found*), conforme registrado nas respostas da tabela `net._http_response`. Adicionalmente, o job agendado no `pg_cron` possuía um timeout curto de 5000ms que estourava durante o processamento em lote dos envios para a VPS.

3. **Trava de Segurança de Antecedência para Slots Quebrada no Link Público (Achado 3):**
   No painel de *Regras de agendamento online*, o gerente define a **Antecedência mínima para agendar** (ex: 30 minutos) e o **Intervalo entre horários na grade** (ex: 40 minutos) para proteger a rotina dos profissionais contra agendamentos de última hora sem tempo hábil de preparação. No entanto, no link público de agendamento (`/{slug}`), essa trava estava quebrada, permitindo que clientes visualizassem e tentassem agendar horários imediatos (ex: às 16:48 para um horário das 17:00 com trava de 30 min).
   - **Causa Raiz:** Existiam versões sobrecarregadas e conflitantes da função `public.get_available_slots` no PostgreSQL (uma com 5 argumentos e outra com 4 em ordem trocada). Uma dessas versões utilizava a formatação `to_char(p_date, 'FMDay')`, que no Postgres varia de acordo com o idioma/locale (`'Quinta-feira'` vs `'Thursday'`), falhando ao ler a chave de horários de funcionamento do tenant (`business_hours`). Além disso, o cálculo reativo no frontend (`FluxoAgendamento.tsx`) precisava filtrar estritamente a grade do dia para que os horários expirados sequer fossem exibidos.

4. **Ausência de Reagendamento Direto na Agenda e na Comanda (Achado 4):**
   Quando um cliente solicitava alteração manual de horário fora do prazo de autoatendimento, o operador da barbearia era obrigado a cancelar o agendamento atual e criar um novo agendamento. Esse fluxo disparava duas mensagens sucessivas para o cliente (*Mensagem de Cancelamento* seguida de *Mensagem de Novo Agendamento*), gerando confusão, além de cancelar a comanda aberta associada ao atendimento original e abrir uma comanda avulsa nova.
   - **Causa Raiz:** Falta de uma ação nativa de "Reagendar horário" na interface da Agenda (`Agenda.tsx`) e no modal de checkout da Comanda (`ComandaCheckoutModal.tsx`), muito embora a infraestrutura no banco (`trg_appointment_whatsapp` com evento `appointment_rescheduled`) e na Edge Function (`template_reschedule` e `template_professional_rescheduled`) já existisse.

5. **Obrigatoriedade Indevida da Tag `{link}` nos Modelos de Mensagem (Achado 5):**
   Ao personalizar os templates de WhatsApp no painel `/whatsapp` (em especial a Confirmação de Agendamento), o sistema bloqueava a gravação se o usuário removesse a tag `{link}` (`isValid: hasLink && isWithinLengthLimit`), impedindo o gestor de enviar mensagens mais concisas e personalizadas sem links repetidos.

---

## Solution

Implementar uma solução arquitetural profunda e integrada abrangendo o banco de dados PostgreSQL (Migration 055), a Edge Function de mensageria (`whatsapp-integration`), o fluxo de autoatendimento público do cliente e as telas operacionais do gerente:

1. **Governança de Origens de Cadastro e Injeção Inteligente de Link Diário:**
   - Atualizar a constraint de `public.customers.registration_origin` para aceitar `('balcao', 'agenda', 'online', 'importacao', 'canal_cliente', 'whatsapp_bot')` e mudar o default da coluna de `'balcao'` para `'agenda'`.
   - Restringir o trigger `trg_customer_welcome_balcao` para disparar **exclusivamente** quando `registration_origin = 'balcao'` (cadastro manual deliberado na tela `Clientes.tsx`).
   - Implementar o helper puro `resolveCustomerMessageWithDailyLink` na Edge Function:
     - Preserva sempre o template do **evento legítimo ocorrido** (confirmação, lembrete, reagendamento).
     - Avalia se a mensagem é a **primeira comunicação automática do dia** para aquele cliente no fuso horário do tenant (`isFirstMessageOfDayForCustomer`).
     - Se for a 1ª do dia e o template não contiver a tag `{link}`, anexa o link de autoatendimento ao final da mensagem.
     - Se for a 2ª do dia e o template não contiver `{link}`, envia o template limpo, sem link duplicado.
     - Se o template contiver explicitamente `{link}`, interpola normalmente.
     - Atualiza atomicamente `customers.last_first_contact_at = now()`.

2. **Roteamento Resiliente e Timeout Seguro de Lembretes:**
   - Normalizar o roteamento da Edge Function `whatsapp-integration` para tratar URLs com ou sem *trailing slashes* (`path.replace(/\/+$/, "")`) e roteamento complementar por payload.
   - Reconfigurar o job do `pg_cron` para `*/15 * * * *` com timeout de 15000ms.
   - Processar pontualmente agendamentos dentro da janela de antecedência (`reminder_hours`) configurada pelo gerente em `whatsapp_instances`.

3. **Unificação Canônica de Slots e Trava de Antecedência no Link Público:**
   - Limpar as funções sobrecarregadas legadas e estabelecer uma única função canônica `public.get_available_slots` no PostgreSQL, usando `extract(dow from p_date)` de forma imune a idiomas de servidor.
   - Aplicar a trava no banco: `s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)`.
   - No frontend (`FluxoAgendamento.tsx` e `timezone.ts`), garantir que slots inferiores ao horário atual acrescido da antecedência mínima configurada (ex: `16:48 + 30 min = 17:18`) **não sejam renderizados** na grade do dia de hoje.
   - Na RPC `create_appointment_by_token`, validar no momento da gravação e retornar mensagem amigável caso a antecedência tenha expirado enquanto o cliente navegava.

4. **Reagendamento Direto na Agenda e Comanda:**
   - Adicionar botão e modal interativo de "Reagendar Horário" no card da agenda (`Agenda.tsx`) e no modal de checkout da comanda (`ComandaCheckoutModal.tsx`).
   - Executar `UPDATE public.appointments SET start_time = ..., end_time = ...`.
   - O trigger `trg_appointment_whatsapp` dispara o evento `appointment_rescheduled` para o cliente (`template_reschedule`) e para o barbeiro (`template_professional_rescheduled`).
   - A comanda vinculada permanece aberta com todos os seus itens, sem ser cancelada nem recriada.
   - Atualizar a RPC `reschedule_appointment_by_token` para seguir o mesmo padrão de `UPDATE` direto.

5. **Flexibilização dos Templates de WhatsApp:**
   - Desacoplar a obrigatoriedade da tag `{link}` em `validateWhatsappTemplate` e na página `/whatsapp`. O salvamento passa a ser permitido com ou sem `{link}`, respeitando a governança do link na 1ª mensagem do dia.

---

## User Stories

### A. Mensageria Inteligente e Primeira Mensagem do Dia
1. As a Customer receiving a booking confirmation for a newly created appointment, I want to receive the appointment confirmation text (and not a generic counter welcome message), so that I know my appointment details immediately.
2. As a Customer receiving my first message of the day from the barber shop, I want the message to include my self-service management link (either within the template or appended at the bottom), so that I can easily view or manage my appointment.
3. As a Customer receiving a second message on the same day (such as a reminder or a reschedule), I want the message to be clean and not repeat the self-service link if the manager configured a template without `{link}`, so that the conversation is pleasant and concise.
4. As a Manager customizing WhatsApp templates, I want to decide whether the confirmation or reminder template has the `{link}` tag, knowing that the system will automatically ensure the link is present on the day's first communication.
5. As a Customer registered manually at the reception counter, I want to receive the friendly counter welcome message with my portal link, so that I am onboarded to the barber shop's digital channel.
6. As a Manager booking an appointment on the agenda for a first-time client, I want the client to receive only the appointment confirmation message, so that they are not spammed with an out-of-context counter registration message.

### B. Lembretes Pontuais no Horário Estabelecido
7. As a Barber Shop Manager, I want to set the reminder lead time (e.g. 1 hour, 2 hours, 4 hours) in `/whatsapp`, so that our clients receive reminders at our preferred notice window.
8. As a Customer with an appointment at 15:00 and a 1-hour reminder setting, I want to receive my reminder at 14:00, so that I have time to prepare and travel to the shop.
9. As a System Administrator, I want the `process-whatsapp-reminders` cron job to execute reliably without 404 routing errors or 5-second timeouts, so that all scheduled reminders are dispatched on time.
10. As a System Administrator, I want reminder dispatches to record unique idempotency keys (`appointment:${id}:appointment_reminder:${window}`), so that no customer receives duplicate reminder messages.

### C. Trava de Segurança e Regras de Agendamento Online
11. As a Barber Shop Manager configuring "Regras de agendamento online", I want to set the "Intervalo entre horários na grade" (e.g. 15, 20, 30, 40, 45, 60 minutes), so that slots are generated at our exact cadence.
12. As a Barber Shop Manager, I want to set the "Antecedência mínima para agendar" (e.g. 30 minutes), so that our barbers have sufficient buffer time to prepare for upcoming clients.
13. As an Online Customer accessing the booking link at 16:48 with a 30-minute notice rule, I want the system to hide slots prior to 17:18 (such as 17:00), so that I only select viable, allowed times.
14. As an Online Customer who selected a slot but waited too long before submitting (surpassing the minimum notice threshold), I want to see a friendly notification explaining that the minimum notice was exceeded, so that I can choose the next available time without confusion.
15. As a Manager or Barber at the physical counter, I want to be able to create immediate walk-ins and encaixes on the agenda without being blocked by the online lead time rule, so that our in-person operations remain flexible.
16. As an Online Customer, I want the "Antecedência mínima para cancelar ou reagendar" (e.g. 60 minutes) to be enforced on the customer portal, so that I cannot cancel at the last minute without contacting the shop directly.

### D. Reagendamento Direto na Agenda e Comanda
17. As a Manager viewing an appointment card on the agenda, I want a direct "Reagendar horário" button, so that I can quickly move an appointment to a new date or time.
18. As a Manager inside an open comanda modal linked to an appointment, I want a "Reagendar horário" option, so that I can adjust the appointment time without cancelling the comanda or losing already added products and services.
19. As a Customer whose appointment was rescheduled by the barber shop, I want to receive a dedicated reschedule confirmation message (and not a cancellation followed by a new booking message), so that I am clearly informed of the time change.
20. As a Barber, I want to receive a reschedule alert whenever an appointment assigned to me is moved to a new time, so that my schedule is always up to date.
21. As an Online Customer using the self-service portal to reschedule my appointment, I want the system to atomically update my appointment rather than deleting and recreating it, so that my appointment history and comanda associations remain continuous.

### E. Modelos de WhatsApp Flexíveis
22. As a Manager, I want to save the Appointment Confirmation message without the `{link}` tag, so that our messages can follow our exact brand voice.
23. As a Manager, I want the visual WhatsApp template editor to provide an informative tip when `{link}` is omitted, explaining that the link will be added automatically only on the first message of the day.
24. As a Manager, I want to test-send templates with or without `{link}` to my own WhatsApp, so that I can review how the messages render on real devices.

---

## Implementation Decisions

### 1. Banco de Dados e Migrations (PostgreSQL / Supabase)

#### Migration Versionada: `20260827180000_055_fix_first_contact_slots_lead_time_and_reschedule.sql`

- **Tabela `public.customers`**:
  - Modificar a constraint `customers_registration_origin_check` para validar `registration_origin IN ('balcao', 'agenda', 'online', 'importacao', 'canal_cliente', 'whatsapp_bot')`.
  - Alterar o valor `DEFAULT` da coluna `registration_origin` para `'agenda'`.
- **Trigger `trg_customer_welcome_balcao`**:
  - Modificar a função `public.fn_customer_welcome_balcao_trigger()`:
    ```sql
    IF NEW.registration_origin = 'balcao' AND NEW.phone IS NOT NULL AND NEW.welcome_sent_at IS NULL THEN
      -- Dispara net.http_post para /send-notification com event: 'customer_welcome_balcao'
    ```
- **RPCs de Cadastro de Clientes**:
  - `public.find_or_create_whatsapp_customer`: Inserir novos clientes com `registration_origin := 'whatsapp_bot'`.
  - `public.get_or_create_provisional_customer_by_slug`: Inserir novos clientes provisórios com `registration_origin := 'online'`.
- **Unificação Canônica de `public.get_available_slots`**:
  - Executar `DROP FUNCTION IF EXISTS public.get_available_slots(...)` para todas as assinaturas legadas.
  - Criar a função canônica única com assinatura:
    ```sql
    CREATE OR REPLACE FUNCTION public.get_available_slots(
      p_tenant_id uuid,
      p_professional_id uuid,
      p_service_id uuid,
      p_date date,
      p_exclude_appointment_id uuid DEFAULT NULL
    )
    RETURNS TABLE(slot_time text)
    ```
  - Obter dinamicamente de `public.tenants`: `timezone`, `slot_interval_minutes`, `min_booking_lead_time_minutes`, `business_hours`.
  - Determinar o dia da semana via `extract(dow from p_date)` (`0=sunday, ..., 6=saturday`).
  - Aplicar filtro de intervalo: `s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)`.
- **RPC `public.get_available_slots_by_token`**:
  - Atualizar para encaminhar os parâmetros na ordem exata da função canônica.
- **RPC `public.create_appointment_by_token`**:
  - Reforçar validação de antecedência mínima:
    ```sql
    IF v_start_time < (now() + (v_min_booking_lead_time || ' minutes')::interval) THEN
      RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time
        USING errcode = '22023';
    END IF;
    ```
- **RPC `public.reschedule_appointment_by_token`**:
  - Refatorar para executar `UPDATE public.appointments` (atualizando `start_time`, `end_time`, `service_id`, `professional_id`, `updated_at`), validando conflitos de agenda e antecedência mínima de reagendamento (`min_cancellation_lead_time_minutes`), disparando nativamente o trigger `trg_appointment_whatsapp`.
- **Job do `pg_cron` (`process-whatsapp-reminders`)**:
  - Atualizar o comando cron para chamar `https://<ref>.supabase.co/functions/v1/whatsapp-integration/process-reminders` com timeout de `15000` ms.

---

### 2. Backend / Edge Functions (`whatsapp-integration`)

#### Arquivo: `supabase/functions/whatsapp-integration/index.ts`

- **Normalização de Roteamento**:
  - Normalizar `const cleanPath = url.pathname.replace(/\/+$/, "")` para que chamadas com barra final sejam aceitas em todas as rotas (`/process-reminders`, `/send-notification`, `/manage-instance`, etc.).
- **Helper Centralizado `resolveCustomerMessageWithDailyLink`**:
  ```typescript
  export interface FormatCustomerMessageParams {
    template: string | null | undefined;
    fallbackTemplate: string;
    variables: WhatsappTemplateVariables;
    isFirstMessageOfDay: boolean;
    clientAccessLink: string;
  }

  export function resolveCustomerMessageWithDailyLink(params: FormatCustomerMessageParams): { text: string; linkIncluded: boolean } {
    const { template, fallbackTemplate, variables, isFirstMessageOfDay, clientAccessLink } = params;
    const rawTemplate = template && template.trim().length > 0 ? template : fallbackTemplate;
    const hasLinkTag = /\{link\}/i.test(rawTemplate);

    let rendered = formatMessageTemplate(rawTemplate, fallbackTemplate, {
      ...variables,
      link: clientAccessLink,
    });

    if (isFirstMessageOfDay && !hasLinkTag && clientAccessLink) {
      rendered = `${rendered.trim()}\n\nPara gerenciar seu agendamento e autoatendimento, acesse: ${clientAccessLink}`;
      return { text: rendered, linkIncluded: true };
    }

    return { text: rendered, linkIncluded: hasLinkTag };
  }
  ```
- **Cálculo de `isFirstMessageOfDayForCustomer`**:
  ```typescript
  export function isFirstMessageOfDayForCustomer(
    lastFirstContactAt: string | null | undefined,
    tenantTimezone: string = "America/Sao_Paulo"
  ): boolean {
    if (!lastFirstContactAt) return true;
    try {
      const lastDate = new Date(lastFirstContactAt);
      const now = new Date();
      const lastStr = lastDate.toLocaleDateString("en-CA", { timeZone: tenantTimezone });
      const nowStr = now.toLocaleDateString("en-CA", { timeZone: tenantTimezone });
      return lastStr !== nowStr;
    } catch {
      return true;
    }
  }
  ```
- **Processamento de Lembretes (`/process-reminders`)**:
  - Buscar agendamentos confirmados e pendentes de lembrete (`reminder_sent = false`) com `start_time > now()` e `start_time <= now + reminder_hours`.
  - Aplicar `resolveCustomerMessageWithDailyLink` e atualizar `reminder_sent = true` e `customers.last_first_contact_at = now()`.

---

### 3. Frontend (Web & Mobile)

- **Módulo de Templates (`src/modules/whatsapp/templates.ts`)**:
  - Atualizar `validateWhatsappTemplate`: `isValid` passa a ser determinado por `isWithinLengthLimit` (`length <= MAX_TEMPLATE_LENGTH`). A propriedade `hasLink` torna-se apenas metadado descritivo.
- **Painel do WhatsApp (`src/pages/gerente/Whatsapp.tsx`)**:
  - Habilitar o botão "Salvar Modelo" mesmo sem `{link}`.
  - Substituir o alerta vermelho por um card informativo sutil com a dica de primeiro contato diário.
- **Trava de Slots no Link Público (`src/pages/cliente/FluxoAgendamento.tsx` e `src/lib/timezone.ts`)**:
  - `isSlotViableForToday(slot, currentLocalTime, min_booking_lead_time_minutes)`:
    Garante que horários cuja hora de início seja anterior ao horário local atual + antecedência mínima **sejam filtrados e não apareçam** na listagem de horários disponíveis de hoje.
  - Capturar o erro `22023` da RPC `create_appointment_by_token` e exibir toast explicativo: *"Este horário não está mais disponível com a antecedência mínima necessária de X minutos configurada pela barbearia."*
- **Reagendamento Direto na Agenda e Comanda (`src/pages/gerente/Agenda.tsx` e `src/components/comandas/ComandaCheckoutModal.tsx`)**:
  - Adicionar ação de "Reagendar Horário" no menu/card de agendamento e no cabeçalho da comanda vinculada.
  - Modal com seleção de Nova Data e Novo Horário livre/disponível.
  - Executar `supabase.from('appointments').update({ start_time, end_time, updated_at }).eq('id', appointmentId)`.
  - Atualizar o estado da agenda em tempo real sem cancelar a comanda.
- **Isolamento de Cadastro (`src/pages/gerente/Clientes.tsx` e `src/pages/gerente/Agenda.tsx`)**:
  - `Clientes.tsx` (Cadastro Manual): Passa `registration_origin: 'balcao'`.
  - `Agenda.tsx` (Novo Agendamento): Passa `registration_origin: 'agenda'`.

---

## Testing Decisions

### 1. Princípios de Testabilidade
- Os testes devem verificar **comportamento externo observável** (respostas de API, textos entregues, bloqueio de slots na interface, disparo de triggers e persistência de dados), sem acoplamento a implementações privadas efêmeras.

### 2. Módulos Testados e Prior Art
- **Frontend (Vitest / Testing Library)**:
  - `src/modules/whatsapp/__tests__/templates.test.ts`: Validar templates sem `{link}`, validação de tamanho e interpolação de tags.
  - `src/pages/gerente/__tests__/Whatsapp.test.tsx`: Validar salvamento de template sem `{link}` e envio de teste.
  - `src/pages/cliente/__tests__/FluxoAgendamento.test.tsx`: Validar ocultação de slots de hoje que não atendem ao `min_booking_lead_time_minutes`.
  - `src/components/comandas/__tests__/ComandaCheckoutModal.test.tsx`: Validar botão de reagendar mantendo a comanda aberta.
  - `src/pages/gerente/__tests__/Agenda.test.tsx`: Validar reagendamento de horário sem cancelamento.
- **Backend / Edge Functions (Deno Test)**:
  - `supabase/functions/whatsapp-integration/index_test.ts`:
    - Processamento de lembretes na janela de `reminder_hours` (1h, 2h).
    - Roteamento com/sem trailing slash.
    - 1ª mensagem do dia sendo Confirmação -> Envia confirmação + link.
    - 1ª mensagem do dia sendo Lembrete -> Envia lembrete + link.
    - 1ª mensagem do dia sendo Reagendamento -> Envia reagendamento + link.
    - 2ª mensagem do mesmo dia sem `{link}` -> Envia template limpo sem link.
    - 2ª mensagem do mesmo dia com `{link}` -> Envia com `{link}` interpolado.
    - Mudança de dia no fuso do tenant -> Reinicia a inclusão do link.
    - Cadastro Balcão (`Clientes.tsx`) -> Envia boas-vindas de balcão.
    - Criação na Agenda (`Agenda.tsx`) -> Não envia boas-vindas de balcão.

---

## Out of Scope

1. **Alteração de Provedor de WhatsApp**: A integração continuará baseada na API Uazapi com persistência neutra em `public.whatsapp_instances`.
2. **Novos Tipos de Notificação**: O conjunto de templates permanece o mesmo (confirmação, reagendamento, cancelamento, lembrete prévio, boas-vindas balcão, primeiro contato bot e notificações da equipe).
3. **Mecanismo de Pagamento Online**: O escopo trata de regras de antecedência de agendamento, slots e mensageria, não alterando os fluxos de pagamento da comanda.

---

## Further Notes

- A migração respeita 100% os padrões multi-tenant do Navalhado, isolando todos os cálculos por `tenant_id` e fuso horário (`timezone`).
- As alterações de banco não truncam nem eliminam colunas existentes, garantindo rollback limpo caso necessário.
