# ADR 013: Ciclo de Comandas, Sessão de Caixa Diário, Bloqueio de Horários e Grade Avançada

## Status

Aceita em 2026-08-15.

## Contexto

A primeira etapa da migração da rota `/agenda` (ADR 012) estabeleceu a grade temporal contínua diária por profissional, os status de atendimento e o encaixe rápido. No entanto, a análise de engenharia reversa do AppBarber ([docs/engenharia_reversa_appbarber_agenda.md](file:///c:/Projetos/navalhado/docs/engenharia_reversa_appbarber_agenda.md)) e a auditoria do banco de dados revelaram necessidades fundamentais para a maturidade operacional e financeira da barbearia:

1. **Ciclo Financeiro Acoplado:** Atualmente, a cobrança do agendamento insere pagamentos diretos e unitários em `public.payments`. No dia a dia de barbearias, atendimentos frequentemente incluem produtos (pomadas, cosméticos), múltiplos serviços e divisão de formas de pagamento (ex: parte em PIX, parte em Dinheiro).
2. **Controle de Caixa e Sangria:** Falta rastreabilidade contábil do turno de trabalho; recebimentos em dinheiro não são amarrados a uma gaveta/sessão de caixa aberta com fundo de troco inicial.
3. **Indisponibilidade e Bloqueios:** Não há suporte para marcar pausas, almoço ou consultas na grade, impedindo que o motor de agendamento online do cliente oculte esses horários.
4. **Limpeza de Ativos Legados:** Funções RPC obsoletas (`get_available_slots` sem token e `get_customer_info_by_token`) ainda residem no schema do banco.

## Decisão

1. **Ciclo Transacional de Comandas (`public.comandas`):**
   - Agendamentos e vendas de balcão passam a gerar uma **Comanda** em estado `aberta`.
   - Suporte a múltiplos itens em `public.comanda_itens` (serviços prestados com profissional comissionado e produtos físicos com baixa de estoque).
   - Suporte a divisões de pagamento em `public.comanda_pagamentos` (PIX, Cartão de Crédito, Cartão de Débito, Dinheiro físico com cálculo de troco).
   - A finalização da comanda transiciona o agendamento para `completed` e atualiza o evento em tempo real na grade para verde (`#0E9F6E`).

2. **Sessão de Caixa Obrigatória com Abertura Assistida (`public.cash_sessions`):**
   - Criação da tabela `cash_sessions` para controle diário de turnos de caixa por tenant.
   - Ao tentar finalizar uma comanda sem sessão aberta no dia, o modal de checkout oferece abertura imediata em 1 clique (informando o fundo de troco inicial) sem perda de dados preenchidos.

3. **Bloqueio de Horários na Grade (`public.blocked_slots`):**
   - Criação da tabela `blocked_slots` (`professional_id`, `start_time`, `end_time`, `reason`, `is_all_day`).
   - Renderização visual em cards cinza escuro/listrados na grade operacional do gerente.
   - Atualização da função RPC `get_available_slots_by_token` para subtrair automaticamente intervalos bloqueados da oferta pública no Canal do Cliente.

4. **Encaixe e Grid Concorrente (Overbooking Controlado):**
   - No Postgres: A constraint GIST anti-sobreposição é atualizada para `WHERE (status IN ('pending', 'confirmed', 'in_progress') AND is_fitting = false)`, permitindo que o gestor force um encaixe simultâneo para o mesmo profissional.
   - Na Interface da Grade (`Agenda.tsx`): Detecção de intervalos concorrentes no mesmo profissional, dividindo a coluna horizontalmente (50% agendamento normal à esquerda, 50% encaixe à direita) para evitar sobreposição cega de cards.

5. **Estoque de Produtos Simples (`public.products`):**
   - Criação da tabela `products` (`id`, `tenant_id`, `name`, `price`, `cost_price`, `stock_quantity`, `is_active`) para inclusão de itens físicos na comanda com baixa automática de estoque.
   - Posicionamento do módulo completo de catálogo de produtos para a próxima sprint ([docs/engenharia_reversa_appbarber_cadastros.md](file:///c:/Projetos/navalhado/docs/engenharia_reversa_appbarber_cadastros.md)).

6. **Visões Temporais e Recursos de Apoio:**
   - Alternância entre **Visão Dia** (colunas por equipe), **Visão Semana** (visão de 7 dias por barbeiro selecionado) e **Mini-Calendário Rápido** (datepicker popover no header).
   - **Lista de Espera Diária** (`public.waiting_list`) com sugestão automática de encaixe em caso de cancelamento.
   - **Rodízio de Barbeiros** como sugestão inteligente de distribuição de atendimentos de balcão.

7. **Limpeza Versionada de Banco de Dados:**
   - Remoção formal via migração versionada das funções legadas `get_available_slots(uuid, text, date)` e `get_customer_info_by_token(uuid, text)`.

## Consequências

- O ecossistema transacional do Navalhado passa a cobrir 100% da operação real de frente de caixa de barbearias.
- O banco de dados ganha rastreabilidade rigorosa com tabelas isoladas para comandas, pagamentos divididos, sessões de caixa e estoque de produtos.
- O schema do Postgres é limpo e padronizado em migrações versionadas e imutáveis.
