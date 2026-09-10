# 16 — Contrair a compatibilidade legada

**What to build:** Após a reconciliação comprovada, o sistema deixa de depender dos caminhos e fallbacks antigos e passa a aplicar as restrições finais sem interromper os fluxos funcionais.

**Blocked by:** 15 — Validar reconciliação e desempenho.

**Status:** ready-for-agent

- [ ] Confirmar pelo MCP que o DEV atende aos critérios de preenchimento e integridade definidos no ticket 15.
- [ ] Localizar e provar a ausência de consumidores dos caminhos legados antes de removê-los.
- [ ] Criar migration nova para constraints finais e revogação de acessos temporários.
- [ ] Tornar obrigatórios somente os campos cuja cobertura foi comprovada.
- [ ] Remover fallbacks de cálculo atual apenas onde todos os registros elegíveis possuem fonte histórica válida.
- [ ] Remover o caminho antigo de escrita somente após todos os repositórios usarem os comandos atômicos.
- [ ] Preservar leitura explícita de registros classificados como estimados ou indisponíveis.
- [ ] Aplicar a contração somente no DEV pelo MCP.
- [ ] Executar novamente reconciliação, advisors, testes de autorização, integração e regressão.
- [ ] Documentar condições de promoção e rollback; não promover para produção neste ticket.
