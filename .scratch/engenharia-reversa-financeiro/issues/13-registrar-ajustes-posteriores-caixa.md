# 13 — Registrar ajustes posteriores de caixa

**What to build:** Uma correção posterior a um fechamento preserva a fotografia original do caixa e cria um ajuste separado, identificado e auditável.

**Blocked by:** 07 — Fechar caixa atomicamente.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP as sessões fechadas, movimentos e regras de acesso no DEV.
- [ ] Definir quais papéis podem registrar ajustes e quais justificativas são obrigatórias.
- [ ] Criar migration nova para eventos de ajuste sem permitir sobrescrita do fechamento original.
- [ ] Vincular cada ajuste à sessão, tenant, responsável, instante, motivo e valores afetados.
- [ ] Manter valor esperado, contado e diferença originais imutáveis pelo fluxo normal.
- [ ] Exibir ou retornar a posição original e o total ajustado sem confundir os dois conceitos.
- [ ] Rejeitar usuário inativo, papel não autorizado e tenant divergente.
- [ ] Impedir edição ou exclusão direta de ajustes auditáveis.
- [ ] Aplicar no DEV via MCP e validar isolamento, imutabilidade e reconciliação.
- [ ] Manter o histórico atual de caixa compatível durante a expansão.
