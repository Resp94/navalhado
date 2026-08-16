# Especificação Técnica: Módulo de Cadastros (Fase 1) - Central 360 de Clientes, Associação N:N de Serviços e Autonomia de Profissionais

## Problem Statement

Após a consolidação da grade temporal contínua e do ciclo de comandas (ADRs 012 e 013), identificou-se a necessidade de evoluir o núcleo de cadastros do Navalhado para atingir a maturidade observada na engenharia reversa do AppBarber e atender às dores reais identificadas em pesquisas com barbeiros e gestores:

1. **Visão Fragmentada e Ausência de Dossiê do Cliente (Central 360):** O cadastro de clientes atual em `public.customers` armazena apenas dados superficiais (nome, telefone e email). O gerente não consegue consultar em um único lugar o histórico completo de atendimentos, comandas pagas, ticket médio, total gasto acumulado (LTV) e preferências com etiquetas temáticas (tags).
2. **Homônimos e Falta de Sobrenome no Agendamento Público:** O fluxo público permitia o envio de apenas um primeiro nome solto, gerando confusão operacional entre clientes com o mesmo nome na recepção da barbearia.
3. **Associação de Serviços Engessada e Falta de Autonomia do Barbeiro:** O sistema tratava a duração e comissão de serviços de forma global e estática. Barbeiros seniores e iniciantes trabalham em ritmos diferentes, e a pesquisa com profissionais confirmou a demanda para que o próprio barbeiro tenha autonomia para calibrar seu tempo de atendimento (com padrão de mercado fixado em 40 minutos), além de comissões diferenciadas por tipo de serviço.
4. **Falta de Parâmetros de Retorno e Precificação Flexível em Serviços:** Serviços não possuíam parametrização de dias para retorno (`return_period_days`) nem templates personalizados de WhatsApp para reativação automática, além de não suportarem a modalidade "A partir de" para procedimentos de valor variável.
5. **Existência de Tabela Legada e Políticas de Segurança Genéricas:** A tabela `public.payments` (v1) permaneceu no banco em ambiente de desenvolvimento mesmo após a migração para o ecossistema de comandas, com a RPC `get_tenant_financial_metrics` ainda apontando para ela. Além disso, as novas tabelas demandam políticas RLS estritamente granulares (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) para conformidade com as diretrizes do Supabase.

---

## Solution

