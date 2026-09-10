# 15 — Validar reconciliação e desempenho

**What to build:** O conjunto novo é comprovado no DEV com resultados reconciliados, isolamento preservado, consultas adequadas e nenhuma regressão nos fluxos atuais.

**Blocked by:** 09 — Usar snapshots nas métricas históricas; 11 — Aplicar quitações às obrigações; 12 — Estornar obrigações na reabertura; 14 — Preencher o histórico recuperável.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP todas as funções, policies, grants, constraints e advisors finais do escopo.
- [ ] Reconciliar uma amostra manual de receita, recebimentos, CMV, comissão, saldo e caixa.
- [ ] Comparar métricas antigas e novas, explicando toda diferença esperada.
- [ ] Confirmar que mudanças em preços, custos e percentuais não alteram fatos fechados.
- [ ] Executar cenários multi-tenant, usuário inativo, papel não autorizado e acesso anônimo.
- [ ] Executar cenários concorrentes de finalização, reabertura, quitação e fechamento de caixa.
- [ ] Medir as consultas principais e revisar planos de execução no volume disponível.
- [ ] Criar índice adicional somente quando a medição demonstrar benefício.
- [ ] Executar todas as suítes relacionadas e a suíte geral da aplicação.
- [ ] Confirmar ausência de pagamentos, movimentos, snapshots ou obrigações órfãos.
- [ ] Registrar evidências suficientes para decidir sobre a contração, sem promover para produção.
