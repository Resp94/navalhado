# Especificação Técnica: Hub Financeiro Operacional, Ciclo de Caixa Diário e Quitação de Comissões

## Problem Statement

Após a consolidação da grade temporal contínua, do ciclo de comandas e da expansão do módulo de cadastros e estoque (ADRs 012, 013, 014 e 015), identificou-se que a rota `/financeiro` no painel do Gerente necessitava de uma reformulação profunda para atender à rotina operacional real da barbearia:

1. **Ausência de Controle Operacional de Caixa na Rota Financeira:** O gerente não possuía uma superfície dedicada para visualizar o status do caixa do dia (aberto ou fechado), abrir o turno com fundo de troco inicial e realizar o fechamento com conferência física do dinheiro na gaveta.
2. **Falta de Discriminação entre Serviços e Produtos de Balcão:** O faturamento bruto não discriminava claramente quanto veio de serviços (cortes e barbas) versus venda de produtos de balcão (pomadas, óleos, ceras), nem apontava o custo das mercadorias vendidas (CMV) para cálculo do lucro líquido real da barbearia.
3. **Inexistência de Registro e Quitação de Comissões:** Não havia mecanismo para o gerente registrar pagamentos e repasses efetuados aos barbeiros, mantendo o histórico de quitações e gerando controle de saldo acumulado versus saldo pendente.
4. **Mistura de Escopos entre Operação e Relatórios:** Gráficos analíticos complexos de BI sobrecarregavam a tela operacional, quando a prioridade do gestor no dia a dia financeiro é controlar a gaveta física e liquidar repasses da equipe.

---

## Solution

