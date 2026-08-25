# Especificação Técnica: Melhorias de Agendamentos, Comandas, Notificações WhatsApp e Roteamento do Canal do Cliente

## Problem Statement

Atualmente, a operação do sistema **Navalhado** apresenta pontos de atrito na experiência do cliente, na comunicação por WhatsApp e no fluxo de gestão diária da barbearia:

1. **Card de Pré-visualização Poluído no WhatsApp:** Ao disparar confirmações ou cancelamentos via WhatsApp contendo links da aplicação, a integração gera automaticamente um card gigante com metadados do site (Open Graph), poluindo a conversa e empurrando o texto principal para baixo.
2. **Ausência de Notificação ao Barbeiro em Novos Agendamentos:** Quando um cliente agenda um horário pelo canal online, apenas o cliente recebe confirmação por WhatsApp. O profissional responsável não é notificado imediatamente no seu próprio WhatsApp, dependendo de checar a agenda no painel para saber dos novos atendimentos.
3. **Desconexão entre Cancelamento de Agendamento e Comandas:** Ao cancelar um agendamento na grade, pelo portal do cliente ou via RPC, a comanda aberta correspondente não era cancelada de forma automática e atômica no banco de dados, gerando comandas órfãs ou pendências financeiras fantasmas.
4. **Falta de Referência Visual Clara nas Comandas:** Os cards de comanda na listagem não destacam de forma visual e imediata qual o agendamento de origem (data, horário e serviço vinculado) versus comandas geradas de forma avulsa no balcão.
5. **Necessidade de Recarregar a Página (Refresh) ao Cancelar:** Quando um agendamento ou comanda é cancelado, a interface não refletia a mudança em tempo real em todos os clientes devido à ausência de `appointments` na publicação `supabase_realtime` e à falta de atualização de estado otimista imediata no React.
6. **Restrição de Horários para Encaixes de Balcão:** O modal de encaixe rápido ficava restrito aos horários de funcionamento padrão da barbearia. O gerente precisa da flexibilidade de realizar encaixes em qualquer horário das 24 horas do dia (`00:00` às `23:00`), mantendo a grade visual da agenda restrita apenas ao expediente cadastrado.
7. **Roteamento Inadequado no Canal do Cliente:** Clientes novos sem cadastro completo eram direcionados para páginas que demandavam dados prévios, enquanto clientes já cadastrados que abriam links de retorno não caíam diretamente no seu painel de gestão de agendamentos.

---

## Solution

Implementar um pacote coeso de melhorias abrangendo mensageria, automação no PostgreSQL, sincronização em tempo real e experiência de agendamento:

1. **Mensageria WhatsApp Otimizada (`whatsapp_provider.ts` e `index.ts`):**
   - Configurar `"linkPreview": false` no adaptador Uazapi para suprimir o card visual de preview em todos os disparos.
   - Implementar template e disparo dedicado para o barbeiro (`professional_appointment_created`) com chave de idempotência isolada sempre que um agendamento for criado (`appointment_created`).
2. **Cancelamento Atômico e Sincronização Realtime (Migration 046):**
   - Trigger `trg_auto_cancel_comanda_on_appointment_cancel` em `public.appointments` no banco Dev (`selvxobcjbkligxighlp`) para transicionar automaticamente a comanda aberta para `cancelada` quando o status do agendamento mudar para `canceled`.
   - Inclusão das tabelas `public.appointments` e `public.comanda_itens` na publicação `supabase_realtime`.
   - Atualização otimista de estado no React para garantir liberação imediata do horário sem necessidade de refresh.
3. **Identificação Visual Explicita nas Comandas:**
   - Enriquecimento do adaptador e tipo `ComandaEnriched` com dados do agendamento vinculado (`start_time`, `is_fitting`, `service_name`).
   - Exibição de badges com ícone de calendário destacando data, hora e serviço nos cards e no modal de checkout.
