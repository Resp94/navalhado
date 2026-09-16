# 13 — Registrar ajustes posteriores de caixa

**What to build:** Uma correção posterior a um fechamento preserva a fotografia original do caixa e cria um ajuste separado, identificado e auditável.

**Blocked by:** 07 — Fechar caixa atomicamente.

**Status:** completed

- [x] Consultar pelo MCP as sessões fechadas, movimentos e regras de acesso no DEV.
- [x] Definir quais papéis podem registrar ajustes e quais justificativas são obrigatórias.
- [x] Criar migration nova para eventos de ajuste sem permitir sobrescrita do fechamento original.
- [x] Vincular cada ajuste à sessão, tenant, responsável, instante, motivo e valores afetados.
- [x] Manter valor esperado, contado e diferença originais imutáveis pelo fluxo normal.
- [x] Exibir ou retornar a posição original e o total ajustado sem confundir os dois conceitos.
- [x] Rejeitar usuário inativo, papel não autorizado e tenant divergente.
- [x] Impedir edição ou exclusão direta de ajustes auditáveis.
- [x] Aplicar no DEV via MCP e validar isolamento, imutabilidade e reconciliação.
- [x] Manter o histórico atual de caixa compatível durante a expansão.

**Evidências:** migration `20260910204509_ajustes_posteriores_caixa.sql` aplicada no DEV pelo MCP; teste `supabase/tests/database/13_ajustes_posteriores_caixa.test.sql` aprovado com 12/12 asserções. O fechamento original permanece intacto e o ajuste retorna os valores original e ajustado separadamente.
