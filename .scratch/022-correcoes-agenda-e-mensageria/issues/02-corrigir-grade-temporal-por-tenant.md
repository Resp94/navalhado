# 02 — Corrigir grade temporal por tenant

**What to build:** uma Agenda em que o intervalo configurado pela barbearia seja aplicado de forma consistente no desktop, mobile, filtros de profissional, intervalo de almoço, encaixes, bloqueios e seletores.

**Blocked by:** 01 — Auditar baseline dos snapshots e migrations.

**Status:** done

- [x] Um tenant configurado com 40 minutos exibe passos de 40 minutos antes e depois do intervalo, sem slots de 20 minutos após o retorno.
- [x] Um tenant configurado com 30 minutos continua exibindo passos de 30 minutos, sem influência de outro tenant.
- [x] O intervalo de almoço apenas remove o período de pausa e não altera o passo da grade.
- [x] Desktop e mobile recebem a mesma sequência de slots para a mesma configuração.
- [x] Agenda, modal de agendamento, encaixe, bloqueio e seletor de horários usam a mesma configuração normalizada.
- [x] Uma alteração válida da configuração atualiza os consumidores sem depender de estado antigo ou reload manual.
- [x] Permanecem aprovados os fluxos de expediente, escala, timezone, antecedência, agendamento público, encaixe e conflito/capacidade previstos nos snapshots.
- [x] Testes focados e regressivos da Agenda passam nos cenários de 30 e 40 minutos, com e sem intervalo.

## Result

- Criadas a normalização do intervalo e a geração unificada da régua em `src/lib/schedule.ts`.
- `Agenda.tsx` passou a gerar a sequência comum para os segmentos da barbearia e dos profissionais.
- Agenda, modal de agendamento, reagendamento direto, bloqueio e opções de escala usam o mesmo intervalo normalizado.
- Escalas explícitas respeitam intervalo e folga; profissionais filtrados e profissionais sem escala explícita não contaminam a régua.
- Validação: Agenda regressiva passou com 58 testes; lint e build TypeScript/Vite passaram.