4. **Modal de Encaixe 24 Horas (00:00 às 23:00):**
   - Dropdown com todas as opções de 24 horas (`00:00` a `23:00`) quando o toggle de Encaixe estiver ativo.
   - Liberação das regras de trava de horário de funcionamento exclusivamente para encaixes.
   - Manutenção da grade visual da agenda inalterada (restrita ao expediente oficial da loja).
5. **Roteamento Inteligente do Canal do Cliente:**
   - **Cliente sem cadastro (`!cadastro_completo`):** Redirecionamento imediato para a seleção de serviços (Etapa 1 do `FluxoAgendamento`).
   - **Cliente com cadastro (`cadastro_completo === true`):** Redirecionamento automático para o Painel do Cliente (`MenuCliente`), com abas de agendamentos ativos, histórico e botão de destaque *"Agendar novo horário"*.

---

## User Stories

### A. Mensageria WhatsApp
1. As a Barber Shop Customer receiving a booking or cancellation WhatsApp message, I want to receive a clean, readable text message without a massive website preview box, so that the message content is immediately visible.
2. As a Barber (Profissional), I want to receive an instant WhatsApp notification on my phone whenever a customer books an appointment with me, so that I am immediately aware of my upcoming schedule without constantly checking the dashboard.
3. As a Barber Shop Manager, I want WhatsApp notifications to professionals to use isolated idempotency keys, so that retries or multiple triggers never send duplicate messages.

### B. Ciclo de Comandas & Cancelamentos
4. As a Manager or Receptionist canceling an appointment on the dashboard, I want the associated open comanda to be automatically cancelled in the database, so that no lingering debt or phantom items remain open.
5. As a Manager, I want the appointment cancellation trigger to run at the PostgreSQL database level, so that cancellations originated from client self-service, barber apps, or manager dashboards all atomically cancel the comanda.
6. As a Manager viewing the Comandas list, I want each comanda card to clearly display if it originates from an appointment (with date, time, and service name) or from a counter walk-in (avulsa), so that I can instantly identify what the bill is for.
7. As a Manager in the Comanda Checkout Modal, I want the header to highlight the originating appointment time and professional, so that checkout is fast and error-free.

### C. Atualização em Tempo Real (Sem Refresh)
8. As a Manager canceling an appointment on the calendar grid, I want the appointment card to vanish and the slot to become available immediately without refreshing the page, so that I can immediately reassign or view the open spot.
9. As a Manager operating on multiple devices/screens, I want appointment creations, edits, and cancellations to reflect in real time via Supabase Realtime, so that all screens stay synchronized.

### D. Encaixe Rápido 24 Horas
10. As a Manager creating a walk-in fitting (encaixe), I want the time dropdown in the modal to allow any time between 00:00 and 23:00 in 24-hour format, so that I can register early morning or late night emergency fittings.
11. As a Manager, I want the main agenda grid view to remain strictly displaying only our normal configured business hours, so that our daily calendar view does not get stretched with empty midnight rows.
12. As a Manager submitting an encaixe outside business hours, I want the system to accept and save the fitting without blocking me with business hour error warnings, so that counter operations have full autonomy.

### E. Roteamento e Experiência do Canal do Cliente
13. As a New Customer without a prior completed registration visiting the shop link, I want to land directly on the service selection screen, so that I can immediately choose my service and start booking without unnecessary intermediate steps.
14. As a Returning Customer with a completed registration visiting the shop link or WhatsApp link, I want to land directly on my Personal Customer Dashboard (`MenuCliente`), so that I can see my active bookings and visit history right away.
15. As a Returning Customer on my Personal Dashboard, I want a prominent "Agendar novo horário" button that takes me to the service selection flow, so that I can easily schedule my next visit.
16. As a Returning Customer who just completed a new booking, I want to be redirected back to my Personal Dashboard showing my newly confirmed appointment, so that I have immediate peace of mind.

---

