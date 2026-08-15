# Especificação Técnica: Wizard de Onboarding do Estabelecimento e Gatekeeper de Acesso

## Problem Statement

Atualmente, quando um novo Gestor conclui o cadastro inicial de sua barbearia em `/signup` (`CadastroBarbearia.tsx`), o sistema cria a autenticação no Supabase Auth, o registro básico do tenant e a assinatura do plano. No entanto, o gestor é direcionado imediatamente para o `/dashboard` com o estabelecimento em estado desconfigurado:
- A barbearia não possui endereço físico estruturado nem geocodificação (latitude/longitude), impossibilitando o cálculo de rotas no Canal do Cliente e nos links do WhatsApp.
- Não existem serviços cadastrados na tabela `public.services`, gerando telas vazias e impedindo agendamentos.
- A tabela `public.professionals` inicia completamente vazia (o Gestor é apenas um usuário administrativo na tabela `public.users`, mas não possui perfil de atendimento cadastrado).
- Não há um fluxo guiado que colete métricas de inteligência de mercado (como canal de aquisição e ticket médio base).

Essa ausência de parametrização inicial resulta em frustração no primeiro uso, telas vazias no painel e incapacidade do sistema de operar agendamentos reais logo após o registro.

## Solution

Implementar um **Wizard de Onboarding** interativo de 4 passos na rota `/onboarding`, protegido por um **Gatekeeper de Onboarding** que intercepta o acesso às rotas operacionais do tenant (`/dashboard`, `/agenda`, `/profissionais`, `/servicos`, etc.) enquanto a flag `public.tenants.onboarding_completed` for `false`.

