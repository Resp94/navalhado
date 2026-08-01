# 09 — Atualizar domínio, ADRs e documentação vigente

**What to build:** Alinhar o vocabulário e as decisões arquiteturais do Navalhado à integração neutra de WhatsApp com adaptador Uazapi, preservando a história da Evolution sem apresentá-la como arquitetura vigente.

**Blocked by:** 08 — Contrair e remover a Evolution ativa.

**Status:** ready-for-agent

- [ ] “Instância WhatsApp” é definida sem acoplamento à Evolution.
- [ ] O contexto do projeto descreve corretamente os ambientes Dev e Prod e a promoção sequencial da instância piloto.
- [ ] Uma nova ADR registra Uazapi, gateway de segurança, webhook individual, credenciais de backend e nomenclatura neutra.
- [ ] ADRs da Evolution são preservados e marcados como substituídos.
- [ ] Glossário, modelo de banco, rotas, telas, personas e diagramas deixam de apresentar Evolution como decisão atual.
- [ ] A documentação diferencia desconectado de pausado.
- [ ] A documentação registra que Prod somente pode ser alterado mediante comando explícito.
- [ ] Migrações históricas continuam autorizadas a mencionar Evolution.
- [ ] Links técnicos apontam para o contrato oficial Uazapi v2.1.1.
- [ ] Uma revisão por busca textual confirma que referências vigentes e históricas estão classificadas corretamente.