Implementar a **Fase 1 do Módulo de Cadastros Avançado** no Navalhado, fundamentada no [ADR 014](file:///c:/Projetos/navalhado/docs/adr/014_associacao_servicos_profissionais_e_central_360.md), [ADR 015](file:///c:/Projetos/navalhado/docs/adr/015_navegacao_navbar_e_gaveta_360.md) e nas melhores práticas do Supabase / Postgres:

1. **Migração Versionada do Banco (Supabase DEV - Migração 018):**
   - Criação da migração `20260816110000_018_cadastros_fase1_clientes_360_e_servicos_profissionais.sql`.
   - Expansão de `public.customers`: adição de `birth_date` (data de nascimento), `tags` (array de texto com índice GIN), `acquisition_channel` (canal de aquisição) e `cpf`.
   - Expansão de `public.services`: adição de `return_period_days` (tempo de retorno em dias), `custom_reminder_template` (template de mensagem de retorno) e `price_type` (`fixed` ou `starting_at`), ajustando a duração padrão para 40 minutos.
   - Criação da tabela associativa `public.professional_services` (N:N) com `custom_duration_minutes` e `custom_commission_percentage`, com RLS granular.
   - Script de povoamento inicial (*backfill*) associando profissionais e serviços existentes com padrão de 40 minutos.
   - Refatoração da RPC `get_tenant_financial_metrics` para consolidar dados diretamente de `public.comandas`, `public.comanda_itens` e `public.comanda_pagamentos`.
   - Remoção definitiva da tabela legada `public.payments` (`DROP TABLE IF EXISTS public.payments CASCADE;`).
   - Atualização das RPCs `get_available_slots` (respeitando a duração customizada do profissional) e `complete_customer_registration` (exigindo Nome e Sobrenome).

2. **Obrigatoriedade de Nome e Sobrenome no Fluxo do Cliente:**
   - Validação no frontend (`CadastroInicialCliente.tsx`) e backend exigindo nome completo (ao menos duas palavras).

3. **Central 360 do Cliente em Drawer Lateral GSAP:**
   - Na tela `/clientes`, ao selecionar um cliente, abre-se uma gaveta lateral deslizante à direita sem perder a tabela de contexto ao fundo.
   - Aba 1 (Dados e Tags): Edição cadastral, etiquetas coloridas com seletor rápido e canal de aquisição.
   - Aba 2 (Histórico Unificado): Linha do tempo integrando agendamentos e comandas com discriminação de itens.
   - Aba 3 (Métricas e LTV): Total investido acumulado, ticket médio, total de visitas e frequência média em dias.
   - Ações rápidas de cabeçalho: Enviar WhatsApp, Nova Comanda e Novo Agendamento.

4. **Gerenciador de Serviços e Comissões por Profissional:**
   - Na tela `/profissionais`, modal com controle individual de serviços habilitados, permitindo ao profissional/gerente sobrescrever duração (padrão 40 min) e comissão específica.

5. **Módulo de Produtos e Gestão de Estoque (`/produtos`):**
   - Na tela `/produtos` (acessada na Navbar superior via `PackageIcon`), gerenciamento completo de itens de vitrine (`retail`) e insumos de bancada (`internal_use`).
   - Leitor de código de barras EAN-13, ponto de reposição (`min_stock_alert`), comissão de venda de balcão e badges visuais de estoque baixo.

6. **Validação Visual Obrigatória no Navegador:**
   - Após cada fase de implementação, realizar verificação visual automatizada no navegador (`http://localhost:5173`) confirmando renderização, responsividade, animações GSAP e fidelidade aos ícones existentes do Hugeicons.


---

## User Stories

### A. Clientes e Central 360
1. As a Gerente, I want to click any customer in the table to open a smooth slide-over Drawer (Central 360) without losing my place in the list.
2. As a Gerente in the Central 360 Drawer, I want to view and edit the customer's birthday, acquisition channel, CPF, and internal notes.
3. As a Gerente in the Central 360 Drawer, I want to add and remove colorful custom tags (e.g., "VIP", "Barba Longa", "Exigente") to categorize client profiles.
4. As a Gerente in the Central 360 Drawer, I want an aggregated financial tab displaying total spend (LTV), average ticket, total visits, and average days between visits.
5. As a Gerente in the Central 360 Drawer, I want a unified timeline tab showing past appointments (status, date, barber, service) and paid Comandas with full itemized details.
6. As a Gerente in the Central 360 Drawer, I want 1-click action buttons in the header to open WhatsApp directly or initiate a new Comanda/Appointment.
7. As a Gerente on the Customers page, I want to filter the table by clicking active tags to quickly isolate specific client segments.

### B. Cadastro Público e Validação de Sobrenome
8. As a Client booking online, I want the initial registration form to validate that I provided my full name (first name and surname), avoiding confusion with other clients who share my first name.
9. As a Client booking online with a single word name, I want a clear and friendly inline warning asking for my full name before submitting.

### C. Profissionais e Associação N:N de Serviços
10. As a Barbeiro or Gerente, I want to customize the execution duration for each specific service I offer (e.g., 25 min for Senior, 45 min for Junior), overriding the 40-minute system default.
11. As a Barbeiro or Gerente, I want to define a specific commission percentage for individual services (e.g., 50% on haircuts, 30% on chemical treatments).
12. As a Gerente in the Professionals management modal, I want to enable or disable specific services for a barber with 1 click.
13. As a Client on the booking channel, I want the available time slots to accurately reflect the custom duration of the selected barber, avoiding scheduling gaps or delays.

### D. Serviços, Tempo de Retorno e Modalidades de Preço
14. As a Gerente creating or editing a service, I want to configure the estimated return interval in days (`return_period_days`, e.g., 20 days) and a custom WhatsApp reminder message template.
15. As a Gerente, I want to mark services as "Preço Fixo" (`fixed`) or "A partir de" (`starting_at`), making pricing clear for procedures with variable length or complexity.

### E. Produtos e Gestão de Estoque
16. As a Gerente navigating via the top navbar, I want to click on "Produtos" (`PackageIcon`) to access the complete inventory and retail catalog.
17. As a Gerente on the Products page, I want to filter products by usage type ("Todos", "Venda Balcão", "Insumo de Bancada") and search by name or barcode (EAN-13).
18. As a Gerente, I want products with stock equal to or below `min_stock_alert` to display a semantic warning badge ("Estoque Baixo"), highlighting items that need immediate replenishment.
19. As a Gerente in the Product Modal (Double-Bezel), I want to create or edit items with brand, category, cost price, retail price, stock quantity, min stock alert, barcode, and barber sales commission percentage.

### F. Integridade do Banco e Limpeza de Legados
20. As a Developer, I want all database security policies on new tables to be strictly granular (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) with authenticated tenant isolation.
21. As a Gerente viewing the Financial Dashboard, I want all revenue, payment method breakdowns, and commission metrics to calculate strictly from `public.comandas` and `public.comanda_pagamentos`.
22. As a Developer, I want the legacy `public.payments` table safely dropped from the development database without breaking existing reports.


---

## Implementation Decisions

### 1. Migração de Banco de Dados (`018_cadastros_fase1_clientes_360_e_servicos_profissionais.sql`)

- **Alterações em `public.customers`**:
  - `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date DATE NULL;`
  - `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];`
  - `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS acquisition_channel TEXT NULL;`
  - `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf TEXT NULL;`
  - `CREATE INDEX IF NOT EXISTS idx_customers_tenant_birth_date ON public.customers (tenant_id, birth_date);`
  - `CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN (tags);`

- **Alterações em `public.services`**:
  - `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS return_period_days INTEGER DEFAULT 20;`
  - `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS custom_reminder_template TEXT NULL;`
  - `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'starting_at'));`
  - `ALTER TABLE public.services ALTER COLUMN duration_minutes SET DEFAULT 40;`

- **Estrutura Expandida de `public.products`**:
  ```sql
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'retail' CHECK (product_type IN ('retail', 'internal_use'));
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0);
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'un' CHECK (unit_type IN ('un', 'cx', 'kg', 'lt', 'ml'));
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NULL CHECK (commission_percentage IS NULL OR (commission_percentage >= 0 AND commission_percentage <= 100));

  CREATE INDEX IF NOT EXISTS idx_products_tenant_type ON public.products (tenant_id, product_type);
  CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON public.products (tenant_id, barcode) WHERE barcode IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_products_tenant_low_stock ON public.products (tenant_id, stock_quantity, min_stock_alert);
  ```

- **Tabela de Auditoria e Movimentações de Estoque (`public.product_movements`)**:
  ```sql
  CREATE TABLE IF NOT EXISTS public.product_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry_manual', 'entry_purchase', 'exit_manual', 'exit_sale_comanda', 'exit_internal_use', 'adjustment')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(10,2) NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
    reason TEXT NULL,
    comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
  );

  CREATE INDEX IF NOT EXISTS idx_product_movements_tenant_product ON public.product_movements(tenant_id, product_id);
  CREATE INDEX IF NOT EXISTS idx_product_movements_tenant_type ON public.product_movements(tenant_id, movement_type);
  CREATE INDEX IF NOT EXISTS idx_product_movements_created_at ON public.product_movements(tenant_id, created_at DESC);

  ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

  CREATE POLICY product_movements_select_policy ON public.product_movements
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY product_movements_insert_policy ON public.product_movements
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY product_movements_update_policy ON public.product_movements
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY product_movements_delete_policy ON public.product_movements
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));
  ```

- **Função Atômica de Ajuste de Estoque (`adjust_product_stock`)**:
  - Atualiza atomicamente `products.stock_quantity` e registra a linha de log em `product_movements` em uma única transação protegida com `SET search_path = ''`.


- **Nova Tabela `public.professional_services`**:

  ```sql
  CREATE TABLE IF NOT EXISTS public.professional_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    custom_duration_minutes INTEGER CHECK (custom_duration_minutes IS NULL OR custom_duration_minutes > 0),
    custom_commission_percentage NUMERIC(5,2) CHECK (custom_commission_percentage IS NULL OR (custom_commission_percentage >= 0 AND custom_commission_percentage <= 100)),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_professional_service_per_tenant UNIQUE (tenant_id, professional_id, service_id)
  );

  CREATE INDEX IF NOT EXISTS idx_prof_services_tenant_prof ON public.professional_services(tenant_id, professional_id);
  CREATE INDEX IF NOT EXISTS idx_prof_services_tenant_serv ON public.professional_services(tenant_id, service_id);

  ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

  -- Políticas Granulares (Sem ALL)
  CREATE POLICY prof_services_select_policy ON public.professional_services
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY prof_services_insert_policy ON public.professional_services
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY prof_services_update_policy ON public.professional_services
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

  CREATE POLICY prof_services_delete_policy ON public.professional_services
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));
  ```

- **Backfill Automático Inicial**:
  - Povoa a tabela `professional_services` para todos os pares ativos existentes com `custom_duration_minutes = 40` e comissão herdada do profissional.

- **Atualização da RPC `get_available_slots`**:
  - Consulta `COALESCE(ps.custom_duration_minutes, s.duration_minutes, 40)` para o cálculo dinâmico de intervalos.

- **Refatoração da RPC `get_tenant_financial_metrics`**:
  - Substitui consultas a `public.payments` por agregações em `public.comandas` (`status = 'closed'`) e `public.comanda_pagamentos`.

- **Exclusão de Tabela Legada**:
  - `DROP TABLE IF EXISTS public.payments CASCADE;`

### 2. Frontend e Design System

- **Navbar e Ícones**:
  - Preservar rigorosamente todos os ícones já em uso no `GerenteLayout.tsx` (`Calendar03Icon`, `UserIcon`, `UserGroupIcon`, `ScissorIcon`, `Money01Icon`, `WhatsappIcon`, `Settings02Icon`).
- **Central 360 no `Clientes.tsx`**:
  - Componente Drawer com `gsap.fromTo` (slide-in horizontal da direita com curva bezier).
  - 3 abas limpas com estatísticas calculadas de LTV e histórico discriminado.
- **Validação de Nome no `CadastroInicialCliente.tsx`**:
  - Regex e validação por split de palavras garantindo `parts.length >= 2`.

---

## Testing Decisions

### O que constitui um bom teste
- Testar comportamentos externos observáveis e contratos de dados, sem testar detalhes efêmeros de implementação interna.

### Módulos e Superfícies a serem Testados
1. **Validação de Nome Completo no Cliente:** Testes unitários cobrindo entradas inválidas (apenas um nome, espaços em branco, caracteres especiais) e entradas válidas (nome e sobrenome).
2. **Cálculo de LTV e Métricas da Central 360:** Testes do adaptador de clientes consolidando histórico de comandas e agendamentos.
3. **Associação de Serviços e Duração Customizada:** Testes unitários garantindo herança e sobrescrita de valores.
4. **Validação Visual no Navegador:** Verificação automatizada via Chrome DevTools MCP no endereço `http://localhost:5173` após cada etapa da implementação.

---

## Out of Scope

- Emissão de Nota Fiscal Eletrônica (NFS-e) automatizada.
- Integração de gateway de pagamento online para cobrança recorrente de clubes de assinatura (reservado para a Fase 3).
- Upload e crop de foto de cliente (descartado conforme alinhamento).

---

## Further Notes

- Todas as alterações seguem a paleta Amber do Design System, tipografia Outfit e bordas Double-Bezel.
- O servidor local de desenvolvimento já se encontra ativo na porta 5173 para inspeções visuais contínuas.
