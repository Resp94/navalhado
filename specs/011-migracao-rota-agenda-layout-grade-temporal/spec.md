# Especificação Técnica: Migração da Rota Canônica do Gerente para /agenda e Layout em Grade Temporal Contínua

## Problem Statement

Atualmente, o sistema Navalhado apresenta três descompassos funcionais e de experiência na gestão diária de atendimentos da barbearia:
1. **Ambiguidade de Rota e Domínio:** O painel operacional principal do Gerente está mapeado na rota `/dashboard`. No domínio real de barbearias, o operador busca uma "Agenda" de trabalho em tempo real, e não uma mesa de relatórios analíticos ("Dashboard", que no Navalhado pertence à esfera administrativa do SaaS em `/admin/dashboard`).
2. **Layout em Cartões Empilhados vs Grade Temporal Real:** A interface atual (`Dashboard.tsx`) renderiza os agendamentos como uma lista de cartões empilhados verticalmente por coluna de barbeiro. Isso oculta a percepção do tempo ocioso entre atendimentos (ex: um agendamento às 09:00 e outro às 17:00 aparecem visualmente colados), não possui régua horária contínua e carece de uma linha do tempo atual ("Red Line").
3. **Ausência de Interatividade de Grade e Metadados do AppBarber:** O operador não consegue clicar diretamente em um slot vago para agendar um horário rápido, não há distinção visual clara para atendimentos de encaixe (`is_fitting`), confirmações de presença via WhatsApp, notas de atendimento ou status de "Em Atendimento" (`in_progress`) e "Ausente / No-Show" (`no_show`).

## Solution