O fluxo é dividido em 4 etapas sequenciais baseadas na engenharia reversa do AppBarber ([docs/scraping_appbarber_wizard.md](file:///c:/Projetos/navalhado/docs/scraping_appbarber_wizard.md)) e adaptadas às diretrizes da [ADR 011](file:///c:/Projetos/navalhado/docs/adr/011_wizard_onboarding_estabelecimento.md):
1. **Passo 1 — Localização:** Foco exclusivo no Brasil, autopreenchimento por CEP via ViaCEP e geocodificação de `latitude` e `longitude`.
2. **Passo 2 — Segmentação:** Exibição do card informativo do plano contratado com cota máxima de barbeiros, coleta do preço base do corte (`base_cut_price`) e canal de aquisição (`acquisition_channel`).
3. **Passo 3 — Serviços:** Sugestões em 1 clique (One-Click Templates) com o serviço principal pré-preenchido com o valor informado no Passo 2 + formulário flexível de cadastro manual (exigindo >= 1 serviço).
4. **Passo 4 — Profissionais & Finalização:** Sugestão do Gestor como primeiro barbeiro da agenda, cadastro rápido de novos membros com validação da cota do plano (`max_professionals`) e finalização atômica que atualiza `onboarding_completed = true` no tenant e redireciona para o `/dashboard`.

---

## User Stories

1. As a Gestor recém-cadastrado, I want to be automatically redirected to the `/onboarding` wizard after signing up, so that I can configure my barbershop before accessing the main dashboard.
2. As a Gestor with incomplete onboarding, I want any attempt to access operational routes (like `/dashboard` or `/agenda`) to redirect me back to `/onboarding`, so that my barbershop is never left in an unconfigured operational state.
3. As a Gestor in Step 1, I want to enter my Brazilian CEP and have street, neighborhood, city, and state automatically populated via ViaCEP, so that I can configure my address with minimal typing.
4. As a Gestor in Step 1, I want to input my building number and confirm my address, so that the system automatically captures my latitude and longitude for GPS and client routing.
5. As a Gestor in Step 1, I want form validation to block advancing if mandatory address fields (CEP, Street, Number, Neighborhood, City, State) are missing, so that invalid addresses cannot be saved.
6. As a Gestor in Step 2, I want to view a visual card showing my active subscription plan (Bronze, Prata, or Ouro) and its maximum professional capacity, so that I understand my team limits.
7. As a Gestor in Step 2, I want to specify my barbershop's base haircut price (`base_cut_price`), so that the system can automatically suggest realistic pricing in subsequent service setup and financial reports.
8. As a Gestor in Step 2, I want to select how I found Navalhado (`acquisition_channel`), so that the platform can measure its marketing channels.
9. As a Gestor in Step 3, I want to see one-click template chips for common Brazilian barbershop services (*"Corte Tradicional"*, *"Barba"*, *"Corte + Barba"*, *"Acabamento"*), so that I can populate my service catalog in seconds.
10. As a Gestor in Step 3, I want the *"Corte Tradicional"* template to come pre-filled with the base haircut price I defined in Step 2, so that I don't have to retype it.
11. As a Gestor in Step 3, I want to add custom services with a name, price, duration (15 to 300 min in 15-min intervals), and category, so that my specific catalog is represented accurately.
12. As a Gestor in Step 3, I want to remove services from the temporary list, so that I can correct mistakes before finishing.
13. As a Gestor in Step 3, I want the wizard to block advancing to Step 4 if 0 services are configured, so that my barbershop always has at least one bookable service.
14. As a Gestor in Step 4, I want the system to offer to add me (the manager) as the first active barber with my registered name and WhatsApp phone, so that I don't have to re-enter my details if I cut hair.
15. As a Gestor in Step 4, I want to add team members with their Name, WhatsApp phone number, and default commission percentage, so that my staff is ready for appointments.
16. As a Gestor in Step 4, I want to see a live visual quota indicator (e.g., `1 of 3 barbers used`), so that I know how many slots remain under my active plan.
17. As a Gestor in Step 4, I want the system to disable adding more professionals when the plan quota (`max_professionals`) is reached, so that the database constraints are respected.
18. As a Gestor in Step 4, I want the delete button on the sole remaining professional to be hidden or disabled, so that the barbershop is never left with zero barbers.
19. As a Gestor completing Step 4, I want clicking "Finalizar Configuração" to persist all data, set `onboarding_completed = true` on my tenant, and transition me smoothly to `/dashboard`, so that I can begin regular daily operations.
20. As a Gestor returning on subsequent logins with `onboarding_completed = true`, I want to be routed directly to `/dashboard` without seeing the onboarding wizard again.

---

## Implementation Decisions

### 1. Database Schema & Migration Versioning (Supabase DEV via MCP)
- **Target Project:** `selvxobcjbkligxighlp` (`Navalhado-dev`).
- **Production Guardrail:** Never execute or apply migration commands to production database (`pjurxbubhdbcsvtimbbb`). All operations are scoped strictly to the development project via Supabase MCP.
- **Migration Version & Name:** `20260815120000_013_establishment_onboarding_wizard.sql` (located in `supabase/migrations/`).
- **Postgres Schema Alterations (`public.tenants`):**
  ```sql
  ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS cep text,
    ADD COLUMN IF NOT EXISTS address_street text,
    ADD COLUMN IF NOT EXISTS address_number text,
    ADD COLUMN IF NOT EXISTS address_neighborhood text,
    ADD COLUMN IF NOT EXISTS address_city text,
    ADD COLUMN IF NOT EXISTS address_state text,
    ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
    ADD COLUMN IF NOT EXISTS longitude numeric(11, 8),
    ADD COLUMN IF NOT EXISTS base_cut_price numeric(10, 2),
    ADD COLUMN IF NOT EXISTS acquisition_channel text,
    ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false NOT NULL;
  ```
- **Performance Indexing (Supabase Best Practices):**
  - Partial index for fast Gatekeeper checks:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_completed 
    ON public.tenants (id) 
    WHERE onboarding_completed = false;
    ```
- **RLS & Column Privilege Hardening:**
  - Gerente and Proprietário roles retain `SELECT` and `UPDATE` on their own tenant row via `private.get_auth_tenant_id()`.
  - Explicit `GRANT SELECT, UPDATE` on all new onboarding columns to `authenticated`.

### 2. Gatekeeper Seam (`OnboardingGatekeeper` / `GerenteLayout`)
- Centralized guard in `src/components/GerenteLayout.tsx` (or route wrapper):
  - Fetches the active tenant record (including `onboarding_completed`).
  - If `onboarding_completed === false` and the current path is not `/onboarding`, redirects to `/onboarding`.
  - If `onboarding_completed === true` and the current path is `/onboarding`, redirects to `/dashboard`.

### 3. Onboarding Wizard Component Architecture
- **Route:** `/onboarding` mapped in `src/App.tsx`.
- **Component File:** `src/pages/gerente/OnboardingWizard.tsx`.
- **Sub-components:**
  - `StepLocation.tsx`: CEP input with mask `99999-999`, ViaCEP lookup, address inputs, Google Maps / Nominatim geocoding.
  - `StepSegmentation.tsx`: Active plan display card, `base_cut_price` input with currency formatting, `acquisition_channel` select.
  - `StepServices.tsx`: Quick templates chips, dynamic service table, manual entry drawer/modal, validation rules.
  - `StepProfessionals.tsx`: Manager auto-populate prompt, quick add professional form, plan quota meter (`count / max_professionals`), delete protection.

---

## Testing Decisions

### 1. Seams to Test
- **Gatekeeper Seam (High-level Route Guard):** Test that authenticated manager sessions with `onboarding_completed: false` are intercepted and sent to `/onboarding`, while `onboarding_completed: true` grants access to `/dashboard`.
- **Wizard Step-by-Step State Flow:** Test that Step 1 validates mandatory address fields, Step 2 passes `base_cut_price` to Step 3, Step 3 requires >= 1 service, and Step 4 enforces `max_professionals` and updates `onboarding_completed`.
- **Database Migration & RLS Seam:** Test that migration applies cleanly on `Navalhado-dev` (`selvxobcjbkligxighlp`) and RLS permits manager updates to onboarding fields while blocking cross-tenant writes.

### 2. Test File Location & Tooling
- `src/pages/__tests__/OnboardingWizard.test.tsx` using Vitest + React Testing Library.
- Mock Supabase client capturing `tenants.update`, `services.insert`, `professionals.insert`.

---

## Out of Scope

- Multi-country currency or foreign address masking (exclusively Brazil / BRL for this release).
- Direct WhatsApp QR code pairing inside the 4-step wizard (WhatsApp connection remains in `/whatsapp` after entering the dashboard).
- Employee payroll/banking split setup (handled in financial settings post-onboarding).

---

## Further Notes

- References: [docs/scraping_appbarber_wizard.md](file:///c:/Projetos/navalhado/docs/scraping_appbarber_wizard.md) and [docs/adr/011_wizard_onboarding_estabelecimento.md](file:///c:/Projetos/navalhado/docs/adr/011_wizard_onboarding_estabelecimento.md).
- Migration application will be performed exclusively against the `Navalhado-dev` project (`selvxobcjbkligxighlp`) via Supabase MCP `execute_sql`.
