# Especificação Técnica: Melhorias Operacionais, Comandas, Bloqueios de Agenda, Mensageria e Comissões por Item

## Problem Statement

A operação diária das barbearias no **Navalhado** identificou gargalos e necessidades de evolução nos fluxos de atendimento rápido, gestão de agenda, persistência de comandas, privacidade de contato, governança de cadastros, mensageria de WhatsApp e apuração de comissões da equipe:

1. **Clientes Fantasmas em Atendimentos de Balcão:** Ao realizar um encaixe rápido ou uma venda avulsa no balcão sem cadastrar um cliente, o sistema forçava a criação de um registro provisório no banco de dados com nome "Cliente" e sem dados de contato, poluindo a base de clientes do tenant com registros fantasmas.
2. **Exposição Indevida do Contato do Cliente e Cancelamentos Direcionados ao Barbeiro:** O telefone particular do cliente era incluído no texto das mensagens de WhatsApp enviadas aos profissionais. Além disso, quando o prazo para cancelamento online expirava, o sistema sugeria que o cliente falasse no celular pessoal do barbeiro em vez de contatar a barbearia/recepção.
3. **Perda de Itens Adicionados à Comanda sem Liquidação:** Ao adicionar ou remover produtos e serviços em uma comanda existente pelo modal de checkout, os itens ficavam apenas no estado local da interface (React). Se o operador fechasse o modal ou navegasse para outra tela sem finalizar a comanda no caixa, as alterações eram perdidas.
4. **Ausência de Bloqueio Manual Direto na Agenda:** O gerente não possuía uma forma rápida na interface da Agenda para bloquear horários (pontuais, intervalos ou dia inteiro) para intervalos, folgas ou manutenções sem ter que criar um agendamento fictício.
5. **Inconsistência Visual e Responsiva nos Cards de Serviços:** O catálogo de serviços apresentava problemas de proporção, touch targets reduzidos e falta de fluidez em telas compactas (320px a 390px).
6. **Falta de Diferenciação entre Inativação e Exclusão (Soft Delete):** Ao "excluir" um serviço ou profissional, o sistema apenas alterava seu status para inativo (`is_active = false`), fazendo-o continuar ocupando espaço visual nas telas operacionais normais em vez de ter um soft delete real com preservação histórica.
7. **Ausência de Boas-Vindas Exclusivas para Clientes Cadastrados no Balcão:** Ao cadastrar um cliente novo presencialmente no balcão, a barbearia não dispunha de um disparo automático e caloroso de boas-vindas com seu link de autoatendimento. Clientes editados ou criados por outros canais corriam risco de disparos duplicados ou indevidos.
8. **Divergência na Apuração de Comissões por Item no Painel do Barbeiro:** Enquanto o Hub Financeiro contabiliza o faturamento e as comissões a partir de cada item da comanda (`comanda_itens.professional_id`), a tela "Minhas Comissões" do barbeiro ainda consultava o profissional do agendamento principal (`appointments.professional_id`). Assim, quando um barbeiro executava um serviço adicional dentro da comanda de outro profissional, ele não enxergava seus ganhos.
9. **Falta de Personalização nas Notificações do Barbeiro:** Os textos enviados via WhatsApp aos profissionais eram rígidos no código e não permitiam adaptação de tom de voz pelo gestor.

---

## Solution

Implementar um pacote integrado de governança de dados, automações no PostgreSQL, mensageria contextual via Edge Functions e refinamentos no frontend:

1. **Atendimento e Encaixes de Balcão Anônimos:**
   - Tornar `public.appointments.customer_id` anulável (`NULL`), permitindo encaixes de balcão e comandas 100% anônimas sem inserção de registros fantasmas na tabela `customers`.
   - Garantir que a comanda e os cálculos financeiros funcionem perfeitamente mesmo com `customer_id: null`.
2. **Privacidade nas Mensagens e Redirecionamento Correto de Cancelamento:**
   - Remover `{telefone_cliente}` dos modelos de mensagem enviados aos profissionais.
   - Tornar as notificações da equipe (`professional_created`, `professional_rescheduled`, `professional_cancelled`) totalmente personalizáveis pelo gestor no painel `/whatsapp`.
   - Atualizar o modal de prazo de cancelamento expirado no canal do cliente para exibir o WhatsApp da barbearia (`tenant_phone`) e orientar o contato com o estabelecimento.