Implementar o **Hub Financeiro Operacional** na rota `/financeiro`, alinhado ao [ADR 016](file:///c:/Projetos/navalhado/docs/adr/016_hub_financeiro_caixa_e_quitacao_de_comissoes.md), com separação estrita entre tesouraria diária e a futura rota de relatórios analíticos, garantindo conformidade com as diretrizes do Supabase e melhores práticas de performance do Postgres:

1. **Painel de Indicadores Financeiros Consolidados (KPIs) no Topo:**
   - **Faturamento bruto:** Total faturado em comandas fechadas.
   - **Serviços prestados:** Total apurado em procedimentos de corte, barba e estética.
   - **Venda de produtos de balcão:** Total faturado em itens físicos, com indicador de unidades vendidas e custo de reposição.
   - **Comissões da equipe:** Total devido aos profissionais, com discriminação entre valor já quitado e saldo pendente.
   - **Faturamento líquido da barbearia:** Lucro operacional livre (`Faturamento - Comissões - Custo de Produtos`).

2. **Aba 1: 🏦 Caixa Diário & Turnos (Frente de Caixa e Gaveta):**
   - **Card de Sessão Ativa em Tempo Real:** Monitora a sessão atual em `public.cash_sessions`.
     - Se fechado: Alerta visual com botão de destaque `[+ Abrir caixa do dia]` (solicita Fundo de Troco Inicial).
     - Se aberto: Badge verde pulsante de turno ativo, fundo de troco inicial, recebimentos apurados em dinheiro e botão `[🔒 Fechar caixa do turno]`.
   - **Modal de Fechamento de Caixa com Conferência:**
     - O operador digita o valor contado na gaveta física. O sistema calcula a diferença (sobra ou quebra de caixa) e registra o encerramento do turno com notas.
   - **Tabela de Histórico de Caixas:** Lista cronológica de turnos com data de abertura/fechamento, responsável, valor inicial, valor final conferido e status.

3. **Aba 2: ✂️ Repasses & Quitação de Comissões (Gestão de Pagamento da Equipe):**
   - **Lista de Profissionais:** Exibe avatar, nome, total de atendimentos realizados, total faturado, comissão gerada, valor já pago e saldo pendente.
   - **Detalhamento de Comandas do Barbeiro:** Gaveta/modal expansível detalhando cada item de comanda que compõe o saldo daquele profissional.
   - **Modal de Quitação de Comissões (`public.commission_payouts`):**
     - O gerente registra o pagamento ao barbeiro (valor total ou parcial, método de quitação: PIX, Dinheiro da Gaveta, Transferência, data e observações).
     - Atualização atômica do saldo pendente e persistência no histórico de repasses.

4. **Modelagem de Dados e Otimização Postgres (Supabase - Migração 022):**
   - Criação da tabela `public.commission_payouts` com chaves estrangeiras, índices de busca e RLS granular com subqueries otimizadas `(SELECT auth.uid())`.
   - Atualização da RPC `get_tenant_financial_metrics` para retornar o desdobramento completo de receitas (serviços vs produtos, custo CMV e contagem de itens).
   - Criação da RPC `register_commission_payout` para inserção atômica e segura de repasses.

---

## User Stories

### A. Indicadores e KPIs Financeiros
1. As a Gerente, I want to see consolidated top cards on `/financeiro` for Total Revenue, Services Revenue, Retail Products Revenue (with units sold and cost), Team Commissions, and Net Profit.
2. As a Gerente, I want to filter the financial KPIs by "Este mês", "Últimos 30 dias" and "Últimos 90 dias" with instant recalculation.
3. As a Gerente, I want the net profit calculation to subtract both barber commissions and the product cost price (CMV) to reflect real operational profit.

### B. Gestão de Caixa Diário & Turnos
4. As a Gerente, I want to see an immediate visual banner indicating whether today's cash session is open or closed.
5. As a Gerente, when the cash session is closed, I want an "Abrir caixa do dia" button that prompts for the initial cash float (fundo de troco) and opens the session.
6. As a Gerente, when the cash session is open, I want to see the opening time, initial float, accumulated cash receipts, and a "Fechar caixa do turno" button.
7. As a Gerente closing the shift, I want to input the physically counted cash amount in the drawer so the system can record discrepancies (shortage or surplus) and close the `cash_sessions` record.
8. As a Gerente, I want to browse the history of past cash sessions with timestamps, operator, opening float, closing balance, and notes.

### C. Repasses e Quitação de Comissões
9. As a Gerente, I want an overview table of all active professionals showing their total service/product sales, total commissions earned, total paid out, and remaining pending balance.
10. As a Gerente, I want to click any professional to inspect the itemized list of closed comandas that contributed to their commission.
11. As a Gerente, I want to click "Pagar comissão" on a professional's card to launch a payout modal where I can enter the payout amount, payment method (PIX, Cash, Bank Transfer), date, and notes.
12. As a Gerente, I want the recorded commission payout to be stored in `public.commission_payouts` and immediately deducted from the professional's pending balance.
13. As a Gerente, I want to view a chronological receipt history of past commission payouts made to each barber.

---

## Implementation Decisions

### 1. Schema & Database (Supabase Migração 022)

#### A. Tabela `public.commission_payouts`
```sql
CREATE TABLE public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL, -- 'pix', 'cash', 'transfer', 'other'
  notes text,
  paid_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de Alta Performance (Conforme Supabase Postgres Best Practices)
CREATE INDEX idx_commission_payouts_tenant_id ON public.commission_payouts (tenant_id);
CREATE INDEX idx_commission_payouts_prof_id ON public.commission_payouts (professional_id);
CREATE INDEX idx_commission_payouts_tenant_prof ON public.commission_payouts (tenant_id, professional_id, paid_at DESC);

-- RLS com Subquery Caching (SELECT auth.uid())
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.commission_payouts FROM public, anon;
GRANT SELECT, INSERT ON TABLE public.commission_payouts TO authenticated;

CREATE POLICY "commission_payouts_select_policy" ON public.commission_payouts
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
    OR (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'proprietario'
  );

CREATE POLICY "commission_payouts_insert_policy" ON public.commission_payouts
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
    OR (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'proprietario'
  );
```

#### B. RPC `get_tenant_financial_metrics` (Refatorada)
- Retorna objeto JSON com:
  - `total_revenue`: Soma de `c.total_amount` em comandas fechadas.
  - `services_revenue`: Faturamento de serviços.
  - `products_revenue`: Faturamento de produtos.
  - `products_count`: Unidades de produtos vendidas.
  - `products_cost`: Custo de reposição (CMV) dos produtos vendidos.
  - `total_commission`: Comissões totais geradas no período.
  - `paid_commission`: Comissões quitadas via `commission_payouts` no período.
  - `pending_commission`: Comissões ainda em aberto.
  - `net_revenue`: `total_revenue - total_commission - products_cost`.
  - `revenue_by_method`: Mapa normalizado de faturamento por método de pagamento.
  - `commissions_by_professional`: Array com profissional, comissão gerada, comissão paga, saldo pendente e atendimentos.

#### C. RPC `register_commission_payout`
- Função atômica `SECURITY DEFINER` com `SET search_path TO 'public', 'extensions'` que valida a autorização do usuário e grava o registro em `commission_payouts`.

### 2. Frontend & Componentes (`Financeiro.tsx`)
- **Seletor de Abas no Topo:** `[🏦 Caixa diário & Turnos]` e `[✂️ Repasses de comissões]`.
- **Modais Integrados:**
  - `AberturaAssistidaCaixaModal.tsx` (reutilizado para abertura direta).
  - `FechamentoCaixaModal.tsx` (novo componente acessível para conferência física de gaveta).
  - `QuitacaoComissaoModal.tsx` (novo componente acessível para quitação de comissões).
- **Design System & Acessibilidade:**
  - Cores semânticas via tokens (`--color-brand-primary`, `--color-bg-secondary`, `--color-border`).
  - Animações via transform e scale com suporte a `prefers-reduced-motion`.
  - 100% *Sentence case* e ausência de travessões (`—`) no meio de frases.

---

## Testing Decisions

1. **Test Seams:**
   - Teste de unidade para `CaixaRepository` cobrindo abertura, consulta de sessão ativa e fechamento com conferência.
   - Teste de unidade para o fluxo de quitação de comissões (`commission_payouts`).
   - Teste de componente em `src/pages/gerente/__tests__/Financeiro.test.tsx` cobrindo:
     - Renderização dos 5 KPI cards (Faturamento bruto, Serviços, Produtos, Comissões e Lucro líquido).
     - Troca entre as abas *Caixa diário* e *Repasses de comissões*.
     - Disparo do modal de Abertura de Caixa e Fechamento de Caixa.
     - Disparo do modal de Quitação de Comissão.

---

## Out of Scope

- Relatórios aprofundados de Business Intelligence, gráficos de coorte e DRE gerencial estendido (serão implementados na rota futura `/relatorios`).
- Emissão de nota fiscal de serviço eletrônica (NFS-e).
- Integração bancária direta via Open Finance (pagamento automatizado de PIX pelo sistema).

---

## Further Notes

- A migração respeita estritamente o isolamento multi-tenant e o princípio de privilégio mínimo.
- Todos os testes unitários existentes (142 testes) devem permanecer 100% verdes após a implementação.
