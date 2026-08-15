# Especificação Técnica: Ciclo de Comandas, Sessão de Caixa Diário, Bloqueio de Horários e Grade Avançada

## Problem Statement

Após a consolidação da grade temporal contínua na rota `/agenda` (ADR 012), identificou-se que a operação de barbearias necessita de maturidade financeira e flexibilidade operacional equivalente ao padrão de mercado observado no AppBarber:

1. **Ausência de Ciclo de Comandas e Venda de Produtos:** O sistema realiza cobranças diretas unitárias do serviço em `public.payments`. Em atendimentos reais, clientes frequentemente consomem produtos de bancada (pomadas, óleos, tônicos), realizam múltiplos serviços (cabelo + barba + sobrancelha) e demandam gorjetas ou descontos.
2. **Impossibilidade de Divisão de Pagamento:** Não é possível liquidar uma conta dividindo o valor entre múltiplas formas de pagamento (ex: R$ 30,00 no PIX e R$ 20,00 em Dinheiro com cálculo de troco).
3. **Inexistência de Sessões de Caixa (Turno Diário):** Recebimentos em dinheiro físico não são vinculados a uma gaveta/sessão de caixa aberta com fundo de troco inicial, impedindo o fechamento e a sangria de caixa no final do dia.
4. **Falta de Bloqueio Dinâmico de Horários:** Não há mecanismo para marcar intervalos de almoço, folgas ou consultas médicas de profissionais na grade, fazendo com que o Canal do Cliente continue ofertando esses horários.
5. **Colisão Visual e Bloqueio de Banco em Encaixes Concorrentes:** A constraint GIST anti-sobreposição atual bloqueia inserções concorrentes mesmo para encaixes autorizados (`is_fitting = true`), e o frontend empilha os cards cegamente em vez de dividir a coluna horizontalmente (50% / 50%).
6. **Limitação de Visualização Temporal:** Falta uma visão semanal dedicada por profissional e um seletor rápido tipo popover/mini-calendário.
7. **Ativos Legados no Banco:** Funções RPC obsoletas (`get_available_slots` sem token e `get_customer_info_by_token`) ainda residem no schema do Postgres.

---

## Solution

