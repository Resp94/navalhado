# 06: Provas em produção e registro na spec

**What to build:** o gerente, o barbeiro e o cliente passam a ter em produção o que as specs 040 a 045 e as correções de 22/09 entregam, e isso fica provado no próprio site de produção e registrado na spec 046. As provas não podem mandar WhatsApp para cliente real: produção tem instância conectada.

**Blocked by:** 05 — Janela de promoção

**Status:** ready-for-agent

- [ ] Nenhum Agendamento de prova é criado para cliente com telefone. Agendamento de prova usa Sem cadastro (Balcão) e é cancelado logo depois com o motivo "Prova da promoção".
- [ ] Gerente cancela um Agendamento pela Agenda informando motivo, e o cancelamento é gravado.
- [ ] Gerente cancela pela tela de Comandas informando motivo, e o cancelamento é gravado.
- [ ] O Painel de Cancelados do Dia mostra os dois cancelamentos com autoria "Barbearia" e o motivo.
- [ ] O cabeçalho do Caixa mostra o horário no fuso do tenant.
- [ ] Na Minha Agenda do barbeiro em desktop, a Grade Temporal aparece travada nele, e o Bloquear horário oferece só ele.
- [ ] No Canal do Cliente, "Próximos horários" lista só o que ainda vai acontecer.
- [ ] Nos Relatórios, o período escolhido é mantido ao trocar de página.
- [ ] Os registros de prova ficam cancelados em produção; nenhum Agendamento ativo de prova sobra.
- [ ] A spec 046 ganha uma seção com a data e o horário da janela, o commit de merge na `main` e o resultado de cada prova.
- [ ] Qualquer prova que falhe vira uma correção na `dev`, testada e promovida pela mesma sequência; nada é editado direto na `main`.
