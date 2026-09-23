# 01: Conferências prévias da promoção

**What to build:** antes de tocar em produção, provar que o ponto de partida da spec 046 continua valendo. O git precisa estar como estava quando o plano foi feito, e os dados de produção não podem violar as duas regras que viram índice único na spec 040. Se algo mudou, a promoção para aqui e o plano é revisto antes de seguir.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] `dev` e `main` locais iguais aos remotos depois de um `fetch`. — **main** igual (`903b6e9`). **dev** local está 1 commit à frente do remoto: `d67d5da` (`docs(specs): planeja a promocao de dev para main`) não foi empurrado ainda. Bloqueia este critério até o push acontecer.
- [x] `main` ainda em `903b6e9`, sem commit novo feito direto nela. — confirmado.
- [x] Merge-base entre `main` e `dev` ainda `3c90e6e`. — confirmado (`git merge-base main dev` = `3c90e6ee846e1edb02d1f7ab22d8eae5fba9609e`).
- [x] A spec 046 e estes tickets estão commitados na `dev`, porque a promoção leva junto o registro do plano. — commit `d67d5da`, presente na `dev` local; falta o push para o remoto.
- [x] Em produção (`boakqstrdfqmsrwnjore`, só leitura): nenhum Agendamento com mais de uma Comanda aberta. — 0 linhas.
- [x] Em produção: nenhum Encaixe ativo (`pending`, `confirmed`, `in_progress`) duplicado para o mesmo profissional e horário. — 0 linhas (mesma query do índice único de `040_ticket09`).
- [x] Em produção: a última migration registrada ainda é a `038_relatorios_ticket11_origem_dos_clientes`, e nenhuma das 22 migrations da spec 046 aparece no histórico. — confirmado via `list_migrations`.
- [x] Em produção: todo profissional ativo tem ao menos um vínculo profissional-serviço habilitado (regra de vínculo obrigatório). — 0 profissionais ativos sem vínculo habilitado.
- [x] O resultado de cada conferência fica anotado neste ticket, com data. — 2026-09-23.

**Resultado 2026-09-23:** todas as conferências de produção passam. Único pendente: push da `dev` local (`d67d5da`) para o remoto — aguardando pedido explícito do usuário antes de empurrar (regra do projeto: só push quando pedido).
