# 05 — Corrigir origem da comanda por agendamento

**What to build:** Corrigir o enriquecimento das comandas para que o badge de origem use o relacionamento existente com o atendimento e distinga corretamente encaixe, agendamento normal e balcão/avulsa.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Comanda vinculada a atendimento com `is_fitting = true` exibe `Encaixe`.
- [ ] Comanda vinculada a atendimento com `is_fitting = false` exibe `Agendamento`.
- [ ] Comanda sem atendimento vinculado permanece identificada como balcão/avulsa.
- [ ] A origem nunca é inferida pelo horário, cliente, itens ou status da comanda.
- [ ] O enriquecimento preserva corretamente `true`, `false` e ausência/nulo.
- [ ] O comportamento é consistente nos cards e fluxos desktop/mobile existentes.
- [ ] Existem testes para os três tipos de origem e para o formato objeto/array da relação retornada pelo Supabase.