Implementar o **Ciclo Completo de Comandas, Sessões de Caixa, Bloqueios de Horários e Recursos Avançados de Grade** no Navalhado, fundamentado na [ADR 013](file:///c:/Projetos/navalhado/docs/adr/013_ciclo_de_comandas_sessao_caixa_e_grade_avancada.md) e na engenharia reversa do AppBarber ([docs/engenharia_reversa_appbarber_agenda.md](file:///c:/Projetos/navalhado/docs/engenharia_reversa_appbarber_agenda.md)):

1. **Migração Versionada do Banco (Supabase DEV):**
   - Criação das tabelas `public.comandas`, `public.comanda_itens`, `public.comanda_pagamentos`, `public.cash_sessions`, `public.blocked_slots`, `public.products` e `public.waiting_list`.
   - Ajuste da constraint GIST anti-sobreposição para permitir encaixes (`WHERE status IN ('pending', 'confirmed', 'in_progress') AND is_fitting = false`).
   - Atualização do RPC `get_available_slots_by_token` para subtrair horários bloqueados.
   - Remoção formal (`DROP FUNCTION`) das RPCs legadas `get_available_slots` e `get_customer_info_by_token`.
2. **Ciclo de Comandas & Checkout com Divisão de Pagamento:**
   - Modal de Comanda com adição de serviços adicionais, produtos com baixa de estoque, descontos (%) e gorjetas.
   - Divisão de conta dinâmica (PIX, Cartão de Crédito, Cartão de Débito, Dinheiro) com calculadora automática de troco.
3. **Sessão de Caixa com Abertura Assistida:**
   - Validação de caixa aberto antes do recebimento. Se fechado, o modal guia a abertura em 1 clique informando o fundo de troco sem perder o preenchimento da comanda.
4. **Bloqueio de Horários e Grid Concorrente (Encaixe 50%/50%):**
   - Card cinza listrado para bloqueios na grade com exclusão rápida.
   - Algoritmo de posicionamento horizontal lado a lado para agendamentos simultâneos no mesmo barbeiro.
5. **Navegação Avançada e Ferramentas Laterais:**
   - Alternância Visão Dia / Visão Semana por barbeiro.
   - Datepicker rápido tipo popover no cabeçalho.
   - Painel lateral de Lista de Espera diária com encaixe sugerido em cancelamentos e sugestão de rodízio de balcão.

---

## User Stories

### A. Ciclo de Comandas e Venda de Produtos
1. As a Gerente, I want every new appointment to automatically associate with or generate an open Comanda, so that all consumption during the visit is centrally tracked.
2. As a Gerente opening the Checkout modal ("Cobrar"), I want to see the customer name, primary service, and an itemized breakdown with subtotal, discounts, and total.
3. As a Gerente in the Checkout modal, I want to click `+ Serviço` to add an unexpected service performed on the fly, selecting the commissioned professional.
4. As a Gerente in the Checkout modal, I want to click `+ Produto` to add retail items (e.g., hair pomade, beard oil) from the catalog with automatic price and stock lookup.
5. As a Gerente in the Checkout modal, I want to apply a discount in percentage (%) or fixed value (R$), updating the grand total in real time.
6. As a Gerente in the Checkout modal, I want to record an optional Barber Tip (gorjeta), so that staff compensation is recorded accurately.
7. As a Gerente in the Checkout modal, I want to split the total payment across multiple methods (e.g., R$ 30,00 PIX + R$ 20,00 Dinheiro), so that complex customer transactions are handled effortlessly.
8. As a Gerente taking cash payment, I want to enter the amount received and see the exact change to give back (calculadora de troco), so that cashier errors are eliminated.
9. As a Gerente completing a Comanda, I want the system to deduct quantities from product inventory (`products.stock_quantity`), keeping stock balances up to date.
10. As a Gerente completing a Comanda, I want the corresponding appointment on the timeline grid to transition to `completed` and turn semantic green (`#0E9F6E`) instantly via Realtime.

### B. Sessão de Caixa Diário (Turno e Abertura Assistida)
11. As a Gerente finalizing a Comanda when no cashier session is open today, I want to see an inline prompt to open today's Cashier session (`cash_sessions`), so that daily financial tracking is strictly preserved.
12. As a Gerente prompted to open the cashier during checkout, I want to enter the initial cash float (fundo de troco, e.g., R$ 50,00) and click Confirm without leaving the modal or losing entered comanda items.
13. As a Gerente, I want every payment received (`comanda_pagamentos`) to record the active `cash_session_id`, ensuring clear audit trails.
14. As a Gerente at the end of the shift, I want to access the Cashier drawer view to review totals grouped by payment method (Dinheiro, PIX, Cartão) and close the register.

### C. Bloqueio de Horários na Grade (`blocked_slots`)
15. As a Gerente, I want to click an empty slot or use the "+ Bloquear" option to block a time range for a barber (e.g., 12:00 to 13:00 for Almoço), so that no one can book that slot.
16. As a Gerente, I want blocked slots to render as distinct dark-gray/hatched cards with the reason displayed (e.g., *"Almoço"*, *"Folga"*), visually differentiating them from client appointments.
17. As a Gerente, I want to click on a blocked slot card to easily unblock/delete it with confirmation.
18. As a Client on the WhatsApp or web booking channel, I want the slot generation RPC (`get_available_slots_by_token`) to automatically exclude blocked periods, preventing double-bookings.

### D. Encaixe Concorrente e Divisão de Colunas (Split Grid)
19. As a Gerente clicking `+ Encaixe`, I want to select any time and barber even if another appointment already occupies that time slot, so that floor emergencies can be scheduled.
20. As a Gerente viewing a barber column with overlapping appointments (e.g., standard appointment + encaixe), I want the timeline column to split into side-by-side 50%/50% sub-columns, so that both cards remain fully readable and interactive.
21. As a Gerente, I want encaixe cards to maintain their distinct visual terracotta badge (`ENCAIXE`), so that the barber knows it was a walk-in overbooking.

### E. Visões Temporais e Recursos de Apoio (Lista de Espera e Rodízio)
22. As a Gerente, I want to toggle between "Visão Dia" (all active barbers side-by-side) and "Visão Semana" (7-day schedule for a selected barber), so that I can manage short-term floor flow and weekly planning.
23. As a Gerente in the header, I want a mini-calendar / datepicker popover to jump to any specific past or future date with one click.
24. As a Gerente, I want a Waiting List drawer (`waiting_list`) to register clients waiting for same-day openings (name, phone, preferred barber, service).
25. As a Gerente when an appointment is canceled, I want the system to notify me if there are matching clients on the waiting list with a 1-click shortcut to schedule them into the newly opened gap.
26. As a Gerente creating a walk-in encaixe with no barber preference, I want the modal to suggest the next barber based on daily rotation (fewest cuts today or longest idle time).

---

## Implementation Decisions

### 1. Migração de Banco de Dados Versionada (`015_comandas_caixa_bloqueios_produtos.sql`)
- **Tabela `public.cash_sessions`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `opened_by UUID REFERENCES auth.users(id)`, `closed_by UUID REFERENCES auth.users(id)`, `opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`, `closed_at TIMESTAMPTZ`, `initial_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (initial_amount >= 0)`, `closing_amount NUMERIC(10,2) CHECK (closing_amount IS NULL OR closing_amount >= 0)`, `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))`, `notes TEXT`.
- **Tabela `public.products`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `price NUMERIC(10,2) NOT NULL CHECK (price >= 0)`, `cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0)`, `stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`.
- **Tabela `public.comandas`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL`, `customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL`, `status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'cancelada'))`, `total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0)`, `discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0)`, `tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tip_amount >= 0)`, `notes TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`, `closed_at TIMESTAMPTZ`.
- **Tabela `public.comanda_itens`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `item_type TEXT NOT NULL CHECK (item_type IN ('servico', 'produto'))`, `service_id UUID REFERENCES public.services(id) ON DELETE SET NULL`, `product_id UUID REFERENCES public.products(id) ON DELETE SET NULL`, `professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL`, `quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)`, `unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)`, `total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0)`.
- **Tabela `public.comanda_pagamentos`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL`, `payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'cash', 'other'))`, `amount NUMERIC(10,2) NOT NULL CHECK (amount > 0)`, `change_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0)`, `paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`.
- **Tabela `public.blocked_slots`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE`, `start_time TIMESTAMPTZ NOT NULL`, `end_time TIMESTAMPTZ NOT NULL`, `reason TEXT NOT NULL DEFAULT 'Almoço'`, `is_all_day BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`, `CONSTRAINT blocked_slots_valid_timerange CHECK (end_time > start_time)`.
- **Tabela `public.waiting_list`**:
  `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`, `customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL`, `name TEXT NOT NULL`, `phone TEXT NOT NULL`, `service_id UUID REFERENCES public.services(id) ON DELETE SET NULL`, `professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL`, `status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'scheduled', 'expired', 'canceled'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`.

### 2. Índices de Performance e Concorrência (Postgres Best Practices)
- **Cobertura de Índices em Foreign Keys (B-Tree)**:
  - `idx_comandas_tenant_id`, `idx_comandas_appointment_id`, `idx_comandas_customer_id`
  - `idx_comanda_itens_comanda_id`, `idx_comanda_itens_service_id`, `idx_comanda_itens_product_id`, `idx_comanda_itens_professional_id`
  - `idx_comanda_pagamentos_comanda_id`, `idx_comanda_pagamentos_cash_session_id`
  - `idx_cash_sessions_tenant_id`, `idx_cash_sessions_opened_by`
  - `idx_blocked_slots_tenant_id`, `idx_blocked_slots_professional_id`, `idx_blocked_slots_range` (GIST para busca rápida de colisão)
  - `idx_waiting_list_tenant_id`, `idx_waiting_list_status`
- **Garantia de Unicidade Concorrente de Caixa Aberto**:
  - `CREATE UNIQUE INDEX idx_single_open_cash_session_per_tenant ON public.cash_sessions (tenant_id) WHERE (status = 'open');`
- **Constraint GIST de Anti-Sobreposição Ajustada (Overbooking Permitido em Encaixes)**:
  ```sql
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_professional_overlap;
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_professional_overlap
    EXCLUDE USING gist (
      professional_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
    )
    WHERE (status IN ('pending', 'confirmed', 'in_progress') AND is_fitting = false);
  ```

### 3. Segurança e Políticas RLS (Supabase Security Best Practices)
- RLS ativado em todas as 7 tabelas com `ENABLE ROW LEVEL SECURITY`.
- Políticas de isolamento multi-tenant aplicadas com `TO authenticated`:
  - `USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))`
  - Cláusula `WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))` em todas as políticas de `UPDATE` e `INSERT` para impedir reatribuição de dados entre barbearias.
- Publicação Realtime habilitada para atualização instantânea entre operadores:
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas, public.cash_sessions, public.blocked_slots;`