3. **Persistência Imediata de Itens em Comandas:**
   - Ao adicionar ou remover serviços e produtos no modal de checkout, gravar imediatamente no banco (`comanda_itens` e recálculo do total da comanda).
   - Para novas comandas avulsas, persistir a comanda com status `aberta` logo no primeiro item inserido.
4. **Bloqueio Manual Unificado na Agenda:**
   - Modal interativo ao clicar em slot livre permitindo escolher entre "Novo Agendamento" ou "Bloquear Horário" (com suporte a horário específico, intervalo customizado ou dia inteiro com motivo).
   - Renderização visual imediata do card de bloqueio e subtração automática dos slots livres no agendamento do cliente.
5. **Padronização Responsiva dos Cards de Serviços:**
   - Aplicação dos padrões `@responsivo` (touch targets de 44px, grid intrínseco `minmax(min(100%, 300px), 1fr)`, altura automática e tipografia fluida sem quebra em 320px).
6. **Diferenciação Estrita de Três Estados em Cadastros:**
   - **Ativo (`is_active = true`, `deleted_at IS NULL`):** Disponível normalmente para agendamentos online e painel.
   - **Inativo (`is_active = false`, `deleted_at IS NULL`):** Pausado, oculto para clientes, mas visível na área de gestão para reativação.
   - **Excluído (`deleted_at IS NOT NULL`):** Soft delete real. Oculto em todas as listagens operacionais normais, preservando 100% da integridade referencial com agendamentos e comandas antigas.
7. **Boas-Vindas Automatizadas para Cadastro de Balcão:**
   - Rastreamento de origem com `customers.registration_origin` (`'balcao'`, `'canal_cliente'`, `'whatsapp_bot'`) e flag de controle `welcome_sent_at`.
   - Template customizável `template_welcome_balcao` e controle `send_welcome_balcao` em `whatsapp_instances` com a aba "Boas-vindas" no painel.
   - Disparo único e seguro no INSERT de novos clientes com origem balcão, blindado contra reenvios em edições (UPDATE).
8. **Comissões por Item Alinhadas ao Hub Financeiro:**
   - Refatoração da tela *Minhas Comissões* (`MinhasComissoes.tsx`) para usar `comanda_itens.professional_id` com status de comanda `fechada`, assegurando que serviços e produtos de múltiplos profissionais na mesma comanda gerem comissões isoladas e exatas.

---

## User Stories

### A. Atendimento e Encaixes de Balcão (Sem Cliente Fantasma)
1. As a Receptionist or Manager creating a quick walk-in fitting (encaixe) in the agenda, I want to create the appointment without selecting or registering a customer, so that no dummy or phantom customer records are added to the database.
2. As a Receptionist opening a counter sale comanda, I want to leave the customer field empty, so that quick sales of beverages, products or haircuts are recorded without friction.
3. As a Manager reviewing financial reports, I want anonymous walk-in comandas to accurately compute in cash sessions, daily turnover and revenue metrics, so that accounting is 100% exact.
4. As a Database Administrator, I want `public.appointments.customer_id` to be nullable, so that the schema natively supports anonymous walk-ins.

### B. Privacidade, Notificações do Barbeiro e Cancelamento
5. As a Customer, I want my personal phone number not to be exposed to barbers in automated notifications, so that my personal privacy is maintained.
6. As a Barber Shop Manager, I want to fully customize the notification text sent to barbers on new appointments, reschedules and cancellations, so that internal instructions and company policies can be included.
7. As a Customer attempting to cancel an appointment whose cancellation window has expired, I want the system to provide the barber shop's official WhatsApp contact (and not the barber's private phone), so that the front desk can handle schedule adjustments.
8. As a Manager, I want expired cancellation inquiries to be routed to the shop's reception, so that our front desk can offer waitlist clients or reschedule properly.

### C. Persistência Imediata de Comandas
9. As a Receptionist adding a product or extra service to an open comanda, I want the item to be immediately saved in the database, so that if I close the modal or refresh the page, the item is not lost.
10. As a Receptionist removing an accidental item from a comanda, I want the deletion to persist immediately, so that the bill amount updates in real time.
11. As a Manager opening a brand new counter comanda, I want the comanda to be saved as `aberta` upon adding the first item, so that it appears on the active open comandas list right away.

### D. Bloqueio Manual de Horários na Agenda
12. As a Manager clicking on an empty slot in the agenda, I want the option to "Bloquear Horário", so that I can prevent client bookings without creating a fake appointment.
13. As a Manager creating a block, I want to select a specific slot, a custom time interval, or "Dia todo", so that I can accommodate quick breaks as well as full-day absences.
14. As a Manager, I want to pick a reason for the block (such as Lunch, Personal, Maintenance, Day Off), so that the team understands why the chair is unavailable.
15. As a Customer checking availability online, I want blocked slots to be automatically excluded from available time options, so that I cannot book during blocked times.
16. As a Manager, I want blocked slots to be rendered as distinctive grey cards with an unlock/remove action, so that managing blocks is intuitive.

