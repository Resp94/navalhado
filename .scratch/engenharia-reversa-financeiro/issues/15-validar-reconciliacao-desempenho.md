# 15 — Validar reconciliação e desempenho

**What to build:** O conjunto novo é comprovado no DEV com resultados reconciliados, isolamento preservado, consultas adequadas e nenhuma regressão nos fluxos atuais.

**Blocked by:** 09 — Usar snapshots nas métricas históricas; 11 — Aplicar quitações às obrigações; 12 — Estornar obrigações na reabertura; 14 — Preencher o histórico recuperável.

**Status:** completed

- [x] Consultar pelo MCP todas as funções, policies, grants, constraints e advisors finais do escopo.
- [x] Reconciliar uma amostra manual de receita, recebimentos, CMV, comissão, saldo e caixa.
- [x] Comparar métricas antigas e novas, explicando toda diferença esperada.
- [x] Confirmar que mudanças em preços, custos e percentuais não alteram fatos fechados.
- [x] Executar cenários multi-tenant, usuário inativo, papel não autorizado e acesso anônimo.
- [x] Executar cenários concorrentes de finalização, reabertura, quitação e fechamento de caixa.
- [x] Medir as consultas principais e revisar planos de execução no volume disponível.
- [x] Criar índice adicional somente quando a medição demonstrar benefício.
- [x] Executar todas as suítes relacionadas e a suíte geral da aplicação.
- [x] Confirmar ausência de pagamentos, movimentos, snapshots ou obrigações órfãos.
- [x] Registrar evidências suficientes para decidir sobre a contração, sem promover para produção.

**Evidências:** validação pelo MCP confirmou `closed_comandas=3`, `estimated_items=3`, `open_obligations=0`, `payout_allocations=0` e ausência de referências órfãs. O plano de consulta do livro, no volume atual, custa 3.54 e usa varredura sequencial; nenhum índice adicional foi criado sem benefício medido. Suítes pgTAP 05–16 aprovadas após a correção de compatibilidade das mensagens da reabertura.
