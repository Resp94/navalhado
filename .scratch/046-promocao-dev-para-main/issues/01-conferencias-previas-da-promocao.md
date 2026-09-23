# 01: Conferências prévias da promoção

**What to build:** antes de tocar em produção, provar que o ponto de partida da spec 046 continua valendo. O git precisa estar como estava quando o plano foi feito, e os dados de produção não podem violar as duas regras que viram índice único na spec 040. Se algo mudou, a promoção para aqui e o plano é revisto antes de seguir.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `dev` e `main` locais iguais aos remotos depois de um `fetch`.
- [ ] `main` ainda em `903b6e9`, sem commit novo feito direto nela.
- [ ] Merge-base entre `main` e `dev` ainda `3c90e6e`.
- [ ] A spec 046 e estes tickets estão commitados na `dev`, porque a promoção leva junto o registro do plano.
- [ ] Em produção (`boakqstrdfqmsrwnjore`, só leitura): nenhum Agendamento com mais de uma Comanda aberta.
- [ ] Em produção: nenhum Encaixe ativo (`pending`, `confirmed`, `in_progress`) duplicado para o mesmo profissional e horário.
- [ ] Em produção: a última migration registrada ainda é a `038_relatorios_ticket11_origem_dos_clientes`, e nenhuma das 22 migrations da spec 046 aparece no histórico.
- [ ] Em produção: todo profissional ativo tem ao menos um vínculo profissional-serviço habilitado (regra de vínculo obrigatório).
- [ ] O resultado de cada conferência fica anotado neste ticket, com data.
