# 05 — Bloqueio de Horários na Grade e Atualização do RPC do Canal do Cliente

**What to build:**
Permitir o bloqueio de intervalos de tempo para barbeiros (almoço, folga, consultas), renderizando cards cinza listrados na grade operacional e subtraindo automaticamente esses horários da oferta pública no Canal do Cliente via RPC.

**Blocked by:** 02 — Repositórios de Domínio (ComandaRepository, CaixaRepository, BloqueioRepository) e Testes.

**Status:** ready-for-agent

- [ ] Criar modal e ação rápida de bloqueio de horário ("+ Bloquear") na grade por barbeiro e intervalo de horas.
- [ ] Renderizar cards visuais com classe `.timeline-blocked-card` e sinalização de bloqueio (motivo exibido).
- [ ] Ação rápida de exclusão/desbloqueio ao clicar no card de bloqueio com confirmação.
- [ ] Atualizar a função RPC `get_available_slots_by_token` no Postgres para subtrair intervalos de `blocked_slots` dos horários livres gerados.
- [ ] Testes unitários e de integração validando bloqueios na grade e na RPC do Canal do Cliente.
