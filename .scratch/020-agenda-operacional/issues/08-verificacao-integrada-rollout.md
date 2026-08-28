# 08 — Verificação integrada e rollout seguro

**What to build:** Validar o conjunto completo de mudanças de Agenda, encaixes, bloqueios, profissionais, comandas, no-show e serviços antes da entrega, garantindo que o comportamento normal existente não regrediu.

**Blocked by:** 01 — Sincronizar expediente e intervalo com a Agenda; 02 — Implementar encaixe fora do expediente com profissional independente; 03 — Alinhar bloqueios à interseção tenant + profissional; 04 — Derivar jornada dos profissionais do expediente do tenant; 05 — Corrigir origem da comanda por agendamento; 06 — Registrar no-show e bloquear movimentação financeira; 07 — Compactar cards de serviços no mobile

**Status:** completed

- [x] Suítes focadas de Agenda desktop/mobile, schedule, bloqueios, profissionais, comandas, Configurações, no-show e serviços passam.
- [x] A suíte completa de testes passa sem regressões.
- [x] Lint e build de produção passam.
- [x] Testes de banco e migration aplicada passam, incluindo advisors de segurança/performance sem regressão introduzida.
- [x] A lista de migrations aplicada no Supabase contém a migration versionada esperada.
- [x] A matriz manual cobre desktop, tablet e mobile 390px, dois intervalos de tenant, dias abertos/fechados, encaixe fora do expediente, profissional fora da escala, conflitos, bloqueios, badges e no-show.
- [x] Fluxos existentes de agendamento normal, criação automática de comanda, cancelamento, checkout válido, notificações e WhatsApp continuam funcionais.