### E. Dimensões e Responsividade dos Cards de Serviços
17. As a Mobile Customer booking on a 320px to 390px screen, I want service cards to have clear layouts, readable text, and large touch targets (44px min), so that I can easily browse and select services.
18. As a Manager managing services on tablet or desktop, I want service cards to maintain consistent heights and aligned price badges, so that the service menu looks professional.

### F. Governança de Cadastros (Ativo vs Inativo vs Excluído)
19. As a Manager, I want to deactivate a service or professional (`is_active = false`) so that it is paused from online bookings while remaining visible in the admin list for future reactivation.
20. As a Manager, I want to delete a service or professional (Soft Delete with `deleted_at = now()`), so that it disappears completely from standard operational screens while keeping historical revenue and past appointments intact.
21. As a Manager, I want a confirmation modal prior to soft deleting a service or professional, so that accidental deletions are prevented.

### G. Mensagem de Boas-Vindas para Cadastros de Balcão
22. As a New Customer registered at the counter, I want to receive a friendly WhatsApp welcome message with my personal self-service portal link, so that I can manage my future bookings online.
23. As a Manager, I want the counter welcome message to be sent strictly on initial customer creation (`registration_origin = 'balcao'`), so that customers created through online self-service or existing customers being edited never receive redundant welcome messages.
24. As a Manager in `/whatsapp`, I want a "Boas-vindas" tab in the visual template editor and simulator, so that I can customize the welcome message sent to counter clients.

### H. Apuração de Comissões por Item no Painel do Barbeiro
25. As a Barber viewing "Minhas Comissões", I want to see commission earnings for every service or product assigned to me in `comanda_itens`, even if the comanda originally belonged to another professional, so that I am fairly compensated for all my work.
26. As a Barber, I want my commission totals and history to match the exact amounts recorded in the Manager's Financial Hub, so that there are no discrepancies between the team and management.

---

## Implementation Decisions

### 1. Banco de Dados e Migrations (PostgreSQL / Supabase MCP)

- **Migration `049` (`20260826120000_049_allow_null_customer_in_appointments.sql`):**
  - `ALTER TABLE public.appointments ALTER COLUMN customer_id DROP NOT NULL;`
  - Atualização da trigger `fn_auto_create_comanda_for_appointment()` para aceitar `customer_id: null`.
- **Migration `050` (`20260826130000_050_soft_delete_services_and_professionals.sql`):**
  - Adição de `deleted_at TIMESTAMPTZ DEFAULT NULL` em `public.services` e `public.professionals`.
  - Índices parciais `CREATE INDEX ... WHERE deleted_at IS NULL`.
  - Atualização das RPCs de agendamento e listagem (`get_available_slots`, `get_customer_appointments_by_token`) para filtrar `AND deleted_at IS NULL`.
- **Migration `051` (`20260826140000_051_customer_welcome_and_barber_templates.sql`):**
  - Tabela `public.customers`: adicionar `registration_origin TEXT NOT NULL DEFAULT 'balcao'` e `welcome_sent_at TIMESTAMPTZ DEFAULT NULL`.
  - Tabela `public.whatsapp_instances`: adicionar `template_welcome_balcao`, `send_welcome_balcao`, `template_professional_created`, `template_professional_rescheduled` e `template_professional_cancelled`.
  - Trigger `trg_customer_welcome_balcao` em `public.customers` disparada `AFTER INSERT` para clientes de balcão via `net.http_post`.

### 2. Mensageria WhatsApp (Edge Functions & Templates)

- `supabase/functions/whatsapp-integration/index.ts`:
  - Tratar templates customizáveis do barbeiro recuperando da instância (`template_professional_created`, `template_professional_rescheduled`, `template_professional_cancelled`), com fallbacks canônicos livres de `{telefone_cliente}`.
  - Implementar manipulador do evento `customer_welcome_balcao`: formatar `template_welcome_balcao` com `{cliente}`, `{barbearia}`, `{link}` e atualizar `welcome_sent_at` no banco.
- `src/modules/whatsapp/templates.ts` e `src/pages/gerente/Whatsapp.tsx`:
  - Adicionar aba **"Boas-vindas"** e seção **"Notificações da Equipe"** com simulação em tempo real e substituição dinâmica de tags.

