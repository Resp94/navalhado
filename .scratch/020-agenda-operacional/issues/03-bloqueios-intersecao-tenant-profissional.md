# 03 — Alinhar bloqueios à interseção tenant + profissional

**What to build:** Fazer o modal de bloqueio gerar somente slots normais pertencentes à interseção entre o expediente do tenant e a disponibilidade do profissional selecionado.

**Blocked by:** 01 — Sincronizar expediente e intervalo com a Agenda

**Status:** completed

- [x] O modal considera o expediente correspondente ao dia da semana selecionado.
- [x] Dia fechado do tenant não apresenta slots normais para bloqueio.
- [x] Em dia aberto, o expediente do tenant é o limite externo; uma jornada profissional mais ampla nunca expande esse limite.
- [x] Uma jornada profissional mais estreita reduz a janela disponível dentro do expediente do tenant.
- [x] Intervalos, agendamentos existentes e bloqueios existentes continuam excluindo slots indisponíveis.
- [x] O modal reage à alteração de `slotIntervalMinutes` e aos novos horários de Configurações sem usar dados antigos.
- [x] Existem testes para tenant mais amplo, profissional mais amplo, profissional mais restrito, dia fechado, intervalo e conflitos existentes.