Implementar a migração completa da rota canônica do Gerente para **/agenda** (`src/pages/gerente/Agenda.tsx`), com redirecionamento transparente da rota legada `/dashboard`, acompanhada pela reconstrução da interface em **Grade Temporal Contínua** inspirada na engenharia reversa do AppBarber ([docs/scraping_appbarber_agenda.md](file:///c:/Projetos/navalhado/docs/scraping_appbarber_agenda.md)) e nas decisões da [ADR 012](file:///c:/Projetos/navalhado/docs/adr/012_migracao_rota_agenda_e_layout_grade_temporal.md).

A solução é composta por:
1. **Roteamento Canônico:** Rota `/agenda` no `App.tsx`, com redirects automáticos a partir de `/dashboard`, `Login.tsx`, `AuthGuard.tsx` e `OnboardingWizard.tsx`.
2. **Grade Temporal Contínua (Resource Columns):** Régua vertical de horários contínuos (de 08:00 às 20:00 ou conforme `tenants.business_hours`), onde cada coluna representa um profissional ativo, a altura dos cards é proporcional à duração do serviço, e slots vazios são diretamente clicáveis.
3. **Linha do Tempo em Tempo Real ("Red Line"):** Marcador visual horizontal que acompanha o minuto exato do dia sobre a grade.
4. **Header de Controle Operacional:** Destaque para o botão mestre **`+ Encaixe`** (estilo AppBarber), navegador de datas com rótulos por extenso em PT-BR e filtro seletivo de profissionais.
5. **Evolução do Schema no Banco (Supabase DEV via MCP):** Migração segura adicionando as colunas `is_fitting`, `notes`, `origin` e suporte aos status `'in_progress'` e `'no_show'`, preservando a integridade da restrição anti-conflito GIST.

---

## User Stories

1. As a Gerente, I want to access my operational scheduling view at `/agenda`, so that the URL directly reflects the core barbering scheduling workflow.
2. As a Gerente accessing the legacy `/dashboard` URL, I want to be automatically redirected to `/agenda`, so that bookmarked or legacy links never break.
3. As a Gerente logging in or finishing onboarding, I want to land directly on `/agenda`, so that I immediately see today's operations.
4. As a Gerente, I want to see a top navigation bar where the first item is clearly labeled "Agenda" and points to `/agenda`, so that navigation is intuitive and consistent.
5. As a Gerente viewing the agenda header, I want to see today's date written in full Portuguese (e.g., *"Sábado, 15 de Agosto de 2026"*), so that I have instant temporal orientation.
6. As a Gerente, I want to navigate between days using `<` (Previous), `>` (Next), a native date selector, and a "Hoje" button, so that I can inspect past and future schedules effortlessly.
7. As a Gerente, I want a prominent **`+ Encaixe`** button in the header toolbar, so that I can quickly schedule walk-in clients from anywhere on the screen.
8. As a Gerente, I want to see a continuous vertical timeline (e.g., from 08:00 to 20:00) with time slots, so that I can visually perceive open gaps, busy periods, and barber utilization.
9. As a Gerente, I want each active barber to have a dedicated vertical column side-by-side with their avatar and name at the top, so that the entire shop's schedule is visible at a glance.
10. As a Gerente, I want a live red indicator line across the grid representing the current time, so that I immediately know which appointments should be starting, running, or ending right now.
11. As a Gerente, I want clicking on any empty time slot in a barber's column to open the new appointment modal pre-filled with that barber and time, so that scheduling takes minimal clicks.
12. As a Gerente, I want appointment cards to scale their height proportionally to the service duration (e.g., 30m vs 60m), so that calendar density matches real-world time.
13. As a Gerente, I want appointments to display distinct semantic border and background badges (e.g., green for WhatsApp-confirmed, brown/orange for walk-in encaixes, blue for in-progress, dark green for completed), so that I can triage the salon floor instantly.
14. As a Gerente, I want to see customer metadata icons on each card (e.g., WhatsApp icon, payment indicator, notes icon), so that I have full context without opening modal after modal.
15. As a Gerente, I want one-click action buttons on each appointment card to Start Service ("Iniciar"), Mark Paid/Collect ("Cobrar"), open direct WhatsApp ("WhatsApp"), or Cancel ("Cancelar"), so that routine operations are instantaneous.
16. As a Gerente, I want clicking the direct WhatsApp button on a card to open `https://wa.me/{phone}` with a contextual pre-formatted message, so that I can communicate with the client without manual typing.
17. As a Gerente creating an encaixe or standard appointment, I want to toggle between selecting an existing customer or doing a quick-create (Name + WhatsApp), so that first-time walk-ins are captured smoothly.
18. As a Gerente creating an appointment, I want to optionally record internal notes (e.g., *"Prefere tesoura"*), so that special preferences are stored on the appointment record.
19. As a Gerente, I want the system to persist walk-in appointments with `is_fitting = true` and `origin = 'manual'`, so that analytics can differentiate online bookings from floor walk-ins.
20. As a Gerente changing an appointment status to "In Progress" or "Completed", I want the database and UI to update reactively, so that the status is synchronized across the shop.
21. As a Gerente canceling an appointment, I want a modal asking for confirmation and an optional reason, so that accidental deletions are prevented and cancellation audit trails are kept.
22. As a Gerente, I want the multi-select filter in the header to let me toggle which barbers are displayed on screen, so that I can focus on a specific team or view all staff together.

---

## Implementation Decisions

### 1. Database Schema & Migration Versioning (Supabase DEV via MCP)
- **Target Project:** `selvxobcjbkligxighlp` (`Navalhado-dev`).
- **Production Guardrail:** All DDL and DML operations are strictly applied via Supabase MCP to development.
- **Migration Version & Name:** `20260815130000_014_agenda_enhancements_and_status.sql` in `supabase/migrations/`.
- **Postgres Schema Alterations (`public.appointments`):**
  ```sql
  -- 1. Adicionar colunas de suporte do AppBarber
  ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS is_fitting boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

  -- 2. Restrição de Origem
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_origin_check,
    ADD CONSTRAINT appointments_origin_check CHECK (origin IN ('manual', 'whatsapp', 'client_channel'));

  -- 3. Atualizar restrição de Status para incluir in_progress e no_show
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check,
    ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show'));

  -- 4. Atualizar constraint GIST anti-sobreposição para cobrir in_progress
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_no_professional_overlap;

  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_professional_overlap
    EXCLUDE USING gist (
      professional_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
    )
    WHERE (status IN ('pending', 'confirmed', 'in_progress'));

  -- 5. Índice composto para a consulta diária da agenda
  CREATE INDEX IF NOT EXISTS idx_appointments_agenda_daily 
    ON public.appointments (tenant_id, start_time) 
    WHERE (status != 'canceled');
  ```

### 2. Frontend Routing & Redirections
- **`src/App.tsx`:**
  - Adiciona rota `/agenda` vinculada a `<GerenteAgenda />`.
  - Redireciona rota `/dashboard` para `/agenda` (`<Navigate to="/agenda" replace />`).
- **`src/components/GerenteLayout.tsx`:**
  - Primeiro link da Navbar atualizado para `{ path: '/agenda', label: 'Agenda', icon: <CalendarIcon size={18} /> }`.
  - Redirecionamentos do Gatekeeper de Onboarding apontam para `/agenda`.
  - Clique na Logo direciona para `/agenda`.
- **`src/components/AuthGuard.tsx` & `src/pages/Login.tsx`:**
  - Destino da role `gerente` atualizado de `/dashboard` para `/agenda`.
- **`src/pages/gerente/OnboardingWizard.tsx`:**
  - Redirecionamento de conclusão atualizado para `/agenda`.

### 3. Componente da Nova Agenda (`src/pages/gerente/Agenda.tsx`)
- **Design System & Tokens do Navalhado:**
  - Uso estrito dos tokens CSS globais definidos em `src/index.css` (`--color-brand-primary`, `--color-brand-soft`, `--color-brand-lightest`, `--color-bg-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-success`, `--color-warning`, `--radius-*`, `--shadow-*`).
  - Efeito glassmorphism e acabamento premium (`backdrop-filter: blur(12px) saturate(120%)`, bordas suaves em `rgba(234, 222, 214, 0.5)`).
  - Tipografia consistente baseada na fonte `Outfit`.
- **Biblioteca de Ícones Oficial:**
  - Uso exclusivo de `@hugeicons/react` e `@hugeicons/core-free-icons` (ex: `Calendar03Icon`, `Clock01Icon`, `UserIcon`, `ScissorsIcon`, `Money01Icon`, `Cancel01Icon`, `PlusSignIcon`, `ArrowLeft01Icon`, `ArrowRight01Icon`, `WhatsappIcon`, `FilterIcon`, `AlertCircleIcon`, etc.).
- **Arquitetura da Grade:**
  - Eixo Y com slots de tempo contínuos calculados dinamicamente com base em `tenant.business_hours` (padrão 08:00 às 20:00).
  - Eixo X com colunas responsivas por profissional ativo.
  - Linha do tempo atual (`Red Line`) atualizada via `setInterval` a cada 60 segundos com posicionamento proporcional em CSS.
  - Células vazias interativas: `onClick` captura o horário do slot e o profissional da coluna e abre o modal de agendamento.
- **Modal de Agendamento & Encaixe:**
  - Suporte a `is_fitting: true` quando disparado pelo botão mestre `+ Encaixe` ou slot livre.
  - Suporte a campo `notes` para observações do atendimento.
  - Cadastro rápido de cliente ou seleção de cliente existente.
- **Modais de Ação:**
  - Modal de Confirmação de Cancelamento com motivo.
  - Modal de Pagamento / Faturamento.
- **Integração Realtime:**
  - Inscrição em `supabase.channel('appointments-agenda')` para atualização reativa quando clientes agendarem via WhatsApp ou Canal do Cliente.

---

## Testing Decisions

### Standards for Good Tests
- **Comportamento Externo:** Testar renderização de rotas, navegação, abertura de modais a partir de cliques em slots e submissão de agendamentos.
- **Isolamento de Supabase:** Mocks controlados para respostas do Supabase Client e Auth.

### Modules Tested
1. **`GerenteLayout.test.tsx`:** Validação de que `/agenda` é a rota ativa na Navbar e que o Gatekeeper redireciona adequadamente.
2. **`OnboardingWizard.test.tsx`:** Validação de que a conclusão do onboarding navega para `/agenda`.
3. **`Agenda.test.tsx`:** Validação da renderização da grade, colunas de barbeiros, cálculo de horários e abertura do modal de encaixe.

---

## Out of Scope

- Visualizações complexas de Mês/Semana agregadas em tabela de calendário tradicional (o foco primário é a visualização diária multirrecurso `resourceDay`).
- Módulo completo de controle de estoque de produtos embutido na agenda (fica a cargo do módulo financeiro/comandas).
- Integração com impressoras térmicas via protocolo ESC/POS (a impressão de agenda utiliza `window.print()`).

---

## Further Notes

- A identidade visual dos cartões e cabeçalho segue o design system do Navalhado (paleta HSL terracota/âmbar com fundo de vidro límpido e acabamentos premium), incorporando os estados semânticos do AppBarber mapeados no documento `docs/scraping_appbarber_agenda.md`.
