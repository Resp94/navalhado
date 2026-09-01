# 03 — Paridade do encaixe na Agenda desktop e mobile

**What to build:** Encaixes criados pela grade ou por horário personalizado aparecem na Agenda desktop e mobile no horário exato, em ordem cronológica, com duração visual e controles operacionais preservados.

**Blocked by:** 01 — Seam de horário para encaixes

**Status:** ready-for-agent

- [ ] Renderizar encaixe personalizado mesmo sem existir slot padrão correspondente.
- [ ] Ordenar os cards pelo horário local real do tenant.
- [ ] Posicionar e dimensionar o card conforme o início e o fim persistidos.
- [ ] Manter selo de encaixe, estado de pagamento, estado do atendimento e ações atuais.
- [ ] Preservar a ação direta de encaixe em dias passados, atuais e futuros.
- [ ] Garantir o mesmo horário e a mesma classificação no desktop e no mobile.
- [ ] Não deslocar, recriar ou alterar a grade normal por causa de um encaixe personalizado.
- [ ] Cobrir visualização de encaixe antes, dentro e depois do expediente.
- [ ] Cobrir viewport mobile de 390 x 844 no navegador integrado.
