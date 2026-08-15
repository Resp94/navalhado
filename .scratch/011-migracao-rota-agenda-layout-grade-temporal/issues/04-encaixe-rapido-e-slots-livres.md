# 04 — Encaixe Rápido e Agendamento Instantâneo em Slots Livres

**What to build:**
A interatividade de clique direto em células vazias da grade e o fluxo do botão mestre `+ Encaixe`, permitindo abrir o modal de novo agendamento com profissional e horário pré-preenchidos, seleção ou cadastro rápido de cliente, anotações internas (`notes`) e persistência como encaixe (`is_fitting = true`).

**Blocked by:** 01, 02, 03.

**Status:** ready-for-agent

- [ ] Clicar em qualquer slot vazio na grade abre o modal de agendamento com o barbeiro e o horário clicado já selecionados.
- [ ] O botão mestre `+ Encaixe` no cabeçalho abre o modal com a flag de encaixe ativa.
- [ ] O formulário permite alternar entre selecionar um cliente existente ou cadastrar um novo cliente na hora (Nome + WhatsApp).
- [ ] Suporte a campo de observações (`notes`) gravado no registro do agendamento.
- [ ] Agendamento criado aparece imediatamente na grade e persiste no Supabase com `origin = 'manual'`.
