# ADR 016: Hub Financeiro Operacional, Ciclo de Caixa Diário e Quitação de Comissões

## Status

Aceita em 2026-08-17.

## Contexto e Problema

No Navalhado, a rota `/financeiro` necessitava de uma definição arquitetural clara entre **Gestão Financeira Operacional** (o dinheiro do dia a dia, abertura/fechamento de gaveta e pagamento de comissões) e **Relatórios e Inteligência de Negócio (BI/DRE Estendido)**.
A mistura de visões analíticas complexas dentro da rotina operacional de frente de caixa sobrecarrega a experiência do gerente e dilui o foco nas tarefas críticas da barbearia:
1. Garantir que a gaveta física de dinheiro seja aberta de manhã com fundo de troco e fechada à noite com conferência exata dos valores;
2. Controlar os saldos de comissões devidos a cada barbeiro e registrar formalmente as quitações e pagamentos efetuados.

## Decisões Tomadas

1. **Separação Canônica entre Operação Financeira e Relatórios Analíticos:**
   - A rota `/financeiro` consolida estritamente as operações financeiras da barbearia.
   - Relatórios analíticos profundos, análises de cohort, DRE estendido e BI são delegados para uma rota futura especializada (`/relatorios`).

2. **Estrutura do Hub Financeiro Operacional em `/financeiro`:**
   - **Header & Cards Consolidados de Indicadores (KPIs):**
     - **Faturamento bruto:** Total apurado em comandas fechadas.
     - **Serviços prestados:** Total faturado exclusivamente em cortes, barbas e procedimentos.
     - **Venda de produtos:** Total faturado em itens de balcão (com indicação de unidades vendidas e custo de reposição).
     - **Comissões a pagar:** Total acumulado devido aos barbeiros.
     - **Faturamento líquido:** Lucro livre da barbearia (`Faturamento - Comissões - Custo de Produtos`).
   - **Aba 1: 🏦 Caixa Diário & Turnos:**
     - Monitoramento em tempo real do estado da sessão de caixa (`cash_sessions`): *Aberta* ou *Fechada*.
     - Ação de **Abertura de Caixa do Turno** com declaração do Fundo de Troco Inicial.
     - Ação de **Fechamento de Caixa com Conferência** onde o operador informa o valor contado na gaveta física para confronto com as entradas em dinheiro do turno.
     - Histórico discriminado de sessões anteriores.
   - **Aba 2: ✂️ Repasses & Quitação de Comissões:**
     - Painel consolidado por barbeiro com total acumulado de comissões a pagar.
     - Detalhamento dos atendimentos e produtos que compõem o saldo do profissional.
     - Ação de **Registrar Pagamento de Comissão**, persistindo na tabela `public.commission_payouts` a quitação (total ou parcial) com data, método de pagamento (PIX, Dinheiro do Caixa, Transferência) e observações.

3. **Criação da Tabela `public.commission_payouts` com RLS Multi-Tenant:**
   - Registro imutável de quitações de comissões (`id`, `tenant_id`, `professional_id`, `amount`, `payment_method`, `notes`, `paid_at`, `created_by`, `created_at`).
   - Políticas RLS rigorosas permitindo leitura e inserção apenas para gerentes e proprietários autenticados do respectivo tenant.

## Consequências

- O gerente obtém controle diário absoluto do fluxo de caixa e da gaveta de dinheiro.
- A equipe de barbeiros ganha transparência total sobre comissões acumuladas e histórico de repasses já pagos.
- O código do frontend fica modular, coeso e limpo, evitando sobrecarga com gráficos de BI que pertencerão à futura rota de relatórios.