### 4. Limpeza de RPCs Legadas
- `DROP FUNCTION IF EXISTS public.get_available_slots(uuid, text, date);`
- `DROP FUNCTION IF EXISTS public.get_customer_info_by_token(uuid, text);`

### 5. Módulos Profundos e Repositórios Frontend
- `src/modules/comandas/ComandaRepository.ts` & `adapters/SupabaseComandaAdapter.ts`: Métodos de abertura, inclusão de itens, cálculo de totais e liquidação com pagamentos divididos.
- `src/modules/caixa/CaixaRepository.ts`: Consulta de sessão aberta, abertura com fundo de troco e fechamento consolidado.
- `src/modules/bloqueios/BloqueioRepository.ts`: Criação e exclusão de bloqueios na grade.

### 6. Interface e Experiência do Usuário (`Agenda.tsx`)
- **Algoritmo de Colunas Concorrentes (Split Grid 50%/50%)**: Cálculo prévio de sobreposição temporal de agendamentos por barbeiro para distribuição das propriedades de CSS `left` e `width`.
- **Modal de Checkout de Comanda (`ComandaCheckoutModal.tsx`)**: Exibição de itens, botões dinâmicos `+ Serviço` e `+ Produto`, linhas de desconto e gorjeta, e formulário de múltiplas parcelas/formas de pagamento com calculadora de troco.
- **Modal de Abertura Assistida de Caixa**: Overlay contextual caso não haja caixa aberto ao tentar faturar.
- **Renderização de Bloqueios**: Cards estilizados com classe `.timeline-blocked-card` e ação de exclusão.
- **Seletor de Escopo Temporal**: Abas `[ Dia ]` e `[ Semana ]` integradas ao cabeçalho e datepicker rápido popover.

