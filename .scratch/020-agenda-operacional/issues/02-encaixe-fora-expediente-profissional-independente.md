# 02 — Implementar encaixe fora do expediente com profissional independente

**What to build:** Permitir registrar e visualizar encaixes em qualquer data, horário ou dia, selecionando qualquer profissional ativo, mesmo fora da escala dele, sem remover o intervalo ou os conflitos/capacidade atuais.

**Blocked by:** 01 — Sincronizar expediente e intervalo com a Agenda

**Status:** completed

- [x] Um encaixe pode ser criado no passado, presente ou futuro, inclusive em dia fechado e antes/depois do expediente do tenant.
- [x] O horário do encaixe é validado pelo `slotIntervalMinutes` atual do tenant; com intervalo de 30 minutos, `07:00`, `07:30` e `22:30` são aceitos e `07:17` é rejeitado.
- [x] A seleção do profissional para encaixe considera apenas profissional ativo e não excluído, sem exigir que ele esteja trabalhando naquele dia/horário ou fora do intervalo dele.
- [x] Agendamentos normais continuam sujeitos ao expediente, escala, intervalo, quebras, antecedência e restrições de data existentes.
- [x] Conflitos e capacidade continuam preservados: a regra vigente de agendamento normal mais um encaixe permanece, e um encaixe conflitante adicional para o mesmo profissional é rejeitado.
- [x] O encaixe fora do expediente aparece nos cards existentes desktop e mobile, com cor distinta e identificação textual `Encaixe`.
- [x] A timeline expande somente o necessário para exibir o encaixe e não transforma o horário excepcional em expediente oficial.
- [x] Existem testes para dia fechado, fora do expediente, passado/futuro, profissional fora da escala, intervalo inválido, normal + encaixe e segundo encaixe conflitante.