## Implementation Decisions

### 1. Mensageria e Edge Functions
- `supabase/functions/whatsapp-integration/whatsapp_provider.ts`: Inserir `"linkPreview": false` no payload JSON de `send/text`.
- `supabase/functions/whatsapp-integration/index.ts`:
  - Adicionar template `DEFAULT_TEMPLATES.professional_appointment_created`:
    `"Olá, {profissional}! Você tem um novo agendamento na *{barbearia}*!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Cliente: *{cliente}*\n📱 WhatsApp: *{telefone_cliente}*"`
  - Buscar `professionals(name, phone)` na query de detalhes do agendamento.
  - No evento `appointment_created`, se `professional.phone` estiver preenchido e for válido, disparar notificação com idempotência `appointment:${appointment_id}:professional_appointment_created`.

### 2. Banco de Dados (Dev: `selvxobcjbkligxighlp`)
- Migration `20260825120000_046_auto_cancel_comanda_and_realtime_appointments.sql`:
  - Trigger `trg_auto_cancel_comanda_on_appointment_cancel` disparada `AFTER UPDATE OF status ON public.appointments`.
  - Execução de `ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;` e `ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_itens;`.

### 3. Módulo de Comandas
- `ComandaEnriched` enriquecida com `appointment_id`, `appointment_time`, `appointment_service`, `is_fitting`.
- `SupabaseComandaAdapter.listarTodas`: incluir relacionamentos de agendamento na query Supabase.
- `Comandas.tsx`: renderizar badges visuais distintivos nos cards (Agendamento vs Avulsa).
- `ComandaCheckoutModal.tsx`: exibir contexto de agendamento no topo do modal.

### 4. Agenda do Gerente & Encaixe 24h
- Gerar lista `all24hTimeSlots` (`00:00` a `23:00`) no intervalo `slotIntervalMinutes`.
- No formulário de agendamento, alternar para `all24hTimeSlots` quando `formIsFitting` for verdadeiro.
- Desabilitar validação de horário fora do expediente exclusivamente quando `formIsFitting` for verdadeiro.
- Atualização otimista no React: `setAppointments(prev => prev.filter(a => a.id !== targetId))` no cancelamento.

### 5. Roteamento do Cliente
- `MenuCliente.tsx`: Se `!customer.cadastro_completo`, `navigate('/cliente/agendar', { replace: true })`.
- `FluxoAgendamento.tsx`: Se `customer.cadastro_completo` e `!location.state?.fromMenu`, `navigate('/cliente/menu', { replace: true })`.
- Botão "Agendar novo horário" no menu passa `state: { fromMenu: true }`.

---

## Testing Decisions

1. **Testes de Integração da Edge Function (Deno):**
   - Testar que a Uazapi recebe `linkPreview: false`.
   - Testar disparo duplo no evento `appointment_created` (cliente + barbeiro).
   - Testar idempotência isolada para notificação do barbeiro.
2. **Testes do Frontend (Vitest & React Testing Library):**
   - Testar redirecionamento de cliente sem cadastro para a tela de serviços.
   - Testar redirecionamento de cliente com cadastro para o painel de gerenciamento.
   - Testar que o clique em "Agendar novo horário" permite avançar para seleção de serviços sem loop de redirecionamento.
   - Testar geração de opções 24h no dropdown de encaixe.
   - Testar remoção otimista de agendamento cancelado na grade.

---

## Out of Scope

- Criação de novos gateways de pagamento na comanda.
- Alteração no layout das colunas principais da grade da agenda (os horários visíveis continuam restritos ao expediente cadastrado).
- Alterações em instâncias de produção (todo o trabalho ocorre no banco Dev).

---

## Further Notes

- Todas as alterações seguem rigorosamente a convenção multi-tenant por `tenant_id` e a política de isolamento de dados do Navalhado.
- As migrações são versionadas sequencialmente a partir da migration 045 (gerando a 046).
