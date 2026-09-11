# 16 — Contrair a compatibilidade legada

**What to build:** Após a reconciliação comprovada, o sistema deixa de depender dos caminhos e fallbacks antigos e passa a aplicar as restrições finais sem interromper os fluxos funcionais.

**Blocked by:** 15 — Validar reconciliação e desempenho.

**Status:** completed

- [x] Confirmar pelo MCP que o DEV atende aos critérios de preenchimento e integridade definidos no ticket 15.
- [x] Localizar e provar a ausência de consumidores dos caminhos legados antes de removê-los.
- [x] Criar migration nova para constraints finais e revogação de acessos temporários.
- [x] Tornar obrigatórios somente os campos cuja cobertura foi comprovada.
- [x] Remover fallbacks de cálculo atual apenas onde todos os registros elegíveis possuem fonte histórica válida.
- [x] Remover o caminho antigo de escrita somente após todos os repositórios usarem os comandos atômicos.
- [x] Preservar leitura explícita de registros classificados como estimados ou indisponíveis.
- [x] Aplicar a contração somente no DEV pelo MCP.
- [x] Executar novamente reconciliação, advisors, testes de autorização, integração e regressão.
- [x] Documentar condições de promoção e rollback; não promover para produção neste ticket.

**Evidências:** migration `20260910205457_contracao_conservadora_financeiro.sql` aplicada no DEV pelo MCP. Foi adicionada a constraint final de coerência entre status e saldo, e as escritas diretas nas tabelas auditáveis foram revogadas. Os fallbacks legados permanecem deliberadamente porque existem 3 itens estimados no DEV; promoção exige cobertura confirmada, reconciliação sem órfãos e execução das suítes sem regressão.