---

## Testing Decisions

- **Testes Unitários de Repositório**:
  - `ComandaRepository.test.ts`: Validação de cálculos de subtotal, descontos, gorjetas, divisão de pagamentos e validação de troco.
  - `CaixaRepository.test.ts`: Validação de abertura e bloqueio de recebimentos sem caixa.
  - `BloqueioRepository.test.ts`: Validação de intervalos e conversão UTC com timezone.
- **Testes de Componente e Regressão (`Agenda.test.tsx`)**:
  - Renderização correta de cards lado a lado (50%/50%) em caso de encaixe concorrente no mesmo slot.
  - Renderização de bloqueios na coluna do barbeiro e clique para remover.
  - Abertura do modal de checkout de comanda ao clicar em "Cobrar".
  - Validação da abertura assistida de caixa se o caixa estiver fechado.
- **Critério de Qualidade**: 100% dos testes da suíte vitest verdes (`npm test`) e build TypeScript limpo (`npm run build`).

---

## Out of Scope

- Emissão e integração de Notas Fiscais Eletrônicas (NFC-e / SAT fiscal) — emissores fiscais permanecem para módulos futuros; apenas comprovantes não-fiscais e recibos em tela/PDF estão no escopo.
- Controle avançado de almoxarifado multi-filiais — o escopo cobre estoque simples unitário por barbearia.
- Comissões dinâmicas progressivas por metas semanais — as comissões utilizam percentual fixo por serviço nesta etapa.