### 3. Gestão de Comandas (Persistência Imediata e Balcão)

- `src/components/comandas/ComandaCheckoutModal.tsx`:
  - Ao confirmar `handleAddServiceConfirm` ou `handleAddProductConfirm`, chamar imediatamente `comRepo.adicionarItem(...)` e atualizar `comandas.total_amount`.
  - Ao executar `handleRemoveItem`, chamar imediatamente `comRepo.removerItem(...)` e recalcular o total.
  - Se for nova comanda avulsa, criar no banco com status `aberta` no primeiro item.
  - Exibir *"Venda Avulsa / Balcão"* quando `customerId` for nulo.
- `src/modules/comandas/adapters/SupabaseComandaAdapter.ts`:
  - Suporte completo a `customer_id: null`.

### 4. Agenda do Gerente (Encaixe sem Cliente & Bloqueio Manual)

- `src/pages/gerente/Agenda.tsx`:
  - Suporte a encaixes com `customer_id: null` sem validação bloqueante de cliente.
  - Modal unificado de bloqueio: profissional, data, tipo (slot específico vs intervalo customizado vs dia todo) e motivo.
  - Inserção direta em `public.blocked_slots` e recarregamento via Realtime/`fetchBlockedSlots`.

### 5. Gestão de Cadastros (Soft Delete vs Inativo)

- `src/pages/gerente/Servicos.tsx` e `Profissionais.tsx`:
  - Queries filtrando `deleted_at IS NULL`.
  - Switch existente mantido para `is_active` (Ativo/Inativo).
  - Nova ação de Excluir com modal de confirmação executando soft delete (`deleted_at = now()`, `is_active = false`).

### 6. Painel do Barbeiro (Minhas Comissões por Item)

- `src/pages/barbeiro/MinhasComissoes.tsx`:
  - Consultar `comanda_itens` com join em `comandas`, `services` e `products`, filtrando por `comanda_itens.professional_id = professional.id` e `comandas.status IN ('fechada', 'closed')`.
  - Calcular comissão e faturamento baseados no item específico executado pelo profissional.

### 7. Canal do Cliente & Responsividade

- `src/pages/cliente/MenuCliente.tsx`:
  - Modal de cancelamento expirado: orientar contato com a barbearia e abrir conversa com `tenant_phone`.
- `src/pages/cliente/FluxoAgendamento.tsx`:
  - Cards de serviços com altura dinâmica, touch targets de 44px e grid responsivo.

---

## Testing Decisions

1. **Testes de Comportamento Externo e Repositórios:**
   - Testar o comportamento das funções públicas e componentes React sem acoplamento a implementações internas efêmeras.
2. **Módulos com Testes Automatizados (Vitest):**
   - `MinhasComissoes.test.tsx`: Validar cálculo de comissões por `comanda_itens.professional_id` em comandas com itens de múltiplos barbeiros.
   - `ComandaCheckoutModal.test.tsx`: Validar persistência imediata de adição/remoção de itens e suporte a comandas sem cliente.
   - `Agenda.test.tsx`: Validar criação de encaixe sem cliente e criação de bloqueios manuais (slot único e intervalo).
   - `Servicos.test.tsx` e `Profissionais.test.tsx`: Validar soft delete (`deleted_at`) vs inativação (`is_active`).
   - `MenuCliente.test.tsx`: Validar redirecionamento de cancelamento para o telefone da barbearia.
   - `Whatsapp.test.tsx` e `Clientes.test.tsx`: Validar aba "Boas-vindas", templates do barbeiro e gravação de `registration_origin = 'balcao'`.
3. **Arte Prévia:**
   - Reutilizar os utilitários de mock e builders de dados presentes em `src/pages/gerente/__tests__/` e `src/modules/canal-cliente/__tests__/`.

---

## Out of Scope

- Criação de novos módulos financeiros fora de `comandas`, `caixa` e `MinhasComissoes`.
- Alteração no motor de disparo de WhatsApp além das novas colunas de templates e eventos especificados.
- Exclusão física (Hard Delete) de registros no banco de dados.

---

## Further Notes

- Todas as migrations devem ser aplicadas no projeto Dev (`selvxobcjbkligxighlp`) utilizando o MCP Supabase e versionadas no repositório em `supabase/migrations/`.
- Toda a interface visual deve respeitar os tokens semânticos e as diretrizes de acessibilidade WCAG 2.2 do `@responsivo`.
