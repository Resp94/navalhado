# 05 — Corrigir origem da comanda por agendamento

**What to build:** Corrigir o enriquecimento das comandas para que o badge de origem use o relacionamento existente com o atendimento e distinga corretamente encaixe, agendamento normal e balcão/avulsa.

**Blocked by:** None — can start immediately

**Status:** completed

- [x] Comanda vinculada a atendimento com `is_fitting = true` exibe `Encaixe`.
- [x] Comanda vinculada a atendimento com `is_fitting = false` exibe `Agendamento`.
- [x] Comanda sem atendimento vinculado permanece identificada como balcão/avulsa.
- [x] A origem nunca é inferida pelo horário, cliente, itens ou status da comanda.
- [x] O enriquecimento preserva corretamente `true`, `false` e ausência/nulo.
- [x] O comportamento é consistente nos cards e fluxos desktop/mobile existentes.
- [x] Existem testes para os três tipos de origem e para o formato objeto/array da relação retornada pelo Supabase.
